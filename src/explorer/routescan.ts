import { decodeEventLog, decodeFunctionResult, encodeFunctionData, getAddress } from "viem";
import type { ChainDef } from "./chains";
import type { DataSource, ExtractedData, ProgressFn, RawTransfer, TokenMeta, TxInfo } from "./types";
import { fetchJson, mapPool } from "./pool";

const MAX_TRANSFERS = 4000;
const PAGE_SIZE = 1000;
const LEG_CONCURRENCY = 5;
const ZERO = "0x0000000000000000000000000000000000000000";

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const TRANSFER_EVENT = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

interface TokenInfo {
  symbol: string;
  decimals: number;
}

export class RoutescanSource implements DataSource {
  label: string;
  private api: string;
  private tokenCache = new Map<string, TokenInfo>();

  constructor(chain: ChainDef) {
    if (!chain.routescanApi) throw new Error("Esta cadena no tiene API Routescan configurada.");
    this.api = chain.routescanApi;
    this.label = `Routescan (${chain.name})`;
  }

  private q(params: Record<string, string | number>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) u.set(k, String(v));
    return `${this.api}?${u.toString()}`;
  }

  // eth_call a view function and decode the result. Returns null on any failure.
  private async ethCall(to: string, fnName: "decimals" | "symbol" | "name", signal?: AbortSignal): Promise<any> {
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: fnName });
    const url = this.q({ module: "proxy", action: "eth_call", to, data, tag: "latest" });
    const res = await fetchJson(url, signal).catch(() => null);
    const hex = res?.result;
    if (!hex || hex === "0x") return null;
    try {
      return decodeFunctionResult({ abi: ERC20_ABI, functionName: fnName, data: hex });
    } catch {
      return null;
    }
  }

  private async tokenInfo(address: string, signal?: AbortSignal): Promise<TokenInfo> {
    const key = address.toLowerCase();
    const cached = this.tokenCache.get(key);
    if (cached) return cached;
    const [dec, sym] = await Promise.all([
      this.ethCall(address, "decimals", signal),
      this.ethCall(address, "symbol", signal),
    ]);
    const info: TokenInfo = {
      decimals: dec != null ? Number(dec) : 18,
      symbol: sym != null ? String(sym) : "?",
    };
    this.tokenCache.set(key, info);
    return info;
  }

  async extract(tokenAddress: string, onProgress: ProgressFn, signal?: AbortSignal): Promise<ExtractedData> {
    onProgress({ phase: "Reading token metadata" });
    const [dec, sym, nm, supplyRes] = await Promise.all([
      this.ethCall(tokenAddress, "decimals", signal),
      this.ethCall(tokenAddress, "symbol", signal),
      this.ethCall(tokenAddress, "name", signal),
      fetchJson(this.q({ module: "stats", action: "tokensupply", contractaddress: tokenAddress }), signal).catch(() => null),
    ]);
    const decimals = dec != null ? Number(dec) : 18;
    const token: TokenMeta = {
      address: tokenAddress,
      name: nm != null ? String(nm) : "Token",
      symbol: sym != null ? String(sym) : "?",
      decimals,
      totalSupply: supplyRes?.result ? String(supplyRes.result) : "0",
      holders: null,
      type: "ERC-20",
    };
    this.tokenCache.set(tokenAddress.toLowerCase(), { decimals, symbol: token.symbol });

    onProgress({ phase: "Downloading token transfers" });
    const assetTransfers: RawTransfer[] = [];
    const methodByTx: Record<string, string | null> = {};
    const txMeta: Record<string, { timestamp: string | null; block: number | null; method: string | null }> = {};
    let page = 1;
    let truncated = false;
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const url = this.q({
        module: "account",
        action: "tokentx",
        contractaddress: tokenAddress,
        page,
        offset: PAGE_SIZE,
        sort: "desc",
      });
      const res = await fetchJson(url, signal);
      const rows: any[] = Array.isArray(res.result) ? res.result : [];
      for (const r of rows) {
        const ts = r.timeStamp ? new Date(Number(r.timeStamp) * 1000).toISOString() : null;
        const method = r.functionName || r.methodId || null;
        const hash = String(r.hash);
        assetTransfers.push({
          txHash: hash,
          block: r.blockNumber != null ? Number(r.blockNumber) : null,
          timestamp: ts,
          token: { address: tokenAddress, symbol: token.symbol, decimals },
          from: String(r.from),
          to: String(r.to),
          value: String(r.value ?? "0"),
        });
        methodByTx[hash] = method;
        txMeta[hash] = { timestamp: ts, block: r.blockNumber != null ? Number(r.blockNumber) : null, method };
      }
      onProgress({ phase: "Downloading token transfers", current: assetTransfers.length });
      if (rows.length < PAGE_SIZE) break;
      if (assetTransfers.length >= MAX_TRANSFERS) {
        truncated = true;
        break;
      }
      page++;
    }

    const isMintTx = (hash: string) =>
      assetTransfers.some((t) => t.txHash === hash && t.from.toLowerCase() === ZERO);
    const uniqueTx = Array.from(new Set(assetTransfers.map((t) => t.txHash)));
    const tradeTx = uniqueTx.filter((h) => !isMintTx(h));

    const legsByTx: Record<string, RawTransfer[]> = {};
    const txInfoByTx: Record<string, TxInfo> = {};
    for (const h of uniqueTx) {
      if (isMintTx(h)) legsByTx[h] = assetTransfers.filter((t) => t.txHash === h);
    }

    onProgress({ phase: "Decoding transactions", current: 0, total: tradeTx.length });
    let done = 0;
    await mapPool(
      tradeTx,
      LEG_CONCURRENCY,
      async (hash) => {
        const meta = txMeta[hash];
        const receiptRes = await fetchJson(
          this.q({ module: "proxy", action: "eth_getTransactionReceipt", txhash: hash }),
          signal,
        ).catch(() => null);
        const receipt = receiptRes?.result;
        const legs: RawTransfer[] = [];
        let txTo: string | null = null;
        if (receipt) {
          txTo = receipt.to ? safeAddr(receipt.to) : null;
          const logs: any[] = receipt.logs || [];
          for (const lg of logs) {
            let decoded: any;
            try {
              decoded = decodeEventLog({ abi: TRANSFER_EVENT, data: lg.data, topics: lg.topics });
            } catch {
              continue; // not a (3-topic) ERC-20 Transfer
            }
            const tokenAddr = safeAddr(lg.address);
            const info = await this.tokenInfo(tokenAddr, signal);
            legs.push({
              txHash: hash,
              block: meta?.block ?? null,
              timestamp: meta?.timestamp ?? null,
              token: { address: tokenAddr, symbol: info.symbol, decimals: info.decimals },
              from: String(decoded.args.from),
              to: String(decoded.args.to),
              value: String(decoded.args.value),
            });
          }
        }
        legsByTx[hash] = legs.length ? legs : assetTransfers.filter((t) => t.txHash === hash);
        txInfoByTx[hash] = {
          txHash: hash,
          block: meta?.block ?? null,
          timestamp: meta?.timestamp ?? null,
          from: receipt?.from ? safeAddr(receipt.from) : null,
          to: txTo,
          method: meta?.method ?? methodByTx[hash] ?? null,
        };
        done++;
        if (done % 2 === 0 || done === tradeTx.length) {
          onProgress({ phase: "Decoding transactions", current: done, total: tradeTx.length });
        }
      },
      signal,
    );

    for (const h of uniqueTx) {
      if (!txInfoByTx[h]) {
        const m = txMeta[h];
        txInfoByTx[h] = {
          txHash: h,
          block: m?.block ?? null,
          timestamp: m?.timestamp ?? null,
          from: null,
          to: null,
          method: m?.method ?? null,
        };
      }
    }

    return {
      token,
      transferCount: assetTransfers.length,
      assetTransfers,
      legsByTx,
      txInfoByTx,
      truncated,
      sourceLabel: this.label,
    };
  }
}

function safeAddr(a: string): string {
  try {
    return getAddress(a);
  } catch {
    return a;
  }
}

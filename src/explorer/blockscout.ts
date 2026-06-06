import type { ChainDef } from "./chains";
import type { DataSource, ExtractedData, ProgressFn, RawTransfer, TokenMeta, TxInfo } from "./types";
import { fetchJson, mapPool } from "./pool";

const MAX_TRANSFERS = 4000; // safety cap on pagination
const LEG_CONCURRENCY = 6;

function addrOf(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  return (x.hash || x.address_hash || x.address || "").toString();
}

function normalizeTransfer(item: any): RawTransfer | null {
  const total = item.total || {};
  const token = item.token || {};
  const value = (total.value ?? item.value ?? "0").toString();
  const decimals = Number(total.decimals ?? token.decimals ?? 18);
  const txHash = (item.transaction_hash || item.tx_hash || item.transaction?.hash || "").toString();
  if (!txHash) return null;
  return {
    txHash,
    block: item.block_number != null ? Number(item.block_number) : null,
    timestamp: item.timestamp ?? null,
    token: {
      address: (token.address || token.address_hash || "").toString(),
      symbol: (token.symbol || "?").toString(),
      decimals: Number.isFinite(decimals) ? decimals : 18,
    },
    from: addrOf(item.from),
    to: addrOf(item.to),
    value,
    // type/method captured separately where needed
  } as RawTransfer & { type?: string };
}

function buildQuery(base: string, params: Record<string, any> | null): string {
  if (!params) return base;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export class BlockscoutSource implements DataSource {
  label: string;
  private base: string;

  constructor(chain: ChainDef) {
    if (!chain.blockscout) throw new Error("Esta cadena no tiene instancia Blockscout configurada.");
    this.base = chain.blockscout.replace(/\/$/, "");
    this.label = `Blockscout (${new URL(this.base).hostname})`;
  }

  async extract(tokenAddress: string, onProgress: ProgressFn, signal?: AbortSignal): Promise<ExtractedData> {
    const api = `${this.base}/api/v2`;

    onProgress({ phase: "Reading token metadata" });
    const tokenJson = await fetchJson(`${api}/tokens/${tokenAddress}`, signal);
    const token: TokenMeta = {
      address: (tokenJson.address || tokenJson.address_hash || tokenAddress).toString(),
      name: (tokenJson.name || "Token").toString(),
      symbol: (tokenJson.symbol || "?").toString(),
      decimals: Number(tokenJson.decimals ?? 18),
      totalSupply: (tokenJson.total_supply ?? "0").toString(),
      holders: tokenJson.holders_count != null ? Number(tokenJson.holders_count) : tokenJson.holders != null ? Number(tokenJson.holders) : null,
      type: (tokenJson.type || null) as string | null,
    };

    let transferCount: number | null = null;
    try {
      const counters = await fetchJson(`${api}/tokens/${tokenAddress}/counters`, signal);
      transferCount = counters.transfers_count != null ? Number(counters.transfers_count) : null;
    } catch {
      /* counters are optional */
    }

    onProgress({ phase: "Downloading token transfers" });
    const assetTransfers: RawTransfer[] = [];
    const transferTypeByTx: Record<string, string> = {};
    const methodByTx: Record<string, string | null> = {};
    let pageParams: Record<string, any> | null = null;
    let truncated = false;

    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const url = buildQuery(`${api}/tokens/${tokenAddress}/transfers`, pageParams);
      const page = await fetchJson(url, signal);
      const items: any[] = page.items || [];
      for (const it of items) {
        const t = normalizeTransfer(it);
        if (!t) continue;
        assetTransfers.push(t);
        if (it.type) transferTypeByTx[t.txHash] = it.type;
        if (it.method != null) methodByTx[t.txHash] = it.method;
      }
      onProgress({ phase: "Downloading token transfers", current: assetTransfers.length });
      if (assetTransfers.length >= MAX_TRANSFERS) {
        truncated = !!page.next_page_params;
        break;
      }
      if (page.next_page_params) {
        pageParams = page.next_page_params;
      } else {
        break;
      }
    }

    // Unique tx hashes. We need full legs for trade txs (non-mint) to surface USDC + fee.
    const isMintTx = (hash: string) => transferTypeByTx[hash] === "token_minting" ||
      assetTransfers.some((t) => t.txHash === hash && /^0x0+$/.test(t.from.toLowerCase()));
    const uniqueTx = Array.from(new Set(assetTransfers.map((t) => t.txHash)));
    const tradeTx = uniqueTx.filter((h) => !isMintTx(h));

    onProgress({ phase: "Decoding transactions", current: 0, total: tradeTx.length });
    const legsByTx: Record<string, RawTransfer[]> = {};
    const txInfoByTx: Record<string, TxInfo> = {};

    // For mint txs, the legs are just the asset mints we already have.
    for (const h of uniqueTx) {
      if (isMintTx(h)) {
        legsByTx[h] = assetTransfers.filter((t) => t.txHash === h);
      }
    }

    let done = 0;
    await mapPool(
      tradeTx,
      LEG_CONCURRENCY,
      async (hash) => {
        const [legsJson, txJson] = await Promise.all([
          fetchJson(`${api}/transactions/${hash}/token-transfers`, signal).catch(() => null),
          fetchJson(`${api}/transactions/${hash}`, signal).catch(() => null),
        ]);
        const legs: RawTransfer[] = [];
        if (legsJson?.items) {
          for (const it of legsJson.items) {
            const t = normalizeTransfer(it);
            if (t) legs.push(t);
          }
        }
        // Fall back to the asset legs we already have if the per-tx endpoint failed.
        legsByTx[hash] = legs.length ? legs : assetTransfers.filter((t) => t.txHash === hash);
        if (txJson) {
          txInfoByTx[hash] = {
            txHash: hash,
            block: txJson.block_number != null ? Number(txJson.block_number) : null,
            timestamp: txJson.timestamp ?? null,
            from: addrOf(txJson.from) || null,
            to: addrOf(txJson.to) || null,
            method: (txJson.method || txJson.decoded_input?.method_call || methodByTx[hash] || null) as string | null,
          };
        } else {
          txInfoByTx[hash] = {
            txHash: hash,
            block: assetTransfers.find((t) => t.txHash === hash)?.block ?? null,
            timestamp: assetTransfers.find((t) => t.txHash === hash)?.timestamp ?? null,
            from: null,
            to: null,
            method: methodByTx[hash] ?? null,
          };
        }
        done++;
        if (done % 2 === 0 || done === tradeTx.length) {
          onProgress({ phase: "Decoding transactions", current: done, total: tradeTx.length });
        }
      },
      signal,
    );

    // Fill tx info for mint txs from the transfer rows we already have.
    for (const h of uniqueTx) {
      if (!txInfoByTx[h]) {
        const row = assetTransfers.find((t) => t.txHash === h);
        txInfoByTx[h] = {
          txHash: h,
          block: row?.block ?? null,
          timestamp: row?.timestamp ?? null,
          from: null,
          to: null,
          method: methodByTx[h] ?? null,
        };
      }
    }

    return {
      token,
      transferCount: transferCount ?? assetTransfers.length,
      assetTransfers,
      legsByTx,
      txInfoByTx,
      truncated,
      sourceLabel: this.label,
    };
  }
}

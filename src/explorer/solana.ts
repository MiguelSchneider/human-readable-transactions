import type { ProgressFn } from "./types";
import { mapPool } from "./pool";
import { COMPUTE_BUDGET, SOLANA_RPC, type SolanaCluster } from "./solanaRegistry";

// ---- Normalized Solana extraction (stage 1-3 of the universal pipeline) ----
export interface SolDelta {
  owner: string;
  mint: string;
  delta: number; // UI units (already decimal/scaled-adjusted by the RPC)
}
export interface SolTx {
  signature: string;
  slot: number | null;
  blockTime: number | null; // unix seconds
  feePayer: string | null; // operator / relayer
  programs: string[]; // all program ids touched (top-level + inner)
  topProgram: string | null; // first non-ComputeBudget top-level program
  deltas: SolDelta[];
  err: boolean;
}
export interface SolToken {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  supplyUi: string; // human supply
  standardProgram: string; // owner program id (Token / Token-2022)
  extensions: string[];
  mintAuthority: string | null;
  freezeAuthority: string | null;
}
export interface SolExtract {
  cluster: SolanaCluster;
  token: SolToken;
  txs: SolTx[]; // newest first
  signatureCount: number;
  truncated: boolean;
}

const SIG_LIMIT = 200; // sample cap for high-volume tokens
const TX_CONCURRENCY = 4;

async function rpc<T>(endpoint: string, method: string, params: any[], signal?: AbortSignal): Promise<T> {
  let backoff = 400;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal,
    });
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 4000);
      continue;
    }
    if (!res.ok) throw new Error(`RPC HTTP ${res.status} (${method})`);
    const json = await res.json();
    if (json.error) throw new Error(`RPC error ${method}: ${json.error.message ?? json.error.code}`);
    return json.result as T;
  }
  throw new Error(`RPC ${method} rate-limited after retries`);
}

function programIdOf(ix: any): string | null {
  return ix?.programId ?? ix?.program ?? null;
}

export async function extractSolana(
  mint: string,
  cluster: SolanaCluster,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<SolExtract> {
  const ep = SOLANA_RPC[cluster];

  onProgress({ phase: "Reading token metadata" });
  const acct = await rpc<any>(ep, "getAccountInfo", [mint, { encoding: "jsonParsed" }], signal);
  if (!acct?.value) throw new Error("Mint account not found on this cluster.");
  const standardProgram = acct.value.owner as string;
  const info = acct.value.data?.parsed?.info ?? {};
  const extEntries: any[] = info.extensions ?? [];
  const extensions = extEntries.map((e) => e.extension).filter(Boolean);
  const meta = extEntries.find((e) => e.extension === "tokenMetadata")?.state;

  const supply = await rpc<any>(ep, "getTokenSupply", [mint], signal);
  const decimals = Number(supply?.value?.decimals ?? info.decimals ?? 0);

  const token: SolToken = {
    mint,
    name: meta?.name ?? "Token",
    symbol: meta?.symbol ?? "?",
    decimals,
    supplyUi: supply?.value?.uiAmountString ?? "0",
    standardProgram,
    extensions,
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
  };

  onProgress({ phase: "Collecting signatures" });
  const sigInfos = await rpc<any[]>(ep, "getSignaturesForAddress", [mint, { limit: SIG_LIMIT }], signal);
  const signatures = (sigInfos ?? []).map((s) => ({ sig: s.signature as string, slot: s.slot ?? null, blockTime: s.blockTime ?? null, err: !!s.err }));
  const truncated = signatures.length >= SIG_LIMIT;

  onProgress({ phase: "Decoding transactions", current: 0, total: signatures.length });
  let done = 0;
  const txs = await mapPool(
    signatures,
    TX_CONCURRENCY,
    async (s): Promise<SolTx | null> => {
      const tx = await rpc<any>(ep, "getTransaction", [s.sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }], signal).catch(() => null);
      done++;
      if (done % 2 === 0 || done === signatures.length) {
        onProgress({ phase: "Decoding transactions", current: done, total: signatures.length });
      }
      if (!tx) return null;
      const m = tx.meta ?? {};
      const message = tx.transaction?.message ?? {};
      const keys: any[] = message.accountKeys ?? [];
      const feePayer = (keys.find((k) => k.signer)?.pubkey ?? keys[0]?.pubkey ?? null) as string | null;

      const programs = new Set<string>();
      for (const ix of message.instructions ?? []) {
        const p = programIdOf(ix);
        if (p) programs.add(p);
      }
      for (const inner of m.innerInstructions ?? []) {
        for (const ix of inner.instructions ?? []) {
          const p = programIdOf(ix);
          if (p) programs.add(p);
        }
      }
      const topPrograms = (message.instructions ?? []).map(programIdOf).filter((p: string | null): p is string => !!p && p !== COMPUTE_BUDGET);
      const topProgram = topPrograms[0] ?? null;

      // Balance deltas from pre/post token balances (owner + mint + uiAmount).
      const byIndex: Record<number, { owner: string; mint: string; pre: number; post: number }> = {};
      for (const b of m.preTokenBalances ?? []) {
        byIndex[b.accountIndex] = { owner: b.owner, mint: b.mint, pre: Number(b.uiTokenAmount?.uiAmountString ?? 0), post: 0 };
      }
      for (const b of m.postTokenBalances ?? []) {
        const prev = byIndex[b.accountIndex] ?? { owner: b.owner, mint: b.mint, pre: 0, post: 0 };
        byIndex[b.accountIndex] = { ...prev, owner: b.owner ?? prev.owner, mint: b.mint ?? prev.mint, post: Number(b.uiTokenAmount?.uiAmountString ?? 0) };
      }
      const deltas: SolDelta[] = Object.values(byIndex)
        .map((x) => ({ owner: x.owner, mint: x.mint, delta: x.post - x.pre }))
        .filter((x) => Math.abs(x.delta) > 1e-9);

      return {
        signature: s.sig,
        slot: s.slot,
        blockTime: s.blockTime,
        feePayer,
        programs: [...programs],
        topProgram,
        deltas,
        err: s.err,
      };
    },
    signal,
  );

  return {
    cluster,
    token,
    txs: txs.filter((t): t is SolTx => !!t),
    signatureCount: signatures.length,
    truncated,
  };
}

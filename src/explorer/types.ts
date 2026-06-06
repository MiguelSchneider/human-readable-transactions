// Raw on-chain data, normalised across data sources (Blockscout v2, Routescan+RPC).
// Amounts are kept as raw integer strings here; unit conversion happens in the model layer.

export interface TokenMeta {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string; // raw integer string
  holders: number | null;
  type: string | null; // ERC-20 / ERC-721 ...
}

// One ERC-20 transfer leg. `block` and `timestamp` may be absent depending on source.
export interface RawTransfer {
  txHash: string;
  block: number | null;
  timestamp: string | null; // ISO string when known
  token: {
    address: string;
    symbol: string;
    decimals: number;
  };
  from: string;
  to: string;
  value: string; // raw integer string
}

// Per-transaction context (signer / target / method) when the source can provide it.
export interface TxInfo {
  txHash: string;
  block: number | null;
  timestamp: string | null;
  from: string | null; // operator / relayer (gas payer + signer)
  to: string | null; // the contract the tx interacted with (market / settlement)
  method: string | null; // decoded method name or 4-byte id
}

// What every DataSource yields. `legsByTx` holds *all* ERC-20 legs inside each trade tx
// (payment-token legs + fee leg + asset leg) — the thing that lets us show USDC and fees.
export interface ExtractedData {
  token: TokenMeta;
  transferCount: number | null;
  assetTransfers: RawTransfer[]; // every transfer of the target token, newest first
  legsByTx: Record<string, RawTransfer[]>;
  txInfoByTx: Record<string, TxInfo>;
  truncated: boolean; // true if we stopped paginating before the full history
  sourceLabel: string; // e.g. "Blockscout (arbitrum-sepolia)"
}

// Structured progress so the UI can render a real progress bar. `total` present →
// determinate (current/total); absent → indeterminate phase (optionally with a count).
export interface Progress {
  phase: string;
  current?: number;
  total?: number;
}
export type ProgressFn = (p: Progress) => void;

export interface DataSource {
  label: string;
  extract(tokenAddress: string, onProgress: ProgressFn, signal?: AbortSignal): Promise<ExtractedData>;
}

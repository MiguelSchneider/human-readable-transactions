// The decoded, human-meaningful model the report templates render from.

export interface Party {
  address: string;
  label: string; // "Treasury", "Investor A", "Fee wallet", ...
}

export interface Leg {
  role: "pay" | "fee" | "net" | "share" | "mint" | "burn";
  from: string;
  to: string;
  amount: number; // human units
  amountRaw: string;
  symbol: string;
  decimals: number;
}

export type OpKind = "buy" | "sell" | "mint" | "burn" | "transfer" | "dividend" | "setup";

export interface Operation {
  n: number; // 1-based, in display order (newest first)
  kind: OpKind;
  txHash: string;
  block: number | null;
  timestamp: string | null; // ISO
  method: string | null;
  investor?: string; // buyer / seller
  recipient?: string; // mint recipient
  assetQty: number;
  gross?: number; // payment gross
  fee?: number;
  net?: number;
  impliedPrice?: number | null; // payment per asset unit
  legs: Leg[];
  market?: string | null; // contract interacted with
  liquidity?: string | null; // payer on sells
  feeWallet?: string | null;
  treasury?: string | null;
  // True when we could not retrieve the payment/fee legs for this trade.
  paymentMissing?: boolean;
  // Solana: programs touched (trade program, AMM…), already friendly-labelled.
  programs?: string[];
}

export interface PaymentToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface Cast {
  treasury?: Party;
  market?: Party;
  feeWallet?: Party;
  liquidity?: Party;
  operator?: Party;
  investors: Party[];
  idleHolders: Party[];
}

export interface FeeModel {
  fractionPct: number | null; // e.g. 1 for 1%
  consistent: boolean;
  samples: number;
}

export interface ReportModel {
  chainKind: "evm" | "solana";
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: number;
    totalSupplyRaw: string;
    holders: number | null;
    type: string | null;
    standard?: string; // ERC-20 | Token-2022 | SPL Token
    extensions?: string[]; // Token-2022 powers (human strings)
  };
  chainName: string;
  testnet: boolean;
  explorerBase: string;
  explorerQuery?: string; // e.g. "?cluster=devnet" for Solana
  sourceLabel: string;
  dataAsOf: string; // ISO date the report was generated
  transferCount: number | null;
  truncated: boolean;
  paymentToken: PaymentToken | null;
  cast: Cast;
  fee: FeeModel;
  operations: Operation[]; // newest first
  buys: Operation[];
  sells: Operation[];
  mints: Operation[];
  // Flat ledger: one row per asset transfer (newest first).
  ledger: {
    n: number;
    kind: OpKind;
    from: string;
    to: string;
    qty: number;
    txHash: string;
    block: number | null;
    timestamp: string | null;
  }[];
  // A representative worked buy / sell for the Type A diagrams.
  sampleBuy?: Operation;
  sampleSell?: Operation;
  labelOf: Record<string, string>; // address(lower) -> label
}

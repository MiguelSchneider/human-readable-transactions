// Solana registries: friendly program names, token-program ids, payment-token (stablecoin)
// mints, and cluster RPC endpoints. Discover the rest at runtime — this is only for labelling.

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

export const SOLANA_RPC: Record<SolanaCluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

export function solanaNetworkName(cluster: SolanaCluster): string {
  return cluster === "mainnet-beta" ? "Solana" : `Solana ${cluster}`;
}
export function isSolanaTestnet(cluster: SolanaCluster): boolean {
  return cluster !== "mainnet-beta";
}

// explorer.solana.com link base + cluster query suffix.
export const SOLANA_EXPLORER = "https://explorer.solana.com";
export function solanaExplorerQuery(cluster: SolanaCluster): string {
  return cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
}

export const TOKEN_PROGRAMS: Record<string, string> = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "SPL Token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "Token-2022",
};

export function tokenStandard(programId: string): string {
  return TOKEN_PROGRAMS[programId] ?? "SPL (unknown program)";
}

// Payment tokens (the "money" leg). delta amounts come pre-scaled from the RPC, so we
// mainly need the symbol for display.
export const STABLECOINS: Record<string, { sym: string; dec: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { sym: "USDC", dec: 6 }, // mainnet
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { sym: "USDC", dec: 6 }, // devnet
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { sym: "USDT", dec: 6 }, // mainnet USDT
};

export const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

// Infra programs that never represent business logic — hide from the diagram.
export const INFRA_PROGRAMS = new Set([
  COMPUTE_BUDGET,
  SYSTEM_PROGRAM,
  ATA_PROGRAM,
  MEMO_PROGRAM,
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);

export const KNOWN_PROGRAMS: Record<string, string> = {
  BiSoNHVpsVZW2F7rx2eQ59yQwKxzU5NvBcmKshCSUypi: "Jump Vision / Bison propAMM",
  [COMPUTE_BUDGET]: "Compute Budget",
  [SYSTEM_PROGRAM]: "System Program",
  [ATA_PROGRAM]: "Associated Token Account",
  [MEMO_PROGRAM]: "Memo",
};

export function programLabel(programId: string): string {
  return KNOWN_PROGRAMS[programId] ?? TOKEN_PROGRAMS[programId] ?? programId;
}

// Human-readable strings for Token-2022 extensions (for the asset spec / Solana panel).
export const EXTENSION_LABELS: Record<string, string> = {
  defaultAccountState: "Default account state (new holders start frozen → on-chain KYC/whitelist)",
  permanentDelegate: "Permanent delegate (issuer can force-transfer / seize)",
  pausableConfig: "Pausable (issuer can halt all transfers)",
  scaledUiAmountConfig: "Scaled UI amount (supports yield / rebasing)",
  transferHook: "Transfer hook (every transfer runs a compliance program)",
  transferFeeConfig: "Transfer fee (protocol-level fee on transfers)",
  metadataPointer: "Metadata pointer",
  tokenMetadata: "On-chain token metadata",
  interestBearingConfig: "Interest-bearing",
  nonTransferable: "Non-transferable (soulbound)",
  mintCloseAuthority: "Mint close authority",
};

export function extensionLabel(ext: string): string {
  return EXTENSION_LABELS[ext] ?? ext;
}

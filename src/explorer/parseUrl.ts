import { CHAINS, chainByHost, type ChainDef } from "./chains";
import type { SolanaCluster } from "./solanaRegistry";

export type Target =
  | { kind: "evm"; chain: ChainDef; address: string }
  | { kind: "solana"; cluster: SolanaCluster; address: string };

export interface ParseResult {
  ok: boolean;
  target?: Target;
  // When we found an address but couldn't infer the network.
  addressOnly?: { kind: "evm" | "solana"; address: string };
  error?: string;
}

const EVM_ADDR_RE = /0x[a-fA-F0-9]{40}/;
const BASE58_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const SOLANA_HOSTS = /explorer\.solana\.com|solscan\.io|solana\.fm/i;

function clusterFrom(url: string): SolanaCluster {
  const m = url.match(/[?&]cluster=([\w-]+)/);
  const c = m?.[1];
  if (c === "devnet" || c === "testnet") return c;
  return "mainnet-beta";
}

// Accepts a full explorer URL or a bare address, for EVM and Solana.
export function parseExplorerInput(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Paste a block-explorer URL or a token address." };

  // Bare EVM address
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
    return { ok: false, addressOnly: { kind: "evm", address: input }, error: "Pick the network for this address." };
  }
  // Bare Solana (base58) address
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input) && !input.startsWith("0x")) {
    return { ok: false, addressOnly: { kind: "solana", address: input }, error: "Pick the Solana cluster for this address." };
  }

  let url: URL | null = null;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    url = null;
  }

  const isSolana = (url && SOLANA_HOSTS.test(url.hostname)) || /[?&]cluster=/.test(input);
  if (isSolana) {
    // Pull the base58 address out of the path (address|token|account/<addr>) or anywhere.
    const path = url?.pathname ?? input;
    const m = path.match(/(?:address|token|account)\/([1-9A-HJ-NP-Za-km-z]{32,44})/) || input.match(BASE58_RE);
    const address = Array.isArray(m) ? (m[1] ?? m[0]) : undefined;
    if (address) {
      return { ok: true, target: { kind: "solana", cluster: clusterFrom(input), address } };
    }
    return { ok: false, error: "Recognized a Solana explorer but found no token address in the URL." };
  }

  // EVM path
  const tokenAddress = (url?.pathname.match(EVM_ADDR_RE) || (url ? (url.search + url.hash).match(EVM_ADDR_RE) : null) || input.match(EVM_ADDR_RE))?.[0];
  const chain = url ? chainByHost(url.hostname) : undefined;

  if (chain && tokenAddress) return { ok: true, target: { kind: "evm", chain, address: tokenAddress } };
  if (tokenAddress) return { ok: false, addressOnly: { kind: "evm", address: tokenAddress }, error: `Unrecognized host${url ? ` (${url.hostname})` : ""}; pick the network.` };
  if (chain) return { ok: false, error: "Recognized the network but found no 0x address in the URL." };
  return { ok: false, error: "Couldn't find a known network or a token address in the input." };
}

export const SUPPORTED_CHAINS = CHAINS;

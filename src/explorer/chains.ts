// Chain registry: maps a chain to (a) the Blockscout v2 base if one exists,
// (b) a Routescan etherscan-compatible base + a public RPC for chains without
// Blockscout (Avalanche), and (c) the canonical explorer base for building links.
//
// Extend freely: add a row here and the URL parser + data source pick it up.

export type Backend = "blockscout" | "routescan";

export interface ChainDef {
  id: number;
  name: string;
  testnet: boolean;
  backend: Backend;
  // Blockscout instance base (no trailing slash), when backend === "blockscout".
  blockscout?: string;
  // Routescan etherscan-compatible API base, when backend === "routescan".
  routescanApi?: string;
  // Public JSON-RPC endpoint used to decode per-tx token legs from receipts.
  rpc?: string;
  // Canonical explorer base for human-facing links (token/tx/address pages).
  explorer: string;
  // Host substrings that identify this chain in a pasted explorer URL.
  hosts: string[];
}

export const CHAINS: ChainDef[] = [
  // ---- Blockscout-backed chains (clean v2 JSON API, CORS, no key) ----
  {
    id: 1,
    name: "Ethereum",
    testnet: false,
    backend: "blockscout",
    blockscout: "https://eth.blockscout.com",
    explorer: "https://etherscan.io",
    hosts: ["etherscan.io", "eth.blockscout.com"],
  },
  {
    id: 11155111,
    name: "Ethereum Sepolia",
    testnet: true,
    backend: "blockscout",
    blockscout: "https://eth-sepolia.blockscout.com",
    explorer: "https://sepolia.etherscan.io",
    hosts: ["sepolia.etherscan.io", "eth-sepolia.blockscout.com"],
  },
  {
    id: 42161,
    name: "Arbitrum One",
    testnet: false,
    backend: "blockscout",
    blockscout: "https://arbitrum.blockscout.com",
    explorer: "https://arbiscan.io",
    hosts: ["arbiscan.io", "arbitrum.blockscout.com"],
  },
  {
    id: 421614,
    name: "Arbitrum Sepolia",
    testnet: true,
    backend: "blockscout",
    blockscout: "https://arbitrum-sepolia.blockscout.com",
    explorer: "https://sepolia.arbiscan.io",
    hosts: ["sepolia.arbiscan.io", "arbitrum-sepolia.blockscout.com"],
  },
  {
    id: 8453,
    name: "Base",
    testnet: false,
    backend: "blockscout",
    blockscout: "https://base.blockscout.com",
    explorer: "https://basescan.org",
    hosts: ["basescan.org", "base.blockscout.com"],
  },
  {
    id: 84532,
    name: "Base Sepolia",
    testnet: true,
    backend: "blockscout",
    blockscout: "https://base-sepolia.blockscout.com",
    explorer: "https://sepolia.basescan.org",
    hosts: ["sepolia.basescan.org", "base-sepolia.blockscout.com"],
  },
  {
    id: 10,
    name: "Optimism",
    testnet: false,
    backend: "blockscout",
    blockscout: "https://optimism.blockscout.com",
    explorer: "https://optimistic.etherscan.io",
    hosts: ["optimistic.etherscan.io", "optimism.blockscout.com"],
  },
  {
    id: 137,
    name: "Polygon",
    testnet: false,
    backend: "blockscout",
    blockscout: "https://polygon.blockscout.com",
    explorer: "https://polygonscan.com",
    hosts: ["polygonscan.com", "polygon.blockscout.com"],
  },
  {
    id: 100,
    name: "Gnosis",
    testnet: false,
    backend: "blockscout",
    blockscout: "https://gnosis.blockscout.com",
    explorer: "https://gnosisscan.io",
    hosts: ["gnosisscan.io", "gnosis.blockscout.com"],
  },

  // ---- Routescan-backed chains (etherscan-compatible API + RPC for legs) ----
  // Avalanche has no public Blockscout; Routescan exposes a keyless, CORS-enabled
  // etherscan API. This is the path for DSTokens deployed on Fuji.
  {
    id: 43114,
    name: "Avalanche C-Chain",
    testnet: false,
    backend: "routescan",
    routescanApi: "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
    hosts: ["snowtrace.io", "cchain.explorer.avax.network"],
  },
  {
    id: 43113,
    name: "Avalanche Fuji",
    testnet: true,
    backend: "routescan",
    routescanApi: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api",
    rpc: "https://api.avax-test.network/ext/bc/C/rpc",
    explorer: "https://testnet.snowtrace.io",
    hosts: ["testnet.snowtrace.io", "subnets-test.avax.network"],
  },
];

export function chainById(id: number): ChainDef | undefined {
  return CHAINS.find((c) => c.id === id);
}

// Find the chain whose host substrings best match a URL host.
export function chainByHost(host: string): ChainDef | undefined {
  const h = host.toLowerCase();
  // Prefer the most specific (longest) host match so "sepolia.arbiscan.io"
  // beats "arbiscan.io".
  let best: ChainDef | undefined;
  let bestLen = -1;
  for (const c of CHAINS) {
    for (const candidate of c.hosts) {
      if (h === candidate || h.endsWith("." + candidate) || h.includes(candidate)) {
        if (candidate.length > bestLen) {
          best = c;
          bestLen = candidate.length;
        }
      }
    }
  }
  return best;
}

export function explorerTxUrl(chain: ChainDef, hash: string): string {
  return `${chain.explorer.replace(/\/$/, "")}/tx/${hash}`;
}

export function explorerAddressUrl(chain: ChainDef, address: string): string {
  return `${chain.explorer.replace(/\/$/, "")}/address/${address}`;
}

import { CHAINS, chainByHost, type ChainDef } from "./chains";

export interface ParsedTarget {
  chain: ChainDef;
  tokenAddress: string;
}

export interface ParseResult {
  ok: boolean;
  target?: ParsedTarget;
  // When we found an address but couldn't infer the chain from the host.
  addressOnly?: string;
  error?: string;
}

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/;

// Accepts:
//  - A full explorer URL: .../token/0x..., .../address/0x..., .../tokens/0x..., with optional query.
//  - A bare 0x address (then the caller must pick the chain).
export function parseExplorerInput(raw: string): ParseResult {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Pega una URL de explorador o una dirección 0x." };

  // Bare address?
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
    return { ok: false, addressOnly: input, error: "Selecciona la red para esta dirección." };
  }

  let url: URL;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    // Maybe it's text containing an address.
    const m = input.match(ADDRESS_RE);
    if (m) return { ok: false, addressOnly: m[0], error: "No reconocí la URL; selecciona la red." };
    return { ok: false, error: "No pude interpretar la entrada como URL ni como dirección." };
  }

  const addrMatch = url.pathname.match(ADDRESS_RE) || (url.search + url.hash).match(ADDRESS_RE);
  const tokenAddress = addrMatch?.[0];

  const chain = chainByHost(url.hostname);

  if (chain && tokenAddress) {
    return { ok: true, target: { chain, tokenAddress } };
  }
  if (tokenAddress) {
    return { ok: false, addressOnly: tokenAddress, error: `Host no reconocido (${url.hostname}); selecciona la red.` };
  }
  if (chain) {
    return { ok: false, error: "Reconocí la red pero no encontré una dirección 0x en la URL." };
  }
  return { ok: false, error: "No encontré ni red conocida ni dirección 0x en la URL." };
}

export const SUPPORTED_CHAINS = CHAINS;

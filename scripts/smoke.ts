// Headless end-to-end smoke test. Examples:
//   npx vite-node scripts/smoke.ts                              # Solana devnet fixture (§13)
//   npx vite-node scripts/smoke.ts 5qUKZ…F5K devnet             # Solana mint + cluster
//   npx vite-node scripts/smoke.ts 0x7020… 43113               # EVM token + chainId
//   npx vite-node scripts/smoke.ts "https://…/token/0x…"       # any explorer URL
import { writeFileSync } from "node:fs";
import { parseExplorerInput, SUPPORTED_CHAINS, type Target } from "@/explorer/parseUrl";
import { generateReport } from "@/generate";
import type { SolanaCluster } from "@/explorer/solanaRegistry";

const arg = process.argv[2] || "5qUKZnstLmW9F7AruVkAgMy4vhGufsePd1tTincZ7F5K";
const opt = process.argv[3] || "devnet";

function buildTarget(): Target {
  const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(arg) && !arg.startsWith("0x");
  if (isBase58) return { kind: "solana", cluster: (opt as SolanaCluster) || "mainnet-beta", address: arg };
  if (/^0x[a-fA-F0-9]{40}$/.test(arg)) {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === Number(opt)) ?? SUPPORTED_CHAINS[0];
    return { kind: "evm", chain, address: arg };
  }
  const parsed = parseExplorerInput(arg);
  if (parsed.ok && parsed.target) return parsed.target;
  throw new Error(parsed.error ?? "Could not build a target from the input.");
}

async function main() {
  const target = buildTarget();
  const { model, typeAHtml, typeBHtml } = await generateReport(target, (p) =>
    console.log("  •", p.phase, p.total ? `${p.current ?? 0}/${p.total}` : p.current ?? ""),
  );

  console.log("\n=== MODEL SUMMARY ===");
  console.log("chain        :", model.chainKind, "·", model.chainName);
  console.log("token        :", model.token.name, `(${model.token.symbol})`, "dec", model.token.decimals, "·", model.token.standard);
  if (model.token.extensions?.length) console.log("extensions   :", model.token.extensions.join(", "));
  console.log("payment token:", model.paymentToken?.symbol, model.paymentToken?.address);
  console.log("fee          :", model.fee.fractionPct, "% samples=", model.fee.samples);
  console.log("treasury     :", model.cast.treasury?.address);
  console.log("pool/liquid  :", model.cast.liquidity?.address);
  console.log("fee account  :", model.cast.feeWallet?.address);
  console.log("operator     :", model.cast.operator?.address);
  console.log("programs/mkt :", model.cast.market?.label, model.cast.market?.address);
  console.log("counts       : buys", model.buys.length, "sells", model.sells.length, "mints", model.mints.length, "total", model.operations.length);
  const mix: Record<string, number> = {};
  for (const o of model.operations) mix[o.kind] = (mix[o.kind] ?? 0) + 1;
  console.log("activity mix :", JSON.stringify(mix));
  console.log("\nfirst ops:");
  for (const op of model.operations.slice(0, 5)) {
    console.log(`  #${op.n} ${op.kind} qty=${op.assetQty} gross=${op.gross} fee=${op.fee} net=${op.net} price=${op.impliedPrice} legs=${op.legs.length}`);
  }

  writeFileSync("/tmp/hrt-typeA.html", typeAHtml);
  writeFileSync("/tmp/hrt-typeB.html", typeBHtml);
  console.log("\nWrote /tmp/hrt-typeA.html (", typeAHtml.length, ") and /tmp/hrt-typeB.html (", typeBHtml.length, ")");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

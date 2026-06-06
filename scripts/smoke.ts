// Headless end-to-end smoke test: run the full pipeline against a real token and
// write the two reports out for inspection. Run with: npx vite-node scripts/smoke.ts
import { writeFileSync } from "node:fs";
import { chainById } from "@/explorer/chains";
import { generateReport } from "@/generate";

const chainId = Number(process.argv[2] || 43113);
const token = process.argv[3] || "0x7020Bb93c95b08701c99A3fde869Ff5525B8dF8D"; // EXODUS on Fuji

async function main() {
  const chain = chainById(chainId);
  if (!chain) throw new Error(`Unknown chain ${chainId}`);
  const { model, typeAHtml, typeBHtml } = await generateReport(chain, token, (p) =>
    console.log("  •", p.phase, p.total ? `${p.current ?? 0}/${p.total}` : p.current ?? ""),
  );

  console.log("\n=== MODEL SUMMARY ===");
  console.log("token        :", model.token.name, `(${model.token.symbol})`, "dec", model.token.decimals);
  console.log("totalSupply  :", model.token.totalSupply);
  console.log("payment token:", model.paymentToken?.symbol, model.paymentToken?.address);
  console.log("fee          :", model.fee.fractionPct, "% consistent=", model.fee.consistent, "samples=", model.fee.samples);
  console.log("treasury     :", model.cast.treasury?.address);
  console.log("market       :", model.cast.market?.address);
  console.log("fee wallet   :", model.cast.feeWallet?.address);
  console.log("liquidity    :", model.cast.liquidity?.address);
  console.log("operator     :", model.cast.operator?.address);
  console.log("investors    :", model.cast.investors.length, model.cast.investors.map((i) => i.label).join(","));
  console.log("counts       : buys", model.buys.length, "sells", model.sells.length, "mints", model.mints.length);
  console.log("\nfirst 3 ops:");
  for (const op of model.operations.slice(0, 3)) {
    console.log(`  #${op.n} ${op.kind} qty=${op.assetQty} gross=${op.gross} fee=${op.fee} net=${op.net} price=${op.impliedPrice} legs=${op.legs.length} method=${op.method}`);
  }

  writeFileSync("/tmp/hrt-typeA.html", typeAHtml);
  writeFileSync("/tmp/hrt-typeB.html", typeBHtml);
  console.log("\nWrote /tmp/hrt-typeA.html (", typeAHtml.length, "bytes ) and /tmp/hrt-typeB.html (", typeBHtml.length, "bytes )");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

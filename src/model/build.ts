import { formatUnits } from "viem";
import type { ChainDef } from "@/explorer/chains";
import type { ExtractedData, RawTransfer } from "@/explorer/types";
import type { Cast, FeeModel, Leg, Operation, Party, PaymentToken, ReportModel } from "./types";

const ZERO = "0x0000000000000000000000000000000000000000";

function lc(a: string): string {
  return (a || "").toLowerCase();
}
function isZero(a: string): boolean {
  return /^0x0+$/.test(lc(a));
}
function toNum(raw: string, decimals: number): number {
  try {
    return Number(formatUnits(BigInt(raw), decimals));
  } catch {
    return 0;
  }
}

// Count occurrences and return the most frequent key.
function topKey(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestN = -1;
  for (const [k, v] of counts) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

export function buildReportModel(data: ExtractedData, chain: ChainDef, now: Date): ReportModel {
  const assetAddr = lc(data.token.address);
  const dec = data.token.decimals;

  // ---- 1. Detect the payment token (most frequent non-asset token across trade legs) ----
  const paymentCounts = new Map<string, number>();
  const paymentInfo = new Map<string, { symbol: string; decimals: number }>();
  for (const legs of Object.values(data.legsByTx)) {
    for (const leg of legs) {
      const a = lc(leg.token.address);
      if (a && a !== assetAddr) {
        paymentCounts.set(a, (paymentCounts.get(a) ?? 0) + 1);
        paymentInfo.set(a, { symbol: leg.token.symbol, decimals: leg.token.decimals });
      }
    }
  }
  const payAddr = topKey(paymentCounts);
  const paymentToken: PaymentToken | null = payAddr
    ? { address: payAddr, symbol: paymentInfo.get(payAddr)!.symbol, decimals: paymentInfo.get(payAddr)!.decimals }
    : null;

  // ---- 2. Detect the treasury (mint recipient that is most active in asset legs) ----
  const mintRecipients = new Map<string, number>(); // address -> minted amount (raw-ish count weight)
  const assetParticipation = new Map<string, number>();
  for (const t of data.assetTransfers) {
    if (lc(t.token.address) !== assetAddr) continue;
    if (isZero(t.from)) {
      mintRecipients.set(lc(t.to), (mintRecipients.get(lc(t.to)) ?? 0) + 1);
    } else {
      assetParticipation.set(lc(t.from), (assetParticipation.get(lc(t.from)) ?? 0) + 1);
      assetParticipation.set(lc(t.to), (assetParticipation.get(lc(t.to)) ?? 0) + 1);
    }
  }
  let treasury: string | undefined;
  if (mintRecipients.size) {
    // Among mint recipients, the treasury is the one that also trades the most.
    let best = -1;
    for (const r of mintRecipients.keys()) {
      const score = (assetParticipation.get(r) ?? 0) * 1000 + (mintRecipients.get(r) ?? 0);
      if (score > best) {
        best = score;
        treasury = r;
      }
    }
  }
  if (!treasury) treasury = topKey(assetParticipation);

  // ---- 3. Walk each transaction into an Operation ----
  const uniqueTx: string[] = [];
  const seen = new Set<string>();
  for (const t of data.assetTransfers) {
    if (!seen.has(t.txHash)) {
      seen.add(t.txHash);
      uniqueTx.push(t.txHash);
    }
  }

  const feeWalletCounts = new Map<string, number>();
  const liquidityCounts = new Map<string, number>();
  const marketCounts = new Map<string, number>();
  const operatorCounts = new Map<string, number>();
  const investorSet = new Set<string>();
  const feeFractions: number[] = [];

  const operations: Operation[] = [];

  uniqueTx.forEach((hash) => {
    const info = data.txInfoByTx[hash];
    const legs = data.legsByTx[hash] ?? data.assetTransfers.filter((t) => t.txHash === hash);
    const assetLegs = legs.filter((l) => lc(l.token.address) === assetAddr);
    const payLegs = paymentToken ? legs.filter((l) => lc(l.token.address) === paymentToken.address) : [];

    if (info?.from) operatorCounts.set(lc(info.from), (operatorCounts.get(lc(info.from)) ?? 0) + 1);

    // --- Mint ---
    if (assetLegs.some((l) => isZero(l.from))) {
      const mintLegs = assetLegs.filter((l) => isZero(l.from));
      const recipient = mintLegs[0]?.to ?? "";
      const qty = mintLegs.reduce((s, l) => s + toNum(l.value, l.token.decimals), 0);
      operations.push({
        n: 0,
        kind: "mint",
        txHash: hash,
        block: info?.block ?? mintLegs[0]?.block ?? null,
        timestamp: info?.timestamp ?? mintLegs[0]?.timestamp ?? null,
        method: info?.method ?? null,
        recipient,
        assetQty: qty,
        legs: mintLegs.map((l) => mkLeg("mint", l)),
        treasury,
      });
      return;
    }

    // --- Trade: direction by who sends the asset ---
    const assetLeg = assetLegs[0];
    if (!assetLeg) return; // nothing to classify
    const assetQty = assetLegs.reduce((s, l) => s + toNum(l.value, l.token.decimals), 0);
    const fromIsTreasury = treasury && lc(assetLeg.from) === treasury;
    const kind: "buy" | "sell" = fromIsTreasury ? "buy" : lc(assetLeg.to) === treasury ? "sell" : "buy";
    const investor = kind === "buy" ? assetLeg.to : assetLeg.from;
    investorSet.add(lc(investor));

    const builtLegs: Leg[] = [];
    let gross: number | undefined;
    let fee: number | undefined;
    let net: number | undefined;
    let feeWallet: string | null = null;
    let liquidity: string | null = null;
    const market = info?.to ?? null;
    if (market) marketCounts.set(lc(market), (marketCounts.get(lc(market)) ?? 0) + 1);

    if (payLegs.length) {
      if (kind === "buy") {
        // Payment OUT from investor (gross), then distributions: fee (small) + proceeds (large).
        const grossLeg = payLegs.find((l) => lc(l.from) === lc(investor)) ?? maxLeg(payLegs);
        gross = toNum(grossLeg.value, grossLeg.token.decimals ?? paymentToken!.decimals);
        const dist = payLegs.filter((l) => l !== grossLeg);
        const sorted = [...dist].sort((a, b) => toNum(a.value, paymentToken!.decimals) - toNum(b.value, paymentToken!.decimals));
        const feeLeg = sorted[0];
        const proceedsLeg = sorted[sorted.length - 1];
        builtLegs.push(mkLeg("pay", grossLeg));
        if (feeLeg && proceedsLeg && feeLeg !== proceedsLeg) {
          fee = toNum(feeLeg.value, paymentToken!.decimals);
          net = toNum(proceedsLeg.value, paymentToken!.decimals);
          feeWallet = feeLeg.to;
          builtLegs.push(mkLeg("fee", feeLeg));
          builtLegs.push(mkLeg("net", proceedsLeg));
        } else if (proceedsLeg) {
          net = toNum(proceedsLeg.value, paymentToken!.decimals);
          builtLegs.push(mkLeg("net", proceedsLeg));
        }
        builtLegs.push(...assetLegs.map((l) => mkLeg("share", l)));
      } else {
        // Sell: asset returns to treasury; payment legs go to investor (proceeds) and fee wallet (fee).
        builtLegs.push(...assetLegs.map((l) => mkLeg("share", l)));
        const proceedsLeg = payLegs.find((l) => lc(l.to) === lc(investor)) ?? maxLeg(payLegs);
        const feeLeg = payLegs.find((l) => l !== proceedsLeg);
        net = toNum(proceedsLeg.value, paymentToken!.decimals);
        liquidity = proceedsLeg.from;
        if (feeLeg) {
          fee = toNum(feeLeg.value, paymentToken!.decimals);
          feeWallet = feeLeg.to;
          builtLegs.push(mkLeg("fee", feeLeg));
        }
        builtLegs.push(mkLeg("net", proceedsLeg));
        gross = (net ?? 0) + (fee ?? 0);
      }
    } else {
      // No payment legs retrieved — show only the asset movement.
      builtLegs.push(...assetLegs.map((l) => mkLeg("share", l)));
    }

    if (feeWallet) feeWalletCounts.set(lc(feeWallet), (feeWalletCounts.get(lc(feeWallet)) ?? 0) + 1);
    if (liquidity) liquidityCounts.set(lc(liquidity), (liquidityCounts.get(lc(liquidity)) ?? 0) + 1);
    if (gross && fee != null && gross > 0) feeFractions.push(fee / gross);

    const impliedPrice = gross != null && assetQty > 0 ? gross / assetQty : null;

    operations.push({
      n: 0,
      kind,
      txHash: hash,
      block: info?.block ?? assetLeg.block ?? null,
      timestamp: info?.timestamp ?? assetLeg.timestamp ?? null,
      method: info?.method ?? null,
      investor,
      assetQty,
      gross,
      fee,
      net,
      impliedPrice,
      legs: builtLegs,
      market,
      liquidity,
      feeWallet,
      treasury,
      paymentMissing: payLegs.length === 0,
    });
  });

  // Number operations in display order (already newest-first from the source).
  operations.forEach((op, i) => (op.n = i + 1));

  const buys = operations.filter((o) => o.kind === "buy");
  const sells = operations.filter((o) => o.kind === "sell");
  const mints = operations.filter((o) => o.kind === "mint");

  // ---- 4. Fee model ----
  const fee: FeeModel = computeFeeModel(feeFractions);

  // ---- 5. Cast & labels ----
  const marketAddr = topKey(marketCounts);
  const feeWalletAddr = topKey(feeWalletCounts);
  const liquidityAddr = topKey(liquidityCounts);
  const operatorAddr = topKey(operatorCounts);

  const labelOf: Record<string, string> = {};
  const setLabel = (addr: string | undefined, label: string) => {
    if (addr) labelOf[lc(addr)] = label;
  };
  labelOf[ZERO] = "Zero address";
  setLabel(treasury, "Treasury");
  setLabel(marketAddr, "Market contract");
  setLabel(feeWalletAddr, "Fee wallet");
  setLabel(liquidityAddr, "Liquidity wallet");
  setLabel(operatorAddr, "Operator");
  setLabel(assetAddr, `${data.token.symbol} token`);
  if (paymentToken) setLabel(paymentToken.address, `${paymentToken.symbol} token`);

  // Investors get stable A, B, C… labels in first-appearance order.
  const investorOrder: string[] = [];
  for (const op of operations) {
    if ((op.kind === "buy" || op.kind === "sell") && op.investor) {
      const a = lc(op.investor);
      if (!investorOrder.includes(a) && a !== treasury) investorOrder.push(a);
    }
  }
  const investors: Party[] = investorOrder.map((a, i) => {
    const label = `Investor ${letter(i)}`;
    if (!labelOf[a]) labelOf[a] = label;
    return { address: a, label };
  });

  // Idle holders: received a mint, never traded, not the treasury or a known role.
  const known = new Set([treasury, marketAddr, feeWalletAddr, liquidityAddr, operatorAddr].filter(Boolean).map((x) => lc(x!)));
  const idleHolders: Party[] = [];
  for (const a of mintRecipients.keys()) {
    if (a === treasury) continue;
    if (investorOrder.includes(a)) continue;
    if (known.has(a)) continue;
    const label = labelOf[a] ?? "Holder";
    idleHolders.push({ address: a, label });
  }

  const party = (addr: string | undefined, label: string): Party | undefined =>
    addr ? { address: addr, label } : undefined;

  const cast: Cast = {
    treasury: party(treasury, "Treasury"),
    market: party(marketAddr, "Market contract"),
    feeWallet: party(feeWalletAddr, "Fee wallet"),
    liquidity: party(liquidityAddr, "Liquidity wallet"),
    operator: party(operatorAddr, "Operator"),
    investors,
    idleHolders,
  };

  // ---- 6. Ledger ----
  const ledger = data.assetTransfers
    .filter((t) => lc(t.token.address) === assetAddr)
    .map((t, i) => ({
      n: i + 1,
      kind: (isZero(t.from) ? "mint" : treasury && lc(t.from) === treasury ? "buy" : treasury && lc(t.to) === treasury ? "sell" : "buy") as Operation["kind"],
      from: t.from,
      to: t.to,
      qty: toNum(t.value, t.token.decimals),
      txHash: t.txHash,
      block: t.block,
      timestamp: t.timestamp,
    }));

  // ---- 7. Sample worked trades for diagrams (prefer ones with full payment legs) ----
  const sampleBuy = buys.find((o) => !o.paymentMissing && o.fee != null) ?? buys[0];
  const sampleSell = sells.find((o) => !o.paymentMissing && o.fee != null) ?? sells[0];

  return {
    token: {
      address: data.token.address,
      name: data.token.name,
      symbol: data.token.symbol,
      decimals: dec,
      totalSupply: toNum(data.token.totalSupply, dec),
      totalSupplyRaw: data.token.totalSupply,
      holders: data.token.holders,
      type: data.token.type,
    },
    chainName: chain.name,
    testnet: chain.testnet,
    explorerBase: chain.explorer,
    sourceLabel: data.sourceLabel,
    dataAsOf: now.toISOString(),
    transferCount: data.transferCount,
    truncated: data.truncated,
    paymentToken,
    cast,
    fee,
    operations,
    buys,
    sells,
    mints,
    ledger,
    sampleBuy,
    sampleSell,
    labelOf,
  };
}

function mkLeg(role: Leg["role"], l: RawTransfer): Leg {
  return {
    role,
    from: l.from,
    to: l.to,
    amount: toNum(l.value, l.token.decimals),
    amountRaw: l.value,
    symbol: l.token.symbol,
    decimals: l.token.decimals,
  };
}

function maxLeg(legs: RawTransfer[]): RawTransfer {
  return legs.reduce((m, l) => (BigInt(l.value || "0") > BigInt(m.value || "0") ? l : m), legs[0]);
}

function computeFeeModel(fractions: number[]): FeeModel {
  if (!fractions.length) return { fractionPct: null, consistent: false, samples: 0 };
  const sorted = [...fractions].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const pct = median * 100;
  // Round to a clean value if everything is close to it.
  const rounded = Math.round(pct * 100) / 100;
  const spread = sorted[sorted.length - 1] - sorted[0];
  const consistent = spread < 0.002; // within 0.2 percentage points
  return { fractionPct: rounded, consistent, samples: fractions.length };
}

function letter(i: number): string {
  // A, B, ... Z, AA, AB ...
  let s = "";
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

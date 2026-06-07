import type { SolExtract, SolTx, SolDelta } from "@/explorer/solana";
import {
  INFRA_PROGRAMS,
  STABLECOINS,
  isSolanaTestnet,
  programLabel,
  solanaExplorerQuery,
  solanaNetworkName,
  SOLANA_EXPLORER,
  tokenStandard,
} from "@/explorer/solanaRegistry";
import type { Cast, FeeModel, Leg, Operation, Party, PaymentToken, ReportModel } from "./types";

const NEW_SUPPLY = "—new supply—";
const BURNED = "—burned—";

function topKey(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestN = -1;
  for (const [k, v] of counts) if (v > bestN) ((best = k), (bestN = v));
  return best;
}
function letter(i: number): string {
  let s = "";
  i += 1;
  while (i > 0) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}
function computeFeeModel(fractions: number[]): FeeModel {
  if (!fractions.length) return { fractionPct: null, consistent: false, samples: 0 };
  const sorted = [...fractions].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const spread = sorted[sorted.length - 1] - sorted[0];
  return { fractionPct: Math.round(median * 10000) / 100, consistent: spread < 0.002, samples: fractions.length };
}

interface OwnerAgg {
  owner: string;
  asset: number;
  pay: number;
}

export function buildSolanaReportModel(data: SolExtract, now: Date): ReportModel {
  const assetMint = data.token.mint;
  const dec = data.token.decimals;

  // ---- Detect the payment token (registered stablecoin, else most-moved non-asset mint) ----
  const payCounts = new Map<string, number>();
  for (const tx of data.txs) {
    for (const d of tx.deltas) {
      if (d.mint !== assetMint) payCounts.set(d.mint, (payCounts.get(d.mint) ?? 0) + 1);
    }
  }
  let payMint = [...payCounts.keys()].find((m) => STABLECOINS[m]);
  if (!payMint) payMint = topKey(payCounts);
  const paymentToken: PaymentToken | null = payMint
    ? { address: payMint, symbol: STABLECOINS[payMint]?.sym ?? short(payMint), decimals: STABLECOINS[payMint]?.dec ?? 0 }
    : null;

  const feeWalletCounts = new Map<string, number>();
  const poolCounts = new Map<string, number>();
  const operatorCounts = new Map<string, number>();
  const programCounts = new Map<string, number>();
  const investorOrder: string[] = [];
  const issuanceRecipients = new Map<string, number>();
  const feeFractions: number[] = [];

  const operations: Operation[] = [];

  for (const tx of data.txs) {
    if (tx.feePayer) operatorCounts.set(tx.feePayer, (operatorCounts.get(tx.feePayer) ?? 0) + 1);
    for (const p of tx.programs) if (!INFRA_PROGRAMS.has(p)) programCounts.set(p, (programCounts.get(p) ?? 0) + 1);

    const assetDeltas = tx.deltas.filter((d) => d.mint === assetMint);
    const payDeltas = payMint ? tx.deltas.filter((d) => d.mint === payMint) : [];
    const op = classify(tx, assetDeltas, payDeltas, dec, data.token.symbol, paymentToken?.symbol ?? "USDC");

    // Tally role counters from this op.
    if (op.feeWallet) feeWalletCounts.set(op.feeWallet, (feeWalletCounts.get(op.feeWallet) ?? 0) + 1);
    if (op.liquidity) poolCounts.set(op.liquidity, (poolCounts.get(op.liquidity) ?? 0) + 1);
    if ((op.kind === "buy" || op.kind === "sell") && op.investor) {
      if (!investorOrder.includes(op.investor)) investorOrder.push(op.investor);
      if (op.gross && op.fee != null && op.gross > 0) feeFractions.push(op.fee / op.gross);
    }
    if (op.kind === "mint" || op.kind === "dividend") {
      if (op.recipient) issuanceRecipients.set(op.recipient, (issuanceRecipients.get(op.recipient) ?? 0) + 1);
    }
    operations.push(op);
  }

  operations.forEach((o, i) => (o.n = i + 1));

  const buys = operations.filter((o) => o.kind === "buy");
  const sells = operations.filter((o) => o.kind === "sell");
  const mints = operations.filter((o) => o.kind === "mint" || o.kind === "dividend");

  const fee = computeFeeModel(feeFractions);

  // ---- Cast & labels ----
  const treasury = data.token.mintAuthority ?? topKey(issuanceRecipients);
  const poolAddr = topKey(poolCounts);
  const feeWalletAddr = topKey(feeWalletCounts);
  const operatorAddr = topKey(operatorCounts);

  const labelOf: Record<string, string> = {};
  const set = (a: string | undefined | null, l: string) => {
    if (a) labelOf[a] = l;
  };
  set(treasury, "Treasury / Issuer");
  set(poolAddr, "Liquidity pool");
  set(feeWalletAddr, "Fee account");
  set(operatorAddr, "Operator");
  labelOf[NEW_SUPPLY] = "New supply";
  labelOf[BURNED] = "Burned";

  const investors: Party[] = investorOrder
    .filter((a) => a !== treasury && a !== poolAddr)
    .map((a, i) => {
      const lbl = `Investor ${letter(i)}`;
      if (!labelOf[a]) labelOf[a] = lbl;
      return { address: a, label: lbl };
    });

  const party = (addr: string | undefined | null, label: string): Party | undefined =>
    addr ? { address: addr, label } : undefined;

  // Top programs across all txs (trade program, AMM…), friendly-labelled.
  const programParties: Party[] = [...programCounts.keys()].map((p) => ({ address: p, label: programLabel(p) }));

  const cast: Cast = {
    treasury: party(treasury, "Treasury / Issuer"),
    market: programParties[0] ? { address: programParties[0].address, label: programParties[0].label } : undefined,
    feeWallet: party(feeWalletAddr, "Fee account"),
    liquidity: party(poolAddr, "Liquidity pool"),
    operator: party(operatorAddr, "Operator"),
    investors,
    idleHolders: [],
  };

  // ---- Ledger: one row per asset movement, newest first ----
  const ledger = operations
    .filter((o) => o.assetQty > 0 && o.kind !== "setup")
    .map((o, i) => {
      const assetLeg = o.legs.find((l) => l.role === "share" || l.role === "mint" || l.role === "burn");
      return {
        n: i + 1,
        kind: o.kind,
        from: assetLeg?.from ?? "—",
        to: assetLeg?.to ?? "—",
        qty: o.assetQty,
        txHash: o.txHash,
        block: o.block,
        timestamp: o.timestamp,
      };
    });

  const sampleBuy = buys.find((o) => o.fee != null) ?? buys[0];
  const sampleSell = sells.find((o) => o.fee != null) ?? sells[0];

  const supplyNum = Number(data.token.supplyUi.replace(/,/g, "")) || 0;

  return {
    chainKind: "solana",
    token: {
      address: assetMint,
      name: data.token.name,
      symbol: data.token.symbol,
      decimals: dec,
      totalSupply: supplyNum,
      totalSupplyRaw: data.token.supplyUi,
      holders: null,
      type: tokenStandard(data.token.standardProgram),
      standard: tokenStandard(data.token.standardProgram),
      extensions: data.token.extensions,
    },
    chainName: solanaNetworkName(data.cluster),
    testnet: isSolanaTestnet(data.cluster),
    explorerBase: SOLANA_EXPLORER,
    explorerQuery: solanaExplorerQuery(data.cluster),
    sourceLabel: `Solana JSON-RPC (${data.cluster})`,
    dataAsOf: now.toISOString(),
    transferCount: data.signatureCount,
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

function short(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function aggregate(assetDeltas: SolDelta[], payDeltas: SolDelta[]): Map<string, OwnerAgg> {
  const m = new Map<string, OwnerAgg>();
  const add = (owner: string, asset: number, pay: number) => {
    const cur = m.get(owner) ?? { owner, asset: 0, pay: 0 };
    cur.asset += asset;
    cur.pay += pay;
    m.set(owner, cur);
  };
  for (const d of assetDeltas) add(d.owner, d.delta, 0);
  for (const d of payDeltas) add(d.owner, 0, d.delta);
  return m;
}

function mkLeg(role: Leg["role"], from: string, to: string, amount: number, symbol: string, decimals: number): Leg {
  return { role, from, to, amount, amountRaw: String(amount), symbol, decimals };
}

function classify(
  tx: SolTx,
  assetDeltas: SolDelta[],
  payDeltas: SolDelta[],
  assetDec: number,
  assetSym: string,
  paySym: string,
): Operation {
  const base: Operation = {
    n: 0,
    kind: "setup",
    txHash: tx.signature,
    block: tx.slot,
    timestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
    method: programLabel(tx.topProgram ?? ""),
    assetQty: 0,
    legs: [],
    programs: tx.programs.filter((p) => !INFRA_PROGRAMS.has(p)).map(programLabel),
  };

  const assetPos = assetDeltas.filter((d) => d.delta > 0);
  const assetNeg = assetDeltas.filter((d) => d.delta < 0);
  const agg = aggregate(assetDeltas, payDeltas);
  const owners = [...agg.values()];

  // No token movement at all → setup/config (thaw/freeze/pause/approve).
  if (assetDeltas.length === 0 && payDeltas.length === 0) {
    return { ...base, kind: "setup" };
  }

  // Provisioning: a single owner sends BOTH asset and payment (seeding) → treat as transfer.
  const seeder = owners.find((o) => o.asset < 0 && o.pay < 0);
  if (seeder && payDeltas.length > 0 && assetNeg.length > 0) {
    const recipient = owners.find((o) => o.asset > 0);
    return {
      ...base,
      kind: "transfer",
      method: "provisioning (seeding)",
      investor: recipient?.owner,
      assetQty: recipient ? recipient.asset : Math.abs(seeder.asset),
      legs: [mkLeg("share", seeder.owner, recipient?.owner ?? BURNED, Math.abs(seeder.asset), assetSym, assetDec)],
    };
  }

  // Issuance / dividend: asset created (only positives, no negatives) and no payment.
  if (assetNeg.length === 0 && assetPos.length > 0 && payDeltas.length === 0) {
    const qty = assetPos.reduce((s, d) => s + d.delta, 0);
    const kind = assetPos.length >= 3 ? "dividend" : "mint";
    return {
      ...base,
      kind,
      recipient: assetPos[0].owner,
      assetQty: qty,
      legs: assetPos.map((d) => mkLeg("mint", NEW_SUPPLY, d.owner, d.delta, assetSym, assetDec)),
    };
  }

  // Burn / redemption: asset destroyed (only negatives) and no buyer payment.
  if (assetPos.length === 0 && assetNeg.length > 0 && payDeltas.length === 0) {
    const qty = Math.abs(assetNeg.reduce((s, d) => s + d.delta, 0));
    return {
      ...base,
      kind: "burn",
      assetQty: qty,
      legs: assetNeg.map((d) => mkLeg("burn", d.owner, BURNED, Math.abs(d.delta), assetSym, assetDec)),
    };
  }

  // Trade: same owner is on both legs → that owner is the investor.
  const buyer = owners.find((o) => o.pay < 0 && o.asset > 0);
  const seller = owners.find((o) => o.asset < 0 && o.pay > 0);
  if ((buyer || seller) && payDeltas.length > 0) {
    const positives = payDeltas.filter((d) => d.delta > 0).sort((a, b) => a.delta - b.delta);
    if (buyer) {
      // Buy: investor spent `gross`, received asset; counterparty = asset sender.
      const counterparty = assetNeg[0]?.owner;
      const gross = -buyer.pay;
      // fee = smallest positive that is NOT the net recipient; net recipient = largest positive
      const feeLeg = positives.length >= 2 ? positives[0] : undefined;
      const fee = feeLeg ? feeLeg.delta : 0;
      const net = gross - fee;
      const assetQty = buyer.asset;
      return {
        ...base,
        kind: "buy",
        investor: buyer.owner,
        liquidity: counterparty,
        feeWallet: feeLeg?.owner ?? null,
        gross,
        fee: feeLeg ? fee : undefined,
        net,
        impliedPrice: assetQty > 0 ? gross / assetQty : null,
        assetQty,
        legs: [
          mkLeg("pay", buyer.owner, counterparty ?? "—", gross, paySym, 0),
          ...(feeLeg ? [mkLeg("fee", counterparty ?? "—", feeLeg.owner, fee, paySym, 0)] : []),
          mkLeg("share", counterparty ?? "—", buyer.owner, assetQty, assetSym, assetDec),
        ],
      };
    }
    // Sell: investor sent asset, received `net`; counterparty = payer (negative) / asset receiver.
    const inv = seller!;
    const counterparty = assetPos[0]?.owner ?? payDeltas.find((d) => d.delta < 0)?.owner;
    const net = inv.pay;
    const feeLeg = positives.find((p) => p.owner !== inv.owner);
    const fee = feeLeg ? feeLeg.delta : 0;
    const gross = net + fee;
    const assetQty = Math.abs(inv.asset);
    return {
      ...base,
      kind: "sell",
      investor: inv.owner,
      liquidity: counterparty,
      feeWallet: feeLeg?.owner ?? null,
      gross,
      fee: feeLeg ? fee : undefined,
      net,
      impliedPrice: assetQty > 0 ? gross / assetQty : null,
      assetQty,
      legs: [
        mkLeg("share", inv.owner, counterparty ?? "—", assetQty, assetSym, assetDec),
        mkLeg("net", counterparty ?? "—", inv.owner, net, paySym, 0),
        ...(feeLeg ? [mkLeg("fee", counterparty ?? "—", feeLeg.owner, fee, paySym, 0)] : []),
      ],
    };
  }

  // Plain transfer of the asset (no payment, both ends present).
  if (assetNeg.length > 0 && assetPos.length > 0) {
    const qty = assetPos.reduce((s, d) => s + d.delta, 0);
    return {
      ...base,
      kind: "transfer",
      investor: assetPos[0].owner,
      assetQty: qty,
      legs: [mkLeg("share", assetNeg[0].owner, assetPos[0].owner, qty, assetSym, assetDec)],
    };
  }

  // Fallback: movement we couldn't categorize → setup.
  return { ...base, kind: "setup" };
}

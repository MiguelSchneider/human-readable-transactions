import type { Leg, Operation, OpKind, ReportModel } from "@/model/types";
import { CSS_TYPE_B, FONT_LINKS } from "./designSystem";
import { escapeHtml, fmtAmount, labelled, refLabel, shortAddr, txUrl, whenLabel } from "./format";

function paySym(m: ReportModel): string {
  return m.paymentToken?.symbol ?? "tokens";
}

function hasFee(m: ReportModel): boolean {
  return m.fee.fractionPct != null && m.fee.fractionPct > 0;
}
function feePctText(m: ReportModel): string {
  return hasFee(m) ? `${trimPct(m.fee.fractionPct!)}%` : "";
}
function netPctText(m: ReportModel): string {
  return hasFee(m) ? `${trimPct(100 - m.fee.fractionPct!)}%` : "";
}
function trimPct(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function roleLabel(leg: Leg, m: ReportModel): string {
  switch (leg.role) {
    case "pay":
      return "Payment in";
    case "fee":
      return `Fee ${feePctText(m)}`.trim();
    case "net":
      return `Proceeds ${netPctText(m)}`.trim();
    case "share":
      return "Asset";
    case "mint":
      return "Mint";
    case "burn":
      return "Burn";
  }
}

function amtClass(leg: Leg): string {
  if (leg.role === "fee") return "feeamt";
  if (leg.role === "pay" || leg.role === "net") return "usdc";
  return "asset";
}

// Render an endpoint cell: zero address, a Solana sentinel (new supply / burned), or a labelled wallet.
function cell(m: ReportModel, addr: string): string {
  if (!addr || addr === "—") return "—";
  if (/^0x0+$/.test(addr.toLowerCase())) return `Zero address <span class="addr">0x000…000</span>`;
  if (addr.startsWith("—")) return escapeHtml(m.labelOf[addr] ?? addr.replace(/—/g, "").trim());
  return labelled(m, addr);
}

function movementRows(op: Operation, m: ReportModel): string {
  return op.legs
    .map((leg) => {
      const unit = escapeHtml(leg.symbol);
      return `        <tr><td><span class="rl ${leg.role}">${escapeHtml(roleLabel(leg, m))}</span></td><td class="mn">${cell(m, leg.from)}</td><td class="arrow">→</td><td class="mn">${cell(m, leg.to)}</td><td class="amt ${amtClass(leg)}">${fmtAmount(leg.amount)} ${unit}</td></tr>`;
    })
    .join("\n");
}

const BADGE: Record<OpKind, string> = {
  buy: "Buy",
  sell: "Sell",
  mint: "Issuance",
  dividend: "Dividend",
  burn: "Redemption",
  transfer: "Transfer",
  setup: "Setup",
};

function title(op: Operation, m: ReportModel): string {
  const sym = escapeHtml(m.token.symbol);
  const inv = op.investor ? plainLabel(m, op.investor) : "Investor";
  const qty = fmtAmount(op.assetQty);
  const ps = escapeHtml(paySym(m));
  switch (op.kind) {
    case "mint":
      return `${qty} ${sym} minted to ${escapeHtml(op.recipient ? plainLabel(m, op.recipient) : "recipient")}`;
    case "dividend":
      return `${qty} ${sym} distributed (dividend)`;
    case "burn":
      return `${qty} ${sym} redeemed / burned`;
    case "transfer":
      return op.method === "provisioning (seeding)" ? `Provisioning: ${qty} ${sym} (+ ${ps}) seeded` : `${qty} ${sym} transferred to ${escapeHtml(inv)}`;
    case "setup":
      return `Compliance / setup${op.method ? ` · ${escapeHtml(op.method)}` : ""}`;
    case "buy":
      return op.gross != null ? `${escapeHtml(inv)} buys ${qty} ${sym} for ${fmtAmount(op.gross)} ${ps}` : `${escapeHtml(inv)} buys ${qty} ${sym}`;
    case "sell":
      return op.gross != null ? `${escapeHtml(inv)} sells ${qty} ${sym} back for ${fmtAmount(op.gross)} ${ps}` : `${escapeHtml(inv)} sells ${qty} ${sym}`;
  }
}

function plainLabel(m: ReportModel, addr: string): string {
  return m.labelOf[addr.toLowerCase()] ?? shortAddr(addr);
}

function narrative(op: Operation, m: ReportModel): string {
  const sym = escapeHtml(m.token.symbol);
  const ps = escapeHtml(paySym(m));
  const source = m.chainKind === "solana" ? "by the mint authority" : "directly from the zero address";
  if (op.kind === "mint") {
    return `New <b>${sym}</b> is created ${source} and delivered to the recipient. There is no payment and no fee — this is pure issuance that increases the circulating supply.`;
  }
  if (op.kind === "dividend") {
    return `New <b>${sym}</b> is minted to several holders at once — a distribution/dividend. No payment token moves; the circulating supply increases.`;
  }
  if (op.kind === "burn") {
    return `<b>${fmtAmount(op.assetQty)} ${sym}</b> is destroyed (redeemed/burned), reducing the circulating supply. No payment leg is involved on-chain.`;
  }
  if (op.kind === "transfer") {
    return op.method === "provisioning (seeding)"
      ? `One wallet seeds another with both <b>${sym}</b> and ${ps} — funding/provisioning, <b>not</b> a trade (there is no fee leg).`
      : `<b>${fmtAmount(op.assetQty)} ${sym}</b> moves between two wallets, with no payment token and no fee — a plain transfer.`;
  }
  if (op.kind === "setup") {
    return `A configuration / compliance transaction (e.g. thaw, freeze, approve, or pause) that references the token but moves no balances. Common on permissioned Token-2022 assets.`;
  }
  if (op.paymentMissing) {
    return op.kind === "buy"
      ? `The treasury delivers <b>${fmtAmount(op.assetQty)} ${sym}</b> to the buyer. The payment-token legs for this transaction could not be retrieved, so only the asset movement is shown.`
      : `The investor returns <b>${fmtAmount(op.assetQty)} ${sym}</b> to the treasury. The payment-token legs for this transaction could not be retrieved.`;
  }
  if (op.kind === "buy") {
    const netTxt = op.net != null ? `forwards <b>${fmtAmount(op.net)} ${ps}</b> to the treasury` : "forwards the payment to the treasury";
    const middle =
      op.fee != null
        ? `instantly takes a <b>${fmtAmount(op.fee)} ${ps}</b> fee (${feePctText(m)}), ${netTxt}`
        : `instantly ${netTxt}`;
    return `The buyer pays <b>${op.gross != null ? fmtAmount(op.gross) + " " + ps : ps}</b> into the market contract, which ${middle}, and the treasury delivers <b>${fmtAmount(op.assetQty)} ${sym}</b> to the buyer. Every leg settles in the same transaction.`;
  }
  const netTxt = op.net != null ? `<b>${fmtAmount(op.net)} ${ps}</b>` : "the proceeds";
  const feeClause = op.fee != null ? ` and a <b>${fmtAmount(op.fee)} ${ps}</b> fee (${feePctText(m)}) to the fee wallet` : "";
  return `The investor returns <b>${fmtAmount(op.assetQty)} ${sym}</b> to the treasury. In the same transaction the liquidity wallet pays out ${netTxt} to the investor${feeClause}.`;
}

function opCard(op: Operation, m: ReportModel): string {
  const badge = BADGE[op.kind];
  const when = whenLabel(op.timestamp, op.block);
  const ref = refLabel(m, op.block);
  const foot: string[] = [];
  if (op.method && op.kind !== "setup") foot.push(`<span><b>Method:</b> ${escapeHtml(op.method)}</span>`);
  if (op.impliedPrice != null) foot.push(`<span><b>Implied price:</b> ${fmtAmount(op.impliedPrice)} ${escapeHtml(paySym(m))}/${escapeHtml(m.token.symbol)}</span>`);
  foot.push(`<span><b>tx:</b> <a href="${txUrl(m, op.txHash)}" target="_blank" rel="noopener">${shortAddr(op.txHash)}</a></span>`);

  const progs =
    m.chainKind === "solana" && op.programs && op.programs.length
      ? `      <div class="op-progs"><span class="lbl">Programs</span>${op.programs.map((p) => `<span class="prog">${escapeHtml(p)}</span>`).join("")}</div>\n`
      : "";

  const table = op.legs.length
    ? `      <table class="mv">
        <tr><th>Role</th><th>From</th><th></th><th>To</th><th style="text-align:right">Amount</th></tr>
${movementRows(op, m)}
      </table>\n`
    : "";

  return `  <div class="op ${op.kind}">
    <div class="op-head">
      <div class="opnum">${op.n}</div>
      <div class="h"><span class="badge ${op.kind}">${badge}</span><div class="op-title">${title(op, m)}</div></div>
      <div class="op-when">${escapeHtml(when)}${ref ? `<br>${ref}` : ""}</div>
    </div>
    <div class="op-body">
      <p class="op-narr">${narrative(op, m)}</p>
${progs}${table}      <div class="op-foot">${foot.join("")}</div>
    </div>
  </div>`;
}

export function renderTypeB(m: ReportModel): string {
  const ps = escapeHtml(paySym(m));
  const sym = escapeHtml(m.token.symbol);
  const totalOps = m.operations.length;
  const trades = m.buys.length + m.sells.length;

  const priceNote = m.testnet
    ? `Numbering is newest→oldest. This is testnet data: amounts and implied prices are for testing and do not represent real value.`
    : `Numbering is newest→oldest. Implied prices are computed per trade as payment ÷ ${sym} units.`;

  const tradesSection =
    trades > 0
      ? `  <div class="sect-label">Trades &amp; redemptions</div>
  <div class="sect-h">The market operations</div>
  <p class="sect-p">${m.buys.length} buy${m.buys.length === 1 ? "" : "s"} and ${m.sells.length} sell${m.sells.length === 1 ? "" : "s"}, decoded leg by leg.</p>
${[...m.buys, ...m.sells]
          .sort((a, b) => a.n - b.n)
          .map((op) => opCard(op, m))
          .join("\n")}`
      : "";

  const issuanceSource = m.chainKind === "solana" ? "minted by the issuer" : "created from the zero address";
  const mintsSection =
    m.mints.length > 0
      ? `  <div class="sect-label">Issuances</div>
  <div class="sect-h">The creation events</div>
  <p class="sect-p">No payment, no fee — supply ${issuanceSource}.</p>
${m.mints.map((op) => opCard(op, m)).join("\n")}`
      : "";

  const others = m.operations.filter((o) => o.kind === "burn" || o.kind === "transfer" || o.kind === "setup");
  const otherSection =
    others.length > 0
      ? `  <div class="sect-label">Other activity</div>
  <div class="sect-h">Transfers, redemptions &amp; setup</div>
  <p class="sect-p">${others.length} transaction${others.length === 1 ? "" : "s"} that aren't trades — plain transfers, burns, and (on permissioned tokens) compliance/config calls.</p>
${others.map((op) => opCard(op, m)).join("\n")}`
      : "";

  const players = buildPlayers(m);

  const provenance = `Decoded from the ${escapeHtml(m.chainName)} ledger via ${escapeHtml(m.sourceLabel)} as of ${escapeHtml(new Date(m.dataAsOf).toUTCString())}. Amounts use each token's own decimals (${sym}: ${m.token.decimals}${m.paymentToken ? `, ${ps}: ${m.paymentToken.decimals}` : ""}). ${m.truncated ? "Note: history was long and was truncated at the safety cap — not every transfer is shown. " : ""}Informational document — not financial or investment advice.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${sym} — all ${totalOps} operations, decoded</title>
${FONT_LINKS}
<style>${CSS_TYPE_B}</style>
</head>
<body><div class="wrap">

  <header class="top">
    <div class="kicker">On-chain activity · Transaction-by-transaction</div>
    <h1>All ${totalOps} operations, <em>decoded one by one</em></h1>
    <p class="dek">What moved inside every ${sym} transaction — the asset, the payment token${m.paymentToken ? "" : ""}, and the fee — each leg tagged by role.</p>
    <div class="meta-row">
      <span><b>Asset:</b> ${escapeHtml(m.token.name)} (${sym})</span><span><b>Network:</b> ${escapeHtml(m.chainName)}${m.testnet ? " (testnet)" : ""}</span><span><b>Data as of:</b> ${escapeHtml(new Date(m.dataAsOf).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }))}</span>
    </div>
  </header>

  <div class="legend">
    <h2>How to read each transaction</h2>
    <p>Each trade bundles several token movements into one indivisible transaction. Every card lists those movements with a role tag.</p>
    <div class="roles">
      <span class="role pay">PAYMENT IN · ${ps}</span>${hasFee(m) ? `<span class="role fee">FEE · ${feePctText(m)}</span>` : ""}
      <span class="role net">${hasFee(m) ? `PROCEEDS · ${netPctText(m)}` : "PROCEEDS"}</span><span class="role share">ASSET · ${sym}</span><span class="role mint">MINT</span>
    </div>
  </div>
  <div class="price-note">${escapeHtml(priceNote)}</div>

${tradesSection}

${mintsSection}

${otherSection}

  <footer>
    <p><b>Players referenced:</b> ${players}</p>
    <p>${provenance}</p>
  </footer>

</div></body>
</html>`;
}

function buildPlayers(m: ReportModel): string {
  const items: string[] = [];
  const add = (label: string, addr?: string) => {
    if (addr) items.push(`${escapeHtml(label)} → <span class="addr">${escapeHtml(addr)}</span>`);
  };
  add("Treasury", m.cast.treasury?.address);
  add("Market contract", m.cast.market?.address);
  add("Fee wallet", m.cast.feeWallet?.address);
  add("Liquidity wallet", m.cast.liquidity?.address);
  add("Operator", m.cast.operator?.address);
  add(`${m.token.symbol} token`, m.token.address);
  if (m.paymentToken) add(`${m.paymentToken.symbol} token`, m.paymentToken.address);
  for (const inv of m.cast.investors) add(inv.label, inv.address);
  return items.join(" · ");
}

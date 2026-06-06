import type { Operation, ReportModel } from "@/model/types";
import { CSS_TYPE_A, FONT_LINKS } from "./designSystem";
import { escapeHtml, fmtAmount, fmtDateShort, shortAddr, whenLabel } from "./format";
import { explorerTxUrl } from "@/explorer/chains";

function paySym(m: ReportModel): string {
  return m.paymentToken?.symbol ?? "the payment token";
}
function trimPct(n: number): string {
  return Number(n.toFixed(2)).toString();
}
function hasFee(m: ReportModel): boolean {
  return m.fee.fractionPct != null && m.fee.fractionPct > 0;
}
function feePct(m: ReportModel): string {
  return hasFee(m) ? `${trimPct(m.fee.fractionPct!)}%` : "a small fee";
}
function netPct(m: ReportModel): string {
  return hasFee(m) ? `${trimPct(100 - m.fee.fractionPct!)}%` : "the remainder";
}
function chainHack(m: ReportModel) {
  return { explorer: m.explorerBase } as any;
}

// ---------- SVG diagrams (orthogonal arrows + polygon arrowheads, per design-system) ----------
function buyDiagram(m: ReportModel, op: Operation): string {
  const inv = shortAddr(op.investor);
  const mk = shortAddr(op.market ?? op.treasury);
  const tr = shortAddr(op.treasury);
  const fw = shortAddr(op.feeWallet);
  const gross = op.gross != null ? `${fmtAmount(op.gross)} ${escapeHtml(paySymShort(m))}` : escapeHtml(paySymShort(m));
  const net = op.net != null ? `${fmtAmount(op.net)} ${escapeHtml(paySymShort(m))}` : "—";
  const fee = op.fee != null ? `${fmtAmount(op.fee)} ${escapeHtml(paySymShort(m))}` : "—";
  const asset = `${fmtAmount(op.assetQty)} ${escapeHtml(m.token.symbol)}`;
  const cap = `Real trade · tx ${shortAddr(op.txHash)} · ${whenLabel(op.timestamp, op.block)} · green = ${escapeHtml(paySymShort(m))} · ink = ${escapeHtml(m.token.symbol)} · clay = fee`;
  return `<div class="diagram">
      <svg viewBox="0 0 760 340" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="130" width="172" height="84" rx="9" fill="#1A2238"/>
        <text x="122" y="166" text-anchor="middle" fill="#fff" font-family="Fraunces,serif" font-size="15" font-weight="600">Investor</text>
        <text x="122" y="186" text-anchor="middle" fill="#C9A85E" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(inv)}</text>
        <rect x="300" y="122" width="176" height="100" rx="9" fill="#FBF9F2" stroke="#1A2238" stroke-width="1.6"/>
        <text x="388" y="170" text-anchor="middle" fill="#1A2238" font-family="Fraunces,serif" font-size="14" font-weight="600">Market contract</text>
        <text x="388" y="190" text-anchor="middle" fill="#6B7390" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(mk)}</text>
        <rect x="552" y="34" width="176" height="84" rx="9" fill="#1A2238"/>
        <text x="640" y="70" text-anchor="middle" fill="#fff" font-family="Fraunces,serif" font-size="14" font-weight="600">Treasury</text>
        <text x="640" y="90" text-anchor="middle" fill="#C9A85E" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(tr)}</text>
        <rect x="552" y="226" width="176" height="84" rx="9" fill="#F0E2DB" stroke="#9C4A2E" stroke-width="1.2"/>
        <text x="640" y="262" text-anchor="middle" fill="#9C4A2E" font-family="Fraunces,serif" font-size="14" font-weight="600">Fee wallet</text>
        <text x="640" y="282" text-anchor="middle" fill="#9C4A2E" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(fw)}</text>
        <line x1="208" y1="172" x2="295" y2="172" stroke="#2E6B4F" stroke-width="2.2"/>
        <polygon points="300,172 291,167 291,177" fill="#2E6B4F"/>
        <rect x="206" y="148" width="94" height="16" rx="8" fill="#E0EBE3"/><text x="253" y="159" text-anchor="middle" fill="#2E6B4F" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(gross)}</text>
        <line x1="476" y1="158" x2="549" y2="92" stroke="#2E6B4F" stroke-width="2.2"/>
        <g transform="translate(552,90) rotate(-42)"><polygon points="0,0 -10,-5 -10,5" fill="#2E6B4F"/></g>
        <rect x="466" y="112" width="100" height="16" rx="8" fill="#E0EBE3"/><text x="516" y="123" text-anchor="middle" fill="#2E6B4F" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(net)}</text>
        <line x1="476" y1="186" x2="549" y2="252" stroke="#9C4A2E" stroke-width="2.2"/>
        <g transform="translate(552,254) rotate(42)"><polygon points="0,0 -10,-5 -10,5" fill="#9C4A2E"/></g>
        <rect x="468" y="216" width="96" height="16" rx="8" fill="#F0E2DB"/><text x="516" y="227" text-anchor="middle" fill="#9C4A2E" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(fee)}</text>
        <polyline points="640,118 640,312 122,312 122,218" fill="none" stroke="#1A2238" stroke-width="2.2"/>
        <polygon points="122,214 117,224 127,224" fill="#1A2238"/>
        <rect x="300" y="303" width="160" height="18" rx="9" fill="#1A2238"/><text x="380" y="315" text-anchor="middle" fill="#fff" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(asset)}</text>
      </svg>
      <div class="cap">${escapeHtml(cap)}</div>
    </div>`;
}

function sellDiagram(m: ReportModel, op: Operation): string {
  const inv = shortAddr(op.investor);
  const tr = shortAddr(op.treasury);
  const lq = shortAddr(op.liquidity ?? op.market);
  const fw = shortAddr(op.feeWallet);
  const net = op.net != null ? `${fmtAmount(op.net)} ${escapeHtml(paySymShort(m))}` : "—";
  const fee = op.fee != null ? `${fmtAmount(op.fee)} ${escapeHtml(paySymShort(m))}` : "—";
  const asset = `${fmtAmount(op.assetQty)} ${escapeHtml(m.token.symbol)}`;
  const cap = `Real trade · tx ${shortAddr(op.txHash)} · ${whenLabel(op.timestamp, op.block)} · green = ${escapeHtml(paySymShort(m))} · ink = ${escapeHtml(m.token.symbol)} · clay = fee`;
  return `<div class="diagram">
      <svg viewBox="0 0 760 340" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="130" width="176" height="84" rx="9" fill="#1A2238"/>
        <text x="124" y="166" text-anchor="middle" fill="#fff" font-family="Fraunces,serif" font-size="15" font-weight="600">Investor</text>
        <text x="124" y="186" text-anchor="middle" fill="#C9A85E" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(inv)}</text>
        <rect x="300" y="34" width="180" height="84" rx="9" fill="#1A2238"/>
        <text x="390" y="70" text-anchor="middle" fill="#fff" font-family="Fraunces,serif" font-size="14" font-weight="600">Treasury</text>
        <text x="390" y="90" text-anchor="middle" fill="#C9A85E" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(tr)}</text>
        <rect x="300" y="226" width="180" height="84" rx="9" fill="#E0EBE3" stroke="#2E6B4F" stroke-width="1.2"/>
        <text x="390" y="262" text-anchor="middle" fill="#2E6B4F" font-family="Fraunces,serif" font-size="13" font-weight="600">${escapeHtml(m.paymentToken?.symbol ?? "Payment")} liquidity</text>
        <text x="390" y="282" text-anchor="middle" fill="#2E6B4F" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(lq)}</text>
        <rect x="556" y="226" width="172" height="84" rx="9" fill="#F0E2DB" stroke="#9C4A2E" stroke-width="1.2"/>
        <text x="642" y="262" text-anchor="middle" fill="#9C4A2E" font-family="Fraunces,serif" font-size="14" font-weight="600">Fee wallet</text>
        <text x="642" y="282" text-anchor="middle" fill="#9C4A2E" font-family="IBM Plex Mono,monospace" font-size="11">${escapeHtml(fw)}</text>
        <polyline points="124,130 124,76 294,76" fill="none" stroke="#1A2238" stroke-width="2.2"/>
        <polygon points="300,76 291,71 291,81" fill="#1A2238"/>
        <rect x="146" y="58" width="100" height="16" rx="8" fill="#1A2238"/><text x="196" y="69" text-anchor="middle" fill="#fff" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(asset)}</text>
        <polyline points="300,268 124,268 124,218" fill="none" stroke="#2E6B4F" stroke-width="2.2"/>
        <polygon points="124,214 119,224 129,224" fill="#2E6B4F"/>
        <rect x="158" y="250" width="108" height="16" rx="8" fill="#E0EBE3"/><text x="212" y="261" text-anchor="middle" fill="#2E6B4F" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(net)}</text>
        <line x1="480" y1="268" x2="549" y2="268" stroke="#9C4A2E" stroke-width="2.2"/>
        <polygon points="556,268 547,263 547,273" fill="#9C4A2E"/>
        <rect x="480" y="244" width="84" height="16" rx="8" fill="#F0E2DB"/><text x="522" y="255" text-anchor="middle" fill="#9C4A2E" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="600">${escapeHtml(fee)}</text>
      </svg>
      <div class="cap">${escapeHtml(cap)}</div>
    </div>`;
}

function paySymShort(m: ReportModel): string {
  return m.paymentToken?.symbol ?? "PAY";
}

function castRows(m: ReportModel): string {
  const rows: string[] = [];
  const row = (who: string, addr: string | undefined, desc: string) => {
    if (!addr) return;
    rows.push(`      <div class="row"><div class="who">${escapeHtml(who)}<small>${escapeHtml(shortAddr(addr))}</small></div><div class="desc">${desc}</div></div>`);
  };
  const sym = escapeHtml(m.token.symbol);
  const ps = escapeHtml(paySym(m));
  row("Treasury", m.cast.treasury?.address, `Holds the ${sym} inventory. It receives the initial mint(s) and is the counterparty that hands out the asset on buys and takes it back on sells.`);
  row("Market contract", m.cast.market?.address, `The contract each trade interacts with. It routes the ${ps} payment, splits off the fee, and triggers the asset transfer in one atomic step.`);
  row("Fee wallet", m.cast.feeWallet?.address, `Receives ${feePct(m)} of the payment on every trade — the platform's revenue.`);
  row("Liquidity wallet", m.cast.liquidity?.address, `Source of ${ps} funds paid out to investors when they sell.`);
  row("Operator", m.cast.operator?.address, `Signs and submits the transactions and pays the gas, so investors transact without holding native gas tokens.`);
  if (m.cast.investors.length) {
    const list = m.cast.investors.map((i) => `${escapeHtml(i.label)} (${escapeHtml(shortAddr(i.address))})`).join(", ");
    rows.push(`      <div class="row"><div class="who">Investors<small>${m.cast.investors.length} address${m.cast.investors.length === 1 ? "" : "es"}</small></div><div class="desc">The buyers and sellers: ${list}.</div></div>`);
  }
  if (m.cast.idleHolders.length) {
    rows.push(`      <div class="row"><div class="who">Idle holders<small>${m.cast.idleHolders.length} address${m.cast.idleHolders.length === 1 ? "" : "es"}</small></div><div class="desc">Received ${sym} (typically a mint) but have not traded.</div></div>`);
  }
  return rows.join("\n");
}

function vocabularyCards(m: ReportModel): string {
  const sym = escapeHtml(m.token.symbol);
  const cards = [
    { term: "Token", tag: "asset", chip: `${sym}`, p: `The asset being traded — a digital share recorded on-chain. Each unit is divisible to ${m.token.decimals} decimals.` },
    { term: "Payment token", tag: "usdc", chip: `${m.paymentToken?.symbol ?? "—"}`, p: `The currency used to pay${m.paymentToken ? ` (${escapeHtml(m.paymentToken.symbol)})` : ""}. Money and asset change hands in the same transaction.` },
    { term: "Wallet", tag: "asset", chip: "0x…", p: `An address that holds tokens. We label each one by what it does — treasury, investor, fee wallet — rather than by its raw hash.` },
    { term: "Smart contract", tag: "asset", chip: "code", p: `Code on the blockchain that enforces the rules of a trade automatically, with no manual settlement.` },
    {
      term: "Fee",
      tag: "fee",
      chip: hasFee(m) ? feePct(m) : "0%",
      p: hasFee(m)
        ? `A ${feePct(m)} cut of the payment taken on every trade and sent to the fee wallet. ${netPct(m)} goes to the counterparty.`
        : `No separate fee leg was observed in these trades — the full payment is forwarded to the treasury.`,
    },
    { term: "Gas", tag: "gold", chip: "fuel", p: `The small network cost to run a transaction. Here the operator pays it, so investors don't need native gas tokens.` },
  ];
  return cards
    .map((c) => `      <div class="card"><p class="term">${escapeHtml(c.term)} <span class="chip ${c.tag}">${escapeHtml(c.chip)}</span></p><p>${c.p}</p></div>`)
    .join("\n");
}

function buySteps(m: ReportModel, op: Operation): string {
  const ps = escapeHtml(paySymShort(m));
  const sym = escapeHtml(m.token.symbol);
  const li: string[] = [];
  li.push(`<li>The investor pays <span class="amt">${op.gross != null ? fmtAmount(op.gross) + " " + ps : ps}</span> into the market contract.</li>`);
  if (op.fee != null) li.push(`<li>The contract sends a <span class="amt">${fmtAmount(op.fee)} ${ps}</span> fee (${feePct(m)}) to the fee wallet.</li>`);
  if (op.net != null) li.push(`<li>It forwards the remaining <span class="amt">${fmtAmount(op.net)} ${ps}</span> (${netPct(m)}) to the treasury.</li>`);
  li.push(`<li>The treasury delivers <span class="amt">${fmtAmount(op.assetQty)} ${sym}</span> to the investor — same transaction.</li>`);
  return `    <ol class="steps">\n      ${li.join("\n      ")}\n    </ol>`;
}

function sellSteps(m: ReportModel, op: Operation): string {
  const ps = escapeHtml(paySymShort(m));
  const sym = escapeHtml(m.token.symbol);
  const li: string[] = [];
  li.push(`<li>The investor returns <span class="amt">${fmtAmount(op.assetQty)} ${sym}</span> to the treasury.</li>`);
  if (op.net != null) li.push(`<li>The liquidity wallet pays the investor <span class="amt">${fmtAmount(op.net)} ${ps}</span> (${netPct(m)}).</li>`);
  if (op.fee != null) li.push(`<li>A <span class="amt">${fmtAmount(op.fee)} ${ps}</span> fee (${feePct(m)}) goes to the fee wallet.</li>`);
  return `    <ol class="steps">\n      ${li.join("\n      ")}\n    </ol>`;
}

function movementTable(op: Operation): string {
  const rows = op.legs
    .map((leg) => {
      const move =
        leg.role === "pay" ? "Payment" : leg.role === "fee" ? "Fee" : leg.role === "net" ? "Proceeds" : leg.role === "share" ? "Asset" : "Mint";
      const unit = leg.symbol;
      return `        <tr><td>${escapeHtml(move)}</td><td class="mono">${escapeHtml(shortAddr(leg.from))}</td><td class="mono">${escapeHtml(shortAddr(leg.to))}</td><td class="num">${fmtAmount(leg.amount)} ${escapeHtml(unit)}</td></tr>`;
    })
    .join("\n");
  return `    <div class="scroll"><table>
      <thead><tr><th>Movement</th><th>From</th><th>To</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table></div>`;
}

function feeTable(m: ReportModel): string {
  const ps = escapeHtml(paySymShort(m));
  const trades = [...m.buys, ...m.sells].filter((o) => o.fee != null).sort((a, b) => a.n - b.n).slice(0, 12);
  if (!trades.length) return "";
  const rows = trades
    .map(
      (o) =>
        `        <tr><td><span class="tag ${o.kind}">${o.kind === "buy" ? "Buy" : "Sell"}</span> ${escapeHtml(shortAddr(o.txHash))}</td><td class="num">${o.gross != null ? fmtAmount(o.gross) : "—"}</td><td class="num">${fmtAmount(o.fee!)}</td><td class="num">${o.net != null ? fmtAmount(o.net) : "—"}</td></tr>`,
    )
    .join("\n");
  return `    <div class="scroll"><table>
      <thead><tr><th>Operation</th><th style="text-align:right">Gross (${ps})</th><th style="text-align:right">Fee (${ps})</th><th style="text-align:right">Net (${ps})</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table></div>`;
}

function ledgerTable(m: ReportModel): string {
  const sym = escapeHtml(m.token.symbol);
  const rows = m.ledger
    .slice(0, 400)
    .map(
      (r) =>
        `        <tr><td>${r.n}</td><td><span class="tag ${r.kind}">${r.kind === "buy" ? "Buy" : r.kind === "sell" ? "Sell" : "Mint"}</span></td><td class="mono">${escapeHtml(shortAddr(r.from))}</td><td class="mono">${escapeHtml(shortAddr(r.to))}</td><td class="num">${fmtAmount(r.qty)}</td><td class="mono"><a href="${explorerTxUrl(chainHack(m), r.txHash)}" target="_blank" rel="noopener">${escapeHtml(shortAddr(r.txHash))}</a></td></tr>`,
    )
    .join("\n");
  return `    <div class="scroll"><table>
      <thead><tr><th>#</th><th>Type</th><th>From</th><th>To</th><th style="text-align:right">${sym}</th><th>Transaction</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table></div>`;
}

function appendixRows(m: ReportModel): string {
  const items: { lab: string; addr: string }[] = [];
  const push = (lab: string, addr?: string) => addr && items.push({ lab, addr });
  push(`${m.token.symbol} token contract`, m.token.address);
  if (m.paymentToken) push(`${m.paymentToken.symbol} payment token`, m.paymentToken.address);
  push("Treasury", m.cast.treasury?.address);
  push("Market contract", m.cast.market?.address);
  push("Fee wallet", m.cast.feeWallet?.address);
  push("Liquidity wallet", m.cast.liquidity?.address);
  push("Operator", m.cast.operator?.address);
  return items
    .map((it) => `      <div style="grid-column:1/-1"><div class="lab">${escapeHtml(it.lab)}</div><div class="val mono">${escapeHtml(it.addr)}</div></div>`)
    .join("\n");
}

export function renderTypeA(m: ReportModel): string {
  const sym = escapeHtml(m.token.symbol);
  const ps = escapeHtml(paySym(m));
  const totalOps = m.operations.length;
  const buy = m.sampleBuy;
  const sell = m.sampleSell;

  const buySection = buy
    ? `${buyDiagram(m, buy)}
${buySteps(m, buy)}
${movementTable(buy)}
    <div class="callout"><b>The key:</b> the payment, the fee and the ${sym} delivery all happen inside one transaction. There is no moment where the investor has paid but not received the asset — it settles atomically or not at all.</div>`
    : `<div class="callout">No buy transactions were found in the retrieved history, so a worked buy example isn't shown.</div>`;

  const sellSection = sell
    ? `${sellDiagram(m, sell)}
${sellSteps(m, sell)}
${movementTable(sell)}`
    : `<div class="callout">No sell / redemption transactions were found in the retrieved history.</div>`;

  const hadPaymentLegs = m.buys.concat(m.sells).some((o) => !o.paymentMissing);
  const feeHero = hasFee(m)
    ? `    <div class="fee-hero"><span class="pct">${feePct(m)}</span><span class="pct-lab">of the payment amount, on every trade, to the fee wallet ${m.cast.feeWallet ? `<span class="addr">${escapeHtml(shortAddr(m.cast.feeWallet.address))}</span>` : ""}.</span></div>`
    : hadPaymentLegs
      ? `    <div class="fee-hero"><span class="pct">0%</span><span class="pct-lab">No separate fee leg was observed on-chain — the full payment is forwarded to the treasury on every trade.</span></div>`
      : `    <p>The payment legs for these trades could not be retrieved, so the fee model could not be derived.</p>`;

  const feeBody = hasFee(m)
    ? `    <p>Across the trades observed the split is consistently <b>${feePct(m)}</b> fee / <b>${netPct(m)}</b> to the counterparty${m.fee.consistent ? ", with no variation" : " (with minor variation across samples)"}. No other fees were observed in the on-chain movements.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(m.token.name)} (${sym}) — on-chain operations report</title>
${FONT_LINKS}
<style>${CSS_TYPE_A}</style>
</head>
<body><div class="wrap">

  <header class="masthead">
    <div class="kicker">On-chain operations report · ${sym} · A plain-language read</div>
    <h1>How <em>${escapeHtml(m.token.name)}</em> moves on-chain</h1>
    <p class="dek">A non-technical walk-through of how the ${sym} security token is issued, bought and sold — and how the payment and fees flow — read straight from the public ledger.</p>
    <div class="meta-row">
      <span><b>Asset:</b> ${escapeHtml(m.token.name)} (${sym})</span>
      <span><b>Network:</b> ${escapeHtml(m.chainName)}${m.testnet ? " (testnet)" : " (mainnet)"}</span>
      <span><b>Data as of:</b> ${escapeHtml(fmtDateShort(m.dataAsOf))}</span>
    </div>
  </header>

  <section style="border-bottom:none">
    <div class="tldr">
      <div class="sec-num">In one sentence</div>
      <h2>What this is all about</h2>
      <p class="big">Investors buy and sell <em>${sym}</em> against ${ps}${hasFee(m) ? `, and on every trade the payment, a ${feePct(m)} <em>fee</em>, and the asset all change hands inside a single, indivisible transaction` : `, and on every trade the payment and the asset change hands inside a single, indivisible transaction`}.</p>
      <p>Every number here is read directly from the public ${escapeHtml(m.chainName)} ledger and can be re-checked on a block explorer. This report just translates it into plain language.</p>
    </div>
  </section>

  <section>
    <div class="sec-num">01 · Vocabulary</div>
    <h2>Five words and you understand most of it</h2>
    <p>A handful of terms cover almost everything that follows.</p>
    <div class="grid g-2" style="margin-top:18px">
${vocabularyCards(m)}
    </div>
    ${m.testnet ? `<div class="callout" style="margin-top:20px"><b>Important:</b> this is testnet data (${escapeHtml(m.chainName)}). Amounts and prices are for testing and do not represent real money.</div>` : ""}
  </section>

  <section>
    <div class="sec-num">02 · Who's who</div>
    <h2>The cast</h2>
    <p>Each address is labelled by what it does, not by its raw hash.</p>
    <div class="cast" style="margin-top:18px">
${castRows(m)}
    </div>
  </section>

  <section>
    <div class="sec-num">03 · The asset</div>
    <h2>The token at a glance</h2>
    <p>The supply was created by minting ${sym} from the zero address to the treasury, then distributed through trades.</p>
    <div class="spec" style="margin-top:18px">
      <div><div class="lab">Name</div><div class="val">${escapeHtml(m.token.name)}</div></div>
      <div><div class="lab">Symbol</div><div class="val">${sym}</div></div>
      <div><div class="lab">Total supply</div><div class="val">${fmtAmount(m.token.totalSupply)}</div></div>
      <div><div class="lab">Holders</div><div class="val">${m.token.holders != null ? m.token.holders : "—"}</div></div>
      <div><div class="lab">Recorded operations</div><div class="val">${m.transferCount != null ? m.transferCount : m.ledger.length} transfers</div></div>
      <div><div class="lab">Decimals</div><div class="val">${m.token.decimals}</div></div>
      <div style="grid-column:1/-1"><div class="lab">Token contract address</div><div class="val mono">${escapeHtml(m.token.address)}</div></div>
    </div>
  </section>

  <section>
    <div class="sec-num">04 · A buy, step by step</div>
    <h2>What happens when an investor buys</h2>
    <p class="lead">The investor pays ${ps}; ${hasFee(m) ? `the contract splits off the fee and delivers` : `the contract forwards the payment to the treasury and delivers`} ${sym} — all at once.</p>
${buySection}
  </section>

  <section>
    <div class="sec-num">05 · A sell, step by step</div>
    <h2>What happens when an investor sells</h2>
    <p class="lead">The investor returns ${sym}; the liquidity wallet pays out ${ps}${hasFee(m) ? `, minus the same fee` : ``}.</p>
${sellSection}
  </section>

  <section>
    <div class="sec-num">06 · The fees</div>
    <h2>Where the platform's business sits</h2>
${feeHero}
${feeTable(m)}
${feeBody}
  </section>

  <section>
    <div class="sec-num">07 · The full register</div>
    <h2>All ${totalOps} operations</h2>
    <p>Every recorded ${sym} transfer, newest first. Amounts are in ${sym}; buys leave the treasury, sells return to it, mints come from the zero address.</p>
${ledgerTable(m)}
    ${m.truncated ? `<p class="note">History was long; the list was capped at the safety limit, so not every transfer is shown.</p>` : `<p class="note">Mints increase supply; trades move existing ${sym} between the treasury and investors.</p>`}
  </section>

  <section>
    <div class="sec-num">08 · Technical appendix</div>
    <h2>Verifiable addresses and references</h2>
    <p>Every figure above can be independently verified on a ${escapeHtml(m.chainName)} block explorer using these addresses.</p>
    <div class="spec" style="margin-top:18px">
${appendixRows(m)}
    </div>
    <h3>About the method ids</h3>
    <p>Trades are classified primarily by who sends the asset: the treasury sending ${sym} to an investor is a buy; ${sym} returning to the treasury is a sell; ${sym} appearing from the zero address is an issuance. Decoded method names${m.operations.some((o) => o.method) ? " (where available) are shown on each transaction" : " were not available from this source"}.</p>
    <footer>
      <p>Decoded from the ${escapeHtml(m.chainName)} ledger via ${escapeHtml(m.sourceLabel)} as of ${escapeHtml(new Date(m.dataAsOf).toUTCString())}; verifiable on a block explorer.</p>
      <p class="note">Informational document. Not financial or investment advice.</p>
    </footer>
  </section>

</div></body>
</html>`;
}

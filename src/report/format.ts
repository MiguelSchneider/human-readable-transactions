import type { ReportModel } from "@/model/types";

export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function shortAddr(a: string | null | undefined): string {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// Address shown with its role label when known, plus the short hash.
export function labelled(model: ReportModel, a: string | null | undefined): string {
  if (!a) return "—";
  const label = model.labelOf[a.toLowerCase()];
  const short = shortAddr(a);
  return label ? `${escapeHtml(label)} <span class="addr">${short}</span>` : `<span class="addr">${short}</span>`;
}

export function fmtAmount(n: number, maxFrac = 4): string {
  if (!isFinite(n)) return "—";
  if (n === 0) return "0";
  // Large integers: group with no decimals; small fractions: keep precision.
  const frac = n < 1 ? 6 : n < 1000 ? maxFrac : 2;
  return n.toLocaleString("en-US", { maximumFractionDigits: frac });
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export function fmtDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });
}

export function whenLabel(timestamp: string | null, block: number | null): string {
  if (timestamp) return fmtDateShort(timestamp);
  if (block != null) return `block ${block}`;
  return "—";
}

// Explorer links that work for both EVM (etherscan/blockscout) and Solana
// (explorer.solana.com with a ?cluster= suffix). Paths are the same: /tx/ and /address/.
export function txUrl(m: ReportModel, hash: string): string {
  return `${m.explorerBase.replace(/\/$/, "")}/tx/${hash}${m.explorerQuery ?? ""}`;
}
export function addrUrl(m: ReportModel, addr: string): string {
  return `${m.explorerBase.replace(/\/$/, "")}/address/${addr}${m.explorerQuery ?? ""}`;
}

// Block vs slot label depending on chain.
export function refLabel(m: ReportModel, block: number | null): string {
  if (block == null) return "";
  return m.chainKind === "solana" ? `slot ${block}` : `block ${block}`;
}

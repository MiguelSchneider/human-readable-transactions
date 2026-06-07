import { useMemo, useRef, useState } from "react";
import { parseExplorerInput, SUPPORTED_CHAINS, type Target } from "@/explorer/parseUrl";
import type { Progress } from "@/explorer/types";
import type { SolanaCluster } from "@/explorer/solanaRegistry";
import { generateReport, type GeneratedReport } from "@/generate";

const EXAMPLES = [
  "https://arbitrum-sepolia.blockscout.com/token/0x…",
  "https://testnet.snowtrace.io/token/0x… (Avalanche Fuji)",
  "https://explorer.solana.com/address/<mint>?cluster=devnet (Solana)",
];

const CLUSTERS: SolanaCluster[] = ["mainnet-beta", "devnet", "testnet"];

type Pending = { kind: "evm" | "solana"; address: string };

export function App() {
  const [input, setInput] = useState("");
  const [chainId, setChainId] = useState<number>(SUPPORTED_CHAINS[0].id);
  const [cluster, setCluster] = useState<SolanaCluster>("mainnet-beta");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedReport | null>(null);
  const [tab, setTab] = useState<"B" | "A">("B");
  const abortRef = useRef<AbortController | null>(null);

  async function run(target: Target) {
    setError(null);
    setResult(null);
    setProgress({ phase: "Starting" });
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r = await generateReport(target, setProgress, ac.signal);
      setResult(r);
      setTab("B");
      setProgress(null);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? String(e));
      setProgress(null);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onGenerate() {
    const parsed = parseExplorerInput(input);
    if (parsed.ok && parsed.target) {
      setPending(null);
      void run(parsed.target);
      return;
    }
    if (parsed.addressOnly) {
      setPending(parsed.addressOnly);
      setError(parsed.error ?? "Pick the network.");
      return;
    }
    setError(parsed.error ?? "Invalid input.");
  }

  function onConfirm() {
    if (!pending) return;
    if (pending.kind === "evm") {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)!;
      void run({ kind: "evm", chain, address: pending.address });
    } else {
      void run({ kind: "solana", cluster, address: pending.address });
    }
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  const currentHtml = result ? (tab === "B" ? result.typeBHtml : result.typeAHtml) : "";

  const summary = useMemo(() => {
    if (!result) return null;
    const m = result.model;
    return (
      <div className="summary">
        <span>
          <b>{m.token.name}</b> ({m.token.symbol})
        </span>
        <span>
          <b>Network:</b> {m.chainName}
          {m.testnet ? " (testnet)" : ""}
        </span>
        <span>
          <b>Standard:</b> {m.token.standard ?? "—"}
        </span>
        <span>
          <b>Source:</b> {m.sourceLabel}
        </span>
        <span>
          <b>Buys/Sells/Issuances:</b> {m.buys.length}/{m.sells.length}/{m.mints.length}
        </span>
        <span>
          <b>Fee:</b> {m.fee.fractionPct != null ? `${m.fee.fractionPct}%` : "—"}
        </span>
        {m.paymentToken && (
          <span>
            <b>Payment token:</b> {m.paymentToken.symbol}
          </span>
        )}
      </div>
    );
  }, [result]);

  function download() {
    if (!result) return;
    const blob = new Blob([currentHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const sym = result.model.token.symbol.replace(/[^A-Za-z0-9]/g, "");
    a.href = url;
    a.download = `${sym || "token"}-report-type-${tab}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function openInTab() {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(currentHtml);
      w.document.close();
    }
  }

  const pct = progress?.total ? Math.round((100 * (progress.current ?? 0)) / progress.total) : null;
  const indeterminate = !progress?.total;

  return (
    <div className="app">
      <header className="masthead">
        <div className="kicker">On-chain Trade Report · Generator</div>
        <h1>
          From an explorer URL to a <em>human-readable report</em>
        </h1>
        <p>
          Paste a token's URL from a block explorer — EVM (Blockscout, Arbiscan, Snowtrace…) or Solana
          (explorer.solana.com, Solscan) — and get the same report the skill produces: issuances, buys and sells are
          classified, the wallets are identified, the fee model is derived and every transaction's flow is shown.
          Everything runs in your browser — no keys, no backend.
        </p>
      </header>

      <div className="panel">
        <label className="field-label" htmlFor="url">
          Explorer URL or token address (EVM or Solana)
        </label>
        <div className="row">
          <input
            id="url"
            type="text"
            placeholder="https://…/token/0x…  ·  explorer.solana.com/address/<mint>?cluster=devnet  ·  or a bare address"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && onGenerate()}
            disabled={busy}
          />
          {pending?.kind === "evm" && (
            <select value={chainId} onChange={(e) => setChainId(Number(e.target.value))} disabled={busy}>
              {SUPPORTED_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.testnet ? " (testnet)" : ""}
                </option>
              ))}
            </select>
          )}
          {pending?.kind === "solana" && (
            <select value={cluster} onChange={(e) => setCluster(e.target.value as SolanaCluster)} disabled={busy}>
              {CLUSTERS.map((c) => (
                <option key={c} value={c}>
                  Solana {c}
                </option>
              ))}
            </select>
          )}
          {!busy && !pending && (
            <button className="primary" onClick={onGenerate}>
              Generate report
            </button>
          )}
          {!busy && pending && (
            <button className="primary" onClick={onConfirm}>
              Generate
            </button>
          )}
          {busy && (
            <button className="ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
        <p className="hint">
          EVM: {SUPPORTED_CHAINS.map((c) => c.name).join(", ")} (Blockscout v2 / Routescan). Solana: mainnet-beta,
          devnet, testnet (JSON-RPC, incl. Token-2022). Example formats:
        </p>
        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setInput(ex.split(" ")[0])} disabled={busy}>
              {ex}
            </button>
          ))}
        </div>
        {error && <p className="error">⚠ {error}</p>}
        {busy && progress && (
          <div className="progress" role="status" aria-live="polite">
            <div className="progress-info">
              <span>{progress.phase}</span>
              <span>{progress.total ? `${progress.current ?? 0} / ${progress.total}` : progress.current ? `${progress.current}` : ""}</span>
            </div>
            <div className="bar">
              <div className={`fill${indeterminate ? " indeterminate" : ""}`} style={indeterminate ? undefined : { width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="panel">{summary}</div>
          <div className="tabs">
            <button className={`tab ${tab === "A" ? "active" : ""}`} onClick={() => setTab("A")}>
              Type A · Explanatory report
            </button>
            <button className={`tab ${tab === "B" ? "active" : ""}`} onClick={() => setTab("B")}>
              Type B · Transaction by transaction
            </button>
          </div>
          <div className="viewer">
            <div className="viewer-toolbar">
              <button className="ghost" onClick={download}>
                Download HTML
              </button>
              <button className="ghost" onClick={openInTab}>
                Open in tab (to print / save as PDF)
              </button>
              <span className="spacer" />
            </div>
            <iframe title={`report-${tab}`} srcDoc={currentHtml} />
          </div>
        </>
      )}
    </div>
  );
}

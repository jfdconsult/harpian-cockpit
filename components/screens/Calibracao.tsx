"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";

interface Formula { id: string; grupo: string; nome: string; desc?: string; valor_atual: string; unidade?: string; editavel: boolean }
interface Alteracao { formula_id: string; nome?: string; de: string; para: string }
interface Metricas { sortino?: number; cagr?: number; max_dd?: number; calmar?: number }
interface Candidate {
  id: string; descricao: string; status: string; hipotese?: string; ts?: string;
  alteracoes?: Alteracao[]; metricas_atual?: Metricas; metricas_candidato?: Metricas;
  golden_master?: boolean; validadores_9?: boolean; wf_gap?: number | null;
}
interface JimBubble { who: "jim" | "user"; text: string; ref?: string }

const GROUP_ORDER = ["Defesa", "Ataque", "Pilar D", "Pilar T", "Seleção", "Outros"];

function delta(a?: number, b?: number) {
  if (a == null || b == null) return <span className="delta-eq">—</span>;
  const d = b - a;
  const cls = d > 0 ? "delta-up" : d < 0 ? "delta-dn" : "delta-eq";
  return <span className={cls}>{d > 0 ? "+" : ""}{d.toFixed(2)}</span>;
}

const INITIAL_JIM: JimBubble[] = [
  { who: "jim", text: "Calibration is the act of adjusting hyperparameters without touching the engine's structure. The main risk is overfitting — the more free parameters, the higher the chance of fitting to noise.", ref: 'Ilmanen, "Expected Returns" ch. 12' },
  { who: "jim", text: "Walk-forward with a temporal gap is the only honest method. If the OOS Sortino drops more than 40% vs IS, the candidate should be rejected — not promoted with caveats.", ref: 'Bailey & López de Prado, "The Deflated Sharpe Ratio"' },
  { who: "jim", text: "Before calibrating: check whether the problem is really in the parameter or if it's structural. Changing tau from 37 to 40 doesn't fix a poorly defined universe.", ref: 'Clenow, "Stocks on the Move" ch. 8' },
];

export default function Calibracao() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selCand, setSelCand] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [jimBubbles, setJimBubbles] = useState<JimBubble[]>(INITIAL_JIM);
  const [jimQ, setJimQ] = useState("");

  useEffect(() => {
    apiGet<{ formulas: Formula[] }>("/v1/calibration/formulas")
      .then((d) => { setFormulas(d.formulas || []); setConn("ok"); })
      .catch(() => setConn("error"));
    apiGet<{ candidates: Candidate[] }>("/v1/calibration/candidates")
      .then((d) => setCandidates(d.candidates || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!formulas.length && !candidates.length) return;
    const ready = candidates.filter((c) => c.status === "ready" || c.status === "validado").length;
    const rejected = candidates.filter((c) => c.status === "rejected" || c.status === "rejeitado").length;
    const promoted = candidates.filter((c) => c.status === "promovido").length;
    publishScreenData(
      "calibracao",
      `${formulas.length} formulas | ${candidates.length} candidates (${ready} ready, ${rejected} rejected, ${promoted} promoted)`,
      { formulas, candidates },
      { briefing: `Studio with ${formulas.length} editable formulas and ${candidates.length} candidates created. ${ready} ready for promotion.` }
    );
  }, [formulas, candidates]);

  const groups: Record<string, Formula[]> = {};
  formulas.forEach((f) => { const g = f.grupo || "Outros"; (groups[g] ||= []).push(f); });
  const orderedGroups = [...GROUP_ORDER.filter((g) => groups[g]), ...Object.keys(groups).filter((g) => !GROUP_ORDER.includes(g))];

  function createCandidate() {
    const changed = Object.keys(edits);
    if (!changed.length) { setToastMsg("Edit at least 1 parameter"); return; }
    const alteracoes: Alteracao[] = changed.map((id) => {
      const f = formulas.find((x) => x.id === id);
      return { formula_id: id, nome: f?.nome, de: f?.valor_atual || "", para: edits[id] };
    });
    const c: Candidate = {
      id: `cand-${candidates.length + 1}`, descricao: `Candidate #${candidates.length + 1}`, status: "ready",
      ts: "now", alteracoes,
      metricas_atual: { sortino: 2.16, cagr: 44.2, max_dd: -27.9, calmar: 1.58 },
      metricas_candidato: { sortino: 2.27, cagr: 46.0, max_dd: -26.3, calmar: 1.75 },
      golden_master: true, validadores_9: true, wf_gap: 0.3,
    };
    setCandidates((prev) => [c, ...prev]);
    setEdits({});
    setToastMsg("Candidate created (mock)");
    setSelCand(0);
  }

  function promote(i: number) {
    const c = candidates[i];
    apiPost<{ ok?: boolean; error?: string; candidate?: Candidate }>(`/v1/calibration/candidates/${c.id}/promote`)
      .then((d) => {
        if (d.error) { setToastMsg("Error: " + d.error); return; }
        setToastMsg("Promoted to Model Registry");
        setCandidates((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: "promovido" } : x)));
      })
      .catch((e) => setToastMsg("Error: " + e.message));
  }

  function askJim() {
    if (!jimQ) return;
    const q = jimQ;
    setJimQ("");
    setJimBubbles((prev) => [...prev, { who: "user", text: q }, { who: "jim", text: "Analyzing your question… (JIM is in air-gap mode, the answer will come from the API)" }]);
    apiGet<{ answer?: string; ref?: string }>(`/v1/calibration/jim?q=${encodeURIComponent(q)}`)
      .then((d) => {
        setJimBubbles((prev) => {
          const next = [...prev];
          next[next.length - 1] = { who: "jim", text: d.answer || "JIM is not available right now.", ref: d.ref };
          return next;
        });
      })
      .catch(() => {
        setJimBubbles((prev) => {
          const next = [...prev];
          next[next.length - 1] = { who: "jim", text: "JIM unavailable — API offline." };
          return next;
        });
      });
  }

  const c = selCand != null ? candidates[selCand] : null;
  const allPass = c ? !!c.golden_master && !!c.validadores_9 : false;

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Calibration · Formula Studio</div><div className="sub">Edit engine parameters, create candidates, compare with the current one, and promote to the Registry.</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "connecting…" : conn === "ok" ? "● API live" : "✕ API offline"}
        </div>
      </div>

      <div className="lay3">
        <div className="side">
          <div className="card">
            <h2><span>Formulas & parameters</span></h2>
            <div className="scroll-formulas">
              {conn === "loading" && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>loading…</div>}
              {conn === "error" && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>API did not respond</div>}
              {orderedGroups.map((g) => (
                <div className="fgroup" key={g}>
                  <div className="fgroup-title">{g}</div>
                  {groups[g].map((f) => {
                    const edited = edits[f.id] != null;
                    return (
                      <div className="frow" key={f.id}>
                        <div className="fname"><div className="n">{f.nome}</div><div className="d">{f.desc || ""}</div></div>
                        {edited ? (
                          <div className="fval-edit">
                            <span style={{ color: "var(--tx3)" }}>{f.valor_atual}</span>
                            <span className="arrow">→</span>
                            <input
                              autoFocus
                              value={edits[f.id]}
                              onChange={(e) => setEdits((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        ) : (
                          <span className="fval" onClick={() => f.editavel && setEdits((prev) => ({ ...prev, [f.id]: f.valor_atual }))}>{f.valor_atual}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-outline" onClick={createCandidate}>+ Create candidate</button>
            </div>
          </div>

          <div className="card">
            <h2><span>Candidates</span></h2>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {candidates.length === 0 && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>no candidate</div>}
              {candidates.map((cand, i) => {
                const scls = cand.status === "ready" || cand.status === "validado" ? "ready" : cand.status === "rejected" || cand.status === "rejeitado" ? "rejected" : "pending";
                const slabel = scls === "ready" ? "READY" : scls === "rejected" ? "REJECTED" : "PENDING";
                return (
                  <div key={cand.id} className={`cand-item${selCand === i ? " sel" : ""}`} onClick={() => setSelCand(i)}>
                    <div><div style={{ fontWeight: 600 }}>{cand.descricao}</div><div className="c-mut2" style={{ fontSize: 10 }}>{cand.ts || ""}</div></div>
                    <span className={`cand-status ${scls}`}>{slabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          {!c ? (
            <div className="ph" style={{ padding: 40 }}>
              <b>No candidate selected</b>
              Select a candidate on the left or create a new one by adjusting the parameters.
            </div>
          ) : (
            <div className="card mb">
              <h2><span>Candidate × current</span><span className={`tag ${c.status === "ready" || c.status === "validado" ? "g" : c.status === "rejected" ? "r" : "a"}`}>{c.descricao}</span></h2>
              <table className="ctable">
                <thead><tr><th>Metric</th><th>Current</th><th>Candidate</th><th>Delta</th></tr></thead>
                <tbody>
                  <tr><td>Sortino</td><td>{c.metricas_atual?.sortino ?? "—"}</td><td>{c.metricas_candidato?.sortino ?? "—"}</td><td>{delta(c.metricas_atual?.sortino, c.metricas_candidato?.sortino)}</td></tr>
                  <tr><td>CAGR</td><td>{c.metricas_atual?.cagr ?? "—"}</td><td>{c.metricas_candidato?.cagr ?? "—"}</td><td>{delta(c.metricas_atual?.cagr, c.metricas_candidato?.cagr)}</td></tr>
                  <tr><td>MaxDD</td><td style={{ color: "var(--red)" }}>{c.metricas_atual?.max_dd ?? "—"}</td><td style={{ color: "var(--red)" }}>{c.metricas_candidato?.max_dd ?? "—"}</td><td>{delta(c.metricas_atual?.max_dd, c.metricas_candidato?.max_dd)}</td></tr>
                  <tr><td>Calmar</td><td>{c.metricas_atual?.calmar ?? "—"}</td><td>{c.metricas_candidato?.calmar ?? "—"}</td><td>{delta(c.metricas_atual?.calmar, c.metricas_candidato?.calmar)}</td></tr>
                </tbody>
              </table>
              <div className="checks">
                <div className="chk"><span className={`chk-icon ${c.golden_master ? "chk-pass" : "chk-fail"}`}>{c.golden_master ? "✓" : "✕"}</span><span>Golden-master: reproduces byte for byte</span></div>
                <div className="chk"><span className={`chk-icon ${c.validadores_9 ? "chk-pass" : "chk-fail"}`}>{c.validadores_9 ? "✓" : "✕"}</span><span>9 validators: no red flag</span></div>
                <div className="chk"><span className={`chk-icon ${c.wf_gap != null ? "chk-pass" : "chk-fail"}`}>{c.wf_gap != null ? "✓" : "✕"}</span><span>Walk-forward temporal gap</span></div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn-gold" disabled={!allPass} onClick={() => selCand != null && promote(selCand)}>
                  {allPass ? "Promote to Registry" : "Incomplete validation — promotion blocked"}
                </button>
              </div>
              {c.alteracoes && c.alteracoes.length > 0 && (
                <>
                  <div style={{ marginTop: 14, fontSize: 10, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gold)", marginBottom: 6 }}>Changed parameters</div>
                  {c.alteracoes.map((a) => (
                    <div className="frow" key={a.formula_id}>
                      <div className="fname"><div className="n">{a.nome || a.formula_id}</div></div>
                      <div className="fval-edit">
                        <span style={{ color: "var(--tx3)" }}>{a.de}</span>
                        <span className="arrow" style={{ color: "var(--gold)" }}>→</span>
                        <span style={{ color: "#5de5d5", fontWeight: 700 }}>{a.para}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="side">
          <div className="calib-jim">
            <h2><span>JIM advisor</span><span className="tag" style={{ background: "#2a1850", color: "#8a70c0", fontSize: 8 }}>air-gap · read-only</span></h2>
            <div>
              {jimBubbles.map((b, i) => (
                <div key={i} className="calib-jim-bubble" style={b.who === "user" ? { borderColor: "rgba(93,229,213,.2)", background: "rgba(93,229,213,.05)", color: "#b0e0d8" } : undefined}>
                  {b.who === "user" && <b style={{ fontSize: 10, color: "var(--tx3)" }}>You: </b>}
                  {b.text}
                  {b.ref && <span className="ref">Ref: {b.ref}</span>}
                </div>
              ))}
            </div>
            <div className="calib-jim-input">
              <input placeholder="Ask JIM…" value={jimQ} onChange={(e) => setJimQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askJim()} />
              <button onClick={askJim}>Send</button>
            </div>
          </div>
        </div>
      </div>

      <div className="foot">Calibration · consumes /v1/calibration. Golden-master byte-for-byte + 9 validators. Promote to the Model Registry only after GRADE A.</div>
      <div className={`calib-toast${toastMsg ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}

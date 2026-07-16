"use client";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";

interface WindowMetrics { cagr?: number; sortino?: number; calmar?: number; max_dd?: number; risk_num?: number }
interface Score { passed: number; total: number; pct: number | null }
interface Motor { id: string; nome: string; status: string; versao?: string }
interface Run {
  id: string; alvo: string; motor_id?: string | null; estrategia: string; metodo: string; periodo: string;
  custos_bps: number; rebalance: string; status: string; grade: string | null; ts: string;
  engine?: string; engine_label?: string;
  score?: Score | null; flag?: string | null; flag_nivel?: string | null;
  reprovacoes?: string[]; aprovado_total?: boolean;
  metricas?: { oos?: WindowMetrics; cheio?: WindowMetrics };
  red_flags?: string[]; annual_returns?: Record<string, number>;
  arena_run_name?: string | null; arena_verdict?: string | null;
  homologacao_producao?: (WindowMetrics & { grade?: string; nota?: string }) | null;
  eta_sec?: number; name?: string; date?: string;
}

type Engine = "delorean_local" | "modal" | "arena";
const ENGINE_META: Record<Engine, { label: string; sub: string; live: boolean }> = {
  delorean_local: { label: "DeLorean (local)", sub: "real backtest on the backend · walk-forward PIT", live: true },
  modal: { label: "Modal", sub: "initial backtest · cloud (pending)", live: false },
  arena: { label: "Arena", sub: "homologation · 8 gates", live: true },
};

function gradeCls(g: string | null) { return g === "A" ? "A" : g === "B" ? "B" : g === "F" ? "F" : "rodando"; }

// flag color by approval level — the grade ALWAYS accompanies the engine
function flagStyle(nivel?: string | null): React.CSSProperties {
  if (nivel === "aprovado") return { color: "#2ECC71", border: "1px solid #2ECC71", background: "var(--green-bg)" };
  if (nivel === "com_reprovacoes") return { color: "#F39C12", border: "1px solid #F39C12", background: "var(--gold-bg)" };
  if (nivel === "sem_homologacao") return { color: "var(--red-text)", border: "1px solid var(--red-text)", background: "var(--red-bg)" };
  return { color: "var(--tx3)", border: "1px solid var(--line)", background: "transparent" }; // pending
}

function ScoreBadge({ score }: { score?: Score | null }) {
  if (!score || score.total === 0) return <span style={{ fontSize: 12, color: "var(--red-text)" }}>no score</span>;
  const col = score.pct === 100 ? "#2ECC71" : (score.pct ?? 0) >= 62 ? "#F39C12" : "var(--red-text)";
  return (
    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 20, color: col }}>
      {score.passed}/{score.total}
      <span style={{ fontSize: 11, marginLeft: 6, color: "var(--tx3)" }}>{score.pct}% of gates</span>
    </span>
  );
}

function BarsSVG({ annualReturns }: { annualReturns?: Record<string, number> }) {
  const ann = Object.entries(annualReturns || {}).map(([year, ret]) => ({ year, ret })).sort((a, b) => a.year.localeCompare(b.year));
  if (!ann.length) return <div className="c-mut2" style={{ padding: 20, textAlign: "center", fontSize: 11 }}>no annual data</div>;
  const W = 440, H = 160, pad = 20, barGap = 2;
  const mx = Math.max(...ann.map((a) => Math.abs(a.ret))) || 1;
  const barW = (W - 2 * pad) / ann.length - barGap;
  const zero = pad + (H - 2 * pad) * 0.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <line x1={pad} x2={W - pad} y1={zero} y2={zero} stroke="var(--line)" strokeWidth={1} />
      {ann.map((a, i) => {
        const bx = pad + i * (barW + barGap);
        const bh = (Math.abs(a.ret) / mx) * ((H - 2 * pad) * 0.45);
        const by = a.ret >= 0 ? zero - bh : zero;
        const col = a.ret >= 0 ? "var(--green)" : "var(--red)";
        return <g key={a.year}><rect x={bx} y={by} width={barW} height={bh} fill={col} rx={2} opacity={0.85} />{ann.length <= 20 && <text x={bx + barW / 2} y={H - 2} fill="var(--tx3)" fontSize={7} textAnchor="middle">{a.year}</text>}</g>;
      })}
    </svg>
  );
}

export default function Backtest() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [motores, setMotores] = useState<Motor[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [motorId, setMotorId] = useState("hc_us_31");
  const [engine, setEngine] = useState<Engine>("arena");
  const [period, setPeriod] = useState<"5y" | "10y" | "full">("full");
  const [custos, setCustos] = useState(15);
  const [submitting, setSubmitting] = useState(false);

  function loadRuns() {
    apiGet<{ runs: Run[] }>("/v1/backtest/runs").then((d) => { setRuns(d.runs || []); setConn("ok"); }).catch(() => setConn("error"));
  }
  useEffect(loadRuns, []);
  useEffect(() => { apiGet<{ motores: Motor[] }>("/v1/registry/motores").then((d) => setMotores(d.motores || [])).catch(() => {}); }, []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 3200); return () => clearTimeout(t); }, [toastMsg]);

  useEffect(() => {
    if (!runs.length) return;
    const gradeA = runs.filter((r) => r.grade === "A").length;
    const gradeB = runs.filter((r) => r.grade === "B").length;
    const gradeF = runs.filter((r) => r.grade === "F").length;
    const running = runs.filter((r) => r.status === "rodando" || r.status === "running").length;
    publishScreenData(
      "backtest",
      `${runs.length} runs | ${gradeA} grade A, ${gradeB} grade B, ${gradeF} grade F | ${running} running`,
      runs,
      { briefing: `${runs.length} backtests registered: ${gradeA} with grade A, ${gradeB} with grade B, and ${gradeF} failed. ${running} running now.` }
    );
  }, [runs]);

  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);
  function pollRun(runId: string, tries = 0) {
    if (tries > 20) return;
    pollRef.current = setTimeout(() => {
      apiGet<{ runs: Run[] }>("/v1/backtest/runs").then((d) => {
        const fresh = d.runs || [];
        setRuns((prev) => prev.map((x) => fresh.find((f) => f.id === x.id) || x));
        const rr = fresh.find((f) => f.id === runId);
        if (rr && (rr.status === "rodando" || rr.status === "running")) pollRun(runId, tries + 1);
        else if (rr) setToastMsg(rr.flag ? `${rr.id}: ${rr.flag}` : `${rr.id} completed`);
      }).catch(() => pollRun(runId, tries + 1));
    }, 2000);
  }

  function submitBt() {
    if (submitting) return;
    const custosSafe = Number.isFinite(custos) && custos > 0 ? custos : 15;
    if (custosSafe !== custos) setCustos(custosSafe);
    setSubmitting(true);
    const periodoMap = { "5y": "2021-2026", "10y": "2016-2026", full: "2007-2026" };
    const motor = motores.find((m) => m.id === motorId);
    apiPost<{ ok: boolean; run: Run }>("/v1/backtest/submit", {
      engine, motor_id: motorId, alvo: motorId, estrategia: motor?.nome || motorId,
      periodo: periodoMap[period], custos_bps: custosSafe, rebalance: "mensal + defesa diária",
    })
      .then((d) => {
        setToastMsg(engine === "arena" ? "Homologating in the Arena…" : `Running (${ENGINE_META[engine].label})…`);
        setRuns((prev) => [{ ...d.run, name: `${motor?.nome || motorId} · ${ENGINE_META[engine].label}`, date: "agora" }, ...prev]);
        setSel(0);
        pollRun(d.run.id);
      })
      .catch((e) => setToastMsg("Erro: " + e.message))
      .finally(() => setSubmitting(false));
  }

  const r = sel != null ? runs[sel] : null;

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Backtest Lab</div><div className="sub">Initial backtest (DeLorean local or Modal) → homologation in the Arena. Every engine carries a scoreboard (SCORE) and a flag.</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>{conn === "loading" ? "connecting…" : conn === "ok" ? "API live" : "API offline"}</div>
      </div>

      <div className="lay">
        <div className="side">
          <div className="card">
            <h2><span>Configure backtest</span></h2>
            <div className="fg">
              <label>Engine</label>
              <select className="input" value={motorId} onChange={(e) => setMotorId(e.target.value)}>
                {motores.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.status !== "homologado" ? ` · ${m.status}` : ""}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>Engine — where to run</label>
              <div className="btchips" style={{ flexWrap: "wrap" }}>
                {(Object.keys(ENGINE_META) as Engine[]).map((e) => (
                  <span key={e} className={`btchip${engine === e ? " on" : ""}`} onClick={() => setEngine(e)}
                    title={ENGINE_META[e].sub} style={{ position: "relative" }}>
                    {ENGINE_META[e].label}
                    {!ENGINE_META[e].live && <i className="ti ti-plug-connected-x" style={{ fontSize: 10, marginLeft: 4, color: "var(--tx3)" }} />}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
                {engine === "arena" ? "Arena live · real homologation (8 gates)"
                  : engine === "delorean_local" ? "Real backtest on the backend · dual-momentum on the engine's universe (2 windows)"
                  : `${ENGINE_META[engine].label}: engine not yet connected to the backend`}
              </div>
            </div>
            <div className="fg">
              <label>Period</label>
              <div className="btchips">
                <span className={`btchip${period === "5y" ? " on" : ""}`} onClick={() => setPeriod("5y")}>5 years</span>
                <span className={`btchip${period === "10y" ? " on" : ""}`} onClick={() => setPeriod("10y")}>10 years</span>
                <span className={`btchip${period === "full" ? " on" : ""}`} onClick={() => setPeriod("full")}>Since 2007</span>
              </div>
            </div>
            <div className="fg"><label>Costs (bps)</label><input className="input" type="number" value={custos} onChange={(e) => setCustos(parseInt(e.target.value) || 15)} /></div>
            <button className="btn-cyan" onClick={submitBt} disabled={submitting}>
              {submitting ? <><i className="ti ti-loader-2 spin" style={{ marginRight: 6 }} />Sending…</> : <><i className="ti ti-player-play" style={{ marginRight: 6 }} />{engine === "arena" ? "Homologate in the Arena" : `Run (${ENGINE_META[engine].label})`}</>}
            </button>
          </div>

          <div className="card">
            <h2><span>Recent runs</span></h2>
            <div className="runs">
              {conn === "loading" && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>loading…</div>}
              {conn === "error" && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>API did not respond</div>}
              {conn === "ok" && runs.length === 0 && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>no run registered</div>}
              {runs.map((run, i) => (
                <div key={run.id + i} className={`run-item${sel === i ? " sel" : ""}`} onClick={() => setSel(i)}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{run.name || `${run.estrategia}`}</div>
                    <div className="c-mut2" style={{ fontSize: 10 }}>{run.engine_label || run.engine || ""} · {run.date || run.ts || ""}</div>
                  </div>
                  {run.score && run.score.total > 0
                    ? <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: run.score.pct === 100 ? "#2ECC71" : (run.score.pct ?? 0) >= 62 ? "#F39C12" : "var(--red-text)" }}>{run.score.passed}/{run.score.total}</span>
                    : <span className={`grade ${gradeCls(run.grade)}`}>{run.status === "rodando" ? "…" : run.grade || "—"}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {!r ? (
            <div className="ph" style={{ padding: 40 }}><b>No backtest selected</b>Select a run on the left or submit a new one.</div>
          ) : r.status === "rodando" || r.status === "running" ? (
            <div className="card">
              <h2><span>{r.name || r.estrategia}</span><span className="tag a">running…</span></h2>
              <div style={{ textAlign: "center", padding: 30, color: "var(--orange)", fontSize: 14 }}>
                <i className="ti ti-loader-2 spin" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 8 }} />
                {r.engine === "arena" ? "Homologating in the Arena live…" : `Running (${r.engine_label})…`}<br />
                <span className="c-mut2" style={{ fontSize: 11 }}>ETA ~{r.eta_sec ?? 10}s{r.engine === "arena" ? " (Arena scale-to-zero may cold-start)" : ""}</span>
              </div>
            </div>
          ) : r.status === "pendente_integracao" ? (
            <div className="card">
              <h2><span>{r.name || r.estrategia}</span><span className="tag" style={{ color: "var(--tx3)" }}>pending</span></h2>
              <div style={{ padding: 20, fontSize: 13, color: "var(--tx2)" }}>
                <div style={{ ...flagStyle("pendente"), padding: "8px 12px", borderRadius: 4, marginBottom: 10, fontWeight: 600 }}>
                  <i className="ti ti-plug-connected-x" style={{ marginRight: 6 }} />{r.flag}
                </div>
                {r.red_flags?.[0] || "This engine does not run from the backend yet. Use the Arena for real homologation."}
              </div>
            </div>
          ) : (
            <>
              <div className="card mb">
                <h2><span>Homologation scoreboard · {r.engine_label || r.engine}</span>
                  {r.arena_verdict && <span className="tag" style={{ color: r.arena_verdict === "ACCEPTED" ? "var(--green)" : "var(--red-text)" }}>Arena: {r.arena_verdict}</span>}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                  <ScoreBadge score={r.score} />
                  {r.grade && <div className={`grade-big ${gradeCls(r.grade)}`} style={{ margin: 0 }}>GRADE {r.grade}</div>}
                </div>
                {/* FLAG — always accompanies the engine, whether approved or with failures */}
                {r.flag && (
                  <div style={{ ...flagStyle(r.flag_nivel), padding: "8px 12px", borderRadius: 4, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                    <i className={`ti ${r.aprovado_total ? "ti-circle-check" : r.flag_nivel === "sem_homologacao" ? "ti-alert-triangle" : "ti-flag"}`} style={{ marginRight: 6 }} />{r.flag}
                    {!r.aprovado_total && r.flag_nivel === "com_reprovacoes" && (
                      <div style={{ marginTop: 4, fontWeight: 400, color: "var(--tx3)" }}>The manager can still use the engine — the flag and grade accompany the decision.</div>
                    )}
                  </div>
                )}
                {r.arena_run_name && <div className="c-mut2" style={{ fontSize: 11, marginBottom: 8 }}>Arena run: <span style={{ fontFamily: "monospace" }}>{r.arena_run_name}</span></div>}

                <table className="mtable">
                  <thead><tr><th>Window</th><th>CAGR</th><th>Sortino</th><th>Calmar</th><th>MaxDD</th></tr></thead>
                  <tbody>
                    <tr className="oos">
                      <td style={{ fontWeight: 700, color: "var(--cyan)" }}>OOS · holdout</td>
                      <td>{r.metricas?.oos?.cagr ?? "—"}%</td><td>{r.metricas?.oos?.sortino ?? "—"}</td><td>{r.metricas?.oos?.calmar ?? "—"}</td><td style={{ color: "var(--red)" }}>{r.metricas?.oos?.max_dd ?? "—"}%</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>In-sample</td>
                      <td>{r.metricas?.cheio?.cagr ?? "—"}%</td><td>{r.metricas?.cheio?.sortino ?? "—"}</td><td>{r.metricas?.cheio?.calmar ?? "—"}</td><td style={{ color: "var(--red)" }}>{r.metricas?.cheio?.max_dd ?? "—"}%</td>
                    </tr>
                  </tbody>
                </table>

                {r.homologacao_producao && r.homologacao_producao.cagr != null && (
                  <div style={{ marginTop: 10, padding: 10, border: "1px solid var(--gold)", background: "var(--gold-bg)", borderRadius: 4, fontSize: 12 }}>
                    <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>PRODUCTION REFERENCE (DeLorean · engine's real config)</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>CAGR <b>{r.homologacao_producao.cagr}%</b></span><span>Sortino <b>{r.homologacao_producao.sortino ?? "—"}</b></span>
                      <span>Calmar <b>{r.homologacao_producao.calmar ?? "—"}</b></span><span>MaxDD <b>{r.homologacao_producao.max_dd ?? "—"}%</b></span><span>Grade <b>{r.homologacao_producao.grade ?? "—"}</b></span>
                    </div>
                    <div style={{ marginTop: 4, color: "var(--tx3)", fontSize: 11 }}>{r.homologacao_producao.nota || "Differs from the backtest above (different config). Both are real."}</div>
                  </div>
                )}

                {r.red_flags && r.red_flags.length > 0 && (
                  <div className="rf" style={{ marginTop: 10 }}><b>RED FLAGS</b><ul style={{ margin: "6px 0 0 16px" }}>{r.red_flags.map((f) => <li key={f}>{f}</li>)}</ul></div>
                )}
              </div>

              <div className="charts"><div className="chart-box"><h3>Annual Returns</h3><BarsSVG annualReturns={r.annual_returns} /></div></div>
            </>
          )}
        </div>
      </div>

      <div className="foot">Backtest Lab · selectable engine (DeLorean local / Modal / Arena) · SCORE X/Y gates · the flag and grade always accompany the engine.</div>
      <div className={`bt-toast${toastMsg ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import { Bullet } from "@/components/RegimeGauge";
import type { ScreenId } from "@/lib/nav";

interface PilarDef { nome: string; temp: number; turb: number; trend_break: number; jerk: number; limiar: number | null; status: string }
interface DefenseState {
  portfolio_id: string; regime: string; defesa_pct: number; pilares: Record<string, PilarDef>;
  cc: number; cc_gate_low: number; cc_gate_high: number; g: number; ema20_acima: boolean; velocity: number | null;
  reentry: { status: string; days_in_defense: number; target_pct: number | null };
}
interface PilarD { universo: string[]; top4_atual: string[]; cap_pct: number | null; rotacao_freq: string; contribuicao_ytd_pct: number | null }
interface ReentryState { mode: string; days: number; ema_cross: boolean; velocity: number; sizing_pct: number }

function sem(s: string) { return s === "ataque" ? "g" : s === "alerta" ? "a" : s === "defesa" ? "r" : "b"; }
function tempColor(v: number) { return v >= 0.8 ? "#E74C3C" : v >= 0.6 ? "#E67E22" : v >= 0.4 ? "#E5B800" : v >= 0.2 ? "#2ECC71" : "#1A8FE3"; }
function pct01(v: number) { return Math.max(0, Math.min(100, v * 100)); }
function f2(n: number | null | undefined) { return n == null ? "—" : Number(n).toFixed(2); }

export default function Protecao({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [pid, setPid] = useState("HPC22");
  const [defense, setDefense] = useState<DefenseState | null>(null);
  const [pilarD, setPilarD] = useState<PilarD | null>(null);
  const [reentry, setReentry] = useState<ReentryState | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    setConn("loading");
    apiGet<DefenseState>(`/v1/protection/defense?portfolio_id=${pid}`)
      .then((d) => { setDefense(d); setConn("ok"); })
      .catch(() => setConn("error"));
    apiGet<PilarD>("/v1/protection/pilar-d").then(setPilarD).catch(() => {});
    apiGet<ReentryState>(`/v1/protection/reentry?portfolio_id=${pid}`).then(setReentry).catch(() => {});
  }, [pid]);

  useEffect(() => {
    if (!defense) return;
    const pilaresEmAlerta = Object.values(defense.pilares).filter((p) => p.status === "alerta" || p.status === "defesa").length;
    const reentryStatus = reentry ? reentry.mode : defense.reentry.status;
    publishScreenData(
      "protecao",
      `Regime ${defense.regime} | Protection ${defense.defesa_pct}% | ${pilaresEmAlerta} pillars on alert | Re-entry: ${reentryStatus}`,
      { defense, pilarD, reentry },
      { briefing: `Current regime is ${defense.regime} with ${defense.defesa_pct}% of protection active. ${pilaresEmAlerta} pillars on alert and re-entry in ${reentryStatus} mode.` }
    );
  }, [defense, pilarD, reentry]);

  const regSem = defense ? (defense.regime === "RISK-ON" ? "g" : defense.regime === "WARNING" ? "a" : defense.regime === "RISK-OFF" ? "r" : "b") : "b";

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Protection & Defense</div><div className="sub">Three defense layers, per-pillar temperature, systemic gate and re-entry monitor.</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "connecting…" : conn === "ok" ? "● API live" : "✕ API offline"}
        </div>
      </div>

      <div className="pills mb">
        {["HPC22", "HPC11", "LCORE22"].map((p) => (
          <div key={p} className={`prot-pill${p === pid ? " on" : ""}`} onClick={() => setPid(p)}>{p}</div>
        ))}
      </div>

      {defense && (
        <div className="grid g4 mb">
          <div className="kpi"><div className="l">Regime</div><div className={`v c-${regSem}`}>{defense.regime}</div><div className="s">{pid}</div></div>
          <div className="kpi"><div className="l">Active protection</div><div className="v">{defense.defesa_pct != null ? `${defense.defesa_pct}%` : "—"}</div><div className="s">of the portfolio</div></div>
          <div className="kpi"><div className="l">Cross-Correlation</div><div className="v">{f2(defense.cc)}</div><div className="s">systemic</div></div>
          <div className="kpi"><div className="l">Velocity</div><div className="v">{f2(defense.velocity)}</div><div className="s">EMA momentum</div></div>
        </div>
      )}

      <div className="flex between mb" style={{ gap: "var(--gap)", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="col-left">
          {!defense && conn === "error" ? (
            <div className="card"><div className="ph"><b>API did not respond</b></div></div>
          ) : defense && (
            <div className="card">
              <h2><span>3 defense layers</span><span className="tag b">{pid}</span></h2>

              <div className="layer">
                <div className="layer-title">Layer 1 — Temperature per pillar</div>
                {Object.entries(defense.pilares).map(([key, p]) => {
                  const col = tempColor(p.temp);
                  return (
                    <div className="pilar-row2" key={key}>
                      <div className="pilar-head2">
                        <span className="pilar-name2">Pillar {p.nome}</span>
                        <span style={{ fontWeight: 700, color: col }}>{f2(p.temp)}</span>
                        <span className={`statechip ${sem(p.status)}`}>{p.status}</span>
                      </div>
                      <div className="decomp">turb {f2(p.turb)} × 0.40 + trend_break {f2(p.trend_break)} × 0.35 + jerk {f2(p.jerk)} × 0.25</div>
                      <div className="phead"><span>Pillar {p.nome} <small>threshold {f2(p.limiar)}</small></span><span className="dist" style={{ color: col }}>{f2(p.temp)}</span></div>
                      <Bullet pct={pct01(p.temp)} />
                    </div>
                  );
                })}
              </div>

              <div className="layer">
                <div className="layer-title">Layer 2 — Systemic gate</div>
                <div className="kv"><span className="c-mut">Cross-correlation</span><span className="v" style={{ color: defense.cc >= 0.75 ? "#E74C3C" : defense.cc >= 0.55 ? "#F39C12" : "#2ECC71" }}>{f2(defense.cc)}</span></div>
                <div className="kv"><span className="c-mut">g factor</span><span className="v">{f2(defense.g)}</span></div>
                <div className="formula">g = clip((cc − 0.55) / (0.75 − 0.55), 0, 1)</div>
                <div className="phead"><span>Cross-correlation <small>0.55 → 0.75</small></span><span className="dist">{f2(defense.g)}</span></div>
                <Bullet pct={pct01(defense.cc)} />
              </div>

              <div className="layer">
                <div className="layer-title">Layer 3 — Re-entry</div>
                <div className="kv"><span className="c-mut">EMA 20</span><span className="v" style={{ color: defense.ema20_acima ? "#2ECC71" : "#E74C3C" }}>{defense.ema20_acima ? "above" : "below"}</span></div>
                <div className="kv"><span className="c-mut">Velocity</span><span className="v">{f2(defense.velocity)}</span></div>
                <div className="kv"><span className="c-mut">Days in defense</span><span className="v">{defense.reentry.days_in_defense}</span></div>
                <div style={{ marginTop: 6 }}><span className={`statechip ${defense.reentry.status === "re-entering" ? "g" : defense.reentry.status === "monitorando" ? "a" : "b"}`}>{defense.reentry.status}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="col-right">
          {pilarD && (
            <div className="card mb">
              <h2><span>Pillar D · Defensive rotation</span><span className="tag a">{pilarD.cap_pct != null ? `cap ${pilarD.cap_pct}%` : "cap —"}</span></h2>
              <div style={{ fontSize: 10, color: "var(--tx2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".8px" }}>Universe · {pilarD.universo.length} ETFs</div>
              {pilarD.universo.map((tk) => {
                const isTop = pilarD.top4_atual.includes(tk);
                return (
                  <div className={`etf-row${isTop ? " top4" : ""}`} key={tk}>
                    <span className="tk-link" style={{ fontWeight: 700, width: 50, display: "inline-block" }} onClick={() => go("chart", tk)}>{tk}</span>
                    <span className="etf-name">{isTop ? "current top 4" : ""}</span>
                    <span className="etf-wt">{isTop ? `${(100 / pilarD.top4_atual.length).toFixed(1)}%` : "—"}</span>
                  </div>
                );
              })}
              <div className="kv" style={{ marginTop: 10 }}>
                <span className="c-mut">Contribution YTD</span>
                <span className="v c-g">{pilarD.contribuicao_ytd_pct != null ? `${pilarD.contribuicao_ytd_pct >= 0 ? "+" : ""}${pilarD.contribuicao_ytd_pct.toFixed(2)}%` : "—"}</span>
              </div>
            </div>
          )}

          <div className="card">
            <h2><span>Re-Entry Monitor</span></h2>
            {reentry ? (
              <>
                <div className="kv"><span className="c-mut">Mode</span><span className="v">{reentry.mode}</span></div>
                <div className="kv"><span className="c-mut">EMA cross</span><span className="v">{reentry.ema_cross ? "yes" : "no"}</span></div>
                <div className="kv"><span className="c-mut">Sizing</span><span className="v">{reentry.sizing_pct}%</span></div>
                <div style={{ marginTop: 6 }}>
                  <div className="phead"><span>Velocity</span><span className="dist" style={{ color: reentry.velocity >= 0 ? "#2ECC71" : "#E74C3C" }}>{reentry.velocity >= 0 ? "+" : ""}{reentry.velocity.toFixed(2)}</span></div>
                  <Bullet pct={pct01(Math.abs(reentry.velocity) / 3)} />
                </div>
              </>
            ) : (
              <div className="ph"><b>Pillar D unavailable</b>API did not respond</div>
            )}
          </div>
        </div>
      </div>

      <div className="foot">Manager Cockpit · Protection & Defense · consumes /v1/protection/*. Shared design system (harpian-ds).</div>
    </div>
  );
}

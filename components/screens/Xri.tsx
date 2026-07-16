"use client";
import { useEffect, useState } from "react";
import { Bullet } from "../RegimeGauge";
import XriGauge from "../XriGauge";
import JimBlock from "../JimBlock";
import { buildXriInternal } from "@/lib/jim-cockpit-analysis";
import { publishScreenData } from "@/lib/jim-data";
import {
  fetchXriFeed, XRI_STATE_COLOR, COUNTRY_PT,
  type XriFeed, type XriSnapshot, type XriValidation, type XriCalibration,
} from "@/lib/xri";

function f1(n: number | null | undefined) { return n == null ? "—" : Number(n).toFixed(1); }
function f2(n: number | null | undefined) { return n == null ? "—" : Number(n).toFixed(2); }
function pctFmt(n: number | null | undefined, d = 1) { return n == null ? "—" : (100 * n).toFixed(d) + "%"; }
function ptCountry(k: string) { return COUNTRY_PT[k] || k; }
function heatCol(v: number) { return v >= 75 ? "#E74C3C" : v >= 55 ? "#E67E22" : v >= 30 ? "#F39C12" : "#2ECC71"; }

// ---------- Generic "sensor" component (same visual language as DefesaInteligente) ----------
function Sensor({ title, value, unit, color, note }: { title: string; value: string; unit?: string; color: string; note?: string }) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--mono)", color }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: "var(--tx3)" }}>{unit}</span>}
      </div>
      <Bullet pct={Math.max(0, Math.min(100, Number(value.replace(",", ".")) || 0))} />
      {note && <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 6, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

function BarRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
        <span style={{ color: "var(--tx2)" }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontFamily: "var(--mono)" }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 3, transition: "width .3s" }} />
      </div>
    </div>
  );
}

function synthesizeInsights(s: XriSnapshot): { type: "pos" | "neg" | "alert"; text: string }[] {
  const insights: { type: "pos" | "neg" | "alert"; text: string }[] = [];
  if (s.state === "CALM") insights.push({ type: "pos", text: "External regime CALM — no pillar under relevant stress." });
  else if (s.state === "CRISIS") insights.push({ type: "neg", text: "External regime CRISIS — fragility + transmission + market confirmation." });
  else insights.push({ type: s.state === "STRESS" ? "neg" : "alert", text: `External regime ${s.state} — score ${f1(s.score)}, direction ${s.direction}.` });

  if (s.absorption_ratio_score >= 80) insights.push({ type: "neg", text: `Absorption Ratio ${f1(s.absorption_ratio_score)} — diversification collapse, few factors explain the market.` });
  if (s.turbulence >= 70) insights.push({ type: "neg", text: `Turbulence (Mahalanobis) ${f1(s.turbulence)} — abnormal multivariate configuration vs. history.` });
  if (s.dy_material_to_us < 0.5) insights.push({ type: "pos", text: `Material DY ${f2(s.dy_material_to_us)} — exposure-weighted contagion still low (P7 matrix Q limits it).` });
  else insights.push({ type: "alert", text: `Material DY ${f2(s.dy_material_to_us)} — economically-weighted contagion rising.` });

  const flags = s.frequency_decomposition.stale_data_flags;
  if (flags?.length) insights.push({ type: "alert", text: `${flags.length} stale series with decay applied.` });
  if (s.data_quality_flags.includes("MARKET_STRESS_DOMINATED")) insights.push({ type: "alert", text: "Movement dominated by the fast-market layer — not a fundamental change in the slow regime." });
  if (s.data_quality_flags.includes("NOT_VALIDATED_AS_OVERLAY")) insights.push({ type: "alert", text: "NOT_VALIDATED_AS_OVERLAY — XRI is a dashboard/information layer, it does not automatically modulate Defensive." });
  return insights;
}

function JimXriPanel({ s }: { s: XriSnapshot }) {
  const insights = synthesizeInsights(s);
  const groups = { pos: insights.filter(i => i.type === "pos"), neg: insights.filter(i => i.type === "neg"), alert: insights.filter(i => i.type === "alert") };
  return (
    <div className="card" style={{ padding: "14px 16px", borderColor: "rgba(201,160,44,.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg, #C9A02C 0%, #E6B800 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-brain" style={{ fontSize: 14, color: "var(--bg)" }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: ".05em" }}>JIM XRI INTELLIGENCE</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {groups.pos.map((p, i) => <div key={`p${i}`} style={{ fontSize: 12, color: "#2ECC71", display: "flex", gap: 6 }}><i className="ti ti-circle-check" style={{ fontSize: 13, marginTop: 2, flexShrink: 0 }} /><span>{p.text}</span></div>)}
        {groups.neg.map((n, i) => <div key={`n${i}`} style={{ fontSize: 12, color: "#E74C3C", display: "flex", gap: 6 }}><i className="ti ti-alert-circle" style={{ fontSize: 13, marginTop: 2, flexShrink: 0 }} /><span>{n.text}</span></div>)}
        {groups.alert.map((a, i) => <div key={`a${i}`} style={{ fontSize: 12, color: "#F39C12", display: "flex", gap: 6 }}><i className="ti ti-alert-triangle" style={{ fontSize: 13, marginTop: 2, flexShrink: 0 }} /><span>{a.text}</span></div>)}
      </div>
    </div>
  );
}

function ValidationSection({ v }: { v: XriValidation }) {
  const sm = v.anchor_events.summary;
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3><i className="ti ti-history" style={{ marginRight: 6 }} />Economic validation (F4) — walk-forward {v.reconstruction.start.slice(0, 4)}–{v.reconstruction.end.slice(0, 4)}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
          <div><div className="muted" style={{ fontSize: 10 }}>Trading days reconstructed</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)" }}>{v.reconstruction.obs}</div></div>
          <div><div className="muted" style={{ fontSize: 10 }}>Events covered</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)" }}>{sm.events_covered}</div></div>
          <div><div className="muted" style={{ fontSize: 10 }}>Alert ≥{sm.alert_level}</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: "#2ECC71" }}>{sm.events_hit_alert}/{sm.events_covered} ({(100 * sm.hit_rate).toFixed(0)}%)</div></div>
          <div><div className="muted" style={{ fontSize: 10 }}>Median lead to WATCH</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)" }}>{sm.median_lead_days_watch}d</div></div>
        </div>
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead><tr style={{ color: "var(--tx3)", textAlign: "left" }}><th>Event</th><th>Start</th><th>Score→Max</th><th>Lead WATCH</th><th>Alert</th></tr></thead>
          <tbody>
            {v.anchor_events.events.map((e) => (
              <tr key={e.key} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "4px 0" }}>{e.name}</td>
                <td>{e.start}</td>
                <td>{e.status === "coberto" ? `${f1(e.score_at_start)}→${f1(e.max_score_window)} (${e.max_state_window})` : <span className="muted">{e.status}</span>}</td>
                <td>{e.lead_days_watch != null ? `${e.lead_days_watch}d` : "—"}</td>
                <td>{e.hit_alert != null ? (e.hit_alert ? <span style={{ color: "#2ECC71" }}>YES</span> : <span style={{ color: "#E74C3C" }}>no</span>) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          False positives: {v.anchor_events.false_positives.episodes} episodes · {v.anchor_events.false_positives.total_days}d ({f1(v.anchor_events.false_positives.pct_of_history)}% of history)
        </div>
      </div>

      {v.overlay_backtests?.map((ob) => (
        <div className="card" key={ob.motor_label} style={{ marginBottom: 14 }}>
          <h3><i className="ti ti-chart-histogram" style={{ marginRight: 6 }} />Overlay on/off — {ob.motor_label} ({ob.motor_period[0]} → {ob.motor_period[1]})</h3>
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead><tr style={{ color: "var(--tx3)", textAlign: "left" }}><th></th><th style={{ textAlign: "right" }}>Pure engine</th><th style={{ textAlign: "right" }}>+ Overlay</th></tr></thead>
            <tbody>
              <tr style={{ borderTop: "1px solid var(--line)" }}><td>Max Drawdown</td><td style={{ textAlign: "right" }}>{f1(100 * ob.base.max_drawdown)}%</td><td style={{ textAlign: "right", color: ob.verdict.drawdown_improved ? "#2ECC71" : "#E74C3C", fontWeight: 700 }}>{f1(100 * ob.overlay.max_drawdown)}%</td></tr>
              <tr><td>Sharpe</td><td style={{ textAlign: "right" }}>{f2(ob.base.sharpe)}</td><td style={{ textAlign: "right", color: ob.verdict.sharpe_improved ? "#2ECC71" : "#E74C3C", fontWeight: 700 }}>{f2(ob.overlay.sharpe)}</td></tr>
              <tr><td>PSR</td><td style={{ textAlign: "right" }}>{ob.base.psr.toFixed(3)}</td><td style={{ textAlign: "right" }}>{ob.overlay.psr.toFixed(3)}</td></tr>
              <tr><td>CAGR</td><td style={{ textAlign: "right" }}>{f1(100 * ob.base.cagr)}%</td><td style={{ textAlign: "right" }}>{f1(100 * ob.overlay.cagr)}%</td></tr>
            </tbody>
          </table>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>ΔDD {f1(ob.verdict.dd_delta_pp)}p.p. · cost {f1(ob.verdict.return_cost_pp_year)}p.p./yr · avg exposure {f1(100 * ob.overlay.avg_exposure)}%</div>
        </div>
      ))}

      <div className="card" style={{ marginBottom: 14, borderColor: v.kill_criteria.verdict.includes("APROVADO") ? "rgba(46,204,113,.3)" : "rgba(231,76,60,.3)" }}>
        <h3><i className="ti ti-gavel" style={{ marginRight: 6 }} />Kill criteria — F4 verdict</h3>
        <div style={{ fontSize: 14, fontWeight: 700, color: v.kill_criteria.verdict.includes("APROVADO") ? "#2ECC71" : "#E74C3C" }}>{v.kill_criteria.verdict}</div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          <b>Stated limitations:</b>
          <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>{v.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      </div>
    </>
  );
}

function CalibrationSection({ c }: { c: XriCalibration }) {
  return (
    <div className="card" style={{ marginBottom: 14, borderColor: c.approved ? "rgba(46,204,113,.3)" : "rgba(231,76,60,.3)" }}>
      <h3><i className="ti ti-adjustments" style={{ marginRight: 6 }} />Banded calibration (F4.1) — {c.search_space.n_trials} pre-declared configs, walk-forward OOS {c.oos_period[0]} → {c.oos_period[1]}</h3>
      <table style={{ width: "100%", fontSize: 12, marginBottom: 10 }}>
        <thead><tr style={{ color: "var(--tx3)", textAlign: "left" }}><th></th><th style={{ textAlign: "right" }}>Base</th><th style={{ textAlign: "right" }}>Calibrated overlay</th></tr></thead>
        <tbody>
          <tr style={{ borderTop: "1px solid var(--line)" }}><td>Max Drawdown</td><td style={{ textAlign: "right" }}>{f1(100 * c.oos_base.maxdd)}%</td><td style={{ textAlign: "right", color: c.checks.dd_ok ? "#2ECC71" : "#E74C3C" }}>{f1(100 * c.oos_overlay.maxdd)}%</td></tr>
          <tr><td>Sharpe</td><td style={{ textAlign: "right" }}>{f2(c.oos_base.sharpe)}</td><td style={{ textAlign: "right", color: c.checks.sharpe_ok ? "#2ECC71" : "#E74C3C" }}>{f2(c.oos_overlay.sharpe)}</td></tr>
          <tr><td>Calmar</td><td style={{ textAlign: "right" }}>{f2(c.oos_base.calmar)}</td><td style={{ textAlign: "right" }}>{f2(c.oos_overlay.calmar)}</td></tr>
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
        Deflated DSR ({c.deflated.n_trials} trials): overlay {c.deflated.dsr_overlay.toFixed(3)} vs base {c.deflated.psr_base.toFixed(3)}
        {c.robustness && <> · Robustness {c.robustness.motor}: DD {f1(100 * c.robustness.base.maxdd)}%→{f1(100 * c.robustness.overlay.maxdd)}% · Sharpe {f2(c.robustness.base.sharpe)}→{f2(c.robustness.overlay.sharpe)}</>}
      </div>
      <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
        <b>Config chosen per year (past data only):</b> {c.selections.map(s => `${s.year}:${s.config.split("|").pop()}`).join(" · ")}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.approved ? "#2ECC71" : "#E74C3C" }}>{c.verdict}</div>
    </div>
  );
}

export default function Xri() {
  const [feed, setFeed] = useState<XriFeed>({ ok: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchXriFeed().then((f) => { setFeed(f); setLoading(false); }); }, []);

  const s = feed.snapshot;

  const deepAnalysis = feed.jim_analysis?.analysis || null;

  useEffect(() => {
    if (!s) return;
    const fallback = `XRI at ${f1(s.score)} (${s.state}), direction ${s.direction}. Absorption Ratio ${f1(s.absorption_ratio_score)}, Turbulence ${f1(s.turbulence)}, material DY ${f2(s.dy_material_to_us)}. Confidence ${pctFmt(s.confidence, 0)}.`;
    publishScreenData(
      "xri",
      "XRI — External Regime Index: external regime risk (0-100), pillars, countries, fragility, events, F4/F4.1 validation.",
      { score: s.score, state: s.state, turbulence: s.turbulence, absorption: s.absorption_ratio_score, dy_material: s.dy_material_to_us },
      {
        // If the nightly analysis (xri-analyze, all the numbers + news) already exists,
        // JIM starts from it — not from the shallow summary — when triggered on this screen.
        briefing: deepAnalysis || fallback,
        suggestions: ["Why is the Absorption Ratio high?", "Was the overlay approved in F4.1?", "Which countries contribute the most today?"],
      }
    );
  }, [s, deepAnalysis]);

  if (loading) return <div className="screen"><div className="muted" style={{ padding: 40, textAlign: "center" }}>Loading…</div></div>;
  if (!feed.ok || !s) return (
    <div className="screen">
      <div className="crumb">Defense › <b>External Risk (XRI)</b></div>
      <div className="placeholder"><i className="ti ti-cloud-off" /><b>XRI unavailable</b><div className="muted" style={{ marginTop: 6 }}>Run <code>xri-daily</code> in the harpian-xri repo to generate the snapshot.</div></div>
    </div>
  );

  const col = XRI_STATE_COLOR[s.state];
  const pillars = Object.entries(s.contribution_by_pillar).sort((a, b) => b[1] - a[1]);
  const countries = Object.entries(s.contribution_by_country).sort((a, b) => b[1] - a[1]);
  const dyCountries = Object.entries(s.dy_by_country).sort((a, b) => b[1] - a[1]);

  return (
    <div className="screen">
      <div className="crumb">Defense › <b>XRI · External Risk</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="flex" style={{ alignItems: "baseline", gap: 10 }}>
            <div className="h1" style={{ margin: 0 }}>External Risk</div>
            <span className="tag b" style={{ fontFamily: "var(--mono)", fontWeight: 700 }} title="External Regime Index — external counterpart of the ARI (American Regime Index)">XRI</span>
          </div>
          <div className="sub">External Regime Index · external counterpart of the ARI · institutional overlay, never an autonomous signal · asof {s.asof_date}</div>
        </div>
        <span className="tag" style={{ background: `${col}18`, color: col, fontFamily: "var(--mono)", fontWeight: 700 }}>{s.state}</span>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 0", marginBottom: 8, borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>SCORE</span><span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: col }}>{f1(s.score)}</span></div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>DIRECTION</span><span style={{ fontSize: 14, fontWeight: 700 }}>{s.direction}</span></div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>CONFIDENCE</span><span style={{ fontSize: 14, fontWeight: 700 }}>{pctFmt(s.confidence, 0)}</span></div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>P7 REPORTED</span><span style={{ fontSize: 14, fontWeight: 700, color: s.exposure_quality.reported_coverage_pct >= 60 ? "#2ECC71" : "#E74C3C" }}>{f1(s.exposure_quality.reported_coverage_pct)}%</span></div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>MODEL</span><span style={{ fontSize: 12, fontFamily: "var(--mono)" }}>{s.versions.model_version} · {s.versions.exposure_version}</span></div>
        {s.data_quality_flags.map((flag) => <span key={flag} className="tag r" style={{ fontSize: 9 }}>{flag}</span>)}
      </div>

      {/* Row 1: Gauge + quick JIM (rules) */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tx2)", marginBottom: 2, fontFamily: "var(--mono)", letterSpacing: ".06em" }}>XRI THERMOMETER</div>
          <XriGauge score={s.score} state={s.state} />
        </div>
        <JimXriPanel s={s} />
      </div>

      {/* Row 1.5: Deep JIM analysis (generated overnight by xri-analyze — all the numbers + news) */}
      <div className="card" style={{ marginBottom: 14, borderColor: "rgba(201,160,44,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}><i className="ti ti-notebook" style={{ marginRight: 6 }} />JIM Analysis — deep (overnight)</h3>
          {feed.jim_analysis && (
            <span className="muted" style={{ fontSize: 10, fontFamily: "var(--mono)" }}>
              {new Date(feed.jim_analysis.generated_at).toLocaleString("en-US")} · {feed.jim_analysis.model}
              {feed.jim_analysis.sources.jd_news && " · w/ news"}{feed.jim_analysis.sources.black_library && " · w/ Black Library"}
            </span>
          )}
        </div>
        {deepAnalysis ? (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--tx)" }}>{deepAnalysis}</div>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>
            Not generated yet. Run <code>xri-analyze</code> (needs <code>ANTHROPIC_API_KEY</code> in <code>.env</code> in the harpian-xri repo) —
            runs together with <code>xri-daily</code> in the nightly job.
            Meanwhile, the structured reading below always runs, independent of the key.
          </div>
        )}
      </div>

      {/* Row 1.6: JIM's structured reading — the mechanism behind the score
          (which channel dominates, absorption, slow×fast, transmission, overlay+flag). */}
      <div style={{ marginBottom: 14 }}>
        <JimBlock block={buildXriInternal(s)} />
      </div>

      {/* Row 2: 5 hard-core components */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 14 }}>
        <Sensor title="Slow Prior" value={f1(s.slow_prior)} color={heatCol(s.slow_prior)} note="Slow macro (P1/P3/P4/P7), decay between releases." />
        <Sensor title="Fast Stress" value={f1(s.fast_market_stress)} color={heatCol(s.fast_market_stress)} note="FX, rates, credit, energy, VIX — daily." />
        <Sensor title="Turbulence" value={f1(s.turbulence)} color={heatCol(s.turbulence)} note="Percentile of the Mahalanobis distance (shrinkage)." />
        <Sensor title="Absorption Ratio" value={f1(s.absorption_ratio_score)} color={heatCol(s.absorption_ratio_score)} note="Percentile of variance concentration (diversification collapse)." />
        <Sensor title="Material DY → US" value={f2(s.dy_material_to_us)} unit="(0-100 = global DY)" color={s.dy_material_to_us >= 1 ? "#E74C3C" : s.dy_material_to_us >= 0.5 ? "#F39C12" : "#2ECC71"} note={`Global DY ${f1(s.dy_global)} · weighted by W[g]·Q[g]`} />
      </div>

      {/* Row 3: contribution by pillar / country + exposure quality */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <h3><i className="ti ti-stack" style={{ marginRight: 6 }} />Contribution by pillar</h3>
          {pillars.length ? pillars.map(([k, v]) => <BarRow key={k} label={k} pct={v} color="#4A90D9" />) : <div className="muted">No positive contribution today.</div>}
        </div>
        <div className="card">
          <h3><i className="ti ti-world" style={{ marginRight: 6 }} />Contribution by country/bloc</h3>
          {countries.length ? countries.map(([k, v]) => <BarRow key={k} label={ptCountry(k)} pct={v} color="#4A90D9" />) : <div className="muted">No positive contribution today.</div>}
        </div>
        <div className="card">
          <h3><i className="ti ti-database" style={{ marginRight: 6 }} />Exposure quality (P7)</h3>
          <BarRow label="Reported (10-K/XBRL)" pct={s.exposure_quality.reported_coverage_pct} color="#2ECC71" />
          <BarRow label="Imputed" pct={s.exposure_quality.imputed_coverage_pct} color="#F39C12" />
          <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 4 }}>Average Q confidence: <b style={{ color: "var(--tx)" }}>{pctFmt(s.exposure_quality.avg_confidence, 0)}</b></div>
          {s.exposure_quality.low_confidence_blocks.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>Low confidence: {s.exposure_quality.low_confidence_blocks.map(ptCountry).join(", ")}</div>
          )}
        </div>
      </div>

      {/* Row 4: DY by country + events */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <h3><i className="ti ti-affiliate" style={{ marginRight: 6 }} />Diebold–Yilmaz · DY(g→US) by bloc</h3>
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead><tr style={{ color: "var(--tx3)", textAlign: "left" }}><th>Bloc</th><th style={{ textAlign: "right" }}>DY g→US (%)</th></tr></thead>
            <tbody>{dyCountries.map(([k, v]) => <tr key={k} style={{ borderTop: "1px solid var(--line)" }}><td>{ptCountry(k)}</td><td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{f2(v)}</td></tr>)}</tbody>
          </table>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>DY_material = Σ W[g]·Q[g]·DY(g→US) = <b style={{ color: "var(--tx)" }}>{f2(s.dy_material_to_us)}</b> · DY_global = <b style={{ color: "var(--tx)" }}>{f1(s.dy_global)}</b></div>
        </div>
        <div className="card">
          <h3><i className="ti ti-news" style={{ marginRight: 6 }} />Bayesian Narrative Gate</h3>
          <div style={{ marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 10, marginBottom: 4 }}>ACCEPTED IN SCORE ({s.accepted_events.length})</div>
            {s.accepted_events.length ? s.accepted_events.map((e) => (
              <div key={e.event_id} style={{ fontSize: 11, marginBottom: 3 }}>{e.date} · {ptCountry(e.country)} · {e.channel} — {e.description} <b style={{ color: e.contribution >= 0 ? "#E74C3C" : "#2ECC71" }}>{e.contribution >= 0 ? "+" : ""}{e.contribution} pts</b></div>
            )) : <div className="muted" style={{ fontSize: 11 }}>No event accepted — score 100% hard data.</div>}
          </div>
          <div>
            <div className="muted" style={{ fontSize: 10, marginBottom: 4 }}>QUARANTINE ({s.quarantined_events.length})</div>
            {s.quarantined_events.length ? s.quarantined_events.map((e) => (
              <div key={e.event_id} style={{ fontSize: 11, marginBottom: 3 }}>{e.date} · {ptCountry(e.country)} — {e.description} <span className="muted">({e.reason})</span></div>
            )) : <div className="muted" style={{ fontSize: 11 }}>Empty quarantine.</div>}
          </div>
        </div>
      </div>

      {/* Row 5: Recommended overlay */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3><i className="ti ti-adjustments-horizontal" style={{ marginRight: 6 }} />Overlay recommended today (state {s.state})</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><div className="muted" style={{ fontSize: 10 }}>Gross exposure cap</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)" }}>{pctFmt(s.overlay_recommendation.gross_exposure_cap_modifier, 0)}</div></div>
          <div><div className="muted" style={{ fontSize: 10 }}>Defensive threshold</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)" }}>{f2(s.overlay_recommendation.defensive_threshold_modifier)}</div></div>
          <div><div className="muted" style={{ fontSize: 10 }}>Re-Entry</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)" }}>{s.overlay_recommendation.reentry_confirmation_required}</div></div>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Sources used today: {s.sources_used.join(" · ")}</div>
      </div>

      {feed.validation && <ValidationSection v={feed.validation} />}
      {feed.calibration && <CalibrationSection c={feed.calibration} />}

      <div className="legend mt">
        <span className="muted">XRI · engine in the harpian-xri repo (immutable daily snapshot) · Internal Cockpit — shows the full method, never exposed to the client Terminal.</span>
      </div>
    </div>
  );
}

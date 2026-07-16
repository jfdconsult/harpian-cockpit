"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import { Bullet } from "@/components/RegimeGauge";
import JimBlock from "@/components/JimBlock";
import { buildCockpitAnalysis, cockpitAnalysisToBriefing } from "@/lib/jim-cockpit-analysis";
import { fetchXriFeed, type XriSnapshot } from "@/lib/xri";

// ---------- Types ----------
interface IndicatorsState {
  temperatura: { valor: number; limiar: number; status: string };
  cross_correlation: { valor: number; limiar_low: number; limiar_high: number; g: number; status: string };
  ema20: { valor: string; dist_pct: number | null; status: string };
  mac_score?: { valor: number; limiar: number; status: string; f13?: number; cot?: number; fed?: number } | null;
}

interface PilarDef { nome: string; temp: number; turb: number; trend_break: number; jerk: number; limiar: number | null; status: string }
interface DefenseState {
  portfolio_id: string; regime: string; defesa_pct: number; pilares: Record<string, PilarDef>;
  cc: number; cc_gate_low: number; cc_gate_high: number; g: number; ema20_acima: boolean; velocity: number | null;
  reentry: { status: string; days_in_defense: number; target_pct: number | null };
}
interface PilarD { universo: string[]; top4_atual: string[]; cap_pct: number | null; rotacao_freq: string; contribuicao_ytd_pct: number | null }
interface ReentryState { mode: string; days: number; ema_cross: boolean; velocity: number; sizing_pct: number }
interface JimAnalysis { analysis: string; generated_at: string; sources: { jd_news: boolean; black_library: boolean; xri: boolean }; model: string }

// Keys = REAL values emitted by compute_regime() in overnight_run.py
// (RISK-ON → WARNING → RISK-OFF → RE-ENTRY → RISK-ON). It used to use
// BEAR/CAUTELA/NEUTRO/BULL, which never matched the API — the .find() always
// failed and fell back to (RISK-ON/green), showing the wrong regime.
const REGIMES = [
  { key: "RISK-OFF", label: "Risk-Off", color: "#E74C3C", icon: "ti-shield-off" },
  { key: "WARNING", label: "Caution", color: "#F39C12", icon: "ti-alert-triangle" },
  { key: "RE-ENTRY", label: "Re-Entry", color: "#4A90D9", icon: "ti-arrows-split" },
  { key: "RISK-ON", label: "Risk-On", color: "#2ECC71", icon: "ti-trending-up" },
];

const REGIME_MEANING: Record<string, string> = {
  "RISK-ON": "Risk-favorable environment. Full exposure; defense on standby.",
  "RE-ENTRY": "Exiting defense. Gradual re-entry, controlled sizing.",
  "WARNING": "Signs of deterioration. Risk reduction underway.",
  "RISK-OFF": "Adverse environment. Active defense, reduced exposure.",
};

const DEFAULTS: IndicatorsState = {
  temperatura: { valor: 0.42, limiar: 0.6, status: "normal" },
  cross_correlation: { valor: 0.62, limiar_low: 0.55, limiar_high: 0.75, g: 0.35, status: "elevado" },
  ema20: { valor: "acima", dist_pct: 2.3, status: "ok" },
  mac_score: { valor: 68, limiar: 50, status: "positivo" },
};

// ---------- Helpers ----------
function f2(n: number | null | undefined) { return n == null ? "—" : Number(n).toFixed(2); }
function tempColor(v: number) { return v >= 0.8 ? "#E74C3C" : v >= 0.6 ? "#E67E22" : v >= 0.4 ? "#E5B800" : v >= 0.2 ? "#2ECC71" : "#1A8FE3"; }
function tempZoneLabel(v: number) { return v >= 0.8 ? "DEFENSE" : v >= 0.6 ? "ALERT" : v >= 0.4 ? "CAUTION" : v >= 0.2 ? "NEUTRAL" : "ATTACK"; }
function balPct(v: number): string { return Math.max(0, Math.round(100 - 125 * v)) + "%"; }
function ccColor(v: number) { return v >= 0.75 ? "#E74C3C" : v >= 0.55 ? "#F39C12" : "#2ECC71"; }
function pct01(v: number) { return Math.max(0, Math.min(100, v * 100)); }
function sem(s: string) { return s === "ataque" ? "g" : s === "alerta" ? "a" : s === "defesa" ? "r" : "b"; }

function trendArrow(dir: "up" | "down" | "flat"): { icon: string; color: string; label: string } {
  if (dir === "up") return { icon: "ti-trending-up", color: "#E74C3C", label: "rising" };
  if (dir === "down") return { icon: "ti-trending-down", color: "#2ECC71", label: "falling" };
  return { icon: "ti-minus", color: "#7d96b3", label: "stable" };
}

function computeTrend(current: number, previous: number): "up" | "down" | "flat" {
  const delta = current - previous;
  if (Math.abs(delta) < 0.02) return "flat";
  return delta > 0 ? "up" : "down";
}

// ---------- 180° Gauge — 5 zones, 4 control points (0-100% balancing) ----------
function TempGauge180({ value, trend1d, trend1w }: { value: number; trend1d: "up" | "down" | "flat"; trend1w: "up" | "down" | "flat" }) {
  const cx = 150, cy = 148, r = 110;
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const zones = [
    { vStart: 0.0,  vEnd: 0.2,  degStart: 0,    degEnd: 28,   color: "#1A8FE3", label: "ATTACK",  bal: "100%" },
    { vStart: 0.2,  vEnd: 0.4,  degStart: 28,   degEnd: 62,   color: "#2ECC71", label: "NEUTRAL",  bal: "75%" },
    { vStart: 0.4,  vEnd: 0.6,  degStart: 62,   degEnd: 102,  color: "#E5B800", label: "CAUTION", bal: "50%" },
    { vStart: 0.6,  vEnd: 0.8,  degStart: 102,  degEnd: 145,  color: "#E67E22", label: "ALERT",  bal: "25%" },
    { vStart: 0.8,  vEnd: 1.0,  degStart: 145,  degEnd: 180,  color: "#E74C3C", label: "DEFENSE",  bal: "0%" },
  ];

  function v2a(v: number): number {
    const c = Math.max(0, Math.min(1, v));
    for (const z of zones) {
      if (c <= z.vEnd) {
        const t = (c - z.vStart) / (z.vEnd - z.vStart);
        return deg2rad(z.degStart + t * (z.degEnd - z.degStart));
      }
    }
    return Math.PI;
  }

  const angle = v2a(value);
  const col = tempColor(value);
  const activeZone = zones.find(z => value >= z.vStart && value < z.vEnd) || zones[zones.length - 1];
  const zLabel = tempZoneLabel(value);
  const bal = balPct(value);
  const t1d = trendArrow(trend1d);
  const t1w = trendArrow(trend1w);

  const needleX = cx + r * 0.82 * Math.cos(angle);
  const needleY = cy - r * 0.82 * Math.sin(angle);

  const numR = r * 0.48;
  const numX = cx + numR * Math.cos(angle);
  const numY = cy - numR * Math.sin(angle);

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={300} height={190} viewBox="0 0 300 190">
        {zones.map((z) => {
          const a1 = deg2rad(z.degStart);
          const a2 = deg2rad(z.degEnd);
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy - r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy - r * Math.sin(a2);
          const large = (z.degEnd - z.degStart) > 90 ? 1 : 0;
          const isActive = z.label === activeZone.label;
          return (
            <path key={z.label}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`}
              fill="none" stroke={z.color}
              strokeWidth={isActive ? 24 : 18} strokeLinecap="butt"
              opacity={isActive ? 0.38 : 0.12}
              style={isActive ? { filter: `drop-shadow(0 0 8px ${z.color}40)` } : undefined}
            />
          );
        })}

        {value > 0.01 && zones.map((z) => {
          if (value <= z.vStart) return null;
          const segStart = Math.max(z.vStart, 0);
          const segEnd = Math.min(value, z.vEnd);
          if (segEnd <= segStart) return null;
          const a1 = v2a(segStart);
          const a2 = v2a(segEnd);
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy - r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy - r * Math.sin(a2);
          const degSpan = (a2 - a1) * 180 / Math.PI;
          const large = degSpan > 90 ? 1 : 0;
          const isFirst = z.vStart === 0;
          const isLast = value <= z.vEnd;
          return (
            <path key={`fill-${z.label}`}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`}
              fill="none" stroke={z.color} strokeWidth={22}
              strokeLinecap={isFirst || isLast ? "round" : "butt"}
              style={{ filter: `drop-shadow(0 0 6px ${z.color}40)` }}
            />
          );
        })}

        {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => {
          const a = v2a(v);
          const isBoundary = v > 0 && v < 1;
          const t1 = r - 13, t2 = r + 13;
          return (
            <g key={v}>
              <line
                x1={cx + t1 * Math.cos(a)} y1={cy - t1 * Math.sin(a)}
                x2={cx + t2 * Math.cos(a)} y2={cy - t2 * Math.sin(a)}
                stroke={isBoundary ? "var(--tx2)" : "var(--tx3)"} strokeWidth={isBoundary ? 2 : 1} opacity={isBoundary ? 0.4 : 0.2}
              />
              <text
                x={cx + (t2 + 10) * Math.cos(a)} y={cy - (t2 + 10) * Math.sin(a)}
                textAnchor="middle" dominantBaseline="middle"
                fill="var(--tx3)" fontSize={8} fontFamily="var(--mono)">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {zones.map((z) => {
          const midA = deg2rad((z.degStart + z.degEnd) / 2);
          const lr = r + 26;
          const isActive = z.label === activeZone.label;
          return (
            <g key={`lbl-${z.label}`}>
              <text
                x={cx + lr * Math.cos(midA)} y={cy - lr * Math.sin(midA) - 5}
                textAnchor="middle" dominantBaseline="middle"
                fill={z.color} fontSize={isActive ? 9 : 7} fontWeight={isActive ? 800 : 600}
                fontFamily="var(--mono)" opacity={isActive ? 1 : 0.45}>
                {z.label}
              </text>
              <text
                x={cx + lr * Math.cos(midA)} y={cy - lr * Math.sin(midA) + 6}
                textAnchor="middle" dominantBaseline="middle"
                fill={z.color} fontSize={7} fontWeight={500}
                fontFamily="var(--mono)" opacity={isActive ? 0.7 : 0.3}>
                {z.bal}
              </text>
            </g>
          );
        })}

        <line x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke={col} strokeWidth={3} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${col})` }}
        />
        <circle cx={cx} cy={cy} r={6} fill={col} stroke="var(--bg1)" strokeWidth={3} />

        <text x={numX} y={numY - 8} textAnchor="middle" dominantBaseline="middle"
          fill={col} fontSize={26} fontWeight={800} fontFamily="var(--mono)"
          style={{ filter: `drop-shadow(0 1px 3px var(--bg1))` }}>
          {f2(value)}
        </text>
        <text x={numX} y={numY + 10} textAnchor="middle" dominantBaseline="middle"
          fill={col} fontSize={9} fontWeight={700} fontFamily="var(--mono)" opacity={0.85}>
          {zLabel} · {bal}
        </text>
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <i className={`ti ${t1d.icon}`} style={{ color: t1d.color, fontSize: 16 }} />
          <span style={{ color: "var(--tx3)", fontFamily: "var(--mono)" }}>1d</span>
          <span style={{ color: t1d.color, fontWeight: 600, fontFamily: "var(--mono)" }}>{t1d.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <i className={`ti ${t1w.icon}`} style={{ color: t1w.color, fontSize: 16 }} />
          <span style={{ color: "var(--tx3)", fontFamily: "var(--mono)" }}>7d</span>
          <span style={{ color: t1w.color, fontWeight: 600, fontFamily: "var(--mono)" }}>{t1w.label}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Sensor Card ----------
function SensorCard({ title, icon, value, unit, color, statusLabel, statusTone, trend, children }: {
  title: string; icon: string; value: string; unit?: string; color: string;
  statusLabel: string; statusTone: string; trend?: "up" | "down" | "flat";
  children?: React.ReactNode;
}) {
  const tr = trend ? trendArrow(trend) : null;
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{title}</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          background: statusTone === "g" ? "rgba(46,204,113,.12)" : statusTone === "r" ? "rgba(231,76,60,.12)" : "rgba(243,156,18,.12)",
          color: statusTone === "g" ? "#2ECC71" : statusTone === "r" ? "#E74C3C" : "#F39C12",
          fontFamily: "var(--mono)",
        }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--mono)", color, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: "var(--tx3)" }}>{unit}</span>}
        {tr && (
          <span style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
            <i className={`ti ${tr.icon}`} style={{ fontSize: 16, color: tr.color }} />
            <span style={{ fontSize: 10, color: tr.color, fontFamily: "var(--mono)", fontWeight: 600 }}>{tr.label}</span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------- JIM Defense Panel ----------
function JimDefensePanel({ regime, temp, cc, ema, mac, defenseState, reentry }: {
  regime: string; temp: number; cc: number; ema: string; mac: number | null;
  defenseState: DefenseState | null; reentry: ReentryState | null;
}) {
  const insights: { type: "pos" | "neg" | "alert"; text: string }[] = [];

  if (regime === "RISK-ON") insights.push({ type: "pos", text: "RISK-ON regime — full exposure, defense on standby." });
  else if (regime === "RISK-OFF") insights.push({ type: "neg", text: "RISK-OFF regime — active defense, reduced exposure." });
  else if (regime === "WARNING") insights.push({ type: "neg", text: "WARNING regime — risk reduction underway." });
  else if (regime === "RE-ENTRY") insights.push({ type: "alert", text: "RE-ENTRY regime — exiting defense, gradual re-entry." });

  if (temp < 0.3) insights.push({ type: "pos", text: `Low temperature (${f2(temp)}) — all pillars stable.` });
  else if (temp >= 0.6) insights.push({ type: "neg", text: `Critical temperature (${f2(temp)}) — one or more pillars in defense.` });
  else if (temp >= 0.4) insights.push({ type: "alert", text: `Temperature on alert (${f2(temp)}) — monitor for escalation.` });

  if (cc >= 0.75) insights.push({ type: "neg", text: `Critical cross-correlation (${f2(cc)}) — elevated systemic risk, gate active.` });
  else if (cc >= 0.55) insights.push({ type: "alert", text: `Elevated cross-correlation (${f2(cc)}) — diversification losing effect.` });
  else insights.push({ type: "pos", text: `Healthy cross-correlation (${f2(cc)}) — diversification working.` });

  if (ema === "acima") insights.push({ type: "pos", text: "Price above the 20 EMA — uptrend intact." });
  else insights.push({ type: "neg", text: "Price below the 20 EMA — trend broken, defense maintained." });

  if (mac != null) {
    if (mac >= 60) insights.push({ type: "pos", text: `Positive MAC Score (${mac}/100) — macro environment supports risk.` });
    else if (mac < 30) insights.push({ type: "neg", text: `Negative MAC Score (${mac}/100) — unfavorable macro environment.` });
  }

  if (defenseState) {
    const pilaresEmAlerta = Object.values(defenseState.pilares).filter(p => p.status === "alerta" || p.status === "defesa").length;
    if (pilaresEmAlerta === 0) insights.push({ type: "pos", text: "No pillar on alert — all engines operating normally." });
    else insights.push({ type: "neg", text: `${pilaresEmAlerta} pillar${pilaresEmAlerta > 1 ? "s" : ""} on alert or defense — monitor the breakdown.` });
  }

  if (reentry) {
    if (reentry.mode === "re-entering") insights.push({ type: "pos", text: `Re-entry underway — sizing ${reentry.sizing_pct}%, velocity ${f2(reentry.velocity)}.` });
    else if (reentry.days > 5) insights.push({ type: "alert", text: `${reentry.days} days in defense — awaiting re-entry conditions.` });
  }

  const positives = insights.filter((i) => i.type === "pos");
  const negatives = insights.filter((i) => i.type === "neg");
  const alerts = insights.filter((i) => i.type === "alert");

  return (
    <div className="card" style={{ padding: "14px 16px", borderColor: "rgba(201,160,44,.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: "linear-gradient(135deg, #C9A02C 0%, #E6B800 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-brain" style={{ fontSize: 14, color: "var(--bg)" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: ".05em" }}>
            JIM DEFENSE INTELLIGENCE
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)" }}>
            Proactive analysis &middot; {new Date().toLocaleDateString("en-US")}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {positives.map((p, i) => (
          <div key={`p${i}`} style={{ fontSize: 12, color: "#2ECC71", lineHeight: 1.5, display: "flex", gap: 6 }}>
            <i className="ti ti-circle-check" style={{ fontSize: 13, marginTop: 2, flexShrink: 0 }} />
            <span>{p.text}</span>
          </div>
        ))}
        {negatives.map((n, i) => (
          <div key={`n${i}`} style={{ fontSize: 12, color: "#E74C3C", lineHeight: 1.5, display: "flex", gap: 6 }}>
            <i className="ti ti-alert-circle" style={{ fontSize: 13, marginTop: 2, flexShrink: 0 }} />
            <span>{n.text}</span>
          </div>
        ))}
        {alerts.map((a, i) => (
          <div key={`a${i}`} style={{ fontSize: 12, color: "#F39C12", lineHeight: 1.5, display: "flex", gap: 6 }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 13, marginTop: 2, flexShrink: 0 }} />
            <span>{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Main ----------
export default function DefesaInteligente() {
  const [ind, setInd] = useState<IndicatorsState>(DEFAULTS);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [tempHistory, setTempHistory] = useState<{ d1: number; d7: number }>({ d1: 0.42, d7: 0.45 });
  const [defenseState, setDefenseState] = useState<DefenseState | null>(null);
  const [pilarD, setPilarD] = useState<PilarD | null>(null);
  const [reentry, setReentry] = useState<ReentryState | null>(null);
  const [jimAnalysis, setJimAnalysis] = useState<JimAnalysis | null>(null);
  // XRI is only here for the internal×external crossover (engine CC × XRI
  // absorption ratio). The XRI detail lives on its own screen.
  const [xriSnap, setXriSnap] = useState<XriSnapshot | null>(null);
  const pid = "HPC22";

  const CURRENT_REGIME = defenseState?.regime || "RISK-ON";
  const curRegime = REGIMES.find((r) => r.key === CURRENT_REGIME) || REGIMES[3];

  useEffect(() => {
    apiGet<{ indicators: IndicatorsState }>("/v1/protection/indicators")
      .then((data) => { setInd(data.indicators); setConn("ok"); })
      .catch(() => { setInd(DEFAULTS); setConn("error"); });

    apiGet<{ temp_1d_ago: number; temp_7d_ago: number }>("/v1/protection/temp-history")
      .then((h) => setTempHistory({ d1: h.temp_1d_ago, d7: h.temp_7d_ago }))
      .catch(() => {});

    apiGet<DefenseState>(`/v1/protection/defense?portfolio_id=${pid}`)
      .then(setDefenseState)
      .catch(() => {});

    apiGet<PilarD>("/v1/protection/pilar-d")
      .then(setPilarD)
      .catch(() => {});

    apiGet<ReentryState>(`/v1/protection/reentry?portfolio_id=${pid}`)
      .then(setReentry)
      .catch(() => {});

    apiGet<{ available: boolean; analysis: JimAnalysis | null }>("/v1/protection/jim-analysis")
      .then((r) => setJimAnalysis(r.available ? r.analysis : null))
      .catch(() => {});

    fetchXriFeed()
      .then((f) => { if (f.ok && f.snapshot) setXriSnap(f.snapshot); })
      .catch(() => {});
  }, [pid]);

  const t = ind.temperatura;
  const cc = ind.cross_correlation;
  const ema = ind.ema20;
  const mac = ind.mac_score;
  const ccRange = cc.limiar_high - cc.limiar_low;
  const gFactor = ccRange ? Math.max(0, Math.min(1, (cc.valor - cc.limiar_low) / ccRange)) : 0;
  const trend1d = computeTrend(t.valor, tempHistory.d1);
  const trend1w = computeTrend(t.valor, tempHistory.d7);

  // Structured JIM reading (engine + XRI). Always runs — doesn't depend on the LLM.
  const jimA = buildCockpitAnalysis(
    ind,
    defenseState,
    { temp_1d_ago: tempHistory.d1, temp_7d_ago: tempHistory.d7 },
    xriSnap
  );
  const ariBlock = jimA.blocks.find((b) => b.key === "ari");

  const tSt = t.valor >= 0.6 ? ["defesa", "r"] : t.valor >= 0.4 ? ["alerta", "a"] : ["normal", "g"];
  const ccSt = cc.valor >= 0.75 ? ["critico", "r"] : cc.valor >= 0.55 ? ["elevado", "a"] : ["normal", "g"];
  const macSt = mac ? (mac.valor >= 50 ? ["positivo", "g"] : mac.valor >= 30 ? ["neutro", "a"] : ["negativo", "r"]) : ["N/A", "b"];

  const pilaresEmAlerta = defenseState ? Object.values(defenseState.pilares).filter(p => p.status === "alerta" || p.status === "defesa").length : 0;

  useEffect(() => {
    publishScreenData(
      "defesa-inteligente",
      "Intelligent Defense: regime + 4 sensors + pillar temperature + re-entry + Pillar D. Defense-exclusive instruments.",
      {
        regime: CURRENT_REGIME, temperatura: t.valor, trend1d, trend1w,
        cc: cc.valor, gFactor, ema: ema.valor, mac: mac?.valor ?? null,
        pilaresEmAlerta,
        defenseState: defenseState ? { defesa_pct: defenseState.defesa_pct, pilares: defenseState.pilares } : null,
        reentry: reentry ? { mode: reentry.mode, days: reentry.days, sizing_pct: reentry.sizing_pct } : null,
      },
      {
        // Briefing preference order: (1) overnight LLM analysis, if the key
        // is configured; (2) rule-based structured reading, which always
        // runs. JIM never falls back to the shallow summary when something
        // better is available.
        briefing: jimAnalysis?.analysis || cockpitAnalysisToBriefing(jimA),
        suggestions: [
          "Does defense need to be activated now?",
          "Which pillar is most critical?",
          "Can re-entry begin?",
        ],
      }
    );
  }, [t.valor, cc.valor, ema.valor, mac?.valor, trend1d, trend1w, defenseState, reentry, CURRENT_REGIME, curRegime.label, pilaresEmAlerta, jimAnalysis]);

  return (
    <div className="screen">
      <div className="crumb">Defense &rsaquo; <b>ARI &middot; Intelligent Defense</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="flex" style={{ alignItems: "baseline", gap: 10 }}>
            <div className="h1" style={{ margin: 0 }}>Intelligent Defense</div>
            <span className="tag b" style={{ fontFamily: "var(--mono)", fontWeight: 700 }} title="American Regime Index — domestic counterpart of the XRI (External Regime Index)">ARI</span>
          </div>
          <div className="sub">
            Does defense need to be activated? How much? &middot; Protection instruments &middot; Proactive JIM analysis
            &middot; ARI (American Regime Index) &mdash; domestic pair of the XRI
          </div>
        </div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "connecting..." : conn === "ok" ? "● API live" : "✕ API offline"}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 0", marginBottom: 8, borderBottom: "1px solid var(--line)" }}>
        <span style={{
          fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 5,
          background: `${curRegime.color}18`, color: curRegime.color, fontFamily: "var(--mono)",
        }}>
          <i className={`ti ${curRegime.icon}`} style={{ fontSize: 14, marginRight: 5 }} />
          {curRegime.label.toUpperCase()}
        </span>
        <span style={{ width: 1, height: 22, background: "var(--line)" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>TEMP</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: tempColor(t.valor) }}>{f2(t.valor)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>CC</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: ccColor(cc.valor) }}>{f2(cc.valor)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>DEFENSE</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--gold)" }}>{defenseState ? `${defenseState.defesa_pct}%` : "—"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>PILLARS</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: pilaresEmAlerta > 0 ? "#E74C3C" : "#2ECC71" }}>
            {pilaresEmAlerta > 0 ? `${pilaresEmAlerta} alert` : "ok"}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--tx3)", marginLeft: "auto", fontStyle: "italic" }}>
          {REGIME_MEANING[CURRENT_REGIME]}
        </span>
      </div>

      {/* Row 1: Gauge + JIM */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tx2)", marginBottom: 2, fontFamily: "var(--mono)", letterSpacing: ".06em" }}>
            DEFENSE THERMOMETER
          </div>
          <TempGauge180 value={t.valor} trend1d={trend1d} trend1w={trend1w} />
        </div>

        <JimDefensePanel
          regime={CURRENT_REGIME}
          temp={t.valor}
          cc={cc.valor}
          ema={ema.valor}
          mac={mac?.valor ?? null}
          defenseState={defenseState}
          reentry={reentry}
        />
      </div>

      {/* Row 1.5: Deep JIM analysis (generated overnight by jim_deep_analysis.py — all the numbers + news + cross-reference with the XRI) */}
      <div className="card" style={{ marginBottom: 14, borderColor: "rgba(201,160,44,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}><i className="ti ti-notebook" style={{ marginRight: 6 }} />JIM Analysis — Deep (Overnight)</h3>
          {jimAnalysis && (
            <span className="muted" style={{ fontSize: 10, fontFamily: "var(--mono)" }}>
              {new Date(jimAnalysis.generated_at).toLocaleString("en-US")} · {jimAnalysis.model}
              {jimAnalysis.sources.jd_news && " · w/ news"}{jimAnalysis.sources.xri && " · w/ XRI"}
            </span>
          )}
        </div>
        {jimAnalysis ? (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--tx)" }}>{jimAnalysis.analysis}</div>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>
            Not generated yet. Requires <code>ANTHROPIC_API_KEY</code> in <code>.env</code> in the
            overnight folder (<code>_SISTEMA_HC-US_IG/overnight/.env</code>) — runs automatically
            alongside <code>overnight_run.py</code> once the key is configured.
            Meanwhile, the structured reading below always runs, independent of the key.
          </div>
        )}
      </div>

      {/* Row 1.6: structured JIM reading — always available (rule-based, not LLM).
          Crosses the engine with the XRI: this is where CC × absorption ratio meet. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", marginBottom: 12,
          borderRadius: 8, background: `${jimA.headlineColor}12`, border: `1px solid ${jimA.headlineColor}44`,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: `${jimA.headlineColor}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-shield-exclamation" style={{ fontSize: 18, color: jimA.headlineColor }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: jimA.headlineColor, lineHeight: 1.3 }}>{jimA.headline}</div>
            <div style={{ fontSize: 12.5, color: "var(--tx2)", marginTop: 2 }}>
              <b style={{ color: "var(--tx)" }}>What to do:</b> {jimA.acao}
            </div>
          </div>
          {jimA.atencao.length > 0 && (
            <div style={{ marginLeft: "auto", flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--mono)", color: "#E67E22", lineHeight: 1 }}>{jimA.atencao.length}</div>
              <div style={{ fontSize: 9, color: "var(--tx3)", fontFamily: "var(--mono)" }}>ALERTS</div>
            </div>
          )}
        </div>

        {/* Internal × external crossover */}
        <div className="card" style={{ padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", fontFamily: "var(--mono)", letterSpacing: ".06em", marginBottom: 6 }}>
            <i className="ti ti-arrows-shuffle" style={{ fontSize: 12, marginRight: 5 }} />
            CROSSOVER — ENGINE (ARI) × EXTERNAL (XRI)
          </div>
          <div style={{ fontSize: 13, color: "var(--tx)", lineHeight: 1.65 }}>{jimA.convergencia}</div>
        </div>

        {jimA.atencao.length > 0 && (
          <div className="card" style={{ padding: "10px 14px", marginBottom: 12, borderColor: "rgba(230,126,34,.3)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#E67E22", fontFamily: "var(--mono)", letterSpacing: ".06em", marginBottom: 6 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 12, marginRight: 5 }} />REQUIRES ATTENTION
            </div>
            {jimA.atencao.map((a, i) => (
              <div key={i} style={{
                fontSize: 12, color: "var(--tx2)", lineHeight: 1.55, marginBottom: 6,
                paddingLeft: 10, borderLeft: "2px solid rgba(230,126,34,.35)",
              }}>{a}</div>
            ))}
          </div>
        )}

        {ariBlock && <JimBlock block={ariBlock} />}
      </div>

      {/* Row 2: 4 Sensor Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <SensorCard title="Temperature" icon="ti-temperature" value={f2(t.valor)} unit={`threshold ${f2(t.limiar)}`}
          color={tempColor(t.valor)} statusLabel={tSt[0]} statusTone={tSt[1]} trend={trend1d}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, t.valor * 100)}%`, height: "100%", background: tempColor(t.valor), borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Turbulence 40% + Trend Break 35% + Jerk 25%
          </div>
        </SensorCard>

        <SensorCard title="Cross-Correlation" icon="ti-topology-ring-3" value={f2(cc.valor)}
          unit={`g=${f2(gFactor)}`} color={ccColor(cc.valor)} statusLabel={ccSt[0]} statusTone={ccSt[1]}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, cc.valor * 100)}%`, height: "100%", background: ccColor(cc.valor), borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Bands: {f2(cc.limiar_low)} &rarr; {f2(cc.limiar_high)}
          </div>
        </SensorCard>

        <SensorCard title="EMA 20" icon="ti-chart-line" value={ema.valor === "acima" ? "ABOVE" : "BELOW"}
          unit={ema.dist_pct != null ? `${ema.dist_pct >= 0 ? "+" : ""}${ema.dist_pct.toFixed(1)}%` : ""}
          color={ema.valor === "acima" ? "#2ECC71" : "#E74C3C"}
          statusLabel={ema.valor === "acima" ? "ok" : "broken"} statusTone={ema.valor === "acima" ? "g" : "r"}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: "50%", top: 0, width: 2, height: "100%", background: "var(--tx3)" }} />
            <div style={{
              position: "absolute", left: ema.valor === "acima" ? "50%" : undefined, right: ema.valor === "abaixo" ? "50%" : undefined,
              top: 0, width: `${Math.min(50, Math.abs(ema.dist_pct ?? 0) * 5)}%`, height: "100%",
              background: ema.valor === "acima" ? "#2ECC71" : "#E74C3C", borderRadius: 3,
            }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Trend {ema.valor === "acima" ? "intact — allows re-entry" : "broken — defense maintained"}
          </div>
        </SensorCard>

        <SensorCard title="MAC Score" icon="ti-building-bank"
          value={mac ? `${mac.valor}` : "N/A"} unit={mac ? "/100" : ""}
          color={mac ? (mac.valor >= 50 ? "#2ECC71" : mac.valor >= 30 ? "#F39C12" : "#E74C3C") : "#7d96b3"}
          statusLabel={macSt[0]} statusTone={macSt[1]}>
          {mac && (
            <>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${mac.valor}%`, height: "100%", background: mac.valor >= 50 ? "#2ECC71" : mac.valor >= 30 ? "#F39C12" : "#E74C3C", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--tx3)", marginTop: 4, fontFamily: "var(--mono)" }}>
                <span>13F: {mac.f13 ?? "—"}</span>
                <span>COT: {mac.cot ?? "—"}</span>
                <span>Fed: {mac.fed ?? "—"}</span>
              </div>
            </>
          )}
          {!mac && <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>Standalone, not integrated into the trigger.</div>}
        </SensorCard>
      </div>

      {/* Row 3: Temperature by pillar */}
      {defenseState && (
        <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <i className="ti ti-flame" style={{ marginRight: 6 }} />
              Temperature by Pillar
            </h3>
            <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
              Layer 1 &middot; Turb/trend_break/jerk breakdown &middot; {pid}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {Object.entries(defenseState.pilares).map(([key, p]) => {
              const col = tempColor(p.temp);
              const st = sem(p.status);
              return (
                <div key={key} style={{
                  padding: "12px 14px", borderRadius: 8,
                  border: `1px solid ${col}25`,
                  background: `${col}08`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: col, fontFamily: "var(--mono)" }}>
                        Pillar {p.nome}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                        background: st === "g" ? "rgba(46,204,113,.12)" : st === "r" ? "rgba(231,76,60,.12)" : st === "a" ? "rgba(243,156,18,.12)" : "rgba(100,140,180,.12)",
                        color: st === "g" ? "#2ECC71" : st === "r" ? "#E74C3C" : st === "a" ? "#F39C12" : "var(--tx3)",
                        fontFamily: "var(--mono)",
                      }}>
                        {p.status}
                      </span>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--mono)", color: col }}>
                      {f2(p.temp)}
                    </span>
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                      <span style={{ color: "var(--tx3)" }}>Pillar {p.nome} <span style={{ opacity: 0.6 }}>threshold {f2(p.limiar)}</span></span>
                      <span style={{ color: col, fontWeight: 600, fontFamily: "var(--mono)" }}>{f2(p.temp)}</span>
                    </div>
                    <Bullet pct={pct01(p.temp)} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 10 }}>
                    <div style={{ textAlign: "center", padding: "4px 0", borderRadius: 4, background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ color: "var(--tx3)", marginBottom: 2 }}>turb</div>
                      <div style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--tx)" }}>{f2(p.turb)}</div>
                      <div style={{ color: "var(--tx3)", fontSize: 8 }}>× 0.40</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "4px 0", borderRadius: 4, background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ color: "var(--tx3)", marginBottom: 2 }}>trend_break</div>
                      <div style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--tx)" }}>{f2(p.trend_break)}</div>
                      <div style={{ color: "var(--tx3)", fontSize: 8 }}>× 0.35</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "4px 0", borderRadius: 4, background: "rgba(255,255,255,0.03)" }}>
                      <div style={{ color: "var(--tx3)", marginBottom: 2 }}>jerk</div>
                      <div style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--tx)" }}>{f2(p.jerk)}</div>
                      <div style={{ color: "var(--tx3)", fontSize: 8 }}>× 0.25</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 4: Re-entry Monitor + Pillar D */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Re-entry Monitor */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>
              <i className="ti ti-arrow-back-up" style={{ marginRight: 6 }} />
              Re-Entry Monitor
            </h3>
            <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>Layer 3 &middot; {pid}</span>
          </div>

          {reentry ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 2 }}>Mode</div>
                  <div style={{
                    fontSize: 16, fontWeight: 800, fontFamily: "var(--mono)",
                    color: reentry.mode === "re-entering" ? "#2ECC71" : reentry.mode === "monitorando" ? "#F39C12" : "var(--tx2)",
                  }}>
                    {reentry.mode}
                  </div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 2 }}>Days in defense</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--mono)", color: reentry.days > 5 ? "#F39C12" : "var(--tx)" }}>
                    {reentry.days}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 2 }}>EMA cross</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--mono)", color: reentry.ema_cross ? "#2ECC71" : "#E74C3C" }}>
                    {reentry.ema_cross ? "YES" : "NO"}
                  </div>
                </div>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 2 }}>Sizing</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--gold)" }}>
                    {reentry.sizing_pct}%
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: "var(--tx3)" }}>Velocity</span>
                  <span style={{ color: reentry.velocity >= 0 ? "#2ECC71" : "#E74C3C", fontWeight: 600, fontFamily: "var(--mono)" }}>
                    {reentry.velocity >= 0 ? "+" : ""}{reentry.velocity.toFixed(2)}
                  </span>
                </div>
                <Bullet pct={pct01(Math.abs(reentry.velocity) / 3)} />
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--tx3)", fontSize: 12 }}>
              Re-entry monitor unavailable — API did not respond
            </div>
          )}
        </div>

        {/* Pillar D */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>
              <i className="ti ti-shield-check" style={{ marginRight: 6 }} />
              Pillar D · Defensive Rotation
            </h3>
            {pilarD && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                background: "rgba(243,156,18,.12)", color: "#F39C12", fontFamily: "var(--mono)",
              }}>
                cap {pilarD.cap_pct != null ? `${pilarD.cap_pct}%` : "—"}
              </span>
            )}
          </div>

          {pilarD ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, color: "var(--tx2)", textTransform: "uppercase", letterSpacing: ".8px" }}>
                Universe &middot; {pilarD.universo.length} ETFs &middot; Freq: {pilarD.rotacao_freq}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pilarD.universo.map((tk) => {
                  const isTop = pilarD.top4_atual.includes(tk);
                  return (
                    <span key={tk} style={{
                      fontSize: 10, fontWeight: isTop ? 800 : 500, fontFamily: "var(--mono)",
                      padding: "3px 8px", borderRadius: 4,
                      background: isTop ? "rgba(201,160,44,.15)" : "rgba(255,255,255,0.04)",
                      color: isTop ? "var(--gold)" : "var(--tx3)",
                      border: isTop ? "1px solid rgba(201,160,44,.3)" : "1px solid transparent",
                    }}>
                      {tk}
                    </span>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>Current Top 4</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {pilarD.top4_atual.map((tk) => (
                    <span key={tk} style={{
                      fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--gold)",
                      padding: "2px 6px", borderRadius: 3, background: "rgba(201,160,44,.12)",
                    }}>
                      {tk}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>Contribution YTD</span>
                <span style={{
                  fontSize: 14, fontWeight: 700, fontFamily: "var(--mono)",
                  color: (pilarD.contribuicao_ytd_pct ?? 0) >= 0 ? "#2ECC71" : "#E74C3C",
                }}>
                  {pilarD.contribuicao_ytd_pct != null
                    ? `${pilarD.contribuicao_ytd_pct >= 0 ? "+" : ""}${pilarD.contribuicao_ytd_pct.toFixed(2)}%`
                    : "—"}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--tx3)", fontSize: 12 }}>
              Pillar D unavailable — API did not respond
            </div>
          )}
        </div>
      </div>

      {/* Regime posture table */}
      <div className="card">
        <h3><i className="ti ti-shield-half" style={{ marginRight: 6 }} />Regime Posture</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          {REGIMES.map((r) => {
            const active = r.key === CURRENT_REGIME;
            const posture = r.key === "RISK-ON" ? { eq: "Full", def: "Standby" }
              : r.key === "RE-ENTRY" ? { eq: "Moderate", def: "Standby" }
              : r.key === "WARNING" ? { eq: "Reduced", def: "Activating" }
              : { eq: "Low", def: "Active" };
            return (
              <div key={r.key} style={{
                padding: "10px 14px", borderRadius: 8, textAlign: "center",
                border: `1px solid ${active ? r.color : "var(--line2)"}`,
                background: active ? `${r.color}12` : "transparent",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, margin: "0 auto 6px", opacity: active ? 1 : 0.3 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: active ? r.color : "var(--tx3)", fontFamily: "var(--mono)" }}>{r.label}</div>
                <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>Equities: {posture.eq}</div>
                <div style={{ fontSize: 10, color: "var(--tx3)" }}>Defense: {posture.def}</div>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>Posture triggered by each regime across the funds — not the internal signals.</div>
      </div>

      <div className="legend mt">
        <span className="muted">Harpian Defense Intelligence &middot; Defense-exclusive instruments &middot; Manager Cockpit</span>
      </div>
    </div>
  );
}

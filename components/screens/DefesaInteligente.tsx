"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import { Bullet } from "@/components/RegimeGauge";

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

const REGIMES = [
  { key: "BEAR", label: "Risk-Off", color: "#E74C3C", icon: "ti-shield-off" },
  { key: "CAUTELA", label: "Cautela", color: "#F39C12", icon: "ti-alert-triangle" },
  { key: "NEUTRO", label: "Neutro", color: "#4A90D9", icon: "ti-arrows-split" },
  { key: "BULL", label: "Risk-On", color: "#2ECC71", icon: "ti-trending-up" },
];

const REGIME_MEANING: Record<string, string> = {
  BULL: "Ambiente favoravel ao risco. Exposicao plena; defesa em prontidao.",
  NEUTRO: "Sem tendencia dominante. Exposicao moderada, monitoramento proximo.",
  CAUTELA: "Sinais de deterioracao. Reducao de risco em andamento.",
  BEAR: "Ambiente adverso. Defesa ativa, exposicao reduzida.",
};

const DEFAULTS: IndicatorsState = {
  temperatura: { valor: 0.42, limiar: 0.6, status: "normal" },
  cross_correlation: { valor: 0.62, limiar_low: 0.55, limiar_high: 0.75, g: 0.35, status: "elevado" },
  ema20: { valor: "acima", dist_pct: 2.3, status: "ok" },
  mac_score: { valor: 68, limiar: 50, status: "positivo" },
};

// ---------- Helpers ----------
function f2(n: number | null | undefined) { return n == null ? "—" : Number(n).toFixed(2).replace(".", ","); }
function tempColor(v: number) { return v >= 0.8 ? "#E74C3C" : v >= 0.6 ? "#E67E22" : v >= 0.4 ? "#E5B800" : v >= 0.2 ? "#2ECC71" : "#1A8FE3"; }
function tempZoneLabel(v: number) { return v >= 0.8 ? "DEFESA" : v >= 0.6 ? "ALERTA" : v >= 0.4 ? "CAUTELA" : v >= 0.2 ? "NEUTRO" : "ATAQUE"; }
function balPct(v: number): string { return Math.max(0, Math.round(100 - 125 * v)) + "%"; }
function ccColor(v: number) { return v >= 0.75 ? "#E74C3C" : v >= 0.55 ? "#F39C12" : "#2ECC71"; }
function pct01(v: number) { return Math.max(0, Math.min(100, v * 100)); }
function sem(s: string) { return s === "ataque" ? "g" : s === "alerta" ? "a" : s === "defesa" ? "r" : "b"; }

function trendArrow(dir: "up" | "down" | "flat"): { icon: string; color: string; label: string } {
  if (dir === "up") return { icon: "ti-trending-up", color: "#E74C3C", label: "subindo" };
  if (dir === "down") return { icon: "ti-trending-down", color: "#2ECC71", label: "caindo" };
  return { icon: "ti-minus", color: "#7d96b3", label: "estavel" };
}

function computeTrend(current: number, previous: number): "up" | "down" | "flat" {
  const delta = current - previous;
  if (Math.abs(delta) < 0.02) return "flat";
  return delta > 0 ? "up" : "down";
}

// ---------- 180° Gauge — 5 zonas, 4 pontos de controle (balanceamento 0-100%) ----------
function TempGauge180({ value, trend1d, trend1w }: { value: number; trend1d: "up" | "down" | "flat"; trend1w: "up" | "down" | "flat" }) {
  const cx = 150, cy = 148, r = 110;
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const zones = [
    { vStart: 0.0,  vEnd: 0.2,  degStart: 0,    degEnd: 28,   color: "#1A8FE3", label: "ATAQUE",  bal: "100%" },
    { vStart: 0.2,  vEnd: 0.4,  degStart: 28,   degEnd: 62,   color: "#2ECC71", label: "NEUTRO",  bal: "75%" },
    { vStart: 0.4,  vEnd: 0.6,  degStart: 62,   degEnd: 102,  color: "#E5B800", label: "CAUTELA", bal: "50%" },
    { vStart: 0.6,  vEnd: 0.8,  degStart: 102,  degEnd: 145,  color: "#E67E22", label: "ALERTA",  bal: "25%" },
    { vStart: 0.8,  vEnd: 1.0,  degStart: 145,  degEnd: 180,  color: "#E74C3C", label: "DEFESA",  bal: "0%" },
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

  if (regime === "BULL") insights.push({ type: "pos", text: "Regime RISK-ON — exposicao plena, defesa em prontidao." });
  else if (regime === "BEAR") insights.push({ type: "neg", text: "Regime RISK-OFF — defesa ativa, exposicao reduzida." });
  else if (regime === "CAUTELA") insights.push({ type: "neg", text: "Regime CAUTELA — reducao de risco em andamento." });

  if (temp < 0.3) insights.push({ type: "pos", text: `Temperatura baixa (${f2(temp)}) — todos os pilares estaveis.` });
  else if (temp >= 0.6) insights.push({ type: "neg", text: `Temperatura critica (${f2(temp)}) — um ou mais pilares em defesa.` });
  else if (temp >= 0.4) insights.push({ type: "alert", text: `Temperatura em alerta (${f2(temp)}) — monitorar escalada.` });

  if (cc >= 0.75) insights.push({ type: "neg", text: `Cross-correlation critica (${f2(cc)}) — risco sistemico elevado, gate ativo.` });
  else if (cc >= 0.55) insights.push({ type: "alert", text: `Cross-correlation elevada (${f2(cc)}) — diversificacao perdendo efeito.` });
  else insights.push({ type: "pos", text: `Cross-correlation saudavel (${f2(cc)}) — diversificacao funcionando.` });

  if (ema === "acima") insights.push({ type: "pos", text: "Preco acima da EMA 20 — tendencia de alta intacta." });
  else insights.push({ type: "neg", text: "Preco abaixo da EMA 20 — tendencia quebrada, defesa mantida." });

  if (mac != null) {
    if (mac >= 60) insights.push({ type: "pos", text: `MAC Score positivo (${mac}/100) — ambiente macro sustenta risco.` });
    else if (mac < 30) insights.push({ type: "neg", text: `MAC Score negativo (${mac}/100) — ambiente macro desfavoravel.` });
  }

  if (defenseState) {
    const pilaresEmAlerta = Object.values(defenseState.pilares).filter(p => p.status === "alerta" || p.status === "defesa").length;
    if (pilaresEmAlerta === 0) insights.push({ type: "pos", text: "Nenhum pilar em alerta — todos os motores operando normalmente." });
    else insights.push({ type: "neg", text: `${pilaresEmAlerta} pilar${pilaresEmAlerta > 1 ? "es" : ""} em alerta ou defesa — monitorar decomposicao.` });
  }

  if (reentry) {
    if (reentry.mode === "re-entering") insights.push({ type: "pos", text: `Re-entry em andamento — sizing ${reentry.sizing_pct}%, velocidade ${f2(reentry.velocity)}.` });
    else if (reentry.days > 5) insights.push({ type: "alert", text: `${reentry.days} dias em defesa — aguardando condicoes de re-entry.` });
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
          <i className="ti ti-brain" style={{ fontSize: 14, color: "#0a1628" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: ".05em" }}>
            JIM DEFENSE INTELLIGENCE
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)" }}>
            Analise proativa &middot; {new Date().toLocaleDateString("pt-BR")}
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
  const pid = "HPC22";

  const CURRENT_REGIME = defenseState?.regime || "BULL";
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
  }, [pid]);

  const t = ind.temperatura;
  const cc = ind.cross_correlation;
  const ema = ind.ema20;
  const mac = ind.mac_score;
  const ccRange = cc.limiar_high - cc.limiar_low;
  const gFactor = ccRange ? Math.max(0, Math.min(1, (cc.valor - cc.limiar_low) / ccRange)) : 0;
  const trend1d = computeTrend(t.valor, tempHistory.d1);
  const trend1w = computeTrend(t.valor, tempHistory.d7);

  const tSt = t.valor >= 0.6 ? ["defesa", "r"] : t.valor >= 0.4 ? ["alerta", "a"] : ["normal", "g"];
  const ccSt = cc.valor >= 0.75 ? ["critico", "r"] : cc.valor >= 0.55 ? ["elevado", "a"] : ["normal", "g"];
  const macSt = mac ? (mac.valor >= 50 ? ["positivo", "g"] : mac.valor >= 30 ? ["neutro", "a"] : ["negativo", "r"]) : ["N/A", "b"];

  const pilaresEmAlerta = defenseState ? Object.values(defenseState.pilares).filter(p => p.status === "alerta" || p.status === "defesa").length : 0;

  useEffect(() => {
    publishScreenData(
      "defesa-inteligente",
      "Defesa Inteligente: regime + 4 sensores + temperatura por pilar + re-entry + Pilar D. Instrumentos exclusivos de defesa.",
      {
        regime: CURRENT_REGIME, temperatura: t.valor, trend1d, trend1w,
        cc: cc.valor, gFactor, ema: ema.valor, mac: mac?.valor ?? null,
        pilaresEmAlerta,
        defenseState: defenseState ? { defesa_pct: defenseState.defesa_pct, pilares: defenseState.pilares } : null,
        reentry: reentry ? { mode: reentry.mode, days: reentry.days, sizing_pct: reentry.sizing_pct } : null,
      },
      {
        briefing:
          `Regime **${curRegime.label}**. Temperatura **${f2(t.valor)}** (${tSt[0]}, ${trendArrow(trend1d).label} no dia, ${trendArrow(trend1w).label} na semana). ` +
          `CC **${f2(cc.valor)}** (${ccSt[0]}). EMA 20 **${ema.valor}**. ` +
          `${pilaresEmAlerta} pilares em alerta. Re-entry: ${reentry?.mode ?? "N/A"}.`,
        suggestions: [
          "A defesa precisa ser ativada agora?",
          "Qual pilar esta mais critico?",
          "O re-entry pode comecar?",
        ],
      }
    );
  }, [t.valor, cc.valor, ema.valor, mac?.valor, trend1d, trend1w, defenseState, reentry, CURRENT_REGIME, curRegime.label, pilaresEmAlerta]);

  return (
    <div className="screen">
      <div className="crumb">Defesa &rsaquo; <b>Defesa Inteligente</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="h1">Defesa Inteligente</div>
          <div className="sub">
            Preciso ativar defesa? Quanto? &middot; Instrumentos de protecao &middot; Analise JIM proativa
          </div>
        </div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "conectando..." : conn === "ok" ? "● API ao vivo" : "✕ API offline"}
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
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>DEFESA</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--gold)" }}>{defenseState ? `${defenseState.defesa_pct}%` : "—"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>PILARES</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: pilaresEmAlerta > 0 ? "#E74C3C" : "#2ECC71" }}>
            {pilaresEmAlerta > 0 ? `${pilaresEmAlerta} alerta` : "ok"}
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
            TERMOMETRO DE DEFESA
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

      {/* Row 2: 4 Sensor Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <SensorCard title="Temperatura" icon="ti-temperature" value={f2(t.valor)} unit={`limiar ${f2(t.limiar)}`}
          color={tempColor(t.valor)} statusLabel={tSt[0]} statusTone={tSt[1]} trend={trend1d}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, t.valor * 100)}%`, height: "100%", background: tempColor(t.valor), borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Turbulencia 40% + Trend Break 35% + Jerk 25%
          </div>
        </SensorCard>

        <SensorCard title="Cross-Correlation" icon="ti-topology-ring-3" value={f2(cc.valor)}
          unit={`g=${f2(gFactor)}`} color={ccColor(cc.valor)} statusLabel={ccSt[0]} statusTone={ccSt[1]}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, cc.valor * 100)}%`, height: "100%", background: ccColor(cc.valor), borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Bandas: {f2(cc.limiar_low)} &rarr; {f2(cc.limiar_high)}
          </div>
        </SensorCard>

        <SensorCard title="EMA 20" icon="ti-chart-line" value={ema.valor === "acima" ? "ACIMA" : "ABAIXO"}
          unit={ema.dist_pct != null ? `${ema.dist_pct >= 0 ? "+" : ""}${ema.dist_pct.toFixed(1)}%` : ""}
          color={ema.valor === "acima" ? "#2ECC71" : "#E74C3C"}
          statusLabel={ema.valor === "acima" ? "ok" : "quebrada"} statusTone={ema.valor === "acima" ? "g" : "r"}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: "50%", top: 0, width: 2, height: "100%", background: "var(--tx3)" }} />
            <div style={{
              position: "absolute", left: ema.valor === "acima" ? "50%" : undefined, right: ema.valor === "abaixo" ? "50%" : undefined,
              top: 0, width: `${Math.min(50, Math.abs(ema.dist_pct ?? 0) * 5)}%`, height: "100%",
              background: ema.valor === "acima" ? "#2ECC71" : "#E74C3C", borderRadius: 3,
            }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Tendencia {ema.valor === "acima" ? "intacta — permite re-entry" : "quebrada — defesa mantida"}
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
          {!mac && <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>Standalone, nao integrado ao gatilho.</div>}
        </SensorCard>
      </div>

      {/* Row 3: Temperatura por pilar */}
      {defenseState && (
        <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <i className="ti ti-flame" style={{ marginRight: 6 }} />
              Temperatura por Pilar
            </h3>
            <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
              Layer 1 &middot; Decomposicao turb/trend_break/jerk &middot; {pid}
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
                        Pilar {p.nome}
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
                      <span style={{ color: "var(--tx3)" }}>Pilar {p.nome} <span style={{ opacity: 0.6 }}>limiar {f2(p.limiar)}</span></span>
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

      {/* Row 4: Re-entry Monitor + Pilar D */}
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
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 2 }}>Dias em defesa</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--mono)", color: reentry.days > 5 ? "#F39C12" : "var(--tx)" }}>
                    {reentry.days}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 2 }}>EMA cross</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--mono)", color: reentry.ema_cross ? "#2ECC71" : "#E74C3C" }}>
                    {reentry.ema_cross ? "SIM" : "NAO"}
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
                  <span style={{ color: "var(--tx3)" }}>Velocidade</span>
                  <span style={{ color: reentry.velocity >= 0 ? "#2ECC71" : "#E74C3C", fontWeight: 600, fontFamily: "var(--mono)" }}>
                    {reentry.velocity >= 0 ? "+" : ""}{reentry.velocity.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <Bullet pct={pct01(Math.abs(reentry.velocity) / 3)} />
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--tx3)", fontSize: 12 }}>
              Re-entry monitor indisponivel — API nao respondeu
            </div>
          )}
        </div>

        {/* Pilar D */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>
              <i className="ti ti-shield-check" style={{ marginRight: 6 }} />
              Pilar D · Rotacao Defensiva
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
                Universo &middot; {pilarD.universo.length} ETFs &middot; Freq: {pilarD.rotacao_freq}
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
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>Top 4 atual</span>
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
                    ? `${pilarD.contribuicao_ytd_pct >= 0 ? "+" : ""}${pilarD.contribuicao_ytd_pct.toFixed(2).replace(".", ",")}%`
                    : "—"}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--tx3)", fontSize: 12 }}>
              Pilar D indisponivel — API nao respondeu
            </div>
          )}
        </div>
      </div>

      {/* Regime posture table */}
      <div className="card">
        <h3><i className="ti ti-shield-half" style={{ marginRight: 6 }} />Postura por regime</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          {REGIMES.map((r) => {
            const active = r.key === CURRENT_REGIME;
            const posture = r.key === "BULL" ? { eq: "Plena", def: "Prontidao" }
              : r.key === "NEUTRO" ? { eq: "Moderada", def: "Prontidao" }
              : r.key === "CAUTELA" ? { eq: "Reduzida", def: "Ativando" }
              : { eq: "Baixa", def: "Ativa" };
            return (
              <div key={r.key} style={{
                padding: "10px 14px", borderRadius: 8, textAlign: "center",
                border: `1px solid ${active ? r.color : "var(--line2)"}`,
                background: active ? `${r.color}12` : "transparent",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, margin: "0 auto 6px", opacity: active ? 1 : 0.3 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: active ? r.color : "var(--tx3)", fontFamily: "var(--mono)" }}>{r.label}</div>
                <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>Acoes: {posture.eq}</div>
                <div style={{ fontSize: 10, color: "var(--tx3)" }}>Defesa: {posture.def}</div>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>Postura que cada regime dispara nos fundos — nao os sinais internos.</div>
      </div>

      <div className="legend mt">
        <span className="muted">Harpian Defense Intelligence &middot; Instrumentos de defesa exclusivos &middot; Cockpit Gestor</span>
      </div>
    </div>
  );
}

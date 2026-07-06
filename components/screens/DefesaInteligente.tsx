"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";

// ---------- Types ----------
interface IndicatorsState {
  temperatura: { valor: number; limiar: number; status: string };
  cross_correlation: { valor: number; limiar_low: number; limiar_high: number; g: number; status: string };
  ema20: { valor: string; dist_pct: number | null; status: string };
  mac_score?: { valor: number; limiar: number; status: string; f13?: number; cot?: number; fed?: number } | null;
}

interface MarketDnaLayer {
  key: string; label: string; score: number; status: string; color: string; icon: string;
}

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

const GOV_API = process.env.NEXT_PUBLIC_GOV_API || "http://localhost:8877";

// ---------- Helpers ----------
function f2(n: number | null | undefined) { return n == null ? "—" : Number(n).toFixed(2).replace(".", ","); }
function tempColor(v: number) { return v >= 0.6 ? "#E74C3C" : v >= 0.4 ? "#E5B800" : v >= 0.2 ? "#7d96b3" : "#2ECC71"; }
function ccColor(v: number) { return v >= 0.75 ? "#E74C3C" : v >= 0.55 ? "#F39C12" : "#2ECC71"; }
function scoreColor(s: number): string {
  if (s >= 80) return "#E74C3C";
  if (s >= 65) return "#E67E22";
  if (s >= 45) return "#C9A02C";
  if (s >= 25) return "#4A90D9";
  return "#2ECC71";
}

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

// ---------- 180-degree Gauge (inverted: Defense LEFT, Risk-On RIGHT) ----------
function TempGauge180({ value, trend1d, trend1w }: { value: number; trend1d: "up" | "down" | "flat"; trend1w: "up" | "down" | "flat" }) {
  const cx = 150, cy = 140, r = 110;
  // Inverted: value=1 → left (PI), value=0 → right (0)
  const angle = value * Math.PI;
  const needleX = cx + r * 0.85 * Math.cos(angle);
  const needleY = cy - r * 0.85 * Math.sin(angle);
  const col = tempColor(value);
  const t1d = trendArrow(trend1d);
  const t1w = trendArrow(trend1w);

  // 4 zones: Defense (red) → Low Risk (yellow) → Neutral (gray) → Risk-On (green)
  const zones = [
    { start: 0.6, end: 1.0, color: "#E74C3C", label: "Defense" },
    { start: 0.4, end: 0.6, color: "#E5B800", label: "Low Risk" },
    { start: 0.2, end: 0.4, color: "#7d96b3", label: "Neutral" },
    { start: 0.0, end: 0.2, color: "#2ECC71", label: "Risk-On" },
  ];

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={300} height={180} viewBox="0 0 300 180">
        {/* Background arcs (inverted: high temp = left) */}
        {zones.map((z) => {
          const a1 = z.start * Math.PI;
          const a2 = z.end * Math.PI;
          const x1 = cx + r * Math.cos(a1);
          const y1 = cy - r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2);
          const y2 = cy - r * Math.sin(a2);
          const largeArc = (z.end - z.start) > 0.5 ? 1 : 0;
          return (
            <path key={z.label}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
              fill="none" stroke={z.color} strokeWidth={18} strokeLinecap="butt" opacity={0.15}
            />
          );
        })}
        {/* Active arc: fills from right (0) to current value */}
        {(() => {
          const activeEnd = value * Math.PI;
          const x1 = cx + r * Math.cos(0);
          const y1 = cy - r * Math.sin(0);
          const x2 = cx + r * Math.cos(activeEnd);
          const y2 = cy - r * Math.sin(activeEnd);
          const largeArc = value > 0.5 ? 1 : 0;
          return (
            <path
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`}
              fill="none" stroke={col} strokeWidth={18} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${col}40)` }}
            />
          );
        })()}
        {/* Tick marks (inverted: 1.0 left, 0.0 right) */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => {
          const a = v * Math.PI;
          const ix = cx + (r + 14) * Math.cos(a);
          const iy = cy - (r + 14) * Math.sin(a);
          return (
            <text key={v} x={ix} y={iy} textAnchor="middle" dominantBaseline="middle"
              fill="var(--tx3)" fontSize={9} fontFamily="var(--mono)">
              {v.toFixed(1)}
            </text>
          );
        })}
        {/* Zone labels: Defense left, Risk-On right */}
        <text x={50} y={130} fill="#E74C3C" fontSize={9} fontFamily="var(--mono)" fontWeight={600}>DEFENSE</text>
        <text x={95} y={55} fill="#E5B800" fontSize={8} fontFamily="var(--mono)" fontWeight={600}>LOW RISK</text>
        <text x={190} y={55} fill="#7d96b3" fontSize={8} fontFamily="var(--mono)" fontWeight={600}>NEUTRAL</text>
        <text x={225} y={130} fill="#2ECC71" fontSize={9} fontFamily="var(--mono)" fontWeight={600}>RISK-ON</text>
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke={col} strokeWidth={3} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${col})` }}
        />
        <circle cx={cx} cy={cy} r={6} fill={col} stroke="var(--bg1)" strokeWidth={3} />
        {/* Value */}
        <text x={cx} y={cy + 28} textAnchor="middle" fill={col}
          fontSize={28} fontWeight={800} fontFamily="var(--mono)">
          {f2(value)}
        </text>
      </svg>

      {/* Trend indicators below gauge */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 4 }}>
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

// ---------- Mini Radar (defense-relevant layers) ----------
function DefenseRadar({ layers }: { layers: MarketDnaLayer[] }) {
  const n = layers.length;
  if (n === 0) return null;
  const cx = 120, cy = 120, maxR = 95;
  const angleStep = (2 * Math.PI) / n;

  const points = layers.map((l, i) => {
    const a = -Math.PI / 2 + i * angleStep;
    const rr = (l.score / 100) * maxR;
    return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={240} height={240} viewBox="0 0 240 240" style={{ display: "block", margin: "0 auto" }}>
      {[20, 40, 60, 80, 100].map((lv) => (
        <circle key={lv} cx={cx} cy={cy} r={(lv / 100) * maxR}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {layers.map((l, i) => {
        const a = -Math.PI / 2 + i * angleStep;
        const ex = cx + maxR * Math.cos(a);
        const ey = cy + maxR * Math.sin(a);
        const lx = cx + (maxR + 14) * Math.cos(a);
        const ly = cy + (maxR + 14) * Math.sin(a);
        return (
          <g key={l.key}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fill={l.color} fontSize={7} fontFamily="var(--mono)" fontWeight={600}>
              {l.label.substring(0, 5).toUpperCase()}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} fill="rgba(201,160,44,.12)" stroke="var(--gold)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={scoreColor(layers[i].score)} stroke="var(--bg1)" strokeWidth={2} />
      ))}
    </svg>
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
function JimDefensePanel({ regime, temp, cc, ema, mac, dnaScore }: {
  regime: string; temp: number; cc: number; ema: string; mac: number | null; dnaScore: number;
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

  if (dnaScore >= 70) insights.push({ type: "pos", text: `Market DNA Conviction ${dnaScore} — multiplas camadas sustentam exposicao.` });
  else if (dnaScore < 40) insights.push({ type: "neg", text: `Market DNA Conviction ${dnaScore} — multiplas camadas pedem cautela.` });

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
  const [dnaLayers, setDnaLayers] = useState<MarketDnaLayer[]>([]);
  const [dnaScore, setDnaScore] = useState(50);
  const [tempHistory, setTempHistory] = useState<{ d1: number; d7: number }>({ d1: 0.42, d7: 0.45 });

  const CURRENT_REGIME = "BULL";
  const curRegime = REGIMES.find((r) => r.key === CURRENT_REGIME)!;

  useEffect(() => {
    apiGet<{ indicators: IndicatorsState }>("/v1/protection/indicators")
      .then((data) => { setInd(data.indicators); setConn("ok"); })
      .catch(() => { setInd(DEFAULTS); setConn("error"); });

    fetch(`${GOV_API}/api/market-dna`)
      .then((r) => r.json())
      .then((data) => {
        const layers = data?.layers || {};
        const mapped: MarketDnaLayer[] = [];
        const defs: { key: string; label: string; color: string; icon: string }[] = [
          { key: "positioning", label: "Positioning", color: "#4A90D9", icon: "ti-users-group" },
          { key: "volatility", label: "Volatility", color: "#E74C3C", icon: "ti-bolt" },
          { key: "options", label: "Options", color: "#9B59B6", icon: "ti-chart-dots-3" },
          { key: "liquidity", label: "Liquidity", color: "#1ABC9C", icon: "ti-droplet-half-2" },
          { key: "breadth", label: "Breadth", color: "#3498DB", icon: "ti-chart-histogram" },
          { key: "sentiment", label: "Sentiment", color: "#E67E22", icon: "ti-mood-smile" },
          { key: "macro", label: "Macro", color: "#7B68EE", icon: "ti-building-bank" },
        ];
        for (const d of defs) {
          const l = layers[d.key];
          mapped.push({
            key: d.key, label: d.label, color: d.color, icon: d.icon,
            score: l?.data ? extractScore(d.key, l.data) : 50,
            status: l ? "live" : "planned",
          });
        }
        setDnaLayers(mapped);
        const avg = Math.round(mapped.reduce((s, l) => s + l.score, 0) / mapped.length);
        setDnaScore(avg);
      })
      .catch(() => {});

    apiGet<{ temp_1d_ago: number; temp_7d_ago: number }>("/v1/protection/temp-history")
      .then((h) => setTempHistory({ d1: h.temp_1d_ago, d7: h.temp_7d_ago }))
      .catch(() => {});
  }, []);

  const t = ind.temperatura;
  const cc = ind.cross_correlation;
  const ema = ind.ema20;
  const mac = ind.mac_score;
  const gFactor = Math.max(0, Math.min(1, (cc.valor - cc.limiar_low) / (cc.limiar_high - cc.limiar_low)));
  const trend1d = computeTrend(t.valor, tempHistory.d1);
  const trend1w = computeTrend(t.valor, tempHistory.d7);

  const tSt = t.valor >= 0.6 ? ["defesa", "r"] : t.valor >= 0.4 ? ["alerta", "a"] : ["normal", "g"];
  const ccSt = cc.valor >= 0.75 ? ["critico", "r"] : cc.valor >= 0.55 ? ["elevado", "a"] : ["normal", "g"];
  const macSt = mac ? (mac.valor >= 50 ? ["positivo", "g"] : mac.valor >= 30 ? ["neutro", "a"] : ["negativo", "r"]) : ["N/A", "b"];

  useEffect(() => {
    publishScreenData(
      "defesa-inteligente",
      "Defesa Inteligente: regime + 4 sensores + Market DNA radar. Temperatura com direcao (1d/7d). Cross-correlation e gate sistemico. JIM analisa todas as camadas de protecao.",
      {
        regime: CURRENT_REGIME, temperatura: t.valor, trend1d, trend1w,
        cc: cc.valor, gFactor, ema: ema.valor, mac: mac?.valor ?? null,
        dnaScore, dnaLayers: dnaLayers.map((l) => ({ camada: l.label, score: l.score })),
      },
      {
        briefing:
          `Regime **${curRegime.label}**. Temperatura **${f2(t.valor)}** (${tSt[0]}, ${trendArrow(trend1d).label} no dia, ${trendArrow(trend1w).label} na semana). ` +
          `CC **${f2(cc.valor)}** (${ccSt[0]}). EMA 20 **${ema.valor}**. DNA Conviction **${dnaScore}**.`,
        suggestions: [
          "A defesa precisa ser ativada agora?",
          "Qual sensor esta mais critico?",
          "O que mudou na ultima semana?",
        ],
      }
    );
  }, [t.valor, cc.valor, ema.valor, mac?.valor, dnaScore, trend1d, trend1w]);

  return (
    <div className="screen">
      <div className="crumb">Defesa &rsaquo; <b>Defesa Inteligente</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="h1">Defesa Inteligente</div>
          <div className="sub">
            Regime + sensores + radar de inteligencia &middot; Termometro com direcao &middot; Analise JIM proativa
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
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>DNA</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", color: scoreColor(dnaScore) }}>{dnaScore}</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--tx3)", marginLeft: "auto", fontStyle: "italic" }}>
          {REGIME_MEANING[CURRENT_REGIME]}
        </span>
      </div>

      {/* Row 1: Gauge + Radar + JIM */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 260px 1fr", gap: 14, marginBottom: 14 }}>
        {/* 180-degree Temperature Gauge */}
        <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tx2)", marginBottom: 2, fontFamily: "var(--mono)", letterSpacing: ".06em" }}>
            TERMOMETRO DE DEFESA
          </div>
          <TempGauge180 value={t.valor} trend1d={trend1d} trend1w={trend1w} />
        </div>

        {/* Defense Radar */}
        <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tx2)", marginBottom: 2, fontFamily: "var(--mono)", letterSpacing: ".06em" }}>
            RADAR INTELLIGENCE
          </div>
          {dnaLayers.length > 0 ? <DefenseRadar layers={dnaLayers} /> : (
            <div style={{ height: 200, display: "flex", alignItems: "center", color: "var(--tx3)", fontSize: 12 }}>Carregando...</div>
          )}
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--tx3)", marginTop: 2 }}>
            Conviction: <span style={{ color: scoreColor(dnaScore), fontWeight: 700 }}>{dnaScore}</span>
          </div>
        </div>

        {/* JIM Defense Intelligence */}
        <JimDefensePanel
          regime={CURRENT_REGIME}
          temp={t.valor}
          cc={cc.valor}
          ema={ema.valor}
          mac={mac?.valor ?? null}
          dnaScore={dnaScore}
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
        <span className="muted">Harpian Defense Intelligence &middot; JIM proactive analysis &middot; Cockpit Gestor</span>
      </div>
    </div>
  );
}

// ---------- Score extraction from API ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractScore(key: string, data: any): number {
  if (key === "positioning") return data?.avg_cot_index != null ? Math.round(data.avg_cot_index) : 50;
  if (key === "volatility") {
    const vix = data?.vix?.current;
    if (vix == null) return 50;
    if (vix >= 35) return 95; if (vix >= 25) return 75; if (vix >= 20) return 55; if (vix >= 15) return 35; return 15;
  }
  if (key === "options") return data ? Math.round(50 + (data.skew ? (data.skew - 130) / 2 : 0)) : 50;
  if (key === "liquidity") return data?.summary?.dark_pool_pct != null ? Math.round(100 - data.summary.dark_pool_pct) : 50;
  if (key === "breadth") return data?.pct_above_200ma != null ? Math.round(data.pct_above_200ma) : 50;
  if (key === "sentiment") return data?.score != null ? Math.round(data.score) : 50;
  if (key === "macro") {
    let s = 50;
    if (data?.yield_curve_signal === "Normal") s += 15; if (data?.yield_curve_signal === "Inverted") s -= 20;
    if (data?.credit_signal === "Tight") s += 15; if (data?.credit_signal === "Normal") s += 5;
    if (data?.credit_signal === "Wide") s -= 10; if (data?.credit_signal === "Stress") s -= 25;
    return Math.max(0, Math.min(100, s));
  }
  return 50;
}

"use client";
import { useEffect, useState } from "react";
import { GOV_API, fmtN } from "@/lib/data";
import { publishScreenData } from "@/lib/jim-data";

// ---------- Types ----------
interface CotMarket {
  market: string;
  date?: string;
  spec_sentiment: string;
  spec_net: number;
  spec_net_pct_oi?: number;
  comm_net: number;
  comm_net_pct_oi?: number;
  open_interest: number;
}

interface LegacyRow {
  market: string;
  date: string;
  spec_net: number;
  comm_net: number;
  open_interest: number;
  spec_long: number;
  spec_short: number;
  comm_long: number;
  comm_short: number;
}

interface CotIndexData {
  market: string;
  index: number;
  specNet: number;
  commNet: number;
  nonreptNet: number;
  oi: number;
  date: string;
  specPctOi: number;
  commPctOi: number;
  signal: string;
  weekChange: number;
}

// ---------- Helpers ----------
const SHORT_NAME: Record<string, string> = {
  "S&P 500 CONSOLIDATED": "S&P 500",
  "E-MINI S&P 500": "E-Mini S&P",
  "NASDAQ-100 CONSOLIDATED": "NASDAQ 100",
  "GOLD - COMMODITY EXCHANGE INC.": "Gold",
  "SILVER - COMMODITY EXCHANGE INC.": "Silver",
  "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE": "Crude Oil WTI",
  "NATURAL GAS - NEW YORK MERCANTILE EXCHANGE": "Natural Gas",
  "U.S. TREASURY BONDS - CHICAGO BOARD OF TRADE": "US T-Bonds",
  "10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE": "10Y Treasury",
  "2-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE": "2Y Treasury",
  "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE": "Yen (JPY)",
  "EURO FX - CHICAGO MERCANTILE EXCHANGE": "Euro (EUR)",
  "BITCOIN - CHICAGO MERCANTILE EXCHANGE": "Bitcoin",
  "VIX FUTURES - CBOE FUTURES EXCHANGE": "VIX",
  "COPPER-GRADE #1 - COMMODITY EXCHANGE INC.": "Copper",
};

const ASSET_CLASS: Record<string, string> = {
  "S&P 500": "Equity", "E-Mini S&P": "Equity", "NASDAQ 100": "Equity",
  Gold: "Metal", Silver: "Metal", Copper: "Metal",
  "Crude Oil WTI": "Energy", "Natural Gas": "Energy",
  "US T-Bonds": "Rates", "10Y Treasury": "Rates", "2Y Treasury": "Rates",
  "Yen (JPY)": "FX", "Euro (EUR)": "FX",
  Bitcoin: "Crypto", VIX: "Volatility",
};

const CLASS_COLOR: Record<string, string> = {
  Equity: "#4A90D9", Metal: "#C9A02C", Energy: "#E67E22",
  Rates: "#7B68EE", FX: "#2ECC71", Crypto: "#F39C12", Volatility: "#E74C3C",
};

function shortName(m: string): string {
  return SHORT_NAME[m] || m.split(" - ")[0].substring(0, 20);
}

function cotIndex(current: number, low: number, high: number): number {
  if (high === low) return 50;
  return Math.round(((current - low) / (high - low)) * 100);
}

function cotSignal(idx: number): { label: string; color: string; bg: string; desc: string } {
  if (idx >= 80) return { label: "EXTREME HIGH", color: "#E74C3C", bg: "rgba(231,76,60,.12)", desc: "Posicionamento especulador em extremo de alta — historicamente, sinal contrário (bearish)" };
  if (idx >= 65) return { label: "HIGH", color: "#E67E22", bg: "rgba(230,126,34,.10)", desc: "Especuladores fortemente comprados — risco de reversão se momentum fraquear" };
  if (idx >= 35) return { label: "NEUTRAL", color: "#7d96b3", bg: "rgba(125,150,179,.08)", desc: "Posicionamento equilibrado — sem sinal direcional do COT" };
  if (idx >= 20) return { label: "LOW", color: "#4A90D9", bg: "rgba(74,144,217,.10)", desc: "Especuladores reduzindo posições — atenção para oportunidade contrária (bullish)" };
  return { label: "EXTREME LOW", color: "#2ECC71", bg: "rgba(46,204,113,.12)", desc: "Posicionamento especulador em extremo de baixa — historicamente, sinal contrário (bullish)" };
}

function computeCotData(legacy: LegacyRow[]): CotIndexData[] {
  const byMarket = new Map<string, LegacyRow[]>();
  for (const r of legacy) {
    const arr = byMarket.get(r.market) || [];
    arr.push(r);
    byMarket.set(r.market, arr);
  }

  const result: CotIndexData[] = [];
  for (const [market, rows] of byMarket) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    const prev = sorted[1];
    const specNets = sorted.map((r) => r.spec_net);
    const low = Math.min(...specNets);
    const high = Math.max(...specNets);
    const idx = cotIndex(latest.spec_net, low, high);
    const nonreptNet = latest.open_interest - (latest.spec_long + latest.spec_short + latest.comm_long + latest.comm_short);
    const oi = latest.open_interest || 1;
    const sig = cotSignal(idx);

    result.push({
      market: shortName(market),
      index: idx,
      specNet: latest.spec_net,
      commNet: latest.comm_net,
      nonreptNet,
      oi: latest.open_interest,
      date: latest.date,
      specPctOi: Math.round((latest.spec_net / oi) * 1000) / 10,
      commPctOi: Math.round((latest.comm_net / oi) * 1000) / 10,
      signal: sig.label,
      weekChange: latest.spec_net - prev.spec_net,
    });
  }

  return result.sort((a, b) => b.index - a.index);
}

// ---------- Demo data ----------
const DEMO_DATA: CotIndexData[] = [
  { market: "S&P 500", index: 78, specNet: 142000, commNet: -128000, nonreptNet: -14000, oi: 2800000, date: "2026-06-24", specPctOi: 5.1, commPctOi: -4.6, signal: "HIGH", weekChange: 18200 },
  { market: "Gold", index: 82, specNet: 218000, commNet: -245000, nonreptNet: 27000, oi: 520000, date: "2026-06-24", specPctOi: 41.9, commPctOi: -47.1, signal: "EXTREME HIGH", weekChange: -8400 },
  { market: "Crude Oil WTI", index: 35, specNet: 145000, commNet: -162000, nonreptNet: 17000, oi: 1900000, date: "2026-06-24", specPctOi: 7.6, commPctOi: -8.5, signal: "NEUTRAL", weekChange: -22100 },
  { market: "10Y Treasury", index: 18, specNet: -420000, commNet: 380000, nonreptNet: 40000, oi: 4200000, date: "2026-06-24", specPctOi: -10.0, commPctOi: 9.0, signal: "EXTREME LOW", weekChange: -31000 },
  { market: "Euro (EUR)", index: 52, specNet: 48000, commNet: -62000, nonreptNet: 14000, oi: 680000, date: "2026-06-24", specPctOi: 7.1, commPctOi: -9.1, signal: "NEUTRAL", weekChange: 5200 },
  { market: "Bitcoin", index: 71, specNet: 8200, commNet: -6800, nonreptNet: -1400, oi: 32000, date: "2026-06-24", specPctOi: 25.6, commPctOi: -21.3, signal: "HIGH", weekChange: 1100 },
  { market: "NASDAQ 100", index: 85, specNet: 64000, commNet: -58000, nonreptNet: -6000, oi: 320000, date: "2026-06-24", specPctOi: 20.0, commPctOi: -18.1, signal: "EXTREME HIGH", weekChange: 4200 },
  { market: "Yen (JPY)", index: 12, specNet: -148000, commNet: 132000, nonreptNet: 16000, oi: 280000, date: "2026-06-24", specPctOi: -52.9, commPctOi: 47.1, signal: "EXTREME LOW", weekChange: -8800 },
  { market: "Silver", index: 68, specNet: 42000, commNet: -48000, nonreptNet: 6000, oi: 160000, date: "2026-06-24", specPctOi: 26.3, commPctOi: -30.0, signal: "HIGH", weekChange: 3100 },
  { market: "Natural Gas", index: 28, specNet: -85000, commNet: 72000, nonreptNet: 13000, oi: 1400000, date: "2026-06-24", specPctOi: -6.1, commPctOi: 5.1, signal: "LOW", weekChange: 4500 },
  { market: "VIX", index: 42, specNet: -62000, commNet: 58000, nonreptNet: 4000, oi: 480000, date: "2026-06-24", specPctOi: -12.9, commPctOi: 12.1, signal: "NEUTRAL", weekChange: -2200 },
  { market: "Copper", index: 55, specNet: 22000, commNet: -28000, nonreptNet: 6000, oi: 220000, date: "2026-06-24", specPctOi: 10.0, commPctOi: -12.7, signal: "NEUTRAL", weekChange: 1800 },
  { market: "US T-Bonds", index: 22, specNet: -180000, commNet: 165000, nonreptNet: 15000, oi: 1200000, date: "2026-06-24", specPctOi: -15.0, commPctOi: 13.8, signal: "LOW", weekChange: -12400 },
  { market: "2Y Treasury", index: 15, specNet: -310000, commNet: 285000, nonreptNet: 25000, oi: 2100000, date: "2026-06-24", specPctOi: -14.8, commPctOi: 13.6, signal: "EXTREME LOW", weekChange: -18700 },
  { market: "E-Mini S&P", index: 74, specNet: 98000, commNet: -92000, nonreptNet: -6000, oi: 2400000, date: "2026-06-24", specPctOi: 4.1, commPctOi: -3.8, signal: "HIGH", weekChange: 7600 },
];

// ---------- Components ----------

function CotGauge({ value }: { value: number }) {
  const w = 120;
  const h = 68;
  const cx = w / 2;
  const cy = h - 4;
  const r = 50;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - ((value / 100) * Math.PI);
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const sig = cotSignal(value);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", margin: "0 auto" }}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${value > 50 ? 1 : 0} 1 ${nx} ${ny}`}
        fill="none" stroke={sig.color} strokeWidth={8} strokeLinecap="round"
        style={{ transition: "d 0.4s ease" }}
      />
      <text x={cx} y={cy - 18} textAnchor="middle" fill={sig.color} fontSize={22} fontWeight={700} fontFamily="var(--mono)">
        {value}
      </text>
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--tx3)" fontSize={8} fontFamily="var(--mono)" letterSpacing=".08em">
        COT INDEX
      </text>
      <text x={4} y={cy + 2} fill="var(--tx3)" fontSize={7} fontFamily="var(--mono)">0</text>
      <text x={w - 12} y={cy + 2} fill="var(--tx3)" fontSize={7} fontFamily="var(--mono)">100</text>
    </svg>
  );
}

function NetBar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  const barW = Math.min(Math.abs(pct) * 2, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, lineHeight: "18px" }}>
      <span style={{ color: "var(--tx3)", width: 42, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".04em" }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${barW}%`, height: "100%", background: color, borderRadius: 2, transition: "width .3s" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color, minWidth: 52, textAlign: "right" }}>{value >= 0 ? "+" : ""}{fmtN(value)}</span>
    </div>
  );
}

function MarketCard({ d }: { d: CotIndexData }) {
  const sig = cotSignal(d.index);
  const cls = ASSET_CLASS[d.market] || "Equity";
  const clsColor = CLASS_COLOR[cls] || "#7d96b3";
  const isExtreme = d.index >= 80 || d.index <= 20;

  return (
    <div className="card" style={{ border: isExtreme ? `1px solid ${sig.color}40` : undefined, transition: "border-color .2s, box-shadow .2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>{d.market}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
            <span style={{ fontSize: 8, fontFamily: "var(--mono)", padding: "1px 5px", borderRadius: 3, background: `${clsColor}20`, color: clsColor, letterSpacing: ".06em" }}>{cls.toUpperCase()}</span>
            <span style={{ fontSize: 9, color: "var(--tx3)", fontFamily: "var(--mono)" }}>{d.date}</span>
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
          background: sig.bg, color: sig.color, fontFamily: "var(--mono)", letterSpacing: ".06em",
        }}>
          {sig.label}
        </span>
      </div>

      <CotGauge value={d.index} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        <NetBar label="SPEC" value={d.specNet} pct={d.specPctOi} color="#4A90D9" />
        <NetBar label="COMM" value={d.commNet} pct={d.commPctOi} color="#C9A02C" />
        <NetBar label="NONR" value={d.nonreptNet} pct={Math.round((d.nonreptNet / (d.oi || 1)) * 1000) / 10} color="#7d96b3" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontSize: 9, color: "var(--tx3)", fontFamily: "var(--mono)" }}>OI {fmtN(d.oi)}</span>
        <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: d.weekChange >= 0 ? "var(--green)" : "var(--red)" }}>
          WoW {d.weekChange >= 0 ? "+" : ""}{fmtN(d.weekChange)}
        </span>
      </div>

      {isExtreme && (
        <div style={{ fontSize: 10, color: sig.color, marginTop: 6, lineHeight: 1.5, padding: "6px 8px", background: sig.bg, borderRadius: 6 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 11, marginRight: 4 }} />
          {sig.desc}
        </div>
      )}
    </div>
  );
}

// ---------- Filters ----------
const CLASSES = ["Todos", "Equity", "Metal", "Energy", "Rates", "FX", "Crypto", "Volatility"];

// ---------- Main ----------
export default function CotSentiment() {
  const [data, setData] = useState<CotIndexData[]>([]);
  const [offline, setOffline] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [showEdu, setShowEdu] = useState(false);

  useEffect(() => {
    fetch(`${GOV_API}/api/cot/legacy?weeks=156`)
      .then((r) => r.json())
      .then((rows: LegacyRow[]) => {
        setData(computeCotData(rows));
        setOffline(false);
      })
      .catch(() => {
        setData(DEMO_DATA);
        setOffline(true);
      });
  }, []);

  useEffect(() => {
    if (!data.length) return;
    const extr = data.filter((d) => d.index >= 80 || d.index <= 20);
    const avg = Math.round(data.reduce((s, d) => s + d.index, 0) / data.length);
    const extremosTxt = extr
      .map((d) => `${d.market} ${d.index} (${d.index >= 80 ? "bearish" : "bullish"})`)
      .join(", ");
    publishScreenData(
      "cot-sentiment",
      "COT Intelligence (CFTC): COT Index 0–100 por mercado. >80 = extremo de alta (sinal contrário bearish); <20 = extremo de baixa (sinal contrário bullish). Grupos: Large Specs (smart money), Commercials (hedgers), Nonreportable (varejo). Defasagem 3 dias úteis.",
      data.map((d) => ({
        mercado: d.market, cotIndex: d.index, sinal: d.signal,
        specNet: d.specNet, commNet: d.commNet, oi: d.oi, variacaoSemana: d.weekChange, data: d.date,
      })),
      {
        briefing:
          `Você está vendo o COT de ${data.length} mercados (índice médio **${avg}**). ` +
          (extr.length
            ? `**${extr.length} em extremo** (sinal contrário): ${extremosTxt}.`
            : "Nenhum mercado em extremo agora."),
        suggestions: [
          extr.length ? "Quais mercados estão em extremo e o que significa?" : "Algum mercado perto de um extremo?",
          "Onde o smart money está posicionado?",
          "Como uso o COT numa decisão?",
        ],
      }
    );
  }, [data]);

  const filtered = filter === "Todos" ? data : data.filter((d) => (ASSET_CLASS[d.market] || "") === filter);

  const extremes = data.filter((d) => d.index >= 80 || d.index <= 20);
  const avgIdx = data.length ? Math.round(data.reduce((s, d) => s + d.index, 0) / data.length) : 50;

  return (
    <div className="screen">
      <div className="crumb">Intelligence › <b>COT Intelligence</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="h1">COT Intelligence</div>
          <div className="sub">
            CFTC Commitments of Traders · COT Index normalizado (3 anos) · Posicionamento como indicador antecedente.
            {offline && <span style={{ color: "var(--orange)", marginLeft: 8 }}> [demo — API offline]</span>}
          </div>
        </div>
        <button
          className="btn ghost" style={{ fontSize: 11, padding: "6px 12px" }}
          onClick={() => setShowEdu(!showEdu)}
        >
          <i className={`ti ${showEdu ? "ti-chevron-up" : "ti-book"}`} />
          {showEdu ? "Fechar" : "O que é COT?"}
        </button>
      </div>

      {showEdu && (
        <div className="card" style={{ marginTop: 10, borderColor: "rgba(201,160,44,.2)" }}>
          <h3 style={{ margin: "0 0 8px" }}><i className="ti ti-school" />Commitment of Traders — Guia rápido</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12, lineHeight: 1.7, color: "var(--tx2)" }}>
            <div>
              <div style={{ fontWeight: 600, color: "var(--tx)", marginBottom: 4 }}>Os 3 grupos</div>
              <div><span style={{ color: "#C9A02C" }}>Commercials (Hedgers)</span> — Produtores e consumidores que usam futuros para proteger sua atividade real. Tipicamente, estão do lado oposto ao mercado.</div>
              <div style={{ marginTop: 6 }}><span style={{ color: "#4A90D9" }}>Large Speculators</span> — Fundos, CTAs e institucionais que operam por lucro. Considerados o &ldquo;smart money&rdquo; em tendências, mas crowded nos extremos.</div>
              <div style={{ marginTop: 6 }}><span style={{ color: "#7d96b3" }}>Nonreportable</span> — Pequenos traders. Historicamente, estão do lado errado nos pontos de inflexão.</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--tx)", marginBottom: 4 }}>COT Index (0–100)</div>
              <div>Normaliza a posição líquida especuladora dentro de um range de 3 anos. Fórmula: <span style={{ fontFamily: "var(--mono)", fontSize: 10 }}>(Net – Mín) / (Máx – Mín) × 100</span></div>
              <div style={{ marginTop: 6 }}><span style={{ color: "#E74C3C" }}>Acima de 80</span> — Extremo de alta. Historicamente, sinal <b>contrário</b>: risco de correção.</div>
              <div style={{ marginTop: 3 }}><span style={{ color: "#2ECC71" }}>Abaixo de 20</span> — Extremo de baixa. Historicamente, sinal <b>contrário</b>: oportunidade de compra.</div>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--tx3)" }}>
                <i className="ti ti-alert-circle" style={{ fontSize: 12, marginRight: 3 }} />
                COT tem defasagem de 3 dias úteis, não mostra preço de entrada e NÃO é trigger isolado. Use como ajustador de convicção junto com trend, momentum e volatilidade.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary strip — faixa compacta de uma linha (KPIs + sinais contrários juntos) */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "8px 14px", marginTop: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="muted" style={{ fontSize: 10 }}>COT Índice Médio</span>
          <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--mono)", color: cotSignal(avgIdx).color }}>{avgIdx}</span>
        </div>
        <div style={{ width: 1, height: 18, background: "var(--line)" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="muted" style={{ fontSize: 10 }}>Mercados</span>
          <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--mono)" }}>{data.length}</span>
        </div>
        <div style={{ width: 1, height: 18, background: "var(--line)" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="muted" style={{ fontSize: 10 }}>Extremos ativos</span>
          <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--mono)", color: extremes.length ? "var(--orange)" : "var(--green)" }}>{extremes.length}</span>
        </div>
        {extremes.length > 0 && <div style={{ width: 1, height: 18, background: "var(--line)" }} />}
        {extremes.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <i className="ti ti-alert-triangle" style={{ color: "var(--orange)", fontSize: 12 }} />
            {extremes.map((d) => {
              const sig = cotSignal(d.index);
              return (
                <span key={d.market} title="Sinal contrário · COT em extremo histórico (3 anos)" style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 5, fontFamily: "var(--mono)",
                  background: sig.bg, color: sig.color, border: `1px solid ${sig.color}30`,
                }}>
                  {d.market} <b>{d.index}</b> {d.index >= 80 ? "↑" : "↓"}
                </span>
              );
            })}
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
          {data[0]?.date || "—"} · CFTC semanal (sex.)
        </div>
      </div>

      {/* Filters */}
      <div className="flex" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {CLASSES.map((c) => (
          <button key={c} onClick={() => setFilter(c)} style={{
            fontSize: 10, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
            fontFamily: "var(--mono)", letterSpacing: ".04em",
            border: `1px solid ${filter === c ? "rgba(201,160,44,.4)" : "var(--line2)"}`,
            background: filter === c ? "rgba(201,160,44,.15)" : "transparent",
            color: filter === c ? "var(--gold)" : "var(--tx3)",
          }}>
            {c === "Todos" ? `TODOS (${data.length})` : `${c.toUpperCase()} (${data.filter((d) => (ASSET_CLASS[d.market] || "") === c).length})`}
          </button>
        ))}
      </div>

      {/* Grid of cards */}
      <div className="grid g3">
        {filtered.map((d) => <MarketCard key={d.market} d={d} />)}
      </div>

      <div className="legend mt">
        <i><b style={{ background: "#4A90D9" }} />Especuladores (Large Specs)</i>
        <i><b style={{ background: "#C9A02C" }} />Comerciais (Hedgers)</i>
        <i><b style={{ background: "#7d96b3" }} />Nonreportable</i>
        <span className="muted" style={{ marginLeft: "auto" }}>CFTC Commitments of Traders · análise Harpian · dados públicos · indicador antecedente</span>
      </div>
    </div>
  );
}

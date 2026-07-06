"use client";
import { useEffect, useState } from "react";
import { publishScreenData } from "@/lib/jim-data";

// ---------- Types ----------
interface IntelLayer {
  key: string;
  label: string;
  question: string;
  icon: string;
  score: number;
  status: "live" | "partial" | "planned";
  source: string;
  color: string;
  indicators: { name: string; value: string; color?: string }[];
}

interface JimInsight {
  headline: string;
  headlineColor: string;
  positives: string[];
  negatives: string[];
  alerts: string[];
  summary: string;
}

// ---------- Helpers ----------
function scoreColor(s: number): string {
  if (s >= 80) return "#E74C3C";
  if (s >= 65) return "#E67E22";
  if (s >= 45) return "#C9A02C";
  if (s >= 25) return "#4A90D9";
  return "#2ECC71";
}

function scoreLabel(s: number): string {
  if (s >= 80) return "EXTREME";
  if (s >= 65) return "HIGH";
  if (s >= 45) return "NEUTRAL";
  if (s >= 25) return "LOW";
  return "EXTREME LOW";
}

function regimeLabel(avg: number): { label: string; color: string; icon: string } {
  if (avg >= 70) return { label: "RISK-ON", color: "#2ECC71", icon: "ti-trending-up" };
  if (avg >= 55) return { label: "CAUTIOUS", color: "#C9A02C", icon: "ti-alert-triangle" };
  if (avg >= 40) return { label: "MIXED", color: "#E67E22", icon: "ti-arrows-split" };
  return { label: "RISK-OFF", color: "#E74C3C", icon: "ti-shield-off" };
}

function generateJimInsight(layers: IntelLayer[]): JimInsight {
  const byKey = Object.fromEntries(layers.map((l) => [l.key, l]));
  const positives: string[] = [];
  const negatives: string[] = [];
  const alerts: string[] = [];

  const vol = byKey["volatility"]?.score ?? 50;
  const breadth = byKey["breadth"]?.score ?? 50;
  const sent = byKey["sentiment"]?.score ?? 50;
  const macro = byKey["macro"]?.score ?? 50;
  const pos = byKey["positioning"]?.score ?? 50;
  const liq = byKey["liquidity"]?.score ?? 50;
  const opt = byKey["options"]?.score ?? 50;

  if (macro >= 70) positives.push("Ambiente macro forte: yield curve normal e credit spreads apertados. Condições favorecem ativos de risco.");
  else if (macro >= 55) positives.push("Macro neutro-positivo: condições razoáveis para exposicao a risco.");
  else if (macro < 35) negatives.push("Macro adverso: curva de juros e/ou spreads de credito sinalizam cautela.");

  if (vol <= 25) {
    positives.push("Volatilidade muito baixa (VIX comprimido). Mercado complacente.");
    alerts.push("VIX comprimido e historicamente precede expansoes subitas de volatilidade. Risco assimetrico de protecao barata.");
  } else if (vol <= 40) {
    positives.push("Volatilidade baixa-moderada. Ambiente favoravel para posicoes direcionais.");
  } else if (vol >= 75) {
    negatives.push("Volatilidade elevada — mercado em stress. Risco de movimentos bruscos.");
    alerts.push("VIX acima de 25 — considerar reduzir tamanho de posicao ou proteger com opcoes.");
  }

  if (breadth >= 65) positives.push(`Breadth saudavel: ${breadth}% dos ativos acima da MA200. Rally com ampla participacao.`);
  else if (breadth >= 50) positives.push(`Breadth aceitavel: ${breadth}% acima da MA200. Participacao moderada.`);
  else if (breadth < 35) negatives.push(`Breadth fraco: apenas ${breadth}% acima da MA200. Mercado estreito — poucos ativos sustentam o indice.`);

  if (sent >= 80) {
    negatives.push("Sentimento euforico (Fear & Greed acima de 80). Historicamente zona de pico.");
    alerts.push("Euforia extrema costuma preceder correcoes. Cautela com novas posicoes.");
  } else if (sent <= 25) {
    positives.push("Pessimismo extremo (Fear & Greed abaixo de 25). Historicamente zona de oportunidade contraria.");
  } else if (sent <= 40) {
    positives.push("Sentimento em zona de medo — pode ser oportunidade se os fundamentos sustentam.");
  } else if (sent >= 65) {
    negatives.push("Sentimento elevado. Otimismo pode estar exagerado.");
  }

  if (pos >= 80) {
    negatives.push("Posicionamento especulador em extremo de alta. Risco de reversao se o fluxo mudar.");
    alerts.push("COT Index extremo — hedge funds excessivamente comprados.");
  } else if (pos <= 20) {
    positives.push("Posicionamento em extremo de baixa. Potencial para alta significativa se sentimento mudar.");
  }

  if (liq >= 65) positives.push("Liquidez saudavel — volume e fluxo sustentam o mercado.");
  else if (liq < 35) negatives.push("Liquidez baixa — risco de gaps e execucao ruim em movimentos de stress.");

  if (opt >= 75) alerts.push("Skew elevado sugere demanda por protecao — institucionais comprando puts.");
  else if (opt <= 25) alerts.push("Skew baixo e complacencia em opcoes. Protecao barata disponivel.");

  let headline: string;
  let headlineColor: string;
  const avg = Math.round(layers.reduce((s, l) => s + l.score, 0) / layers.length);

  if (avg >= 70 && negatives.length === 0) {
    headline = "Cenario favoravel para risco. Fundamentos, liquidez e sentimento alinhados.";
    headlineColor = "#2ECC71";
  } else if (avg >= 55 && negatives.length <= 1) {
    headline = "Cenario moderadamente positivo. Maioria dos indicadores sustenta exposicao a risco.";
    headlineColor = "#4A90D9";
  } else if (avg >= 40) {
    headline = positives.length > negatives.length
      ? "Cenario misto com vies positivo. Sinais contraditarios entre camadas."
      : "Cenario misto com alertas. Equilibrio entre sinais positivos e negativos.";
    headlineColor = "#C9A02C";
  } else {
    headline = "Cenario de cautela. Multiplos indicadores sugerem reducao de risco.";
    headlineColor = "#E74C3C";
  }

  const summaryParts: string[] = [];
  if (positives.length > 0) summaryParts.push(`${positives.length} sinal(is) positivo(s)`);
  if (negatives.length > 0) summaryParts.push(`${negatives.length} sinal(is) negativo(s)`);
  if (alerts.length > 0) summaryParts.push(`${alerts.length} alerta(s)`);
  const summary = `JIM identifica ${summaryParts.join(", ")} nas ${layers.filter(l => l.status !== "planned").length} camadas ativas.`;

  return { headline, headlineColor, positives, negatives, alerts, summary };
}

// ---------- API Integration ----------
const GOV_API = process.env.NEXT_PUBLIC_GOV_API || "http://localhost:8877";

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—";
  return v.toFixed(dec);
}

function volScore(vix: number | null): number {
  if (vix == null) return 50;
  if (vix >= 35) return 95;
  if (vix >= 25) return 75;
  if (vix >= 20) return 55;
  if (vix >= 15) return 35;
  return 15;
}

function fgToScore(fg: number | null): number {
  if (fg == null) return 50;
  return Math.round(fg);
}

function breadthToScore(pct200: number | null): number {
  if (pct200 == null) return 50;
  return Math.round(pct200);
}

function macroScore(yieldSignal: string | null, creditSignal: string | null): number {
  let s = 50;
  if (yieldSignal === "Normal") s += 15;
  if (yieldSignal === "Inverted") s -= 20;
  if (creditSignal === "Tight") s += 15;
  if (creditSignal === "Normal") s += 5;
  if (creditSignal === "Wide") s -= 10;
  if (creditSignal === "Stress") s -= 25;
  return Math.max(0, Math.min(100, s));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLayersFromApi(api: any): IntelLayer[] {
  const layers: IntelLayer[] = [];
  const apiLayers = api?.layers || {};

  const cot = apiLayers.positioning?.data;
  const cotScore = cot?.avg_cot_index != null ? Math.round(cot.avg_cot_index) : 50;
  layers.push({
    key: "positioning", label: "Positioning", question: "Quem esta comprado?",
    icon: "ti-users-group", score: cotScore,
    status: apiLayers.positioning ? "live" : "planned",
    source: "CFTC COT + SEC 13F", color: "#4A90D9",
    indicators: [
      { name: "COT Index Medio", value: cot?.avg_cot_index != null ? fmtNum(cot.avg_cot_index, 0) : "—", color: cotScore >= 70 ? "#E67E22" : undefined },
      { name: "Extremos", value: cot?.extreme_count != null ? `${cot.extreme_count} mercados` : "—" },
      { name: "Mercados", value: cot?.n_markets != null ? `${cot.n_markets}` : "—" },
      { name: "Status", value: apiLayers.positioning ? "Live" : "Planejado", color: apiLayers.positioning ? "#2ECC71" : "#7d96b3" },
    ],
  });

  const cboe = apiLayers.volatility?.data;
  const vix = cboe?.vix;
  const vScore = volScore(vix?.current);
  layers.push({
    key: "volatility", label: "Volatility", question: "Qual o nivel de medo?",
    icon: "ti-bolt", score: vScore,
    status: apiLayers.volatility ? "live" : "planned",
    source: "CBOE + Yahoo", color: "#E74C3C",
    indicators: [
      { name: "VIX", value: vix?.current != null ? fmtNum(vix.current) : "—", color: (vix?.current ?? 20) < 18 ? "#2ECC71" : (vix?.current ?? 20) > 25 ? "#E74C3C" : undefined },
      { name: "VVIX", value: cboe?.vvix != null ? fmtNum(cboe.vvix) : "—" },
      { name: "IV Rank", value: vix?.iv_rank != null ? `${fmtNum(vix.iv_rank)}%` : "—" },
      { name: "Term Structure", value: vix?.term_structure || "—", color: vix?.term_structure === "Contango" ? "#2ECC71" : "#E74C3C" },
    ],
  });

  layers.push({
    key: "options", label: "Options", question: "O mercado esta protegido?",
    icon: "ti-chart-dots-3", score: cboe ? Math.round(50 + (cboe.skew ? (cboe.skew - 130) / 2 : 0)) : 50,
    status: cboe ? "partial" : "planned",
    source: "CBOE", color: "#9B59B6",
    indicators: [
      { name: "Put/Call Ratio", value: cboe?.put_call?.put_call_ratio != null ? fmtNum(cboe.put_call.put_call_ratio, 2) : "—" },
      { name: "IV Rank", value: vix?.iv_rank != null ? `${fmtNum(vix.iv_rank)}%` : "—" },
      { name: "Skew", value: cboe?.skew != null ? fmtNum(cboe.skew, 0) : "—" },
      { name: "Regime", value: cboe?.regime || "—" },
    ],
  });

  const finra = apiLayers.liquidity?.data;
  const darkPct = finra?.summary?.dark_pool_pct;
  layers.push({
    key: "liquidity", label: "Liquidity", question: "Quem esta colocando dinheiro?",
    icon: "ti-droplet-half-2", score: finra ? (darkPct != null ? Math.round(100 - darkPct) : 55) : 50,
    status: apiLayers.liquidity ? "partial" : "planned",
    source: "FINRA ATS", color: "#1ABC9C",
    indicators: [
      { name: "Dark Pool %", value: darkPct != null ? `${fmtNum(darkPct)}%` : "—" },
      { name: "Tracked Symbols", value: finra?.summary?.tracked_symbols != null ? `${finra.summary.tracked_symbols}` : "—" },
      { name: "Demo", value: finra?.is_demo ? "Sim" : "Nao", color: finra?.is_demo ? "#E67E22" : "#2ECC71" },
      { name: "Fonte", value: finra?.source ? "FINRA" : "—" },
    ],
  });

  const breadthData = apiLayers.breadth?.data;
  const bScore = breadthToScore(breadthData?.pct_above_200ma);
  layers.push({
    key: "breadth", label: "Breadth", question: "O mercado inteiro sobe ou so poucos?",
    icon: "ti-chart-histogram", score: bScore,
    status: apiLayers.breadth ? "live" : "planned",
    source: "Yahoo (calculado)", color: "#3498DB",
    indicators: [
      { name: "% > 200MA", value: breadthData?.pct_above_200ma != null ? `${fmtNum(breadthData.pct_above_200ma)}%` : "—" },
      { name: "% > 50MA", value: breadthData?.pct_above_50ma != null ? `${fmtNum(breadthData.pct_above_50ma)}%` : "—" },
      { name: "A/D Ratio", value: breadthData?.ad_ratio != null ? fmtNum(breadthData.ad_ratio, 2) : "—", color: (breadthData?.ad_ratio ?? 1) > 1 ? "#2ECC71" : "#E74C3C" },
      { name: "Sinal", value: breadthData?.breadth_signal || "—", color: breadthData?.breadth_signal === "Strong" ? "#2ECC71" : breadthData?.breadth_signal === "Healthy" ? "#4A90D9" : "#E67E22" },
    ],
  });

  const sentData = apiLayers.sentiment?.data;
  const fgScore = fgToScore(sentData?.score);
  layers.push({
    key: "sentiment", label: "Sentiment", question: "O que o mercado sente?",
    icon: "ti-mood-smile", score: fgScore,
    status: apiLayers.sentiment ? "partial" : "planned",
    source: "CNN Fear & Greed", color: "#E67E22",
    indicators: [
      { name: "Fear & Greed", value: sentData?.score != null ? `${fmtNum(sentData.score, 0)} ${sentData.rating || ""}` : "—", color: (sentData?.score ?? 50) >= 75 ? "#E74C3C" : (sentData?.score ?? 50) <= 25 ? "#2ECC71" : undefined },
      { name: "Semana anterior", value: sentData?.previous_close != null ? fmtNum(sentData.previous_close, 0) : "—" },
      { name: "1 semana atras", value: sentData?.week_ago != null ? fmtNum(sentData.week_ago, 0) : "—" },
      { name: "1 ano atras", value: sentData?.year_ago != null ? fmtNum(sentData.year_ago, 0) : "—" },
    ],
  });

  const fred = apiLayers.macro?.data;
  const mScore = macroScore(fred?.yield_curve_signal, fred?.credit_signal);
  layers.push({
    key: "macro", label: "Macro", question: "O ambiente favorece risco?",
    icon: "ti-building-bank", score: mScore,
    status: apiLayers.macro ? "live" : "planned",
    source: "FRED", color: "#7B68EE",
    indicators: [
      { name: "Fed Funds", value: fred?.series?.fed_funds?.value != null ? `${fmtNum(fred.series.fed_funds.value, 2)}%` : "—" },
      { name: "Yield Curve", value: fred?.yield_curve_spread != null ? `${fred.yield_curve_spread > 0 ? "+" : ""}${fmtNum(fred.yield_curve_spread * 100, 0)}bp` : "—", color: fred?.yield_curve_signal === "Normal" ? "#2ECC71" : "#E74C3C" },
      { name: "Credit Spread", value: fred?.credit_spread != null ? `${fmtNum(fred.credit_spread, 2)}%` : "—" },
      { name: "Policy", value: fred?.policy_stance || "—" },
    ],
  });

  layers.push({
    key: "momentum", label: "Momentum", question: "A tendencia esta forte?",
    icon: "ti-rocket", score: 50, status: "planned",
    source: "AlphaDroid · TPT · DEMA", color: "#F39C12",
    indicators: [
      { name: "RS Score", value: "—" },
      { name: "Dual Momentum", value: "—" },
      { name: "Trend", value: "—" },
      { name: "Status", value: "Planned", color: "#7d96b3" },
    ],
  });

  layers.push({
    key: "structure", label: "Mkt Structure", question: "Como os ativos se correlacionam?",
    icon: "ti-topology-ring-3", score: 50, status: "planned",
    source: "Yahoo (calculado)", color: "#2C3E50",
    indicators: [
      { name: "Avg Correlation", value: "—" },
      { name: "Dispersion", value: "—" },
      { name: "Regime", value: "—" },
      { name: "Status", value: "Planned", color: "#7d96b3" },
    ],
  });

  layers.push({
    key: "risk", label: "Risk Engine", question: "A Harpian esta protegida?",
    icon: "ti-shield-check", score: 50, status: "planned",
    source: "StormGuard · Risk Number", color: "#27AE60",
    indicators: [
      { name: "StormGuard", value: "—" },
      { name: "Risk Number", value: "—" },
      { name: "Defense Level", value: "—" },
      { name: "Status", value: "Planned", color: "#7d96b3" },
    ],
  });

  return layers;
}

function buildFallbackLayers(): IntelLayer[] {
  const names = [
    { key: "positioning", label: "Positioning", icon: "ti-users-group", color: "#4A90D9", q: "Quem esta comprado?", src: "CFTC COT" },
    { key: "volatility", label: "Volatility", icon: "ti-bolt", color: "#E74C3C", q: "Qual o nivel de medo?", src: "CBOE" },
    { key: "options", label: "Options", icon: "ti-chart-dots-3", color: "#9B59B6", q: "O mercado esta protegido?", src: "CBOE" },
    { key: "liquidity", label: "Liquidity", icon: "ti-droplet-half-2", color: "#1ABC9C", q: "Quem coloca dinheiro?", src: "FINRA" },
    { key: "breadth", label: "Breadth", icon: "ti-chart-histogram", color: "#3498DB", q: "O mercado inteiro sobe?", src: "Yahoo" },
    { key: "sentiment", label: "Sentiment", icon: "ti-mood-smile", color: "#E67E22", q: "O que o mercado sente?", src: "CNN F&G" },
    { key: "macro", label: "Macro", icon: "ti-building-bank", color: "#7B68EE", q: "Ambiente favorece risco?", src: "FRED" },
    { key: "momentum", label: "Momentum", icon: "ti-rocket", color: "#F39C12", q: "Tendencia forte?", src: "AlphaDroid" },
    { key: "structure", label: "Mkt Structure", icon: "ti-topology-ring-3", color: "#2C3E50", q: "Correlacoes?", src: "Yahoo" },
    { key: "risk", label: "Risk Engine", icon: "ti-shield-check", color: "#27AE60", q: "Harpian protegida?", src: "StormGuard" },
  ];
  return names.map(n => ({
    key: n.key, label: n.label, question: n.q, icon: n.icon,
    score: 50, status: "planned" as const, source: n.src, color: n.color,
    indicators: [{ name: "Aguardando", value: "API offline" }],
  }));
}

// ---------- Components ----------

function ScoreBar({ score, color, h = 6 }: { score: number; color: string; h?: number }) {
  return (
    <div style={{ flex: 1, height: h, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width .4s", opacity: 0.8 }} />
    </div>
  );
}

function LayerCard({ layer }: { layer: IntelLayer }) {
  const sc = scoreColor(layer.score);
  const statusBadge = layer.status === "live"
    ? { label: "LIVE", bg: "rgba(46,204,113,.12)", color: "#2ECC71" }
    : layer.status === "partial"
    ? { label: "PARTIAL", bg: "rgba(230,126,34,.10)", color: "#E67E22" }
    : { label: "PLANNED", bg: "rgba(125,150,179,.08)", color: "#7d96b3" };

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className={`ti ${layer.icon}`} style={{ fontSize: 20, color: layer.color }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--tx)" }}>{layer.label}</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
          background: statusBadge.bg, color: statusBadge.color, fontFamily: "var(--mono)",
        }}>
          {statusBadge.label}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 10, fontStyle: "italic" }}>
        {layer.question}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--mono)", color: sc, lineHeight: 1 }}>
          {layer.score}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: sc, fontFamily: "var(--mono)", fontWeight: 700 }}>{scoreLabel(layer.score)}</span>
            <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>0—100</span>
          </div>
          <ScoreBar score={layer.score} color={sc} h={7} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 8 }}>
        {layer.indicators.map((ind) => (
          <div key={ind.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--tx3)" }}>{ind.name}</span>
            <span style={{ fontSize: 14, fontFamily: "var(--mono)", fontWeight: 700, color: ind.color || "var(--tx)" }}>
              {ind.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)", borderTop: "1px solid var(--line)", paddingTop: 6 }}>
        {layer.source}
      </div>
    </div>
  );
}

function RadarSvg({ layers }: { layers: IntelLayer[] }) {
  const n = layers.length;
  const cx = 140, cy = 140, maxR = 120;
  const angleStep = (2 * Math.PI) / n;

  const gridLevels = [20, 40, 60, 80, 100];
  const points = layers.map((l, i) => {
    const a = -Math.PI / 2 + i * angleStep;
    const r = (l.score / 100) * maxR;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={280} height={280} viewBox="0 0 280 280" style={{ display: "block", margin: "0 auto" }}>
      {gridLevels.map((lv) => (
        <circle key={lv} cx={cx} cy={cy} r={(lv / 100) * maxR}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {layers.map((l, i) => {
        const a = -Math.PI / 2 + i * angleStep;
        const ex = cx + maxR * Math.cos(a);
        const ey = cy + maxR * Math.sin(a);
        const lx = cx + (maxR + 16) * Math.cos(a);
        const ly = cy + (maxR + 16) * Math.sin(a);
        return (
          <g key={l.key}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fill={l.color} fontSize={8} fontFamily="var(--mono)" fontWeight={600}>
              {l.label.substring(0, 6).toUpperCase()}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} fill="rgba(201,160,44,.12)" stroke="var(--gold)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={scoreColor(layers[i].score)} stroke="var(--bg1)" strokeWidth={2} />
      ))}
    </svg>
  );
}

// ---------- JIM Analysis Panel ----------
function JimAnalysisPanel({ insight, avgScore, regime }: { insight: JimInsight; avgScore: number; regime: { label: string; color: string } }) {
  return (
    <div className="card" style={{ padding: "14px 18px", borderColor: "rgba(201,160,44,.25)", flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: "linear-gradient(135deg, #C9A02C 0%, #E6B800 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-brain" style={{ fontSize: 16, color: "#0a1628" }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: ".05em" }}>
            JIM INTELLIGENCE
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)" }}>
            Analise proativa &middot; {new Date().toLocaleDateString("pt-BR")}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: scoreColor(avgScore) }}>{avgScore}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: `${regime.color}18`, color: regime.color, fontFamily: "var(--mono)",
          }}>
            {regime.label}
          </span>
        </div>
      </div>

      <div style={{
        fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: insight.headlineColor,
        padding: "8px 12px", marginBottom: 10, borderRadius: 6,
        background: `${insight.headlineColor}10`, borderLeft: `3px solid ${insight.headlineColor}`,
      }}>
        {insight.headline}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }}>
        {insight.positives.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2ECC71", fontFamily: "var(--mono)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ti ti-circle-check" style={{ fontSize: 13 }} /> SINAIS POSITIVOS
            </div>
            {insight.positives.map((p, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--tx2)", lineHeight: 1.6, paddingLeft: 12, marginBottom: 3 }}>
                &bull; {p}
              </div>
            ))}
          </div>
        )}

        {insight.negatives.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#E74C3C", fontFamily: "var(--mono)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 13 }} /> SINAIS NEGATIVOS
            </div>
            {insight.negatives.map((n, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--tx2)", lineHeight: 1.6, paddingLeft: 12, marginBottom: 3 }}>
                &bull; {n}
              </div>
            ))}
          </div>
        )}

        {insight.alerts.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#E67E22", fontFamily: "var(--mono)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} /> ALERTAS
            </div>
            {insight.alerts.map((a, i) => (
              <div key={i} style={{ fontSize: 13, color: "#E67E22", lineHeight: 1.6, paddingLeft: 12, marginBottom: 3 }}>
                &#9888; {a}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--tx3)", fontStyle: "italic", borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 8 }}>
        {insight.summary}
      </div>
    </div>
  );
}

// ---------- Main ----------
export default function MarketDna() {
  const [layers, setLayers] = useState<IntelLayer[]>(buildFallbackLayers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${GOV_API}/api/market-dna`)
      .then((r) => r.json())
      .then((data) => { setLayers(buildLayersFromApi(data)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const avgScore = Math.round(layers.reduce((s, l) => s + l.score, 0) / layers.length);
  const liveCount = layers.filter((l) => l.status === "live").length;
  const partialCount = layers.filter((l) => l.status === "partial").length;
  const plannedCount = layers.filter((l) => l.status === "planned").length;
  const regime = regimeLabel(avgScore);
  const jimInsight = generateJimInsight(layers);

  useEffect(() => {
    publishScreenData(
      "market-dna",
      "Market DNA: 10 camadas de inteligencia de mercado com score 0-100. Posicionamento + Opcoes + Liquidez + Breadth + Volatilidade + Momentum + Macro + Sentimento + Estrutura + Risk Engine. Score medio = Market Conviction Score.",
      layers.map((l) => ({ camada: l.label, score: l.score, status: l.status, source: l.source })),
      {
        briefing:
          `Market DNA: **${layers.length} camadas**. Conviction **${avgScore}** (${regime.label}). ` +
          `${liveCount} live, ${partialCount} parciais, ${plannedCount} planejadas. ` +
          `Headline: ${jimInsight.headline}`,
        suggestions: [
          "Qual camada esta mais fraca agora?",
          "O mercado esta em Risk-On ou Risk-Off?",
          "Que sinais contrarios existem?",
        ],
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avgScore, regime.label, liveCount, partialCount, plannedCount]);

  return (
    <div className="screen">
      <div className="crumb">Intelligence &rsaquo; <b>Market DNA</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="h1">Market DNA</div>
          <div className="sub">
            10 camadas de inteligencia &middot; Score 0&ndash;100 por dimensao &middot; Sintese quantitativa para decisao de alocacao
            {loading && <span style={{ marginLeft: 8, color: "#C9A02C" }}> Carregando dados...</span>}
          </div>
        </div>
      </div>

      {/* Top summary strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 0", marginBottom: 8, borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--mono)", color: scoreColor(avgScore) }}>
            {avgScore}
          </span>
          <span style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)" }}>CONVICTION</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 5,
          background: `${regime.color}18`, color: regime.color, fontFamily: "var(--mono)",
        }}>
          <i className={`ti ${regime.icon}`} style={{ fontSize: 14, marginRight: 5 }} />
          {regime.label}
        </span>
        <span style={{ width: 1, height: 22, background: "var(--line)" }} />
        <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "#2ECC71" }}>{liveCount} LIVE</span>
        <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "#E67E22" }}>{partialCount} PARTIAL</span>
        <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "#7d96b3" }}>{plannedCount} PLANNED</span>
      </div>

      {/* Radar + Score Table + JIM Analysis */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tx2)", marginBottom: 4, fontFamily: "var(--mono)", letterSpacing: ".06em" }}>
            INTELLIGENCE RADAR
          </div>
          <RadarSvg layers={layers} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card" style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tx2)", marginBottom: 10, fontFamily: "var(--mono)", letterSpacing: ".06em" }}>
              SCORE POR CAMADA
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[...layers].sort((a, b) => b.score - a.score).map((l) => (
                <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className={`ti ${l.icon}`} style={{ fontSize: 15, color: l.color, width: 20, textAlign: "center" }} />
                  <span style={{ fontSize: 13, color: "var(--tx)", width: 100 }}>{l.label}</span>
                  <ScoreBar score={l.score} color={scoreColor(l.score)} h={7} />
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--mono)", color: scoreColor(l.score), width: 32, textAlign: "right" }}>
                    {l.score}
                  </span>
                  <span style={{
                    fontSize: 9, fontFamily: "var(--mono)", padding: "2px 6px", borderRadius: 3,
                    background: l.status === "live" ? "rgba(46,204,113,.12)" : l.status === "partial" ? "rgba(230,126,34,.10)" : "rgba(125,150,179,.08)",
                    color: l.status === "live" ? "#2ECC71" : l.status === "partial" ? "#E67E22" : "#7d96b3",
                  }}>
                    {l.status === "live" ? "LIVE" : l.status === "partial" ? "PART" : "PLAN"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <JimAnalysisPanel insight={jimInsight} avgScore={avgScore} regime={regime} />
        </div>
      </div>

      {/* Layer detail cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {layers.map((l) => <LayerCard key={l.key} layer={l} />)}
      </div>

      <div className="legend mt">
        <i><b style={{ background: "#2ECC71" }} />Live (dado real)</i>
        <i><b style={{ background: "#E67E22" }} />Parcial</i>
        <i><b style={{ background: "#7d96b3" }} />Planejado</i>
        <span className="muted" style={{ marginLeft: "auto" }}>Harpian Intelligence Engine &middot; JIM proactive analysis &middot; atualizacao semanal</span>
      </div>
    </div>
  );
}

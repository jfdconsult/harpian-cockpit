// ============================================================
// JIM — INTERNAL interpretation engine (Manager's Cockpit)
// ------------------------------------------------------------
// Sibling of the Terminal's lib/jim-market-analysis.ts, but with one
// difference that defines the entire module: THERE IS NO WHITELIST HERE.
//
// The Terminal (client-facing) can only show result and posture — never
// method. The Cockpit is internal: it can and should talk about Temperature,
// CC, gates, EMA20, MAC Score, turb/trend_break/jerk decomposition per
// pillar, slow_prior, turbulence, absorption ratio, Diebold-Yilmaz,
// contribution by pillar, exposure quality, and the overlay recommendation
// with its flags.
//
// That's why this file does NOT import anything from the Terminal and must
// NOT be shared with it: the input types are internal, and leaking this to
// the client side would break the repo's confidentiality boundary.
//
// Writing rule (same as the Terminal's): every statement anchored to a
// number that came from the feed. No number, no sentence.
// ============================================================

import type { XriSnapshot } from "./xri";

// ── Entradas internas (espelham o que /v1/protection/* devolve) ──
export interface IndicatorsState {
  temperatura: { valor: number; limiar: number; status: string };
  cross_correlation: { valor: number; limiar_low: number; limiar_high: number; g: number; status: string };
  ema20: { valor: string; dist_pct: number | null; status: string };
  mac_score?: { valor: number; limiar: number; status: string; f13?: number; cot?: number; fed?: number } | null;
}
export interface PilarDef {
  nome: string; temp: number; turb: number; trend_break: number; jerk: number;
  limiar: number | null; status: string;
}
export interface DefenseState {
  portfolio_id: string; regime: string; defesa_pct: number; pilares: Record<string, PilarDef>;
  cc: number; cc_gate_low: number; cc_gate_high: number; g: number;
  ema20_acima: boolean; velocity: number | null;
  reentry: { status: string; days_in_defense: number; target_pct: number | null };
}
export interface TempHistory { temp_1d_ago?: number; temp_7d_ago?: number }

// ── Output (same shape as the Terminal's, so the UI is a twin) ──
export type Tone = "pos" | "neg" | "neu";
export interface Driver { label: string; detail: string; tone: Tone }
export interface AnalysisBlock {
  key: string;
  title: string;
  badge: { label: string; color: string };
  resumo: string;
  leitura: string;
  porque: Driver[];
  tendencia: string;
  impacto: string;
}
export interface CockpitAnalysis {
  headline: string;
  headlineColor: string;
  acao: string;
  convergencia: string;
  blocks: AnalysisBlock[];
  atencao: string[];
}

// ── Numeric formatting (en-US) ──
const d0 = (v: number) => v.toFixed(0);
const d1 = (v: number) => v.toFixed(1);
const d2 = (v: number) => v.toFixed(2);

const REGIME_COLOR: Record<string, string> = {
  "RISK-OFF": "#E74C3C", "WARNING": "#F39C12", "RE-ENTRY": "#4A90D9", "RISK-ON": "#2ECC71",
};
const XRI_STATE_COLOR: Record<string, string> = {
  CALM: "#2ECC71", WATCH: "#F39C12", STRESS: "#E67E22", CRISIS: "#E74C3C",
};
const COUNTRY_PT: Record<string, string> = {
  japan: "Japan", china: "China", taiwan: "Taiwan", korea: "South Korea",
  euro_area: "Euro Area", uk: "United Kingdom", canada: "Canada", mexico: "Mexico",
  india: "India", gulf_energy: "Gulf/Energy", apac_other: "Asia-Pacific",
  latam_other: "Latin America", us: "United States",
};
const PILLAR_PT: Record<string, string> = {
  P1: "P1 · Macro/Financial", P2: "P2 · Market", P3: "P3 · Monetary Policy",
  P4: "P4 · Trade/Tariffs", P5: "P5 · Geopolitics", P6: "P6 · Supply Chain/Energy", P7: "P7 · Exposure",
};

function tempZone(v: number): string {
  return v >= 0.8 ? "DEFENSE" : v >= 0.6 ? "ALERT" : v >= 0.4 ? "CAUTION" : v >= 0.2 ? "NEUTRAL" : "ATTACK";
}
function balPct(v: number): number {
  return Math.max(0, Math.round(100 - 125 * v));
}

// ============================================================
// Internal ARI — why the engine is in this regime
// ============================================================
export function buildAriInternal(
  ind: IndicatorsState,
  def: DefenseState | null,
  hist: TempHistory | null
): AnalysisBlock {
  const porque: Driver[] = [];
  const regime = def?.regime || "—";
  const defensivo = regime === "RISK-OFF" || regime === "WARNING";
  const t = ind.temperatura;
  const cc = ind.cross_correlation;
  const mac = ind.mac_score;

  // 1. Temperature vs threshold — the distance is what matters, not the level.
  const folga = t.limiar - t.valor;
  porque.push({
    label: `Temperature ${d2(t.valor)} · zone ${tempZone(t.valor)}`,
    detail: `Defense threshold at ${d2(t.limiar)} — buffer of ${d2(folga)}. Implied balancing: ${balPct(t.valor)}% exposure. ${folga <= 0.1 ? "It's brushing against the trigger: the next reading could flip the switch." : folga <= 0.2 ? "Narrow buffer — one bad week eats through this." : "Comfortable buffer relative to the trigger."}`,
    tone: folga <= 0.1 ? "neg" : folga <= 0.2 ? "neu" : "pos",
  });

  // 2. Pillars: which one is closest to flipping, and via which sub-component.
  if (def?.pilares) {
    const rows = Object.entries(def.pilares).filter(([, p]) => p.limiar != null);
    const critico = rows
      .map(([k, p]) => ({ k, p, folga: (p.limiar as number) - p.temp }))
      .sort((a, b) => a.folga - b.folga)[0];
    if (critico) {
      const p = critico.p;
      const subs: [string, number][] = [["turbulence", p.turb], ["trend break", p.trend_break], ["jerk", p.jerk]];
      const dom = [...subs].sort((a, b) => b[1] - a[1])[0];
      porque.push({
        label: `Pillar ${p.nome} is the first to flip`,
        detail: `Temp ${d2(p.temp)} against threshold ${d2(critico.p.limiar as number)} — only ${d2(critico.folga)} of buffer, the smallest in the engine (status: ${p.status}). What's driving it is ${dom[0]} at ${d2(dom[1])} (turb ${d2(p.turb)} · trend break ${d2(p.trend_break)} · jerk ${d2(p.jerk)}). This is the pillar that decides the engine's next defensive move.`,
        tone: critico.folga <= 0.08 ? "neg" : "neu",
      });
    }
    const emAlerta = rows.filter(([, p]) => p.status === "alerta" || p.status === "defesa");
    if (emAlerta.length) {
      porque.push({
        label: `${emAlerta.length} pillar(s) outside attack mode`,
        detail: emAlerta.map(([, p]) => `${p.nome} ${d2(p.temp)} (${p.status})`).join(" · ") + `. The rest remain in attack mode — the deterioration is still localized, not systemic.`,
        tone: "neg",
      });
    }
  }

  // 3. CC — the true driver of defense. High correlation kills diversification.
  const ccAlto = cc.valor >= cc.limiar_low;
  porque.push({
    label: `Cross-correlation ${d2(cc.valor)} — ${ccAlto ? "diversification losing effect" : "diversification working"}`,
    detail: `Gates at ${d2(cc.limiar_low)}–${d2(cc.limiar_high)}, g=${d2(cc.g)} (status ${cc.status}). ${ccAlto ? `Above the lower gate: assets are moving together, so cutting a name doesn't reduce risk — only cutting exposure does. That's why defense enters through size, not selection.` : `Below the gate: risk can be reduced by rotating composition, without cutting gross exposure.`}`,
    tone: cc.valor >= cc.limiar_high ? "neg" : ccAlto ? "neu" : "pos",
  });

  // 4. EMA20 — the re-entry gate.
  const acima = def?.ema20_acima ?? ind.ema20.valor === "acima";
  porque.push({
    label: `EMA20 ${acima ? "above" : "below"}${ind.ema20.dist_pct != null ? ` (${ind.ema20.dist_pct > 0 ? "+" : ""}${d1(ind.ema20.dist_pct)}%)` : ""}`,
    detail: acima
      ? `Trend intact — the re-entry gate is open. If temperature eases, a return is allowed without waiting for a crossover.`
      : `Trend broken — the re-entry gate is closed. Even with temperature falling, a return requires the crossover first.`,
    tone: acima ? "pos" : "neg",
  });

  // 5. MAC — divergence between macro and regime is information.
  if (mac) {
    const macPos = mac.valor >= mac.limiar;
    const partes: string[] = [`${d0(mac.valor)}/100 against threshold ${d0(mac.limiar)} (${mac.status})`];
    const comp: string[] = [];
    if (mac.f13 != null) comp.push(`13F ${d2(mac.f13)}`);
    if (mac.cot != null) comp.push(`COT ${d2(mac.cot)}`);
    if (mac.fed != null) comp.push(`Fed ${d2(mac.fed)}`);
    if (comp.length) partes.push(`components: ${comp.join(" · ")}`);
    porque.push({
      label: macPos && defensivo ? "Divergence: MAC positive with defensive regime" : `MAC Score ${macPos ? "supports risk-on" : "doesn't support risk-on"}`,
      detail: partes.join(" — ") + ". " + (macPos && defensivo
        ? "The macro environment still supports risk-taking, but the engine has already turned defensive. What turned was the microstructure (temperature/correlation), not the macro. A divergence like this usually resolves from one side or the other within weeks."
        : macPos ? "Macro corroborates the current posture." : "Macro reinforces the defense — both sides point the same way."),
      tone: macPos ? (defensivo ? "neu" : "pos") : "neg",
    });
  }

  // 6. Re-entry — the operational state.
  if (def?.reentry) {
    const r = def.reentry;
    porque.push({
      label: `Re-entry: ${r.status}`,
      detail: `${r.days_in_defense} day(s) in defense${r.target_pct != null ? `, target ${d0(r.target_pct)}%` : ""}${def.velocity != null ? `, velocity ${d2(def.velocity)}` : ""}. Current defense at ${d0(def.defesa_pct)}%.`,
      tone: "neu",
    });
  }

  // Temperature trend
  const tend: string[] = [];
  if (hist?.temp_1d_ago != null) {
    const d = t.valor - hist.temp_1d_ago;
    tend.push(`${Math.abs(d) < 0.02 ? "stable" : d > 0 ? `up ${d2(Math.abs(d))}` : `down ${d2(Math.abs(d))}`} over 1 day`);
  }
  if (hist?.temp_7d_ago != null) {
    const d = t.valor - hist.temp_7d_ago;
    tend.push(`${Math.abs(d) < 0.02 ? "flat" : d > 0 ? `up ${d2(Math.abs(d))}` : `down ${d2(Math.abs(d))}`} over 7 days`);
  }
  const tendencia = tend.length
    ? `Temperature ${tend.join(", ")}. ${hist?.temp_7d_ago != null && t.valor < hist.temp_7d_ago ? "Easing on the week — if it continues and EMA20 stays above, re-entry unlocks." : "No relief this week."}`
    : "No temperature series available to gauge a trend right now.";

  const agressores = porque.filter((p) => p.tone === "neg");
  const resumo = agressores.length
    ? `${agressores.length} aggressor${agressores.length > 1 ? "s" : ""} · temp ${d2(t.valor)}/${d2(t.limiar)} · CC ${d2(cc.valor)}`
    : `Temp ${d2(t.valor)}/${d2(t.limiar)} · CC ${d2(cc.valor)} · no relevant aggressor`;

  return {
    key: "ari",
    title: "ARI · American Regime Index (internal)",
    badge: { label: regime, color: REGIME_COLOR[regime] || "var(--tx2)" },
    resumo,
    leitura: defensivo
      ? `Engine in ${regime} with defense at ${def ? d0(def.defesa_pct) : "—"}%. What turned was ${cc.valor >= cc.limiar_low ? "correlation — and high correlation is fought with size, not selection" : "pillar temperature"}.`
      : `Engine in ${regime} — exposure sustained, defense on standby at ${def ? d0(def.defesa_pct) : "—"}%.`,
    porque,
    tendencia,
    impacto: defensivo
      ? `Cutting gross exposure is the instrument — with CC at ${d2(cc.valor)}, swapping names doesn't reduce risk. The gate back is EMA20 (${acima ? "open" : "closed"}) plus temperature easing below ${d2(t.limiar)}.`
      : `Full exposure sustained. Watch the pillar with the smallest buffer and CC: that's where the next turn will come from.`,
  };
}

// ============================================================
// XRI internal — mechanism, not just result
// ============================================================
export function buildXriInternal(s: XriSnapshot): AnalysisBlock {
  const porque: Driver[] = [];
  const fd = s.frequency_decomposition;

  // 1. The central question: what's holding the score there?
  const canais: [string, number][] = [
    ["fragility (turbulence + absorption + DY)", fd.fragility_contribution],
    ["slow prior (structural macro)", fd.slow_prior_contribution],
    ["market stress (fast)", fd.fast_market_contribution],
    ["events (narrative)", fd.event_contribution],
  ];
  const dom = [...canais].sort((a, b) => b[1] - a[1])[0];
  porque.push({
    label: `The score comes from ${dom[0].split(" (")[0]}`,
    detail: `Decomposition: fragility ${d1(fd.fragility_contribution)} · slow prior ${d1(fd.slow_prior_contribution)} · fast stress ${d1(fd.fast_market_contribution)} · events ${d1(fd.event_contribution)}. ${dom[0].startsWith("fragility") ? "The XRI isn't here because of market panic or an event — it's here because of STRUCTURE. High fragility means the system is wired to transmit shock, even with no shock happening today. It's the kind of risk that doesn't show up in price until the day it shows up all at once." : "Worth checking whether the dominant channel is persistent or episodic."}`,
    tone: dom[0].startsWith("fragility") ? "neg" : "neu",
  });

  // 2. Absorption ratio — the most misunderstood number on the panel.
  porque.push({
    label: `Absorption ratio at ${d1(s.absorption_ratio_score)}`,
    detail: `${s.absorption_ratio_score >= 85 ? "Very high: a handful of factors explain almost all of the markets' variance — they're moving as a single body. Historically a necessary (not sufficient) condition for contagion: when everything is a single factor, there's nowhere to hide." : s.absorption_ratio_score >= 60 ? "Elevated: factor concentration above normal." : "Normal: markets are still moving for their own reasons."} Turbulence (Mahalanobis) at ${d1(s.turbulence)}.`,
    tone: s.absorption_ratio_score >= 85 ? "neg" : s.absorption_ratio_score >= 60 ? "neu" : "pos",
  });

  // 3. Slow vs fast — who's ahead.
  const gap = s.slow_prior - s.fast_market_stress;
  porque.push({
    label: gap > 8 ? "The macro prior is ahead of the market" : gap < -8 ? "The market is ahead of the macro prior" : "Prior and market aligned",
    detail: `Slow prior ${d1(s.slow_prior)} against fast market stress ${d1(s.fast_market_stress)} — a gap of ${d1(Math.abs(gap))}. ${gap > 8 ? "The structural component sees more risk than the market is pricing in today. Either the market re-prices, or the prior gives way. This mismatch is exactly the anticipation window the XRI exists to capture." : gap < -8 ? "The market is more nervous than the structure justifies — could be short-term noise." : "The two components agree; no mismatch to exploit."}`,
    tone: gap > 8 ? "neg" : "neu",
  });

  // 4. Material transmission to the US — the filter that separates news from risk.
  porque.push({
    label: `Material transmission to the US at ${d2(s.dy_material_to_us)}`,
    detail: `Global Diebold-Yilmaz at ${d1(s.dy_global)}, but what materially reaches the US is ${d2(s.dy_material_to_us)}. ${s.dy_material_to_us < 0.5 ? "Low: the risk exists out there and doesn't yet have an open channel over here. This is what sustains the current state instead of something worse — and it's the first thing to watch, because once this number rises, the rest has already happened." : "Channel open: what happens abroad is already reaching the American market."} By country: ${Object.entries(s.dy_by_country || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${COUNTRY_PT[k] || k} ${d2(v)}`).join(" · ")}.`,
    tone: s.dy_material_to_us < 0.5 ? "pos" : "neg",
  });

  // 5. Pillars and countries.
  const pil = Object.entries(s.contribution_by_pillar || {}).sort((a, b) => b[1] - a[1]);
  if (pil.length) {
    porque.push({
      label: `Concentration by pillar: ${PILLAR_PT[pil[0][0]] || pil[0][0]} at ${d1(pil[0][1])}`,
      detail: pil.map(([k, v]) => `${PILLAR_PT[k] || k} ${d1(v)}`).join(" · ") + ". Remember that the weighting is by American companies' exposure, not by GDP size — that's what separates the XRI from a generic country-risk index.",
      tone: "neu",
    });
  }
  const pais = Object.entries(s.contribution_by_country || {}).filter(([k]) => k !== "us").sort((a, b) => b[1] - a[1]);
  if (pais.length) {
    porque.push({
      label: `${COUNTRY_PT[pais[0][0]] || pais[0][0]} concentrates ${d1(pais[0][1])}% of the external risk`,
      detail: pais.slice(0, 4).map(([k, v]) => `${COUNTRY_PT[k] || k} ${d1(v)}%`).join(" · ") + `. Concentration ${pais[0][1] >= 45 ? "high — easier to monitor, and easier to flip all at once" : "distributed"}.`,
      tone: pais[0][1] >= 45 ? "neg" : "neu",
    });
  }

  // 6. Data quality — honesty about what backs the number.
  const eq = s.exposure_quality;
  if (eq) {
    porque.push({
      label: `Exposure quality: ${d1(eq.reported_coverage_pct)}% reported, ${d1(eq.imputed_coverage_pct)}% imputed`,
      detail: `Average confidence ${d2(eq.avg_confidence)}${eq.low_confidence_blocks?.length ? ` · low-confidence blocks: ${eq.low_confidence_blocks.join(", ")}` : ""}. ${eq.imputed_coverage_pct > 35 ? "More than a third of the exposure matrix is imputed, not reported in a 10-K. The number is usable, but it isn't a measurement — it's an estimate with a margin." : "Coverage mostly reported."}`,
      tone: eq.imputed_coverage_pct > 35 ? "neu" : "pos",
    });
  }

  // 7. Events.
  if (s.accepted_events?.length || s.quarantined_events?.length) {
    porque.push({
      label: `Narrative gate: ${s.accepted_events?.length || 0} accepted, ${s.quarantined_events?.length || 0} quarantined`,
      detail: (s.accepted_events || []).map(e => `${e.description} (+${d2(e.contribution)})`).join(" · ")
        || `No event passed the 3 filters today — the score is entirely structural, with no narrative component. Event adjustment: ${d2(s.event_adjustment)}.`,
      tone: "neu",
    });
  }

  const dirTxt = s.direction === "heating" ? "heating" : s.direction === "cooling" ? "cooling" : "stable";
  const resumo = `${dom[0].split(" (")[0]} dominates (${d1(dom[1])}) · AR ${d1(s.absorption_ratio_score)} · DY→US ${d2(s.dy_material_to_us)}`;

  return {
    key: "xri",
    title: "XRI · External Regime Index (internal)",
    badge: { label: s.state, color: XRI_STATE_COLOR[s.state] || "var(--tx2)" },
    resumo,
    leitura: `Score ${d1(s.score)} (${s.state}), ${dirTxt}, confidence ${d1(s.confidence * 100)}%. What backs the number is ${dom[0].split(" (")[0]} — ${d1(dom[1])} of the decomposition.`,
    porque,
    tendencia: `Direction ${dirTxt}. Slow prior ${d1(s.slow_prior)} · fast stress ${d1(s.fast_market_stress)} · turbulence ${d1(s.turbulence)} · absorption ${d1(s.absorption_ratio_score)} · DY global ${d1(s.dy_global)}. Versions: model ${s.versions?.model_version || "—"}, exposure ${s.versions?.exposure_version || "—"}, data ${s.versions?.data_version || "—"}.`,
    impacto: buildOverlayImpacto(s),
  };
}

// The most important part of the Cockpit: the recommended overlay AND its
// authorization status. Showing the modifier without the flag would invite
// the manager to operate an overlay that hasn't passed validation yet.
function buildOverlayImpacto(s: XriSnapshot): string {
  const o = s.overlay_recommendation;
  const naoValidado = (s.data_quality_flags || []).includes("NOT_VALIDATED_AS_OVERLAY");
  if (!o) return "No overlay recommendation in today's snapshot.";
  const rec = `Recommendation: gross exposure cap ${o.gross_exposure_cap_modifier > 0 ? "+" : ""}${d0(o.gross_exposure_cap_modifier * 100)}%, defensive threshold ${o.defensive_threshold_modifier > 0 ? "+" : ""}${d0(o.defensive_threshold_modifier * 100)}%, re-entry confirmation "${o.reentry_confirmation_required}".`;
  if (naoValidado) {
    return `${rec} ⚠ BUT the NOT_VALIDATED_AS_OVERLAY flag is active: the XRI has NOT yet passed the criteria to operate as an overlay. This is a panel reading, not an execution instruction — do not apply it to the engine until validation clears. The number informs the conversation; it doesn't move exposure.`;
  }
  return `${rec} Validated as an overlay — can enter the engine within contract.`;
}

// ============================================================
// Complete Cockpit analysis
// ============================================================
export function buildCockpitAnalysis(
  ind: IndicatorsState | null,
  def: DefenseState | null,
  hist: TempHistory | null,
  xri: XriSnapshot | null
): CockpitAnalysis {
  const blocks: AnalysisBlock[] = [];
  if (ind) blocks.push(buildAriInternal(ind, def, hist));
  if (xri) blocks.push(buildXriInternal(xri));

  const regime = def?.regime || "—";
  const domDefensivo = regime === "RISK-OFF" || regime === "WARNING";
  const extDefensivo = xri ? (xri.state === "STRESS" || xri.state === "CRISIS") : false;

  let headline: string, headlineColor: string, acao: string;
  if (domDefensivo && extDefensivo) {
    headline = "Pressure from both sides — engine and external environment defensive together.";
    headlineColor = "#E74C3C";
    acao = "Reduce gross exposure. No geographic diversification available.";
  } else if (domDefensivo) {
    headline = "Defense for domestic reasons. The engine turned before the external environment.";
    headlineColor = "#E67E22";
    acao = `Reduce by size, not by selection${ind && ind.cross_correlation.valor >= ind.cross_correlation.limiar_low ? ` — CC at ${d2(ind.cross_correlation.valor)} negates the gain from swapping names` : ""}.`;
  } else if (extDefensivo) {
    headline = "External risk elevated, engine still sustaining risk.";
    headlineColor = "#C9A02C";
    acao = "Hold exposure and tighten re-entry. Watch the transmission to the US.";
  } else {
    headline = "Engine and external environment sustain risk.";
    headlineColor = "#2ECC71";
    acao = "Full exposure. Watch the pillar with the smallest buffer.";
  }

  // Convergence — internal×external cross-check
  let convergencia: string;
  if (ind && xri) {
    const cc = ind.cross_correlation.valor;
    const ar = xri.absorption_ratio_score;
    const ambosAltos = cc >= ind.cross_correlation.limiar_low && ar >= 85;
    if (ambosAltos) {
      convergencia = `Two independent gauges saying the same thing: the engine's cross-correlation is at ${d2(cc)} (above the gate of ${d2(ind.cross_correlation.limiar_low)}) and the XRI's absorption ratio is at ${d1(ar)}. One looks at the HC-US pillars, the other looks at global markets — neither knows about the other, and both are pointing to "everything turned into a single factor." When two independent measurements converge like this, the signal isn't a methodological artifact: diversification is genuinely losing effectiveness, inside and out. It's the strongest justification that exists today for defending by size rather than by composition.`;
    } else if (domDefensivo && !extDefensivo) {
      convergencia = `The engine is in ${regime} while the XRI is in ${xri.state} (${d1(xri.score)}). The pressure is domestic: what turned was temperature/correlation in here, not the external environment. Material transmission to the US at ${d2(xri.dy_material_to_us)} confirms it — the external channel is closed. Swapping American exposure for international wouldn't solve it; it would just move the risk elsewhere.`;
    } else {
      convergencia = `Engine in ${regime}, XRI in ${xri.state} (${d1(xri.score)}). CC ${d2(cc)}, absorption ratio ${d1(ar)}, transmission to the US ${d2(xri.dy_material_to_us)}.`;
    }
  } else {
    convergencia = xri ? `XRI in ${xri.state} (${d1(xri.score)}). Engine indicators unavailable for cross-checking.` : "Cross-check unavailable — one of the two sides is missing.";
  }

  // Attention — what only shows up when cross-checking
  const atencao: string[] = [];
  if (xri && (xri.data_quality_flags || []).includes("NOT_VALIDATED_AS_OVERLAY")) {
    atencao.push(`XRI recommends adjusting the cap (${d0(xri.overlay_recommendation.gross_exposure_cap_modifier * 100)}%) but carries NOT_VALIDATED_AS_OVERLAY. As long as this flag exists, the number is a panel reading — not an instruction. Applying it to the engine now would mean operating an overlay that hasn't passed its own validation.`);
  }
  if (ind?.mac_score && ind.mac_score.valor >= ind.mac_score.limiar && domDefensivo) {
    atencao.push(`MAC Score at ${d0(ind.mac_score.valor)} (threshold ${d0(ind.mac_score.limiar)}) supports risk-taking, but the engine is in ${regime}. What turned was the microstructure, not the macro. A divergence like this resolves from one of the two sides — worth knowing which, because it determines whether the defense is short or long.`);
  }
  if (xri && xri.slow_prior - xri.fast_market_stress > 8) {
    atencao.push(`Slow prior (${d1(xri.slow_prior)}) above fast market stress (${d1(xri.fast_market_stress)}) by ${d1(xri.slow_prior - xri.fast_market_stress)} points: the structural component sees more risk than the market is pricing in. It's the window the XRI exists to capture — and it doesn't tend to stay open for long.`);
  }
  if (xri && xri.exposure_quality?.imputed_coverage_pct > 35) {
    atencao.push(`${d1(xri.exposure_quality.imputed_coverage_pct)}% of the exposure matrix is imputed (average confidence ${d2(xri.exposure_quality.avg_confidence)}). Today's XRI is an estimate with a margin, not a measurement — weigh that before any decision based on it.`);
  }
  if (def?.pilares) {
    const rows = Object.entries(def.pilares).filter(([, p]) => p.limiar != null)
      .map(([, p]) => ({ p, folga: (p.limiar as number) - p.temp }))
      .sort((a, b) => a.folga - b.folga);
    if (rows[0] && rows[0].folga <= 0.08) {
      atencao.push(`Pillar ${rows[0].p.nome} is ${d2(rows[0].folga)} from its threshold (${d2(rows[0].p.temp)} vs ${d2(rows[0].p.limiar as number)}). It's the engine's closest trigger today.`);
    }
  }

  return { headline, headlineColor, acao, convergencia, blocks, atencao };
}

/** Short briefing for the JIM drawer. */
export function cockpitAnalysisToBriefing(a: CockpitAnalysis): string {
  return [a.headline, a.convergencia, a.atencao[0] || ""].filter(Boolean).join(" ");
}

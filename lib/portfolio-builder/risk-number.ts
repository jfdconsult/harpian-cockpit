/**
 * Nitrogen / Riskalyze Risk Number — implementação pura.
 *
 * Baseada no material engenheirado reverso em `HARPIAN/05 - RISK_NUMBER_ALPHA_QUANT/
 * 05.05 - Risk Number MFO/risk_number_model.md` (métrica proprietária mas com o
 * miolo documentado pelo próprio Nitrogen em The Math Behind Nitrogen).
 *
 * Fórmula:
 *   sigma6M   = volAnual / sqrt(2)
 *   r6M       = (1 + cagr)^0.5 − 1
 *   downside6 = r6M − 1.64 · sigma6M          ← 95% VaR paramétrico normal
 *   RN        = interpolarNasAnchors(|downside6|)
 *
 * Anchors públicos do Nitrogen (downside 6M → RN):
 *   -2%   → 22
 *   -5%   → 32
 *   -7%   → 42
 *   -12%  → 62
 *   -18%  → 82
 *   -27%  → 91
 *
 * Referências pra sanidade:
 *   SPY = 70, AGG = 29, blend 70/30 = 52, blend 50/50 = 42.
 *
 * NÃO usar como "número oficial do Nitrogen" — é uma REPLICAÇÃO baseada
 * em anchors públicos. Bom pra dar ao cliente uma referência comparável
 * ao que ele conhece do Riskalyze/Nitrogen, mas o RN oficial precisa
 * do próprio serviço deles.
 */

const ANCHORS: { downside: number; rn: number }[] = [
  { downside: 0.02, rn: 22 },
  { downside: 0.05, rn: 32 },
  { downside: 0.07, rn: 42 },
  { downside: 0.12, rn: 62 },
  { downside: 0.18, rn: 82 },
  { downside: 0.2742, rn: 91 },
];

/** RN de referência dos principais benchmarks públicos, pra comparação. */
export const RN_BENCHMARKS = {
  AGG: 29,       // Bloomberg Aggregate Bond
  BLEND_50_50: 42,
  BLEND_70_30: 52,
  SPY: 70,       // S&P 500 puro
} as const;

/** RN é sempre inteiro entre 1 e 99. */
function clampRN(x: number): number {
  return Math.max(1, Math.min(99, Math.round(x)));
}

/** Mapeia downside (magnitude positiva, ex 0.12 = 12%) → RN via interpolação linear entre anchors. */
export function riskNumberFromDownside(downsideMag: number): number {
  if (!isFinite(downsideMag) || downsideMag <= 0) return 1;

  // Antes do primeiro anchor: escala linear de 0 até o 1º ponto
  if (downsideMag <= ANCHORS[0].downside) {
    return clampRN((ANCHORS[0].rn * downsideMag) / ANCHORS[0].downside);
  }
  // Interpolação entre pares consecutivos
  for (let i = 1; i < ANCHORS.length; i++) {
    const a = ANCHORS[i - 1];
    const b = ANCHORS[i];
    if (downsideMag <= b.downside) {
      const w = (downsideMag - a.downside) / (b.downside - a.downside);
      return clampRN(a.rn + w * (b.rn - a.rn));
    }
  }
  // Extrapolação linear da última reta pro topo do range
  const last = ANCHORS[ANCHORS.length - 1];
  const prev = ANCHORS[ANCHORS.length - 2];
  const slope = (last.rn - prev.rn) / (last.downside - prev.downside);
  return clampRN(last.rn + slope * (downsideMag - last.downside));
}

/**
 * Calcula Risk Number a partir do CAGR + vol anualizada do portfólio.
 * Retorna também os passos intermediários pra exibição/auditoria.
 *
 * @param cagr       Retorno anualizado composto (0.15 = 15%/ano)
 * @param volAnual   Volatilidade anualizada (0.20 = 20% a.a.)
 */
export function calcularRiskNumber(cagr: number, volAnual: number) {
  const sigma6 = volAnual / Math.SQRT2;               // vol 6M
  const r6 = Math.pow(1 + cagr, 0.5) - 1;             // retorno esperado 6M
  const downside6 = r6 - 1.64 * sigma6;               // pior cenário 6M (95%)
  const downsideMag = Math.max(0, -downside6);
  const rn = riskNumberFromDownside(downsideMag);
  return {
    rn,
    downside6,
    downside6Mag: downsideMag,
    upside6: r6 + 1.64 * sigma6,
    r6,
    sigma6,
    cagr,
    volAnual,
  };
}

/** Rótulo curto pro RN — mesma escala que o Nitrogen mostra ao cliente. */
export function classificarRN(rn: number): { label: string; cor: string } {
  if (rn <= 25) return { label: "Conservador", cor: "#0a5aa0" };
  if (rn <= 45) return { label: "Moderado", cor: "#0a7a3b" };
  if (rn <= 65) return { label: "Balanceado", cor: "#c9a02c" };
  if (rn <= 85) return { label: "Crescimento", cor: "#e08420" };
  return { label: "Agressivo", cor: "#b0201f" };
}

/**
 * HRD Engine — port TypeScript do `hrd_engine.py` oficial da Harpian.
 * Substitui a réplica genérica do Nitrogen. Fórmula:
 *
 *   RS_i        = min(BASE_SCORE[asset_class] × CRM[jurisdiction]
 *                     + LIQUIDITY_PENALTY[liquidity], 99)
 *   raw_RN      = Σ (w_i × RS_i)
 *   final_RN    = min(raw_RN × CF, 99)      onde CF = 1.10 se equity > 60%
 *
 * Calibrado contra os 6 portfolios modelo Harpian:
 *   P2 Cons-Mod Global   → RN 36
 *   P3 Conservador EUA   → RN 34
 *   P4 Balanceado Global → RN 36
 *   P5 Moderado EUA      → RN 47
 */

// ── Enumerações ──────────────────────────────────────────────────────────────
export type AssetClass =
  | "CASH" | "FIXED_INCOME_IG" | "FIXED_INCOME_HY" | "CREDIT_BR" | "FIXED_IPCA"
  | "EQUITY_BROAD" | "EQUITY_IBOV" | "EQUITY_TECH_SC" | "HARPIAN_ETP"
  | "GOLD" | "COMMODITIES" | "REITS" | "PRIVATE_EQUITY" | "VENTURE"
  | "CRYPTO" | "OTHER";

export type Jurisdiction = "USA" | "BRAZIL" | "EUROPE" | "ASIA_EM" | "OTHER";
export type LiquidityTier = "D0" | "D1" | "D3" | "D30" | "D60" | "D90" | "LOCK";

// ── Tabelas de referência (mesmas do hrd_engine.py) ──────────────────────────
export const BASE_RISK_SCORE: Record<AssetClass, number> = {
  CASH: 5,
  FIXED_INCOME_IG: 25,
  FIXED_INCOME_HY: 50,
  CREDIT_BR: 35,
  FIXED_IPCA: 45,
  EQUITY_BROAD: 65,
  EQUITY_IBOV: 70,
  EQUITY_TECH_SC: 85,
  HARPIAN_ETP: 42,
  GOLD: 55,
  COMMODITIES: 70,
  REITS: 65,
  PRIVATE_EQUITY: 90,
  VENTURE: 95,
  CRYPTO: 99,
  OTHER: 60,
};

export const COUNTRY_RISK_MULTIPLIER: Record<Jurisdiction, number> = {
  USA: 1.00, EUROPE: 1.10, ASIA_EM: 1.20, BRAZIL: 1.30, OTHER: 1.25,
};

export const LIQUIDITY_PENALTY: Record<LiquidityTier, number> = {
  D0: 0, D1: 0, D3: 0, D30: 5, D60: 10, D90: 10, LOCK: 15,
};

const EQUITY_ASSET_CLASSES: ReadonlySet<AssetClass> = new Set([
  "EQUITY_BROAD", "EQUITY_IBOV", "EQUITY_TECH_SC",
]);
const EQUITY_CONCENTRATION_THRESHOLD = 0.60;
const CORRELATION_FACTOR_HIGH = 1.10;
const MAX_RISK_SCORE = 99;

// ── Position + Portfolio ─────────────────────────────────────────────────────
export interface HRDPosition {
  name: string;
  weight: number;                 // 0..1
  asset_class: AssetClass;
  jurisdiction: Jurisdiction;
  liquidity: LiquidityTier;
}

export interface HRDScoredPosition {
  name: string;
  weight: number;
  base_score: number;
  after_crm: number;
  liquidity_penalty: number;
  final_score: number;
  weighted_score: number;
}

export interface HRDReport {
  raw_rn: number;
  final_rn: number;               // com Correlation Factor
  cf_applied: number;             // 1.00 ou 1.10
  equity_weight: number;
  positions: HRDScoredPosition[];
}

// ── Scoring ──────────────────────────────────────────────────────────────────
export function scorePosition(p: HRDPosition): HRDScoredPosition {
  const base = BASE_RISK_SCORE[p.asset_class];
  const crm = COUNTRY_RISK_MULTIPLIER[p.jurisdiction];
  const after_crm = base * crm;
  const liq_pen = LIQUIDITY_PENALTY[p.liquidity];
  const final = Math.min(after_crm + liq_pen, MAX_RISK_SCORE);
  return {
    name: p.name, weight: p.weight, base_score: base,
    after_crm, liquidity_penalty: liq_pen,
    final_score: final, weighted_score: p.weight * final,
  };
}

export function computePortfolioRN(positions: HRDPosition[]): HRDReport {
  const scored = positions.map(scorePosition);
  const raw = scored.reduce((a, s) => a + s.weighted_score, 0);
  const eq = positions
    .filter(p => EQUITY_ASSET_CLASSES.has(p.asset_class))
    .reduce((a, p) => a + p.weight, 0);
  const cf = eq >= EQUITY_CONCENTRATION_THRESHOLD ? CORRELATION_FACTOR_HIGH : 1.00;
  const final = Math.min(raw * cf, MAX_RISK_SCORE);
  return { raw_rn: raw, final_rn: final, cf_applied: cf, equity_weight: eq, positions: scored };
}

export type RiskBand =
  | "Conservative Extreme" | "Conservative" | "Moderate"
  | "Moderate Aggressive" | "Aggressive" | "Ultra Aggressive";

export function classifyBand(rn: number): { band: RiskBand; cor: string } {
  if (rn <= 20) return { band: "Conservative Extreme", cor: "#0a5aa0" };
  if (rn <= 40) return { band: "Conservative",         cor: "#0a7a3b" };
  if (rn <= 60) return { band: "Moderate",             cor: "#c9a02c" };
  if (rn <= 75) return { band: "Moderate Aggressive",  cor: "#e08420" };
  if (rn <= 90) return { band: "Aggressive",           cor: "#b0201f" };
  return { band: "Ultra Aggressive", cor: "#8a1010" };
}

// ── Heurística: strategy id → HRD classification ─────────────────────────────
/**
 * Mapeia cada estratégia do catálogo do Portfolio Builder pra uma classificação
 * HRD (asset_class + jurisdiction + liquidity). Todas as estratégias sao
 * negociadas via ETF/ETP com liquidez D+1 e listadas em USA.
 *
 * Regras derivadas dos labels do strategies.json (ver NOMES.md):
 *  - CORE11 S21/S22 = US Treasuries / Global IG Bonds → FIXED_INCOME_IG
 *  - CORE11 S23     = Global High Yield Bonds        → FIXED_INCOME_HY
 *  - CORE11 S24     = Global Equity Dividends       → EQUITY_BROAD (defensivo)
 *  - CORE11 S25     = US Defensive Sectors          → EQUITY_BROAD (defensivo)
 *  - CORE11 S26     = US Large Cap                   → EQUITY_BROAD
 *  - CORE11 S27     = Developed Countries            → EQUITY_BROAD (Europe mix)
 *  - CORE11 S28     = Emerging Mkts                  → EQUITY_TECH_SC (EM = alto risco)
 *  - CORE11 S29     = US Small & Mid Caps            → EQUITY_TECH_SC
 *  - CORE11 S30     = Global Innovation              → EQUITY_TECH_SC
 *  - CORE11 S31     = Alternative Investments        → OTHER
 *  - CORE11 S32C+   = Big Tech / Sectors             → EQUITY_TECH_SC
 *  - C22ACT... setoriais 150-171                     → EQUITY_BROAD (SPDR setoriais)
 */
export function classifyStrategy(id: string, label = "", sub = ""): {
  asset_class: AssetClass;
  jurisdiction: Jurisdiction;
  liquidity: LiquidityTier;
} {
  const s = (id + " " + label + " " + sub).toLowerCase();
  // ordem importa — do mais especifico pro geral

  // Renda fixa
  if (/us[- ]?treas|aggbond|agg\.?bond|us treasur|treasury/i.test(s))
    return { asset_class: "FIXED_INCOME_IG", jurisdiction: "USA", liquidity: "D1" };
  if (/inv.?grade|inv\. grade bond|invgrade|corporate.*ig/i.test(s))
    return { asset_class: "FIXED_INCOME_IG", jurisdiction: "USA", liquidity: "D1" };
  if (/high yield|highyield|hy bond|hy/i.test(s))
    return { asset_class: "FIXED_INCOME_HY", jurisdiction: "USA", liquidity: "D1" };

  // Setoriais / Small caps / Emergentes / Tech
  if (/emerg|emerging/i.test(s))
    return { asset_class: "EQUITY_TECH_SC", jurisdiction: "ASIA_EM", liquidity: "D1" };
  if (/small|mid.?cap|small.?mid|innovation|big.?tech|tech|nasdaq|technolog/i.test(s))
    return { asset_class: "EQUITY_TECH_SC", jurisdiction: "USA", liquidity: "D1" };

  // Alternativos / commodities
  if (/gold|commodit|comm,|alternative/i.test(s))
    return { asset_class: "OTHER", jurisdiction: "USA", liquidity: "D1" };
  if (/crypto/i.test(s))
    return { asset_class: "CRYPTO", jurisdiction: "USA", liquidity: "D1" };

  // Setoriais SPDR (C22ACT) — todos EQUITY_BROAD USA
  if (/c22act|c22 |^c11 - c22/i.test(s))
    return { asset_class: "EQUITY_BROAD", jurisdiction: "USA", liquidity: "D1" };

  // Developed Countries fora USA
  if (/developed|europ|intl/i.test(s))
    return { asset_class: "EQUITY_BROAD", jurisdiction: "EUROPE", liquidity: "D1" };

  // Defensive sectors, Large Cap, Dividends
  if (/defensive|dividend|large.?cap|large/i.test(s))
    return { asset_class: "EQUITY_BROAD", jurisdiction: "USA", liquidity: "D1" };

  // Blocos sinteticos dos SETs Harpian (rotacao20/corrmin20/aggbond/maxcagr10/
  // suavemin15) sao estrategias ADAPTATIVAS proprietarias — tem defesa embutida
  // (StormGuard), rotacao entre 41 subjacentes, e limites de exposicao.
  // Classifica como HARPIAN_ETP (base 42) em vez de EQUITY_BROAD (65). Isso
  // replica a leitura dos portfolios modelo, onde a fatia Harpian pesa menos
  // que equity puro.
  if (/rotacao|corrmin|correlacao|rotation|momentum|maxcagr|suavemin|hpc11|hpc22|harpian/i.test(s))
    return { asset_class: "HARPIAN_ETP", jurisdiction: "USA", liquidity: "D1" };

  // Fallback
  return { asset_class: "EQUITY_BROAD", jurisdiction: "USA", liquidity: "D1" };
}

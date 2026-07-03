// ============================================================
// PORTFOLIO STUDIO v2 — tipos + API client + diff
// Composição: motores tipados + regras de mix + perfis institucionais
// Fiel a ARQUITETURA_HC-US_IG_v2.md (ADR-002: só w_min/w_max variam por perfil)
// ============================================================
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

export type MotorTipo = "attack_stocks" | "attack_etfs" | "detector" | "defense" | "custom";
export type PesoModo = "fixo" | "dinamico" | "n/a";

export interface PesoConfig {
  modo: PesoModo;
  regra_id: string | null;
  valor: number | null;
}

export interface AtivoNo {
  ticker: string;
  peso_pct: number;
  tipo?: string;
}

// A ESTRATÉGIA como arena de competição (estilo AlphaDroid, sem limite de ativos —
// resposta do João, 2026-07-03): um universo de ativos compete via um ranker (fórmula),
// os top-N líderes ficam comprados. `ativos` em EsteiraNo continua sendo o RESULTADO
// atual da competição (os líderes já escolhidos); `arena` é a CONFIGURAÇÃO de como
// competem. Sem `arena`, a estratégia é uma cesta curada manualmente (modo legado).
export type RegraPeso = "igual" | "forca_sinal" | "inverse_vol" | "cap";

export interface Arena {
  universo_tickers: string[]; // candidatos que competem — até 500
  ranker_formula_id: string | null; // fórmula do catálogo, categoria "Ranker"
  selecao_top_n: number | null; // quantos líderes ficam comprados
  regra_peso: RegraPeso;
  peso_cap_pct: number | null; // só relevante quando regra_peso === "cap"
  rebalance_freq: string;
}

export interface EsteiraNo {
  nome: string;
  peso_pct: number;
  peso_modo?: "fixo" | "emergente";
  ativos: AtivoNo[];
  arena?: Arena | null;
}

export interface PilarNo {
  nome: string;
  peso_pct: number;
  peso_modo?: "fixo" | "emergente";
  esteiras: EsteiraNo[];
}

export interface EstruturaAttackStocks {
  pilares: PilarNo[];
  regras_internas?: Record<string, unknown>;
}

export interface EstruturaAttackEtfs {
  buckets_n: number;
  etfs_n: number;
  config?: string;
  signal?: string;
  mask_anti_phantom?: boolean;
}

export interface FormulaDetector {
  id: string;
  peso: number;
  descricao?: string;
}

export interface EstruturaDetector {
  formulas: FormulaDetector[];
  emite_sinal?: string;
}

export type EstruturaMotor = EstruturaAttackStocks | EstruturaAttackEtfs | EstruturaDetector;

export interface MotorRegistryInfo {
  descricao?: string;
  grade?: string;
  status?: string;
}

export interface MotorNoPortfolio {
  id: string; // "A" / "B" / "C" (local no portfolio)
  ref_motor_id: string; // id no catálogo /v1/registry/motores
  nome: string;
  versao: string;
  tipo: MotorTipo;
  status: "prod" | "lab" | "candidate";
  peso: PesoConfig;
  estrutura: EstruturaMotor;
  registry?: MotorRegistryInfo | null;
}

export interface Regra {
  id: string;
  tipo: "dynamic_mix" | "cap_ativo" | "rebalance" | "custom";
  nome: string;
  fonte_sinal: string | null;
  alvos: string[];
  response_type: "step" | "linear" | null;
  threshold: number | null;
  k_steep: number | null;
  descricao: string;
}

export interface Perfil {
  id: string;
  nome: string;
  w_min: number;
  w_max: number;
  ativo: boolean;
  cagr_10y?: number;
  sharpe?: number;
  calmar?: number;
  max_dd?: number;
  vol?: number;
}

export interface Composicao {
  portfolio_id: string;
  motores: MotorNoPortfolio[];
  regras: Regra[];
  perfis: Perfil[];
  adr_travas: string[];
  perfil_ativo: Perfil | null;
}

export interface BacktestPreviewResult {
  run_id: string;
  grade: "A" | "B" | "F";
  red_flags: string[];
  metricas_oos: { cagr: number; sortino: number; calmar: number; max_dd: number };
  metricas_full: { cagr: number; sortino: number; calmar: number; max_dd: number };
  validadores?: Record<string, boolean>;
}

export interface ForkResult {
  portfolio: Record<string, unknown> & { id: string };
  origin_id: string;
}

// ============================================================
// API client
// ============================================================

export const fetchComposicao = (pid: string) =>
  apiGet<Composicao>(`/v1/strategies/${pid}/composicao`);

export const addMotor = (
  pid: string,
  body: {
    id: string;
    ref_motor_id: string;
    tipo: MotorTipo;
    peso_modo?: PesoModo;
    peso_regra_id?: string | null;
    peso_valor?: number | null;
  }
) => apiPost<{ motor: MotorNoPortfolio }>(`/v1/strategies/${pid}/motor`, body);

export const removeMotor = (pid: string, mid: string) =>
  apiDelete<{ ok: boolean }>(`/v1/strategies/${pid}/motor/${mid}`);

export const patchMotorPeso = (
  pid: string,
  mid: string,
  body: Partial<Pick<PesoConfig, "modo" | "regra_id" | "valor">>
) => apiPatch<{ motor: MotorNoPortfolio }>(`/v1/strategies/${pid}/motor/${mid}`, body);

export const addRegra = (pid: string, body: Regra) =>
  apiPost<{ regra: Regra }>(`/v1/strategies/${pid}/regra`, body);

export const removeRegra = (pid: string, rid: string) =>
  apiDelete<{ ok: boolean }>(`/v1/strategies/${pid}/regra/${rid}`);

export const addPerfil = (
  pid: string,
  body: { id: string; nome: string; w_min: number; w_max: number; ativo?: boolean }
) => apiPost<{ perfil: Perfil }>(`/v1/strategies/${pid}/perfil`, body);

export const patchPerfil = (
  pid: string,
  prid: string,
  body: Partial<Pick<Perfil, "w_min" | "w_max" | "ativo">>
) => apiPatch<{ perfil: Perfil }>(`/v1/strategies/${pid}/perfil/${prid}`, body);

export const activatePerfil = (pid: string, prid: string) =>
  apiPost<{ perfil: Perfil; portfolio_id: string }>(
    `/v1/strategies/${pid}/perfil/${prid}/activate`
  );

export const forkPortfolio = (pid: string) =>
  apiPost<ForkResult>(`/v1/strategies/${pid}/fork`);

export const backtestPreview = (motorId: string, portfolioId: string) =>
  apiPost<BacktestPreviewResult>("/v1/registry/etps/backtest-preview", {
    motor_id: motorId,
    portfolio_id: portfolioId,
  });

export const addEsteira = (
  pid: string,
  body: { nome: string; peso_pct: number; pilar?: string | null }
) => apiPost(`/v1/strategies/${pid}/esteira`, body);

export const addAtivoEsteira = (
  pid: string,
  esteiraNome: string,
  body: { ticker: string; tipo?: string; peso_pct: number }
) => apiPost(`/v1/strategies/${pid}/esteira/${esteiraNome}/ativo`, body);

export const removeAtivoEsteira = (pid: string, esteiraNome: string, ticker: string) =>
  apiDelete(`/v1/strategies/${pid}/esteira/${esteiraNome}/ativo/${ticker}`);

// ---- Esteira/Ativo DENTRO de um motor da composição (Portfolio Studio) ----
// Diferente dos 3 acima (que escrevem no campo legado top-level do portfolio),
// estes escrevem dentro de composicao.motores[mid].estrutura — persistência real
// para o que o usuário edita no nível 2/3 do Studio.

export const addEsteiraToMotor = (
  pid: string,
  motorId: string,
  body: { nome: string; peso_pct: number; pilar?: string | null }
) => apiPost<{ esteira: EsteiraNo }>(`/v1/strategies/${pid}/motor/${motorId}/esteira`, body);

export const removeEsteiraFromMotor = (pid: string, motorId: string, esteiraNome: string) =>
  apiDelete<{ ok: boolean }>(`/v1/strategies/${pid}/motor/${motorId}/esteira/${esteiraNome}`);

export const addAtivoToMotorEsteira = (
  pid: string,
  motorId: string,
  esteiraNome: string,
  body: { ticker: string; tipo?: string; peso_pct: number }
) =>
  apiPost<{ ativo: AtivoNo; esteira: EsteiraNo }>(
    `/v1/strategies/${pid}/motor/${motorId}/esteira/${esteiraNome}/ativo`,
    body
  );

export const removeAtivoFromMotorEsteira = (
  pid: string,
  motorId: string,
  esteiraNome: string,
  ticker: string
) =>
  apiDelete<{ ok: boolean }>(
    `/v1/strategies/${pid}/motor/${motorId}/esteira/${esteiraNome}/ativo/${ticker}`
  );

export const patchArenaEsteira = (
  pid: string,
  motorId: string,
  esteiraNome: string,
  body: Arena
) =>
  apiPatch<{ esteira: EsteiraNo }>(
    `/v1/strategies/${pid}/motor/${motorId}/esteira/${esteiraNome}/arena`,
    body
  );

// ============================================================
// Diff
// ============================================================

export interface Diff {
  motoresAdded: MotorNoPortfolio[];
  motoresRemoved: MotorNoPortfolio[];
  motoresChanged: { id: string; nome: string; changes: string[] }[];
  regrasAdded: Regra[];
  regrasRemoved: Regra[];
  perfisChanged: { id: string; nome: string; from: Partial<Perfil>; to: Partial<Perfil> }[];
  perfilAtivoChanged?: { from: string | null; to: string | null };
}

function isEmptyDiffInternal(d: Diff): boolean {
  return (
    d.motoresAdded.length === 0 &&
    d.motoresRemoved.length === 0 &&
    d.motoresChanged.length === 0 &&
    d.regrasAdded.length === 0 &&
    d.regrasRemoved.length === 0 &&
    d.perfisChanged.length === 0 &&
    !d.perfilAtivoChanged
  );
}

export function isEmptyDiff(d: Diff): boolean {
  return isEmptyDiffInternal(d);
}

export function computeDiff(before: Composicao, after: Composicao): Diff {
  const beforeMotores = new Map(before.motores.map((m) => [m.id, m]));
  const afterMotores = new Map(after.motores.map((m) => [m.id, m]));

  const motoresAdded = after.motores.filter((m) => !beforeMotores.has(m.id));
  const motoresRemoved = before.motores.filter((m) => !afterMotores.has(m.id));
  const motoresChanged: Diff["motoresChanged"] = [];

  for (const [id, am] of afterMotores) {
    const bm = beforeMotores.get(id);
    if (!bm) continue;
    const changes: string[] = [];
    if (bm.tipo !== am.tipo) changes.push("tipo");
    if (bm.peso.modo !== am.peso.modo) changes.push("peso.modo");
    if (bm.peso.valor !== am.peso.valor) changes.push("peso.valor");
    if (bm.peso.regra_id !== am.peso.regra_id) changes.push("peso.regra_id");
    if (changes.length > 0) {
      motoresChanged.push({ id, nome: am.nome, changes });
    }
  }

  const beforeRegras = new Map(before.regras.map((r) => [r.id, r]));
  const afterRegras = new Map(after.regras.map((r) => [r.id, r]));
  const regrasAdded = after.regras.filter((r) => !beforeRegras.has(r.id));
  const regrasRemoved = before.regras.filter((r) => !afterRegras.has(r.id));

  const beforePerfis = new Map(before.perfis.map((p) => [p.id, p]));
  const afterPerfis = new Map(after.perfis.map((p) => [p.id, p]));
  const perfisChanged: Diff["perfisChanged"] = [];

  for (const [id, ap] of afterPerfis) {
    const bp = beforePerfis.get(id);
    if (!bp) continue;
    const from: Partial<Perfil> = {};
    const to: Partial<Perfil> = {};
    if (bp.w_min !== ap.w_min) {
      from.w_min = bp.w_min;
      to.w_min = ap.w_min;
    }
    if (bp.w_max !== ap.w_max) {
      from.w_max = bp.w_max;
      to.w_max = ap.w_max;
    }
    if (Object.keys(to).length > 0) {
      perfisChanged.push({ id, nome: ap.nome, from, to });
    }
  }

  let perfilAtivoChanged: Diff["perfilAtivoChanged"];
  const beforeAtivoId = before.perfil_ativo?.id ?? null;
  const afterAtivoId = after.perfil_ativo?.id ?? null;
  if (beforeAtivoId !== afterAtivoId) {
    perfilAtivoChanged = { from: beforeAtivoId, to: afterAtivoId };
  }

  return {
    motoresAdded,
    motoresRemoved,
    motoresChanged,
    regrasAdded,
    regrasRemoved,
    perfisChanged,
    perfilAtivoChanged,
  };
}

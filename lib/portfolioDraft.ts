// ============================================================
// PORTFOLIO STUDIO v2 — draft store (useReducer)
// Local in-memory editing. "Save" syncs with the API via diff.
// ============================================================
import type {
  Composicao,
  MotorNoPortfolio,
  Regra,
  Perfil,
  EsteiraNo,
  AtivoNo,
  PesoConfig,
  Arena,
} from "./portfolioComposicao";

export type DraftAction =
  | { type: "LOAD"; composicao: Composicao }
  | { type: "ADD_MOTOR"; motor: MotorNoPortfolio }
  | { type: "REMOVE_MOTOR"; motor_id: string }
  | { type: "UPDATE_MOTOR_PESO"; motor_id: string; peso: PesoConfig }
  | { type: "ADD_REGRA"; regra: Regra }
  | { type: "REMOVE_REGRA"; regra_id: string }
  | { type: "PATCH_PERFIL"; perfil_id: string; patch: Partial<Perfil> }
  | { type: "ACTIVATE_PERFIL"; perfil_id: string }
  | { type: "ADD_ESTEIRA"; motor_id: string; pilar: string | null; esteira: EsteiraNo }
  | { type: "REMOVE_ESTEIRA"; motor_id: string; esteira_nome: string }
  | { type: "ADD_ATIVO"; motor_id: string; esteira_nome: string; ativo: AtivoNo }
  | { type: "REMOVE_ATIVO"; motor_id: string; esteira_nome: string; ticker: string }
  | { type: "PATCH_ARENA"; motor_id: string; esteira_nome: string; arena: Arena };

export const EMPTY_COMPOSICAO: Composicao = {
  portfolio_id: "",
  motores: [],
  regras: [],
  perfis: [],
  adr_travas: [],
  perfil_ativo: null,
};

function hasPilares(estrutura: unknown): estrutura is { pilares: import("./portfolioComposicao").PilarNo[] } {
  return !!estrutura && typeof estrutura === "object" && "pilares" in estrutura;
}

function updateMotorEstrutura(
  motores: MotorNoPortfolio[],
  motorId: string,
  fn: (pilares: import("./portfolioComposicao").PilarNo[]) => import("./portfolioComposicao").PilarNo[]
): MotorNoPortfolio[] {
  return motores.map((m) => {
    if (m.id !== motorId || !hasPilares(m.estrutura)) return m;
    return { ...m, estrutura: { ...m.estrutura, pilares: fn(m.estrutura.pilares) } };
  });
}

export function portfolioDraftReducer(state: Composicao, action: DraftAction): Composicao {
  switch (action.type) {
    case "LOAD":
      return action.composicao;

    case "ADD_MOTOR":
      if (state.motores.some((m) => m.id === action.motor.id)) return state;
      return { ...state, motores: [...state.motores, action.motor] };

    case "REMOVE_MOTOR":
      return {
        ...state,
        motores: state.motores.filter((m) => m.id !== action.motor_id),
        regras: state.regras.filter(
          (r) => r.fonte_sinal !== action.motor_id && !r.alvos.includes(action.motor_id)
        ),
      };

    case "UPDATE_MOTOR_PESO":
      return {
        ...state,
        motores: state.motores.map((m) =>
          m.id === action.motor_id ? { ...m, peso: action.peso } : m
        ),
      };

    case "ADD_REGRA":
      if (state.regras.some((r) => r.id === action.regra.id)) return state;
      return { ...state, regras: [...state.regras, action.regra] };

    case "REMOVE_REGRA":
      return {
        ...state,
        regras: state.regras.filter((r) => r.id !== action.regra_id),
        motores: state.motores.map((m) =>
          m.peso.regra_id === action.regra_id
            ? { ...m, peso: { ...m.peso, regra_id: null } }
            : m
        ),
      };

    case "PATCH_PERFIL":
      return {
        ...state,
        perfis: state.perfis.map((p) =>
          p.id === action.perfil_id ? { ...p, ...action.patch } : p
        ),
        perfil_ativo:
          state.perfil_ativo?.id === action.perfil_id
            ? { ...state.perfil_ativo, ...action.patch }
            : state.perfil_ativo,
      };

    case "ACTIVATE_PERFIL": {
      const perfis = state.perfis.map((p) => ({ ...p, ativo: p.id === action.perfil_id }));
      const perfil_ativo = perfis.find((p) => p.id === action.perfil_id) ?? null;
      return { ...state, perfis, perfil_ativo };
    }

    case "ADD_ESTEIRA": {
      if (action.pilar === null) {
        // standalone "sleeve" — in the MVP we attach it as a single synthetic pillar if one doesn't exist
        return {
          ...state,
          motores: updateMotorEstrutura(state.motores, action.motor_id, (pilares) => {
            const idx = pilares.findIndex((p) => p.nome === "__sem_pilar__");
            if (idx === -1) {
              return [
                ...pilares,
                { nome: "__sem_pilar__", peso_pct: 0, esteiras: [action.esteira] },
              ];
            }
            const novo = [...pilares];
            novo[idx] = { ...novo[idx], esteiras: [...novo[idx].esteiras, action.esteira] };
            return novo;
          }),
        };
      }
      return {
        ...state,
        motores: updateMotorEstrutura(state.motores, action.motor_id, (pilares) => {
          const idx = pilares.findIndex((p) => p.nome === action.pilar);
          if (idx === -1) {
            return [...pilares, { nome: action.pilar!, peso_pct: 0, esteiras: [action.esteira] }];
          }
          const novo = [...pilares];
          novo[idx] = { ...novo[idx], esteiras: [...novo[idx].esteiras, action.esteira] };
          return novo;
        }),
      };
    }

    case "REMOVE_ESTEIRA":
      return {
        ...state,
        motores: updateMotorEstrutura(state.motores, action.motor_id, (pilares) =>
          pilares.map((pil) => ({
            ...pil,
            esteiras: pil.esteiras.filter((est) => est.nome !== action.esteira_nome),
          }))
        ),
      };

    case "ADD_ATIVO":
      return {
        ...state,
        motores: updateMotorEstrutura(state.motores, action.motor_id, (pilares) =>
          pilares.map((pil) => ({
            ...pil,
            esteiras: pil.esteiras.map((est) =>
              est.nome === action.esteira_nome
                ? { ...est, ativos: [...est.ativos, action.ativo] }
                : est
            ),
          }))
        ),
      };

    case "REMOVE_ATIVO":
      return {
        ...state,
        motores: updateMotorEstrutura(state.motores, action.motor_id, (pilares) =>
          pilares.map((pil) => ({
            ...pil,
            esteiras: pil.esteiras.map((est) =>
              est.nome === action.esteira_nome
                ? { ...est, ativos: est.ativos.filter((a) => a.ticker !== action.ticker) }
                : est
            ),
          }))
        ),
      };

    case "PATCH_ARENA":
      return {
        ...state,
        motores: updateMotorEstrutura(state.motores, action.motor_id, (pilares) =>
          pilares.map((pil) => ({
            ...pil,
            esteiras: pil.esteiras.map((est) =>
              est.nome === action.esteira_nome ? { ...est, arena: action.arena } : est
            ),
          }))
        ),
      };

    default:
      return state;
  }
}

// Selo de homologação — a "chave de segurança": nada cru entra na estrada.
// Um único lugar que traduz os status crus do backend (motor.status /
// portfolio.estado) no selo visual 🟢/🟡/🔴 usado em toda a Árvore Viva e no Studio.

export type SeloTone = "homologado" | "candidato" | "nao_testado";

export interface Selo {
  tone: SeloTone;
  emoji: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}

const SELOS: Record<SeloTone, Selo> = {
  homologado: {
    tone: "homologado",
    emoji: "🟢",
    label: "Homologado",
    color: "#2ECC71",
    bg: "rgba(46,204,113,.12)",
    border: "rgba(46,204,113,.35)",
  },
  candidato: {
    tone: "candidato",
    emoji: "🟡",
    label: "Candidato · testando",
    color: "#F39C12",
    bg: "rgba(243,156,18,.12)",
    border: "rgba(243,156,18,.35)",
  },
  nao_testado: {
    tone: "nao_testado",
    emoji: "🔴",
    label: "Não homologado",
    color: "#E74C3C",
    bg: "rgba(231,76,60,.12)",
    border: "rgba(231,76,60,.35)",
  },
};

// status de motor DENTRO de um portfolio (composicao.motores[].status)
export function seloMotor(status: string | null | undefined): Selo {
  if (status === "prod") return SELOS.homologado;
  if (status === "candidate") return SELOS.candidato;
  return SELOS.nao_testado; // "lab" ou ausente
}

// status de motor no CATÁLOGO (/v1/registry/motores[].status)
export function seloMotorCatalogo(status: string | null | undefined): Selo {
  if (status === "homologado") return SELOS.homologado;
  return SELOS.nao_testado; // "lab"
}

// estado de portfolio (PORTFOLIOS[].estado)
export function seloPortfolio(estado: string | null | undefined): Selo {
  if (estado === "live" || estado === "homologado") return SELOS.homologado;
  if (estado === "candidate" || estado === "testando") return SELOS.candidato;
  return SELOS.nao_testado; // "lab"
}

// ETP: listado = elegível/live; candidato = aguardando o portfólio homologar
export function seloEtp(status: string | null | undefined): Selo {
  if (status === "listed") return SELOS.homologado;
  return SELOS.candidato;
}

// Validation badge — the "security key": nothing raw makes it to the road.
// A single place that translates the raw backend statuses (motor.status /
// portfolio.estado) into the visual badge 🟢/🟡/🔴 used throughout the Living Tree and the Studio.

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
    label: "Validated",
    color: "#2ECC71",
    bg: "rgba(46,204,113,.12)",
    border: "rgba(46,204,113,.35)",
  },
  candidato: {
    tone: "candidato",
    emoji: "🟡",
    label: "Candidate · testing",
    color: "#F39C12",
    bg: "rgba(243,156,18,.12)",
    border: "rgba(243,156,18,.35)",
  },
  nao_testado: {
    tone: "nao_testado",
    emoji: "🔴",
    label: "Not validated",
    color: "#E74C3C",
    bg: "rgba(231,76,60,.12)",
    border: "rgba(231,76,60,.35)",
  },
};

// engine status INSIDE a portfolio (composicao.motores[].status)
export function seloMotor(status: string | null | undefined): Selo {
  if (status === "prod") return SELOS.homologado;
  if (status === "candidate") return SELOS.candidato;
  return SELOS.nao_testado; // "lab" or absent
}

// engine status in the CATALOG (/v1/registry/motores[].status)
export function seloMotorCatalogo(status: string | null | undefined): Selo {
  if (status === "homologado") return SELOS.homologado;
  return SELOS.nao_testado; // "lab"
}

// portfolio state (PORTFOLIOS[].estado)
export function seloPortfolio(estado: string | null | undefined): Selo {
  if (estado === "live" || estado === "homologado") return SELOS.homologado;
  if (estado === "candidate" || estado === "testando") return SELOS.candidato;
  return SELOS.nao_testado; // "lab"
}

// ETP: listed = eligible/live; candidate = waiting on the portfolio to be validated
export function seloEtp(status: string | null | undefined): Selo {
  if (status === "listed") return SELOS.homologado;
  return SELOS.candidato;
}

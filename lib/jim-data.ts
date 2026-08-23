// ============================================================
// JIM — Barramento de dados da tela (o que o JIM ENXERGA)
// ============================================================

export interface ScreenExtra {
  briefing?: string;
  suggestions?: string[];
}

export interface ScreenSnapshot extends ScreenExtra {
  screen: string;
  summary: string;
  rows: unknown;
  capturedAt: number;
}

const store: Record<string, ScreenSnapshot> = {};
type Listener = (s: ScreenSnapshot) => void;
const listeners = new Set<Listener>();

export function publishScreenData(
  screen: string,
  summary: string,
  rows: unknown,
  extra?: ScreenExtra
): void {
  const snap: ScreenSnapshot = {
    screen,
    summary,
    rows,
    briefing: extra?.briefing,
    suggestions: extra?.suggestions,
    capturedAt: Date.now(),
  };
  store[screen] = snap;
  listeners.forEach((fn) => fn(snap));
}

export function readScreenData(screen: string): ScreenSnapshot | null {
  return store[screen] || null;
}

export function subscribeScreenData(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// ABERTURA DO JIM A PARTIR DA TELA
//
// O estado `jimOpen` vive no Cockpit, acima de todas as telas. Uma tela que
// queira abrir a gaveta (por exemplo o botao J de uma empresa) teria de receber
// o setter via prop, e o setter atravessaria todas as telas so para servir uma.
// O barramento ja existe para o dado; a abertura anda junto com ele.
//
// Ordem importa: publique o snapshot ANTES de pedir a abertura, senao a gaveta
// abre lendo o snapshot anterior e explica a empresa errada.
// ---------------------------------------------------------------------------
type PedidoListener = () => void;
const pedidos = new Set<PedidoListener>();

export function requestJim(): void {
  pedidos.forEach((fn) => fn());
}
export function onJimRequest(fn: PedidoListener): () => void {
  pedidos.add(fn);
  return () => { pedidos.delete(fn); };
}

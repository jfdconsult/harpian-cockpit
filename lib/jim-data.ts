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

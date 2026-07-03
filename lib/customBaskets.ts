// ============================================================
// Custom baskets (setores e estratégias criados pelo gestor)
// Salvos em localStorage — v1. Backend depois.
// ============================================================
export interface CustomBasket {
  id: string;              // uuid local
  kind: "sector" | "strategy";
  label: string;           // nome dado pelo gestor
  tickers: string[];       // lista de tickers
  created_at: string;
}

const KEY = "harpian.custom_baskets.v1";

export function loadBaskets(kind?: "sector" | "strategy"): CustomBasket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const all: CustomBasket[] = raw ? JSON.parse(raw) : [];
    return kind ? all.filter((b) => b.kind === kind) : all;
  } catch {
    return [];
  }
}

export function saveBasket(b: Omit<CustomBasket, "id" | "created_at">): CustomBasket {
  const all = loadBaskets();
  const nb: CustomBasket = {
    ...b,
    id: `${b.kind}_${Date.now().toString(36)}`,
    created_at: new Date().toISOString(),
  };
  all.push(nb);
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return nb;
}

export function deleteBasket(id: string): void {
  const all = loadBaskets().filter((b) => b.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

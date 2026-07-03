// ============================================================
// HARPIAN COCKPIT — Cliente da API HQP (/v1)
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_HQP_API_URL || "http://localhost:8080";

const HEADERS = {
  "X-User-Role": "socio_gestor",
  "X-User-Name": "João Daniel",
};

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function fmtUSD(n: number): string {
  return "US$ " + (n / 1e6).toFixed(1).replace(".", ",") + "M";
}

export function semColor(regime: string): "g" | "a" | "r" | "b" {
  if (regime === "RISK-ON") return "g";
  if (regime === "WARNING") return "a";
  if (regime === "RISK-OFF") return "r";
  return "b";
}

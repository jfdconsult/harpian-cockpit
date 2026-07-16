// ============================================================
// HARPIAN COCKPIT — HQP API client (/v1)
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_HQP_API_URL || "http://localhost:8080";

const HEADERS = {
  "X-User-Role": "socio_gestor",
  "X-User-Name": "João Daniel",
};

async function parseBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseBody<T>(res);
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseBody<T>(res);
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseBody<T>(res);
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parseBody<T>(res);
}

export function fmtUSD(n: number): string {
  return "$" + (n / 1e6).toFixed(1) + "M";
}

export function semColor(regime: string): "g" | "a" | "r" | "b" {
  if (regime === "RISK-ON") return "g";
  if (regime === "WARNING") return "a";
  if (regime === "RISK-OFF") return "r";
  return "b";
}

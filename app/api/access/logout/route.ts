import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/access";

/**
 * POST /api/access/logout
 *
 * Limpa o cookie de acesso ao Terminal.
 * Idempotente: retorna sempre 200 { ok: true }.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  console.info(
    JSON.stringify({
      event: "cockpit_access.logout",
      ip,
      timestamp: new Date().toISOString(),
    })
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE_SECONDS,
  getPasswordHash,
  isEmailAllowed,
} from "@/lib/access";

/**
 * POST /api/access/login
 *
 * Body: { email: string, password: string }
 *
 * Fluxo:
 * 1. Valida email contra allowlist
 * 2. Valida senha contra hash bcrypt
 * 3. Emite JWT curto (email + iat + exp)
 * 4. Set-Cookie httpOnly, secure, sameSite=strict
 * 5. Log audit (server-side console): timestamp, email, ip, user-agent
 *
 * Retorna 200 { ok: true } se autenticado, 401 caso contrario.
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email : "";
  const rawPassword = typeof body.password === "string" ? body.password : "";

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ua = request.headers.get("user-agent") || "unknown";

  const emailOk = email !== "" && isEmailAllowed(email);

  // Constant-time-ish: sempre executa bcrypt.compare, mesmo se email invalido,
  // para evitar timing oracle que revele a existencia do email.
  const passwordHash = getPasswordHash();
  let passwordOk = false;
  try {
    passwordOk = await bcrypt.compare(password, passwordHash);
  } catch {
    passwordOk = false;
  }

  if (!emailOk || !passwordOk) {
    console.warn(
      JSON.stringify({
        event: "cockpit_access.login_denied",
        email: email || "(empty)",
        emailAllowed: emailOk,
        passwordProvided: password !== "",
        ip,
        ua,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      })
    );
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error(
      JSON.stringify({
        event: "cockpit_access.error",
        reason: "jwt_secret_missing",
        timestamp: new Date().toISOString(),
      })
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  const token = await new SignJWT({ sub: email, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));

  console.info(
    JSON.stringify({
      event: "cockpit_access.login_granted",
      email,
      ip,
      ua,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    })
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });

  return response;
}

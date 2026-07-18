import { NextRequest, NextResponse } from "next/server";

// Gates every request behind HTTP Basic Auth. The Cockpit is internal-only —
// real partner account data and unrestricted model internals (turbulence,
// absorption ratio, overlay weights) live behind this screen. Credentials
// come from Vercel env vars (COCKPIT_AUTH_USER / COCKPIT_AUTH_PASS), never
// hardcoded here.

// Constant-time string compare: falso == verdadeiro leva o mesmo tempo,
// bloqueando timing attacks byte-por-byte contra a senha.
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  const len = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

function decodeBasic(encoded: string): [string, string] | null {
  try {
    const raw = atob(encoded);
    const i = raw.indexOf(":");
    if (i < 0) return null;
    return [raw.slice(0, i), raw.slice(i + 1)];
  } catch {
    return null;
  }
}

function unauthorized(): NextResponse {
  const res = new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Harpian Cockpit"',
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
    },
  });
  return res;
}

export function middleware(req: NextRequest) {
  const user = process.env.COCKPIT_AUTH_USER;
  const pass = process.env.COCKPIT_AUTH_PASS;
  if (!user || !pass) return NextResponse.next(); // no creds configured (e.g. local dev) → open

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const creds = decodeBasic(encoded);
      if (creds) {
        const [u, p] = creds;
        // sempre roda os DOIS compares (nao usa &&) pra manter o tempo constante
        const userOk = safeEqual(u, user);
        const passOk = safeEqual(p, pass);
        if (userOk && passOk) {
          const res = NextResponse.next();
          res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
          res.headers.set("X-Content-Type-Options", "nosniff");
          res.headers.set("X-Frame-Options", "DENY");
          res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
          return res;
        }
      }
    }
  }

  return unauthorized();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

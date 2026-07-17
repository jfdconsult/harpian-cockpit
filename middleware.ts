import { NextRequest, NextResponse } from "next/server";

// Gates every request behind HTTP Basic Auth. The Cockpit is internal-only —
// real partner account data and unrestricted model internals (turbulence,
// absorption ratio, overlay weights) live behind this screen. Credentials
// come from Vercel env vars (COCKPIT_AUTH_USER / COCKPIT_AUTH_PASS), never
// hardcoded here.
export function middleware(req: NextRequest) {
  const user = process.env.COCKPIT_AUTH_USER;
  const pass = process.env.COCKPIT_AUTH_PASS;
  if (!user || !pass) return NextResponse.next(); // no creds configured (e.g. local dev) → open

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const [u, p] = atob(encoded).split(":");
      if (u === user && p === pass) return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Harpian Cockpit"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE } from "@/lib/access";

// ============================================================
// Gate do Cockpit — email + senha (JWT cookie)
// ============================================================
// Substitui o HTTP Basic Auth anterior (COCKPIT_AUTH_USER/PASS) pelo mesmo
// mecanismo da apresentacao institucional e do Terminal: tela de login
// propria, allowlist de emails + senha compartilhada + sessao JWT.
//
// /ato4 fica FORA do gate — e o entry-point publico que a apresentacao
// (Ato IV · Portfolio Builder) usa. Cliente que vem do Ato III cai direto no
// Builder sem prompt de senha. O cockpit interno (rota /) permanece protegido.
//
// APIs de catalogo publico tambem excluidas: strategy-catalog, benchmark-sets,
// strategy-series — sao dados que o Builder consome pra popular listas, sem
// secrets. Sem essa exclusao, cada fetch de dentro de /ato4 cairia no gate (a
// pagina era publica, mas o fetch de /api/strategy-catalog batia no
// middleware protegido).
//
// Outras APIs (/api/jim-report, /api/*-admin, etc.) continuam protegidas.

const PUBLIC_PREFIXES = ["/ato4", "/api/strategy-catalog", "/api/benchmark-sets", "/api/strategy-series", "/api/probabilidade"];
const ACCESS_PUBLIC_PATHS = new Set<string>(["/login"]);

function isPublicPath(pathname: string): boolean {
  if (ACCESS_PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/access/")) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin(req: NextRequest): NextResponse {
  const loginUrl = new URL("/login", req.url);
  const originalPath = req.nextUrl.pathname + req.nextUrl.search;
  if (originalPath && originalPath !== "/login") {
    loginUrl.searchParams.set("next", originalPath);
  }
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const ok = await isAuthenticated(req);
  if (!ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    return redirectToLogin(req);
  }

  const res = NextResponse.next();
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

// Roda em tudo (paginas + APIs) exceto assets estaticos — a exclusao fina de
// /ato4 e das 3 APIs publicas fica em isPublicPath(), verificada dentro da
// funcao (mais legivel que empilhar tudo no regex do matcher).
//
// A lista de extensoes (png/svg/etc.) e necessaria porque arquivos em
// /public nao caem sob _next/static — sem ela, um asset como o logo do
// /login ficava atras do gate e nunca carregava pra quem nao tem cookie
// ainda (exatamente quem esta olhando a tela de login).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)",
  ],
};

"use client";

/**
 * Rota ISOLADA do Ato IV (Portfolio Builder) para a apresentacao publica.
 *
 * Diferencas vs a rota / do cockpit:
 *  - Nao renderiza o shell/menu do cockpit (so o PortfolioBuilder puro).
 *  - Renderiza o CABECALHO INSTITUCIONAL da apresentacao (logo + nav dos
 *    5 atos), pra manter a continuidade visual quando o cliente vem do
 *    Ato III. Assets carregados da apresentacao (harpian-front) via URL
 *    absoluta pra evitar duplicacao.
 *  - Nao passa pelo Basic Auth (middleware.ts exclui /ato4 do matcher).
 *  - Fica em dominio publico: o cliente que vem da apresentacao chega
 *    direto sem prompt de senha.
 *
 * Isolamento de dados: o cockpit interno usa o mesmo componente na rota /,
 * mas eventuais persistencias/estudos sao coisas separadas — a apresentacao
 * usa a ferramenta ao vivo com o cliente, o cockpit usa pra estudo interno.
 * Nao ha sincronizacao entre os dois contextos.
 */
import PortfolioBuilder from "@/components/screens/PortfolioBuilder";

const PRES = "https://harpian-front.vercel.app/presentation";
const ACTS = [
  { n: "I",   label: "Arquitetura",       href: `${PRES}/parceria.html` },
  { n: "II",  label: "Perfil & Mandato",  href: `${PRES}/puzzle-core11.html` },
  { n: "III", label: "Nosso Método",      href: `${PRES}/doutrina.html` },
  { n: "IV",  label: "Portfolio Builder", href: "/ato4" },
  { n: "V",   label: "Terminal",          href: "/" },
];
const CURRENT = 4;

export default function Ato4Page() {
  return (
    <div style={{ minHeight: "100vh", background: "#0B1626", color: "#F5EFE0", position: "relative" }}>
      {/* Cabecalho institucional — logo top-left */}
      <div style={{ position: "fixed", top: 14, left: 24, zIndex: 200, pointerEvents: "auto" }}>
        <img
          src={`${PRES}/assets/harpian-logo.svg`}
          alt="Harpian"
          style={{ height: 22, width: "auto", opacity: 0.95, display: "block" }}
        />
      </div>

      {/* Cabecalho institucional — nav dos 5 atos (mesmo componente da apresentacao) */}
      <nav
        aria-label="Ato atual da apresentacao"
        style={{
          position: "fixed",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 200,
          display: "flex",
          gap: 8,
          background: "rgba(11,22,38,0.55)",
          backdropFilter: "blur(10px)",
          padding: "8px 14px",
          borderRadius: 24,
          border: "1px solid rgba(184,144,47,0.22)",
          fontFamily: "'JetBrains Mono',ui-monospace,monospace",
          fontSize: 9.5,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          userSelect: "none",
          whiteSpace: "nowrap",
          maxWidth: "calc(100vw - 40px)",
          overflow: "hidden",
        }}
      >
        {ACTS.map((a, i) => {
          const isCurrent = i + 1 === CURRENT;
          const isDone = i + 1 < CURRENT;
          return (
            <a
              key={a.n}
              href={a.href}
              title={`Ato ${a.n} · ${a.label}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: isCurrent ? "#F0D27A" : isDone ? "rgba(224,203,154,0.75)" : "rgba(245,239,224,0.42)",
                padding: "2px 6px",
                borderRadius: 12,
                textDecoration: "none",
                whiteSpace: "nowrap",
                fontWeight: isCurrent ? 700 : 400,
                flex: "0 0 auto",
              }}
            >
              <span
                style={{
                  width: isCurrent ? 22 : 6,
                  height: 6,
                  borderRadius: isCurrent ? 3 : "50%",
                  background: isCurrent
                    ? "linear-gradient(180deg,#F0D27A,#D4AF45)"
                    : isDone
                    ? "#B89554"
                    : "rgba(245,239,224,0.22)",
                  boxShadow: isCurrent ? "0 0 8px rgba(212,175,69,0.7)" : "none",
                  flex: "0 0 auto",
                }}
              />
              <span style={{ fontWeight: 800 }}>{a.n}</span>
              {isCurrent && <span>· {a.label}</span>}
            </a>
          );
        })}
      </nav>

      {/* PortfolioBuilder — offset pra nao ficar coberto pelo header.
          --pb-sticky-top: onde a regua de KPIs gruda ao rolar (logo top:14
          + nav ~35px = 49px, arredondando pra 52). O overflow:visible
          no body destrava o position:sticky (globals.css do cockpit usa
          overflow-x:hidden no body, que por sua vez transforma overflow-y
          em auto e mata o sticky). Escopo local: so nesta rota. */}
      <style jsx global>{`html, body { overflow: visible !important; }`}</style>
      <div style={{ paddingTop: 60, ["--pb-sticky-top" as unknown as string]: "52px" } as React.CSSProperties}>
        <PortfolioBuilder />
      </div>
    </div>
  );
}

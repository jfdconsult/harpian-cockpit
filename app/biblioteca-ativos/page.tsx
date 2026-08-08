"use client";

/**
 * Biblioteca de Ativos — pagina de consulta pro gestor.
 *
 * Contexto: cliente perguntou "que ativos estao dentro dessa estrategia?".
 * Aqui listamos, agrupados por setor (11 setores GICS) e por tema de ETF
 * (Bonds, Big Tech, Cripto, Alternativas etc.), o UNIVERSO COMPLETO de
 * tickers que cada estrategia pode alocar — inclusive os que nunca foram
 * alocados. Cada ticker vira link pro Yahoo Finance.
 *
 * NAO mostra: pesos, algoritmo de rotacao, gatilho de defesa. So o universo.
 * Isso e o que da pra abrir sem soltar o metodo.
 */

import { useEffect, useMemo, useState } from "react";

interface Estrategia {
  id: string;
  label: string;
  nome: string;
  grupo: "etf" | "acoes" | "outras";
  sub: string;
  universo: string[];
}

const SECTOR_NAMES: Record<string, string> = {
  TE: "Technology", CO: "Communications", CD: "Consumer Discretionary",
  CS: "Consumer Staples", FI: "Financials", HE: "Health Care",
  IN: "Industrials", MA: "Materials", RE: "Real Estate",
  EN: "Energy", UT: "Utilities",
};

// Ordem GICS canonica (Technology primeiro, Utilities por ultimo)
const SECTOR_ORDER = ["TE", "HE", "FI", "CD", "IN", "CO", "CS", "EN", "UT", "RE", "MA"];

function limpaTicker(t: string): string {
  // 'TLT-', 'GLD-' etc. — o dash e artifact do dataset
  return t.replace(/[- ]+$/, "").trim();
}

const HREF_TICKER = (t: string) =>
  `https://finance.yahoo.com/quote/${encodeURIComponent(limpaTicker(t))}`;

const PRES = "/presentation";
const ACTS = [
  { n: "I",   label: "Arquitetura",       href: `${PRES}/parceria.html` },
  { n: "II",  label: "Perfil & Mandato",  href: `${PRES}/puzzle-core11.html` },
  { n: "III", label: "Nosso Método",      href: `${PRES}/doutrina.html` },
  { n: "IV",  label: "Portfolio Builder", href: `${PRES}/portfolio-builder` },
  { n: "V",   label: "Terminal",          href: `${PRES}/atos.html?next=5` },
];
const CURRENT = 4;

export default function BibliotecaAtivosPage() {
  const [strats, setStrats] = useState<Estrategia[] | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/strategy-catalog")
      .then((r) => r.json())
      .then((d) => setStrats(d?.estrategias ?? d ?? []))
      .catch(() => setStrats([]));
  }, []);

  const setores = useMemo(() => {
    if (!strats) return [];
    // Agrupa acoes setoriais por sub (ex.: 'Technology') mesclando o universo
    // de ACT1 e ACT2 num universo unico por setor.
    const map: Record<string, { key: string; nome: string; universo: Set<string>; estrategias: string[] }> = {};
    for (const s of strats) {
      if (s.grupo !== "acoes") continue;
      const sub = s.sub || "?";
      // Deriva o codigo do setor do id (C22ACT[12]<COD>)
      const m = /C22ACT[12]([A-Z]+)/.exec(s.id + " " + s.label);
      const cod = m ? m[1] : "?";
      if (!map[cod]) map[cod] = { key: cod, nome: SECTOR_NAMES[cod] || sub, universo: new Set(), estrategias: [] };
      map[cod].estrategias.push(s.label);
      (s.universo || []).forEach((t) => map[cod].universo.add(limpaTicker(t)));
    }
    const rank = (k: string) => {
      const i = SECTOR_ORDER.indexOf(k);
      return i < 0 ? 99 : i;
    };
    return Object.values(map).sort((a, b) => rank(a.key) - rank(b.key));
  }, [strats]);

  const etfs = useMemo(() => {
    if (!strats) return [];
    // ETFs: cada um e um card. Nome legivel via label + sub.
    return strats
      .filter((s) => s.grupo === "etf")
      .map((s) => {
        // Trata a marca 'XX ' e '!' que aparecem em alguns labels
        const nome = (s.label || s.nome || "")
          .replace(/^XX\s+/, "")
          .replace(/^!/, "")
          .trim();
        return { id: s.id, nome, sub: s.sub, universo: (s.universo || []).map(limpaTicker) };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [strats]);

  const toggle = (k: string) => setAbertos((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0B1626", color: "#F5EFE0", position: "relative" }}>
      {/* Cabecalho institucional — igual ao portfolio-builder */}
      <div style={{ position: "fixed", top: 14, left: 24, zIndex: 200 }}>
        <img src="/presentation/assets/harpian-logo.svg" alt="Harpian"
          style={{ height: 22, width: "auto", opacity: 0.95, display: "block" }} />
      </div>
      <nav aria-label="Ato atual da apresentacao" style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 200,
        display: "flex", gap: 8, background: "rgba(11,22,38,0.55)", backdropFilter: "blur(10px)",
        padding: "8px 14px", borderRadius: 24, border: "1px solid rgba(184,144,47,0.22)",
        fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 9.5, letterSpacing: ".14em",
        textTransform: "uppercase", userSelect: "none", whiteSpace: "nowrap",
      }}>
        {ACTS.map((a, i) => {
          const isCurrent = i + 1 === CURRENT;
          const isDone = i + 1 < CURRENT;
          return (
            <a key={a.n} href={a.href} title={`Ato ${a.n} · ${a.label}`} style={{
              display: "flex", alignItems: "center", gap: 6,
              color: isCurrent ? "#F0D27A" : isDone ? "rgba(224,203,154,0.75)" : "rgba(245,239,224,0.42)",
              padding: "2px 6px", borderRadius: 12, textDecoration: "none", whiteSpace: "nowrap",
              fontWeight: isCurrent ? 700 : 400, flex: "0 0 auto",
            }}>
              <span style={{
                width: isCurrent ? 22 : 6, height: 6, borderRadius: isCurrent ? 3 : "50%",
                background: isCurrent ? "linear-gradient(180deg,#F0D27A,#D4AF45)"
                  : isDone ? "#B89554" : "rgba(245,239,224,0.22)",
                boxShadow: isCurrent ? "0 0 8px rgba(212,175,69,0.7)" : "none",
              }} />
              <span style={{ fontWeight: 800 }}>{a.n}</span>
              {isCurrent && <span>· {a.label}</span>}
            </a>
          );
        })}
      </nav>

      {/* Corpo */}
      <div style={{ paddingTop: 70, paddingBottom: 60, maxWidth: 1200, margin: "0 auto", padding: "70px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 26, letterSpacing: "-.01em" }}>Biblioteca de Ativos</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "rgba(245,239,224,0.65)", lineHeight: 1.55 }}>
              Universo completo de cada estratégia AlphaDroid — todos os tickers que podem ser alocados,
              inclusive os que nunca foram. Consulta pra gestor entender <em>o que está dentro</em>, sem revelar o algoritmo.
            </p>
          </div>
          <a href="/presentation/portfolio-builder" style={{
            fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 11, letterSpacing: ".08em",
            textTransform: "uppercase", color: "#C9A02C", textDecoration: "none",
            padding: "8px 14px", border: "1px solid rgba(201,160,44,0.4)", borderRadius: 5,
          }}>← voltar ao Portfolio Builder</a>
        </div>

        {!strats && <p style={{ color: "rgba(245,239,224,0.5)" }}>Carregando catálogo…</p>}

        {strats && (
          <>
            {/* AÇÕES SETORIAIS */}
            <Secao titulo="Ações setoriais" subtitulo="11 setores GICS · cada setor tem 2 estratégias (ACT1 + ACT2) mescladas aqui num universo único">
              {setores.map((s) => (
                <Card
                  key={s.key}
                  titulo={s.nome}
                  sub={`${s.estrategias.length} estratégia${s.estrategias.length > 1 ? "s" : ""} · ${s.universo.size} ticker${s.universo.size > 1 ? "s" : ""}`}
                  aberto={abertos.has("s:" + s.key)}
                  onToggle={() => toggle("s:" + s.key)}
                >
                  <Tickers items={[...s.universo].sort()} />
                </Card>
              ))}
            </Secao>

            {/* ETFs MACRO */}
            <Secao titulo="ETFs Macro" subtitulo="Blocos temáticos — bonds, alternativas, big tech, cripto, países desenvolvidos, mercados emergentes etc.">
              {etfs.map((e) => (
                <Card
                  key={e.id}
                  titulo={e.nome}
                  sub={`${e.sub} · ${e.universo.length} ticker${e.universo.length > 1 ? "s" : ""}`}
                  aberto={abertos.has("e:" + e.id)}
                  onToggle={() => toggle("e:" + e.id)}
                >
                  <Tickers items={e.universo} />
                </Card>
              ))}
            </Secao>

            <p style={{ marginTop: 32, fontSize: 11.5, color: "rgba(245,239,224,0.4)", textAlign: "center" }}>
              Cliques nos tickers abrem no Yahoo Finance. Dados de universo baseados nos exports oficiais da AlphaDroid.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(201,160,44,0.25)" }}>
        <h2 style={{ margin: 0, fontSize: 15, letterSpacing: ".14em", textTransform: "uppercase", color: "#C9A02C",
          fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>{titulo}</h2>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(245,239,224,0.55)" }}>{subtitulo}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function Card({ titulo, sub, aberto, onToggle, children }: {
  titulo: string; sub: string; aberto: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(15,39,71,0.6)", border: "1px solid " + (aberto ? "rgba(201,160,44,0.5)" : "rgba(29,58,95,0.7)"),
      borderRadius: 8, overflow: "hidden", transition: "border-color .18s",
    }}>
      <button onClick={onToggle} type="button" style={{
        width: "100%", padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10, textAlign: "left", color: "inherit", font: "inherit",
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 3, background: aberto ? "#C9A02C" : "rgba(122,144,174,0.25)",
          color: aberto ? "#0B1626" : "#7d96b3", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>{aberto ? "−" : "+"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#F5EFE0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(245,239,224,0.5)",
            marginTop: 2, fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>{sub}</span>
        </span>
      </button>
      {aberto && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

function Tickers({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((t) => (
        <a key={t} href={HREF_TICKER(t)} target="_blank" rel="noopener noreferrer"
          title={`Abrir ${t} no Yahoo Finance`}
          style={{
            fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 11.5,
            padding: "4px 10px", borderRadius: 4,
            background: t === "BMS" ? "rgba(46,204,113,0.12)" : "rgba(201,160,44,0.10)",
            border: "1px solid " + (t === "BMS" ? "rgba(46,204,113,0.35)" : "rgba(201,160,44,0.28)"),
            color: t === "BMS" ? "#5FB98C" : "#E0CB9A",
            textDecoration: "none", transition: "background .15s, transform .1s",
          }}
        >{t}</a>
      ))}
    </div>
  );
}

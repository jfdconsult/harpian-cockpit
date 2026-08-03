"use client";

/**
 * Relatório imprimível do PortfolioBuilder.
 *
 * Renderiza uma view print-friendly com:
 *  - Header: logo Harpian + data/hora + autor + cliente
 *  - Grid de KPIs (todos os 10 que aparecem na tela)
 *  - Gráfico do capital (curva + benchmark + faixa de defesa)
 *  - Composição do portfólio (sleeves + pesos)
 *  - Análise JIM AI (chamada em tempo real via /api/jim-report)
 *
 * O componente fica escondido em @media screen (via classe .print-only-container)
 * e ocupa o body inteiro em @media print. Cliente aciona pelo botão do topo do
 * builder, que abre modal com autor/cliente e depois chama window.print().
 */

import { useEffect, useMemo, useState } from "react";
import type { SimResult, Sleeve, StrategyMeta } from "@/lib/portfolio-builder/types";
import type { SetDef } from "@/lib/portfolio-builder/benchmark-sets";

const MONO = "var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)";

const brDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const pct = (n: number, d = 1) => (n == null || isNaN(n) ? "—" : `${(n * 100).toFixed(d)}%`);
const money = (n: number) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
};

interface KPI { k: string; v: string; tom?: "pos" | "neg" }
interface ReportData {
  autor: string;
  cliente: string;
  sim: SimResult;
  sleeves: Sleeve[];
  meta: Record<string, StrategyMeta>;
  nomeCurto: (m: StrategyMeta) => string;
  kpis: KPI[];
  set?: SetDef | null;
  mode: "linear" | "dynamic";
  rebalance: string;
  capital: number;
  janelaLabel: string;
  onClose?: () => void;
  /** JSX ja pronto do gráfico do capital — vem do PortfolioBuilder */
  curvaCapitalEl: React.ReactNode;
  /** JSX ja pronto da faixa de defesa */
  faixaDefesaEl: React.ReactNode;
}

export default function ReportPrint(props: ReportData) {
  const { autor, cliente, sim, sleeves, meta, nomeCurto, kpis, set, mode, rebalance, capital, janelaLabel, curvaCapitalEl, faixaDefesaEl } = props;

  const [analise, setAnalise] = useState<string | null>(null);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(true);
  const [baixando, setBaixando] = useState(false);

  // Dispara Claude Haiku ao montar. Análise do "JIM AI" — 3-4 parágrafos.
  useEffect(() => {
    setCarregandoAnalise(true);
    fetch("/api/jim-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente, autor,
        setNome: set?.nome ?? null,
        setTese: set?.tese ?? null,
        mode, rebalance, capital, janela: janelaLabel,
        kpis,
        composicao: sleeves.map((s) => ({
          id: s.id,
          nome: meta[s.id] ? nomeCurto(meta[s.id]) : s.id,
          peso: s.weight,
        })),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.analise) setAnalise(d.analise);
        else setErroAnalise(d.error || "JIM AI não respondeu");
      })
      .catch((e) => setErroAnalise(String(e)))
      .finally(() => setCarregandoAnalise(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agora = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yy} · ${hh}:${mi}`;
  }, []);

  const dateRange = `${brDate(sim.dates[0])} → ${brDate(sim.dates[sim.dates.length - 1])} · ${sim.dates.length.toLocaleString("pt-BR")} pregões`;

  return (
    <div className="print-only-container" style={{
      position: "fixed", inset: 0, zIndex: 9999, overflow: "auto",
      background: "#fff", color: "#111",
    }}>
      {/* Toolbar de tela — some no print */}
      <div className="print-hide" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#0b1220", color: "#eee", padding: "10px 20px",
        borderBottom: "1px solid #333",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12 }}>
          Pré-visualização do relatório · {cliente || "Cliente"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={async () => {
            // Download PDF de verdade: html2pdf.js pega o .print-page e gera arquivo binário.
            // Fallback: se der erro, aciona window.print() (Ctrl+P nativo).
            setBaixando(true);
            try {
              const html2pdf = (await import("html2pdf.js")).default;
              const el = document.querySelector(".print-page") as HTMLElement | null;
              if (!el) throw new Error("Página não encontrada");
              const nomeArq = `Harpian_${(cliente || "Portfolio").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
              await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: nomeArq,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                pagebreak: { mode: ["css", "legacy"] },
              }).from(el).save();
            } catch (err) {
              console.warn("html2pdf falhou, usando print nativo:", err);
              window.print();
            } finally {
              setBaixando(false);
            }
          }} disabled={baixando} style={{
            padding: "7px 14px", background: "#c9a02c", color: "#0b1220",
            border: "none", borderRadius: 5, cursor: baixando ? "wait" : "pointer", fontWeight: 700,
            fontFamily: "inherit", fontSize: 13, opacity: baixando ? 0.6 : 1,
          }}>{baixando ? "Gerando PDF…" : "⬇️ Baixar PDF"}</button>
          <button onClick={() => window.print()} style={{
            padding: "7px 14px", background: "transparent", color: "#eee",
            border: "1px solid #444", borderRadius: 5, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
          }}>🖨️ Imprimir</button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Relatório Harpian · ${cliente || "portfólio"}\nGerado em ${agora}\n\nSalve o PDF e anexe aqui na próxima mensagem.`)}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              padding: "7px 14px", background: "#25D366", color: "#fff",
              border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700,
              fontFamily: "inherit", fontSize: 13, textDecoration: "none",
            }}
          >💬 WhatsApp</a>
          {props.onClose && (
            <button onClick={props.onClose} style={{
              padding: "7px 14px", background: "transparent", color: "#eee",
              border: "1px solid #444", borderRadius: 5, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13,
            }}>Voltar ao builder</button>
          )}
        </div>
      </div>

      {/* PÁGINA DO PDF */}
      <div className="print-page" style={{
        maxWidth: 820, margin: "0 auto", padding: "36px 40px",
        background: "#fff", color: "#0b1220",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}>
        {/* HEADER */}
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          borderBottom: "3px solid #c9a02c", paddingBottom: 14, marginBottom: 22,
        }}>
          <div>
            {/* Logotipo real da Harpian — wordmark preto pra fundo branco do PDF */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/harpian-wordmark-dark.svg"
              alt="HARPIAN"
              style={{ height: 34, width: "auto", display: "block", marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", fontFamily: MONO, letterSpacing: ".05em", textTransform: "uppercase" }}>
              Adaptive Portfolio Engineering
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#333", lineHeight: 1.55 }}>
            <div style={{ fontFamily: MONO, letterSpacing: ".04em", color: "#c9a02c", fontWeight: 700, textTransform: "uppercase", fontSize: 9.5 }}>Relatório · Simulação de Portfólio</div>
            <div style={{ marginTop: 4 }}>Gerado em <b>{agora}</b></div>
            <div>Autor: <b>{autor || "—"}</b></div>
          </div>
        </header>

        {/* CLIENTE + JANELA */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
          <div style={{ padding: "12px 14px", background: "#f6f4ee", borderLeft: "3px solid #c9a02c", borderRadius: 4 }}>
            <div style={{ fontSize: 9.5, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>Cliente</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{cliente || "—"}</div>
          </div>
          <div style={{ padding: "12px 14px", background: "#f6f4ee", borderRadius: 4 }}>
            <div style={{ fontSize: 9.5, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>Simulação — {janelaLabel}</div>
            <div style={{ fontSize: 13, fontFamily: MONO, color: "#111", lineHeight: 1.5 }}>
              {dateRange}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
              Capital inicial: <b style={{ color: "#c9a02c" }}>{money(capital)}</b>
              {set && <> · SET base: <b>{set.nome}</b></>}
              {" · "}Alocação {mode === "linear" ? "linear (peso fixo)" : "dinâmica (peso pelo momento)"}
              {" · "}Rebalance {rebalance}
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Números do portfólio
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {kpis.map((kp) => (
              <div key={kp.k} style={{
                padding: "10px 11px", border: "1px solid #eee", borderRadius: 5,
                background: "#fafafa",
              }}>
                <div style={{ fontSize: 8.5, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>{kp.k}</div>
                <div style={{
                  fontSize: 15, fontFamily: MONO, fontWeight: 700,
                  color: kp.tom === "pos" ? "#0a7a3b" : kp.tom === "neg" ? "#b0201f" : "#111",
                }}>{kp.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* GRÁFICO */}
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Capital do portfólio ao longo do tempo
          </h2>
          <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 5, padding: 10 }}>
            {curvaCapitalEl}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e6e6e6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3, fontSize: 10, color: "#666", fontFamily: MONO, letterSpacing: ".08em", textTransform: "uppercase" }}>
                <span>Quanto do portfólio estava blindado</span>
              </div>
              {faixaDefesaEl}
            </div>
          </div>
        </section>

        {/* COMPOSIÇÃO */}
        <section style={{ marginBottom: 22, pageBreakInside: "avoid" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Composição do portfólio · {sleeves.length} {sleeves.length === 1 ? "estratégia" : "estratégias"}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Estratégia</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Código AlphaDroid</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, width: 80 }}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {sleeves.map((s) => {
                const m = meta[s.id];
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m ? nomeCurto(m) : s.id}</td>
                    <td style={{ padding: "6px 8px", color: "#666", fontSize: 10.5, fontFamily: MONO }}>{m?.label ?? s.id}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: "#c9a02c" }}>{pct(s.weight, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ANÁLISE JIM AI */}
        <section style={{ marginBottom: 22, pageBreakInside: "avoid" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Análise em tempo real do JIM AI
          </h2>
          <div style={{
            padding: "14px 16px", background: "#f6f4ee", borderLeft: "3px solid #c9a02c",
            borderRadius: 4, fontSize: 12, lineHeight: 1.65, color: "#222",
            whiteSpace: "pre-wrap", minHeight: 120,
          }}>
            {carregandoAnalise
              ? "JIM AI está analisando seu portfólio…"
              : erroAnalise
                ? `JIM AI temporariamente indisponível: ${erroAnalise}. O relatório segue impresso com os números e a composição.`
                : analise}
          </div>
        </section>

        {/* RODAPÉ */}
        <footer style={{
          marginTop: 28, paddingTop: 12, borderTop: "1px solid #ddd",
          fontSize: 9.5, color: "#666", fontFamily: MONO, letterSpacing: ".04em",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>HARPIAN · Adaptive Portfolio Engineering · relatório gerado por Manager Cockpit</span>
          <span>{agora}</span>
        </footer>
      </div>

      <style>{`
        @media screen {
          .print-only-container { }
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff !important; }
          body > *:not(.print-only-container) { display: none !important; }
          .print-only-container { position: static !important; overflow: visible !important; }
          .print-hide { display: none !important; }
          .print-page { padding: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}

"use client";
// ============================================================
// MODO APRESENTACAO — o portfolio rodando na frente do cliente
// ------------------------------------------------------------
// Tela cheia, um grafico so, o tempo andando. A esquerda, as 41 estrategias
// empilhadas com uma barra de alocacao ao lado do nome: elas crescem e encolhem
// enquanto a curva avanca. O cliente ve a carteira respirar.
//
// POR QUE NAO TEM NUMERO NA BARRA
// A leitura aqui e de BLOCO, nao de valor: "isso encheu, aquilo esvaziou". Um
// percentual em cada uma das 41 linhas vira ruido — 41 numeros mudando 4 vezes
// por segundo ninguem le. O numero que importa (capital, retorno, data) fica
// grande no topo, onde o olho ja esta.
//
// PERFORMANCE
// A animacao NAO passa por estado do React: um rAF avanca o cursor e escreve
// direto no `style.width` das barras e no `update()` da serie do grafico.
// Re-renderizar 43 linhas 60 vezes por segundo derrubaria a tela justamente na
// hora em que ela precisa impressionar.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, LineStyle, type IChartApi, type ISeriesApi } from "lightweight-charts";
import {
  ROTULO_SECAO, VELOCIDADES, corDaBarra, escalaDaBarra, linhasDeAlocacao,
} from "@/lib/portfolio-builder/apresentacao";
import type { VelocidadeId } from "@/lib/portfolio-builder/apresentacao";
import type { BenchmarkSetsData } from "@/lib/portfolio-builder/benchmark-sets";
import type { PortfolioConfig, SimResult, StrategyMeta } from "@/lib/portfolio-builder/types";

const money = (v: number) =>
  v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B"
  : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M"
  : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "k"
  : "$" + v.toFixed(0);
const brDate = (iso: string) => iso.split("-").reverse().join("/");
const pct = (v: number, d = 1) => (v * 100).toFixed(d).replace(".", ",") + "%";

const CORTES = [
  { id: "5", label: "5 anos", anos: 5 },
  { id: "10", label: "10 anos", anos: 10 },
  { id: "15", label: "15 anos", anos: 15 },
  { id: "max", label: "Tudo", anos: null as number | null },
];

export default function ApresentacaoPortfolio({
  titulo, subtitulo, cfg, sim, meta, setsData, onFechar,
}: {
  titulo: string;
  subtitulo: string;
  cfg: PortfolioConfig;
  sim: SimResult;
  meta: Record<string, StrategyMeta>;
  setsData: BenchmarkSetsData | null;
  onFechar: () => void;
}) {
  const linhas = useMemo(() => linhasDeAlocacao(cfg, sim, meta, setsData), [cfg, sim, meta, setsData]);
  const escala = useMemo(() => escalaDaBarra(linhas), [linhas]);

  const [corte, setCorte] = useState("max");
  const [vel, setVel] = useState<VelocidadeId>("normal");
  const [tocando, setTocando] = useState(false);
  const [cursorUI, setCursorUI] = useState(0);      // so para o scrubber e o topo

  // recorte da janela: quantos anos para tras a partir do ultimo dia
  const de = useMemo(() => {
    const c = CORTES.find((x) => x.id === corte);
    if (!c?.anos) return 0;
    const fim = sim.dates[sim.dates.length - 1];
    const [a, m, d] = fim.split("-").map(Number);
    const alvo = `${a - c.anos}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const i = sim.dates.findIndex((x) => x >= alvo);
    return i < 0 ? 0 : i;
  }, [corte, sim.dates]);
  const ate = sim.dates.length - 1;
  const total = ate - de;

  // ── refs da animacao ──────────────────────────────────────────────────────
  const chartRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IChartApi | null>(null);
  const portRef = useRef<ISeriesApi<"Line"> | null>(null);
  const benchRef = useRef<ISeriesApi<"Line"> | null>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const nomesRef = useRef<(HTMLDivElement | null)[]>([]);
  const cursor = useRef(0);
  const desenhado = useRef(-1);
  const raf = useRef<number | null>(null);
  const ultimoT = useRef(0);

  // base de reescala: a curva sempre comeca em 100 no primeiro dia do recorte
  const base = sim.equity[de] || 1;
  const baseB = useMemo(() => {
    for (let d = de; d <= ate; d++) { const v = sim.benchmark[d]; if (v != null && v > 0) return v; }
    return null;
  }, [sim.benchmark, de, ate]);

  // ── grafico ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8aa4c0", fontSize: 12 },
      grid: { vertLines: { color: "rgba(255,255,255,0.035)" }, horzLines: { color: "rgba(255,255,255,0.035)" } },
      rightPriceScale: { borderColor: "#16304f", mode: 1, scaleMargins: { top: 0.08, bottom: 0.06 } },
      timeScale: { borderColor: "#16304f", timeVisible: false, minBarSpacing: 0.02, rightOffset: 2 },
      crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
    });
    apiRef.current = chart;
    portRef.current = chart.addLineSeries({
      color: "#C9A02C", lineWidth: 3, priceLineVisible: false,
      priceFormat: { type: "custom", formatter: (v: number) => money(v * base / 100), minMove: 0.01 },
    });
    benchRef.current = chart.addLineSeries({
      color: "#5a7391", lineWidth: 1, lineStyle: LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: false,
      priceFormat: { type: "custom", formatter: (v: number) => money(v * base / 100), minMove: 0.01 },
    });
    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
      }
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); apiRef.current = null; };
  }, [base]);

  /** Redesenha ate `alvo`. Para frente vai de update em update; para tras refaz. */
  const pintar = (alvo: number) => {
    const p = portRef.current, b = benchRef.current;
    if (!p || !b) return;
    if (alvo < desenhado.current || desenhado.current < 0) {
      const dados: { time: string; value: number }[] = [];
      const dadosB: { time: string; value: number }[] = [];
      for (let d = de; d <= de + alvo; d++) {
        dados.push({ time: sim.dates[d], value: (sim.equity[d] / base) * 100 });
        const v = sim.benchmark[d];
        if (v != null && baseB) dadosB.push({ time: sim.dates[d], value: (v / baseB) * 100 });
      }
      p.setData(dados as never);
      b.setData(dadosB as never);
      apiRef.current?.timeScale().fitContent();
    } else {
      for (let d = de + desenhado.current + 1; d <= de + alvo; d++) {
        p.update({ time: sim.dates[d], value: (sim.equity[d] / base) * 100 } as never);
        const v = sim.benchmark[d];
        if (v != null && baseB) b.update({ time: sim.dates[d], value: (v / baseB) * 100 } as never);
      }
      apiRef.current?.timeScale().fitContent();
    }
    desenhado.current = alvo;

    // barras: mudam de tamanho E de temperatura. A cor faz o olho achar o que
    // esta pesado sem comparar 41 comprimentos.
    for (let i = 0; i < linhas.length; i++) {
      const el = barsRef.current[i];
      if (!el) continue;
      const w = Math.min(1, linhas[i].pesos[de + alvo] / escala);
      el.style.width = (w * 100).toFixed(1) + "%";
      const [c0, c1] = corDaBarra(w);
      el.style.background = `linear-gradient(90deg, ${c0} 0%, ${c1} 100%)`;
      const nome = nomesRef.current[i];
      if (nome) nome.style.opacity = w > 0.004 ? "1" : "0.28";
    }
  };

  // recomeca quando o recorte muda
  useEffect(() => {
    cursor.current = 0;
    desenhado.current = -1;
    setCursorUI(0);
    pintar(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, escala, linhas]);

  // ── laco de animacao ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tocando) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      return;
    }
    const pps = VELOCIDADES.find((v) => v.id === vel)!.pregoesPorSegundo;
    ultimoT.current = performance.now();
    const passo = (t: number) => {
      const dt = Math.min(0.25, (t - ultimoT.current) / 1000);
      ultimoT.current = t;
      cursor.current = Math.min(total, cursor.current + dt * pps);
      const i = Math.floor(cursor.current);
      pintar(i);
      setCursorUI(i);
      if (cursor.current >= total) { setTocando(false); return; }
      raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocando, vel, total, de, escala, linhas]);

  // Esc fecha, espaco toca/pausa
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key === " ") { e.preventDefault(); setTocando((v) => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onFechar]);

  const d = de + cursorUI;
  const valor = sim.equity[d] ?? sim.equity[de];
  const retorno = valor / base - 1;
  const vb = sim.benchmark[d];
  const retB = vb != null && baseB ? vb / baseB - 1 : null;
  const dentro = linhas.filter((l) => !l.bloco && l.pesos[d] > 5e-5).length;

  const recomecar = () => {
    cursor.current = 0; desenhado.current = -1; setCursorUI(0); pintar(0); setTocando(true);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: "var(--bg, #060b13)",
      display: "flex", flexDirection: "column",
    }}>
      {/* topo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 24, padding: "14px 22px",
        borderBottom: "1px solid var(--line)", flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tx3)", fontWeight: 600 }}>
            Simulação em tempo real
          </div>
          <div style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-.015em", marginTop: 1 }}>{titulo}</div>
        </div>

        <div style={{ display: "flex", gap: 26, marginLeft: "auto", alignItems: "baseline", flexWrap: "wrap" }}>
          <Grande k="Data" v={brDate(sim.dates[d] ?? sim.dates[de])} />
          <Grande k="Capital" v={money(valor)} cor="#C9A02C" />
          <Grande k="Retorno" v={(retorno >= 0 ? "+" : "") + pct(retorno)} cor={retorno >= 0 ? "#5FB98C" : "#D96A6A"} />
          {retB != null && <Grande k="S&P 500" v={(retB >= 0 ? "+" : "") + pct(retB)} cor="#8aa4c0" />}
          <Grande k="Estratégias" v={String(dentro)} />
        </div>

        <button onClick={onFechar} style={{
          font: "inherit", fontSize: 13, padding: "7px 14px", borderRadius: 6, cursor: "pointer",
          border: "1px solid var(--line2)", background: "transparent", color: "var(--tx2)",
        }}>Voltar ao builder <span style={{ color: "var(--tx3)", marginLeft: 6 }}>Esc</span></button>
      </div>

      {/* corpo */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "clamp(280px, 23vw, 360px) 1fr" }}>
        {/* coluna das estrategias */}
        <div style={{
          borderRight: "1px solid var(--line)", overflowY: "auto", padding: "10px 12px 14px",
          display: "flex", flexDirection: "column", gap: 1,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)",
            fontWeight: 600, marginBottom: 6, position: "sticky", top: -10,
            background: "var(--bg, #060b13)", padding: "4px 0",
          }}>
            Alocação · {linhas.length} estratégias
          </div>
          {linhas.map((l, i) => (
            <div key={l.id}>
              {/* Separador entre secoes: so uma linha discreta, sem titulo (JD
                  pediu pra remover "AÇÕES SETORIAIS / ETF MACRO / DEFESA"
                  pra sobrar espaco e caber todas as 41 sem scroll). */}
              {i > 0 && linhas[i - 1].secao !== l.secao && (
                <div style={{ borderTop: "1px solid var(--line)", margin: "5px 0" }} />
              )}
              <div style={{ display: "grid", gridTemplateColumns: "148px 1fr", gap: 8, alignItems: "center" }}>
                <div
                  ref={(el) => { nomesRef.current[i] = el; }}
                  title={l.label}
                  style={{
                    fontSize: 10, color: "var(--tx2)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    transition: "opacity .18s",
                  }}
                >{l.curto}</div>
                <div style={{ height: 8, background: "rgba(255,255,255,.045)", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    ref={(el) => { barsRef.current[i] = el; }}
                    style={{
                      height: "100%", width: "0%", borderRadius: 2, background: "#F2E7A8",
                      transition: "width .12s linear, background .25s linear",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* grafico */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />

          {/* controles */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16, padding: "12px 22px 14px",
            borderTop: "1px solid var(--line)", flexWrap: "wrap",
          }}>
            <button onClick={() => setTocando((v) => !v)} style={{
              font: "inherit", fontSize: 14, fontWeight: 600, width: 92, padding: "8px 0", borderRadius: 6,
              cursor: "pointer", border: "1px solid var(--gold)", background: "rgba(201,160,44,.18)", color: "var(--gold)",
            }}>{tocando ? "❚❚ Pausar" : "▶ Tocar"}</button>
            <button onClick={recomecar} style={{
              font: "inherit", fontSize: 13, padding: "8px 13px", borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--line2)", background: "transparent", color: "var(--tx2)",
            }}>↺ Recomeçar</button>

            <input
              type="range" min={0} max={total} value={cursorUI}
              onChange={(e) => {
                const i = +e.target.value;
                cursor.current = i; setCursorUI(i); pintar(i);
              }}
              style={{ flex: 1, minWidth: 160, accentColor: "#C9A02C" }}
            />

            <div style={{ display: "flex", gap: 5 }}>
              {VELOCIDADES.map((v) => (
                <button key={v.id} onClick={() => setVel(v.id)} style={pill(v.id === vel)}>{v.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {CORTES.map((c) => (
                <button key={c.id} onClick={() => setCorte(c.id)} style={pill(c.id === corte)}>{c.label}</button>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
              {subtitulo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Grande({ k, v, cor }: { k: string; v: string; cor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)", fontWeight: 600 }}>{k}</div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 22, fontWeight: 650, letterSpacing: "-.02em",
        color: cor ?? "var(--tx1)", lineHeight: 1.15, fontVariantNumeric: "tabular-nums",
      }}>{v}</div>
    </div>
  );
}

function pill(on: boolean): React.CSSProperties {
  return {
    font: "inherit", fontSize: 12, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
    border: "1px solid " + (on ? "var(--gold)" : "var(--line2)"),
    background: on ? "rgba(201,160,44,.16)" : "transparent",
    color: on ? "var(--gold)" : "var(--tx2)",
  };
}

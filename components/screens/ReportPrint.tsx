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
import type { SimResult, Sleeve, StrategyMeta, StrategySeries } from "@/lib/portfolio-builder/types";
import type { BenchmarkSetsData, EstatisticaEstrategia, SetDef } from "@/lib/portfolio-builder/benchmark-sets";
import { computePortfolioRN, classifyBand, classifyStrategy } from "@/lib/portfolio-builder/hrd-engine";

const MONO = "var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)";

const brDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const diasParaLegivel = (dias: number): string => {
  if (dias <= 0) return "—";
  if (dias < 21) return `${dias} pregões`;
  const meses = Math.round(dias / 21);
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = meses / 12;
  return `${anos.toFixed(1)} anos`;
};

const pct = (n: number, d = 1) => (n == null || isNaN(n) ? "—" : `${(n * 100).toFixed(d)}%`);
/** Retorno acumulado da janela: acima de +1000% vira múltiplo (×41) pra ser legível. */
const fmtRet = (r: number) =>
  r == null || isNaN(r) ? "—"
    : r >= 10 ? `×${Math.round(1 + r).toLocaleString("pt-BR")}`
    : pct(r, Math.abs(r) >= 1 ? 0 : 1);
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
  /** dataset dos SETs — traz a estatistica por estrategia pre-computada no export */
  setsData?: BenchmarkSetsData | null;
  mode: "linear" | "dynamic";
  rebalance: string;
  capital: number;
  janelaLabel: string;
  onClose?: () => void;
  /** JSX ja pronto do gráfico do capital — vem do PortfolioBuilder */
  curvaCapitalEl: React.ReactNode;
  /** JSX ja pronto da faixa de defesa */
  faixaDefesaEl: React.ReactNode;
  /** series por sleeve — pra calcular retorno individual, trocas, defesa */
  series: Record<string, StrategySeries>;
  /** valor do maxdd do portfolio (0..1) — pra secao tecnica */
  maxDrawdown: number;
  /** CAGR anualizado do portfolio (0.15 = 15%/ano) — pra Risk Number */
  cagr: number;
  /** volatilidade anualizada (0.20 = 20% a.a.) — pra Risk Number */
  volAnual: number;
  /** RN do cliente (1..99) vindo do questionario, opcional */
  rnCliente: number | null;
}

function TechTile({ k, v, sub, tom }: { k: string; v: string; sub?: string; tom?: "pos" | "neg" }) {
  return (
    <div style={{
      padding: "9px 11px", border: "1px solid #eee", borderRadius: 5, background: "#fafafa",
    }}>
      <div style={{ fontSize: 8.5, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
      <div style={{
        fontSize: 14, fontFamily: MONO, fontWeight: 700,
        color: tom === "pos" ? "#0a7a3b" : tom === "neg" ? "#b0201f" : "#111",
      }}>{v}</div>
      {sub && <div style={{ fontSize: 9.5, color: "#888", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ReportPrint(props: ReportData) {
  const { autor, cliente, sim, sleeves, meta, nomeCurto, kpis, set, mode, rebalance, capital, janelaLabel, curvaCapitalEl, faixaDefesaEl, series, maxDrawdown, cagr, volAnual, rnCliente } = props;

  /**
   * Risk Number via HRD Engine (harpian_engine.py portado). Calibrado com
   * os 6 portfolios modelo Harpian — usa asset_class × CRM × liquidez, nao
   * VaR parametrico. So depende da COMPOSICAO (sleeves + pesos), nao do
   * retorno historico simulado.
   */
  const rnReport = useMemo(() => {
    // Exposicao media do overlay de vol-target: se o SET tem overlay ativo
    // (Institucional Dinamico, Dinamico Conservador), sim.exposicao vem
    // preenchido com fracao <1 e o resto do capital fica em CAIXA (rf=0).
    // Sem esse ajuste, o HRD trataria o sleeve como 100% investido no motor
    // e o RN sairia muito alto (72 pro Institucional que na verdade tem 22%
    // de exposicao ao motor + 78% em caixa).
    const expo = sim?.exposicao;
    const expoMedia = (Array.isArray(expo) && expo.length)
      ? expo.reduce((a, b) => a + b, 0) / expo.length
      : 1;
    const caixaMedio = Math.max(0, 1 - expoMedia);

    const positions = sleeves.map((s) => {
      const m = meta[s.id];
      const cls = classifyStrategy(s.id, m?.label, m?.sub);
      return {
        name: m ? m.label : s.id,
        weight: s.weight * expoMedia,
        asset_class: cls.asset_class,
        jurisdiction: cls.jurisdiction,
        liquidity: cls.liquidity,
      };
    });
    // Adiciona posicao virtual de CAIXA quando o overlay tira exposicao
    if (caixaMedio > 0.01) {
      positions.push({
        name: "Caixa (overlay de volatilidade)",
        weight: caixaMedio,
        asset_class: "CASH",
        jurisdiction: "USA",
        liquidity: "D1",
      });
    }
    return computePortfolioRN(positions);
  }, [sleeves, meta, sim?.exposicao]);
  const rnPortfolio = Math.round(rnReport.final_rn);
  const riskClass = classifyBand(rnPortfolio);
  const rnGap = rnCliente != null ? rnPortfolio - rnCliente : null;
  const rnClienteClass = rnCliente != null ? classifyBand(rnCliente) : null;

  /**
   * Estatisticas tecnicas por sleeve — extraidas de sim.weights + series.
   * Calcula uma vez por render:
   *  - pesoMedio: media dos pesos diarios (0..1)
   *  - pesoMax: pico historico
   *  - pctTempoAtiva: fracao dos dias com peso > 1%
   *  - trocas: mudancas de simbolo (sym[i] != sym[i-1]) na janela da sim
   *  - pctEmDefesa: fracao dos dias com defensivo=1 na janela
   *  - retornoJanela: equity[to]/equity[from] - 1 (na janela da sim)
   *  - contribuicao: peso medio * retorno da janela (aprox 1a ordem)
   */
  const stats = useMemo(() => {
    return sleeves.map((sl, sleeveIdx) => {
      let soma = 0, n = 0, mx = 0, ativos = 0;
      if (sim.weights?.length) {
        for (let d = 0; d < sim.weights.length; d++) {
          const w = sim.weights[d]?.[sleeveIdx];
          if (w == null || !isFinite(w)) continue;
          soma += w; n++;
          if (w > mx) mx = w;
          if (w > 0.01) ativos++;
        }
      }
      const pesoMedio = n > 0 ? soma / n : 0;
      const pesoMax = mx;
      const pctTempoAtiva = n > 0 ? ativos / n : 0;

      // Recorta series na janela da sim (de sim.from ate sim.to no calendario)
      const s = series[sl.id];
      let trocas = 0;
      let pctEmDefesa = 0;
      let retornoJanela = 0;
      if (s) {
        // s.start eh onde s comeca no calendario. sim.from tambem eh do calendario.
        const iniIdx = Math.max(0, sim.from - s.start);
        const fimIdx = Math.min(s.n - 1, sim.to - s.start);
        if (fimIdx > iniIdx) {
          for (let i = iniIdx + 1; i <= fimIdx; i++) {
            if (s.sym[i] !== s.sym[i - 1]) trocas++;
          }
          let df = 0, dtot = 0;
          for (let i = iniIdx; i <= fimIdx; i++) {
            if (s.defensivo[i] === 1) df++;
            dtot++;
          }
          pctEmDefesa = dtot > 0 ? df / dtot : 0;
          const ei = s.equity[iniIdx];
          const ef = s.equity[fimIdx];
          if (ei > 0 && ef > 0) retornoJanela = ef / ei - 1;
        }
      }
      const contribuicao = pesoMedio * retornoJanela;
      return { id: sl.id, sleeveIdx, pesoMedio, pesoMax, pctTempoAtiva, trocas, pctEmDefesa, retornoJanela, contribuicao };
    });
  }, [sleeves, sim.weights, sim.from, sim.to, series]);

  /**
   * Estatisticas do PORTFOLIO como um todo — tempo em drawdown, recovery,
   * meses em defesa, turnover. Usa sim.drawdown e sim.defenseFrac.
   */
  const portfolioStats = useMemo(() => {
    // Tempo max em drawdown: maior sequencia consecutiva com dd < -0.1%
    let maxSeq = 0, curSeq = 0;
    let diasEmDD = 0;
    for (const dd of sim.drawdown) {
      if (dd < -0.001) {
        curSeq++;
        diasEmDD++;
        if (curSeq > maxSeq) maxSeq = curSeq;
      } else {
        curSeq = 0;
      }
    }
    // Meses em defesa (>= 50% em defesa por >= 15 dias no mes)
    let diasComDefesa = 0;
    for (const f of sim.defenseFrac) if (f >= 0.5) diasComDefesa++;
    // Turnover: soma das mudancas absolutas de peso por dia
    let turnover = 0;
    if (sim.weights?.length > 1) {
      for (let d = 1; d < sim.weights.length; d++) {
        for (let s = 0; s < sim.weights[d].length; s++) {
          turnover += Math.abs((sim.weights[d]?.[s] ?? 0) - (sim.weights[d - 1]?.[s] ?? 0));
        }
      }
      // normaliza: turnover total / 2 (compra+venda contam) / (anos)
      const anos = sim.dates.length / 252;
      turnover = anos > 0 ? turnover / 2 / anos : 0;
    }
    const totalDias = sim.dates.length;
    return {
      diasMaxEmDD: maxSeq,
      diasEmDD,
      diasComDefesa,
      totalDias,
      pctTempoEmDD: totalDias > 0 ? diasEmDD / totalDias : 0,
      pctTempoEmDefesa: totalDias > 0 ? diasComDefesa / totalDias : 0,
      turnoverAnual: turnover, // vezes/ano que a carteira gira
    };
  }, [sim.drawdown, sim.defenseFrac, sim.weights, sim.dates]);

  // Top 3 melhor e top 3 pior retorno da janela
  const topBest = useMemo(() =>
    [...stats].sort((a, b) => b.retornoJanela - a.retornoJanela).slice(0, 3),
  [stats]);
  const topWorst = useMemo(() =>
    [...stats].sort((a, b) => a.retornoJanela - b.retornoJanela).slice(0, 3),
  [stats]);

  /**
   * Quando um SET esta carregado, os sleeves sao BLOCOS sinteticos — a tabela
   * tecnica acima mostraria uma linha so. Aqui o bloco e desmontado nas
   * estrategias de verdade usando a estatistica pre-computada no export
   * (mesma janela validada). O peso vem DENTRO do bloco; escala-se pela
   * composicao fixa do SET. Nos SETs de bloco unico (Max Retorno) e exato;
   * nos de 2-3 blocos e a composicao alvo, com a deriva de ~1 pp ignorada.
   */
  const estatSet = useMemo(() => {
    const eb = props.setsData?.estatisticasBloco;
    if (!set || !eb) return null;
    type Linha = EstatisticaEstrategia & { pesoPortfolio: number; picoPortfolio: number; contribuicao: number };
    const porId = new Map<string, Linha>();
    const tickers = new Set<string>();
    for (const c of set.composicao) {
      const bloco = eb[c.bloco as keyof typeof eb];
      if (!bloco) continue;
      for (const s of bloco.simbolosNegociados) tickers.add(s);
      for (const e of bloco.estrategias) {
        const atual = porId.get(e.id);
        if (atual) {
          atual.pesoPortfolio += c.peso * e.pesoMedio;
          atual.picoPortfolio += c.peso * e.pesoMax;
        } else {
          porId.set(e.id, {
            ...e,
            pesoPortfolio: c.peso * e.pesoMedio,
            picoPortfolio: c.peso * e.pesoMax,
            contribuicao: 0,
          });
        }
      }
    }
    const linhas = [...porId.values()];
    for (const l of linhas) l.contribuicao = l.pesoPortfolio * l.retornoJanela;
    linhas.sort((a, b) => b.contribuicao - a.contribuicao);
    const contribTotal = linhas.reduce((a, l) => a + Math.max(0, l.contribuicao), 0);
    // relevantes: quem teve peso de verdade (>= 0,2% medio) — evita encher a
    // tabela com quem so passou de raspao pelo corr-min
    const relevantes = linhas.filter((l) => l.pesoPortfolio >= 0.002);
    const melhores = [...relevantes].sort((a, b) => b.retornoJanela - a.retornoJanela).slice(0, 3);
    const piores = [...relevantes].sort((a, b) => a.retornoJanela - b.retornoJanela).slice(0, 3);
    const giros = linhas.reduce((a, l) => a + l.trocas, 0);
    return { linhas, relevantes, melhores, piores, giros, nTickers: tickers.size, contribTotal };
  }, [set, props.setsData]);

  /** Meses negativos do PORTFOLIO, da curva simulada — mes-calendario cheio. */
  const mesesPortfolio = useMemo(() => {
    let neg = 0, tot = 0, pico = 0;
    let iniEq = sim.equity[0];
    for (let i = 1; i < sim.dates.length; i++) {
      const fechouMes = sim.dates[i].slice(0, 7) !== sim.dates[i - 1].slice(0, 7);
      if (fechouMes) {
        const r = sim.equity[i - 1] / iniEq - 1;
        tot++;
        if (r < 0) neg++; else if (r > pico) pico = r;
        iniEq = sim.equity[i - 1];
      }
    }
    return { neg, tot, melhorMes: pico };
  }, [sim.dates, sim.equity]);

  const [analise, setAnalise] = useState<string | null>(null);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [carregandoAnalise, setCarregandoAnalise] = useState(true);
  const [baixando, setBaixando] = useState(false);

  // Dispara Claude Haiku ao montar. Análise do "JIM AI" — 3-4 parágrafos.
  useEffect(() => {
    setCarregandoAnalise(true);
    // Contexto extra pro JIM nao fabricar (janela em anos, overlay real, caixa).
    // Bug de 04/08/2026: JIM cravou "10 anos" numa janela de 15 e inventou
    // "DMAX puro = 12%aa/vol 8%" (real: 67%/35%). Endurecemos o prompt e
    // passamos aqui os numeros que ele precisa pra ancorar.
    const anosReais = sim?.dates && sim.dates.length > 1
      ? (sim.to - sim.from + 1) / 252
      : null;
    const expo = sim?.exposicao;
    const expoMedia = (Array.isArray(expo) && expo.length)
      ? expo.reduce((a, b) => a + b, 0) / expo.length
      : null;
    const volTargetAlvo = set?.volTarget?.alvo ?? null;
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
        anos: anosReais,
        volTargetAlvo,
        expoMedia,
        caixaConvencao: "rf=0 (caixa não remunerado no backtest — convenção conservadora)",
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
            <div style={{ fontSize: 12.9, color: "#666", fontFamily: MONO, letterSpacing: ".05em", textTransform: "uppercase" }}>
              Adaptive Portfolio Engineering
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12.9, color: "#333", lineHeight: 1.55 }}>
            <div style={{ fontFamily: MONO, letterSpacing: ".04em", color: "#c9a02c", fontWeight: 700, textTransform: "uppercase", fontSize: 11.1 }}>Relatório · Simulação de Portfólio</div>
            <div style={{ marginTop: 4 }}>Gerado em <b>{agora}</b></div>
            <div>Autor: <b>{autor || "—"}</b></div>
          </div>
        </header>

        {/* CLIENTE + JANELA — cliente estreito (nome curto), janela ganha espaco */}
        <section style={{ display: "grid", gridTemplateColumns: "minmax(180px, 260px) 1fr", gap: 14, marginBottom: 22 }}>
          <div style={{ padding: "12px 14px", background: "#f6f4ee", borderLeft: "3px solid #c9a02c", borderRadius: 4 }}>
            <div style={{ fontSize: 11.1, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>Cliente</div>
            <div style={{ fontSize: 21.1, fontWeight: 700 }}>{cliente || "—"}</div>
          </div>
          <div style={{ padding: "12px 14px", background: "#f6f4ee", borderRadius: 4 }}>
            <div style={{ fontSize: 11.1, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>Simulação — {janelaLabel}</div>
            <div style={{ fontSize: 15.2, fontFamily: MONO, color: "#111", lineHeight: 1.5 }}>
              {dateRange}
            </div>
            <div style={{ fontSize: 12.9, color: "#555", marginTop: 4 }}>
              Capital inicial: <b style={{ color: "#c9a02c" }}>{money(capital)}</b>
              {set && <> · SET base: <b>{set.nome}</b></>}
              {" · "}Alocação {mode === "linear" ? "linear (peso fixo)" : "dinâmica (peso pelo momento)"}
              {" · "}Rebalance {rebalance}
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14.0, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Números do portfólio
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {kpis.map((kp) => (
              <div key={kp.k} style={{
                padding: "10px 11px", border: "1px solid #eee", borderRadius: 5,
                background: "#fafafa",
              }}>
                <div style={{ fontSize: 9.9, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 3 }}>{kp.k}</div>
                <div style={{
                  fontSize: 17.5, fontFamily: MONO, fontWeight: 700,
                  color: kp.tom === "pos" ? "#0a7a3b" : kp.tom === "neg" ? "#b0201f" : "#111",
                }}>{kp.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RISK NUMBER — HRD Engine (fórmula oficial Harpian, calibrada
            contra os 6 portfolios modelo). Baseado em asset_class + CRM
            + liquidez das estratégias, não em VaR paramétrico histórico. */}
        <section style={{ marginBottom: 22, pageBreakInside: "avoid" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14.0, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Risk Number — HRD Engine
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: rnCliente != null ? "1fr 1fr 1fr" : "1fr 2fr", gap: 10 }}>
            {/* RN do portfolio */}
            <div style={{
              padding: "16px 18px", border: `2px solid ${riskClass.cor}`, borderRadius: 6,
              background: "#fafafa", textAlign: "center",
            }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".12em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 4 }}>
                Portfolio proposto
              </div>
              <div style={{ fontSize: 51.5, fontWeight: 800, fontFamily: MONO, color: riskClass.cor, lineHeight: 1 }}>{rnPortfolio}</div>
              <div style={{ fontSize: 13.5, color: riskClass.cor, fontWeight: 700, marginTop: 4, letterSpacing: ".02em" }}>{riskClass.band}</div>
            </div>

            {/* RN do cliente — só se informado */}
            {rnCliente != null && rnClienteClass && (
              <div style={{
                padding: "16px 18px", border: `2px solid ${rnClienteClass.cor}`, borderRadius: 6,
                background: "#fafafa", textAlign: "center",
              }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".12em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 4 }}>
                  Cliente (questionário)
                </div>
                <div style={{ fontSize: 51.5, fontWeight: 800, fontFamily: MONO, color: rnClienteClass.cor, lineHeight: 1 }}>{rnCliente}</div>
                <div style={{ fontSize: 13.5, color: rnClienteClass.cor, fontWeight: 700, marginTop: 4, letterSpacing: ".02em" }}>{rnClienteClass.band}</div>
              </div>
            )}

            {/* Explicação e comparação */}
            <div style={{ padding: "14px 16px", background: "#f6f4ee", borderRadius: 6, fontSize: 12.9, color: "#333", lineHeight: 1.55 }}>
              <div style={{ fontSize: 11.7, letterSpacing: ".08em", color: "#666", fontFamily: MONO, textTransform: "uppercase", marginBottom: 6 }}>Interpretação HRD Engine</div>
              <div style={{ marginBottom: 6 }}>
                Score bruto: <b style={{ fontFamily: MONO }}>{rnReport.raw_rn.toFixed(1)}</b> · Peso equity:{" "}
                <b style={{ fontFamily: MONO }}>{(rnReport.equity_weight * 100).toFixed(0)}%</b>
                {rnReport.cf_applied > 1 && (
                  <span> · <b style={{ color: "#e08420" }}>Correlation Factor {rnReport.cf_applied.toFixed(2)}×</b> aplicado (equity {'>'} 60%)</span>
                )}
              </div>
              <div style={{ fontSize: 12.3, color: "#666" }}>
                Bandas: 0-20 Cons. Extremo · 21-40 Conservador · 41-60 Moderado · 61-75 Mod. Agressivo · 76-90 Agressivo · 91-99 Ultra
              </div>
              {rnGap != null && (
                <div style={{
                  marginTop: 8, padding: "6px 10px", borderRadius: 4,
                  background: Math.abs(rnGap) <= 10 ? "rgba(10,122,59,.12)" : "rgba(224,132,32,.14)",
                  color: Math.abs(rnGap) <= 10 ? "#0a7a3b" : "#a15a10",
                  fontSize: 12.9, fontWeight: 600,
                }}>
                  Gap: {rnGap > 0 ? "+" : ""}{rnGap} pontos —{" "}
                  {Math.abs(rnGap) <= 10 ? "alinhado ao perfil do cliente"
                    : rnGap > 0 ? "portfólio mais arrojado que o perfil"
                    : "portfólio mais conservador que o perfil"}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 11.1, color: "#888", marginTop: 8, lineHeight: 1.45 }}>
            HRD Engine v1.0.0 — <code style={{ fontFamily: MONO }}>RS_i = min(BASE[classe] × CRM[país] + LIQUIDITY_PENALTY, 99)</code>,
            <code style={{ fontFamily: MONO }}> RN = Σ(w_i × RS_i) × CF</code>. Calibrado contra os 6 portfólios modelo Harpian.
            Não depende do retorno histórico simulado.
          </div>
        </section>

        {/* GRÁFICO */}
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14.0, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Capital do portfólio ao longo do tempo
          </h2>
          <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 5, padding: 10 }}>
            {curvaCapitalEl}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e6e6e6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3, fontSize: 11.7, color: "#666", fontFamily: MONO, letterSpacing: ".08em", textTransform: "uppercase" }}>
                <span>Quanto do portfólio estava blindado</span>
              </div>
              {faixaDefesaEl}
            </div>
          </div>
        </section>

        {/* COMPOSIÇÃO */}
        <section style={{ marginBottom: 22, pageBreakInside: "avoid" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14.0, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Composição do portfólio · {sleeves.length} {sleeves.length === 1 ? "estratégia" : "estratégias"}
          </h2>
          {/* Nota que muda pelo modo: no linear o peso e fixo; no dinamico
              mostramos peso medio (media ao longo da janela) e peso maximo
              (pico historico). O minimo do dinamico e sempre 0 — a estrategia
              pode ficar de fora do portfolio em meses em que o momento cai. */}
          <div style={{ fontSize: 12.9, color: "#555", marginBottom: 8, lineHeight: 1.5 }}>
            {mode === "linear"
              ? "Alocação linear: cada estratégia mantém o peso fixo o tempo todo, com rebalance " + rebalance + "."
              : "Alocação dinâmica: os pesos variam a cada rebalance " + rebalance + " pela força do momento. A tabela mostra o peso médio (média ao longo da janela) e o pico máximo alocado. O mínimo é sempre 0% — a estratégia pode ficar de fora do portfólio quando o momento cai."}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.0 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Estratégia</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Código AlphaDroid</th>
                {mode === "linear" ? (
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, width: 80 }}>Peso fixo</th>
                ) : (
                  <>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, width: 80 }}>Peso médio</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, width: 80 }}>Máx alocado</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sleeves.map((s, sleeveIdx) => {
                const m = meta[s.id];
                const st = stats[sleeveIdx];
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m ? nomeCurto(m) : s.id}</td>
                    <td style={{ padding: "6px 8px", color: "#666", fontSize: 12.3, fontFamily: MONO }}>{m?.label ?? s.id}</td>
                    {mode === "linear" ? (
                      <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: "#c9a02c" }}>
                        {pct(s.weight, 0)}
                      </td>
                    ) : (
                      <>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: "#c9a02c" }}>
                          {pct(st.pesoMedio, 1)}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: MONO, color: "#555" }}>
                          {pct(st.pesoMax, 0)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ANÁLISE TÉCNICA — ASSET ALLOCATOR (página 2 típica) */}
        <section style={{ marginBottom: 22, pageBreakInside: "avoid", pageBreakBefore: "always" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14.0, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Análise técnica do Asset Allocator
          </h2>

          {/* Estatisticas do portfolio */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 8 }}>
            <TechTile k="Drawdown máx" v={pct(-Math.abs(maxDrawdown), 1)} tom="neg" />
            <TechTile k="Tempo máx em DD" v={diasParaLegivel(portfolioStats.diasMaxEmDD)} sub={`${portfolioStats.diasMaxEmDD} pregões consecutivos`} />
            <TechTile k="% tempo em DD" v={pct(portfolioStats.pctTempoEmDD, 1)} sub="fração dos pregões abaixo do pico" />
            {estatSet && props.setsData ? (
              <TechTile
                k="Meses no gatilho de defesa"
                v={`${props.setsData.mesesEmDefesa.length} de ${props.setsData.rebalMensal.length}`}
                sub="amplitude < 12 de 41 → carteira sai de risco"
              />
            ) : (
              <TechTile k="% tempo em defesa" v={pct(portfolioStats.pctTempoEmDefesa, 1)} sub="pregões com ≥ 50% blindado" />
            )}
            <TechTile
              k="Meses negativos" tom={mesesPortfolio.neg > 0 ? "neg" : "pos"}
              v={`${mesesPortfolio.neg} de ${mesesPortfolio.tot}`}
              sub={`${pct(mesesPortfolio.tot > 0 ? mesesPortfolio.neg / mesesPortfolio.tot : 0, 0)} dos meses-calendário`}
            />
          </div>
          {estatSet && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
              <TechTile k="Estratégias com peso" v={`${estatSet.relevantes.length}`} sub="peso médio ≥ 0,2% na janela" />
              <TechTile k="Giros de ativo (total)" v={estatSet.giros.toLocaleString("pt-BR")} sub="trocas de ticker somadas nas estratégias" />
              <TechTile k="Ativos negociados" v={estatSet.nTickers.toLocaleString("pt-BR")} sub="tickers distintos na janela" />
              <TechTile k="Melhor mês do portfólio" v={pct(mesesPortfolio.melhorMes, 1)} tom="pos" />
            </div>
          )}

          {/* Turnover — so faz sentido quando os sleeves sao as proprias
              estrategias; num SET o sleeve e um bloco unico de peso 100% e o
              numero sairia zero. O giro do SET esta no tile "Giros de ativo". */}
          {!estatSet && (
            <div style={{ padding: "10px 12px", background: "#fafafa", border: "1px solid #eee", borderRadius: 5, marginBottom: 14, fontSize: 13.5, color: "#333" }}>
              <b style={{ color: "#c9a02c" }}>Turnover anual da carteira:</b> {portfolioStats.turnoverAnual.toFixed(2)}× / ano — quantas vezes por ano os pesos giram (0 = estático, 1 = uma carteira totalmente nova por ano).
            </div>
          )}

          {/* Top 3 melhor e pior retorno — decomposto por estrategia quando ha SET */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12.3, letterSpacing: ".08em", textTransform: "uppercase", color: "#0a7a3b", fontFamily: MONO, fontWeight: 700, marginBottom: 6 }}>Melhores retornos (janela)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.9 }}>
                <tbody>
                  {(estatSet ? estatSet.melhores : topBest).map((t) => {
                    const m = meta[t.id];
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "5px 6px", fontWeight: 600 }}>{m ? nomeCurto(m) : t.id}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: "#0a7a3b", fontWeight: 700 }}>{fmtRet(t.retornoJanela)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize: 12.3, letterSpacing: ".08em", textTransform: "uppercase", color: "#b0201f", fontFamily: MONO, fontWeight: 700, marginBottom: 6 }}>Piores retornos (janela)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.9 }}>
                <tbody>
                  {(estatSet ? estatSet.piores : topWorst).map((t) => {
                    const m = meta[t.id];
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "5px 6px", fontWeight: 600 }}>{m ? nomeCurto(m) : t.id}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: "#b0201f", fontWeight: 700 }}>{fmtRet(t.retornoJanela)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhe por estrategia — decomposto do SET quando ha um, senao dos sleeves */}
          <div style={{ fontSize: 12.3, letterSpacing: ".08em", textTransform: "uppercase", color: "#555", fontFamily: MONO, fontWeight: 700, marginBottom: 6 }}>
            Estatística técnica por estratégia
          </div>
          {estatSet ? (
            <>
              <div style={{ fontSize: 12.3, color: "#666", marginBottom: 6, lineHeight: 1.5 }}>
                O SET é um bloco de alocação dinâmica — a tabela abaixo o desmonta nas estratégias
                que receberam peso na janela validada. Peso médio e pico incluem a deriva diária
                dentro do mês (por isso o pico pode passar do teto de rebalance). Meses neg. conta
                os meses-calendário negativos da estratégia em {estatSet.linhas[0]?.mesesTotal ?? "—"} meses.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.7 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    {["Estratégia", "Desde", "Peso méd", "Pico", "Retorno", "% contrib", "Mês méd", "Meses neg", "Giros", "Ativos", "% defesa"].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "5px 5px", color: "#666", fontFamily: MONO, fontSize: 9.9, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estatSet.relevantes.map((l) => {
                    const m = meta[l.id];
                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "4px 5px", fontWeight: 600 }}>{m ? nomeCurto(m) : l.id}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#666" }}>{l.desde.slice(0, 4)}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: "#c9a02c" }}>{pct(l.pesoPortfolio, 1)}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#555" }}>{pct(l.picoPortfolio, 0)}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: l.retornoJanela >= 0 ? "#0a7a3b" : "#b0201f" }}>{fmtRet(l.retornoJanela)}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: l.contribuicao >= 0 ? "#0a7a3b" : "#b0201f" }}>
                          {estatSet.contribTotal > 0 ? pct(Math.max(0, l.contribuicao) / estatSet.contribTotal, 1) : "—"}
                        </td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: l.retMesMedio >= 0 ? "#0a7a3b" : "#b0201f" }}>{pct(l.retMesMedio, 1)}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#333" }}>{l.mesesNeg}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#333" }}>{l.trocas}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#333" }}>{l.nAtivos}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: l.pctDefesa > 0.1 ? "#0a5aa0" : "#666" }}>{pct(l.pctDefesa, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Os ativos que puxaram o retorno de cada estrategia */}
              <div style={{ fontSize: 12.3, letterSpacing: ".08em", textTransform: "uppercase", color: "#555", fontFamily: MONO, fontWeight: 700, margin: "14px 0 6px" }}>
                Ativos que mais renderam, por estratégia
              </div>
              <div style={{ fontSize: 12.3, color: "#666", marginBottom: 6, lineHeight: 1.5 }}>
                Retorno acumulado do ticker nos dias em que a estratégia o carregava — as 8
                estratégias de maior contribuição. Melhor e pior mês da estratégia ao lado.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.7 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd" }}>
                    {["Estratégia", "1º ativo", "2º ativo", "3º ativo", "Melhor mês", "Pior mês"].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "5px 5px", color: "#666", fontFamily: MONO, fontSize: 9.9, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estatSet.relevantes.slice(0, 8).map((l) => {
                    const m = meta[l.id];
                    const cel = (a?: { simbolo: string; retorno: number }) =>
                      a ? `${a.simbolo} ${fmtRet(a.retorno)}` : "—";
                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "4px 5px", fontWeight: 600 }}>{m ? nomeCurto(m) : l.id}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#0a7a3b", fontWeight: 700 }}>{cel(l.topAtivos[0])}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#0a7a3b" }}>{cel(l.topAtivos[1])}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#0a7a3b" }}>{cel(l.topAtivos[2])}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#0a7a3b" }}>{pct(l.melhorMes, 0)}</td>
                        <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: MONO, color: "#b0201f" }}>{pct(l.piorMes, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th style={{ textAlign: "left", padding: "5px 6px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Estratégia</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Retorno</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Contribuição</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>% tempo ativa</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Nº trocas</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>% em defesa</th>
                </tr>
              </thead>
              <tbody>
                {sleeves.map((s, i) => {
                  const m = meta[s.id];
                  const st = stats[i];
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "5px 6px", fontWeight: 600 }}>{m ? nomeCurto(m) : s.id}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: st.retornoJanela >= 0 ? "#0a7a3b" : "#b0201f" }}>{pct(st.retornoJanela, 1)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: st.contribuicao >= 0 ? "#0a7a3b" : "#b0201f", fontWeight: 700 }}>{pct(st.contribuicao, 2)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: "#333" }}>{pct(st.pctTempoAtiva, 0)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: "#333" }}>{st.trocas}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: MONO, color: st.pctEmDefesa > 0.1 ? "#0a5aa0" : "#666" }}>{pct(st.pctEmDefesa, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* ANÁLISE JIM AI */}
        <section style={{ marginBottom: 22, pageBreakInside: "avoid" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14.0, letterSpacing: ".1em", textTransform: "uppercase", color: "#c9a02c", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
            Análise em tempo real do JIM AI
          </h2>
          <div style={{
            padding: "14px 16px", background: "#f6f4ee", borderLeft: "3px solid #c9a02c",
            borderRadius: 4, fontSize: 14.0, lineHeight: 1.65, color: "#222",
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
          fontSize: 11.1, color: "#666", fontFamily: MONO, letterSpacing: ".04em",
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
          /* Truque de visibility em vez de display:none:
             o print-only-container fica nested dentro do .pb-shell no
             front-logo, entao 'body > *:not(...)' nao pega ele. visibility
             hidden + override no proprio container funciona independente
             de aninhamento. */
          body * { visibility: hidden !important; }
          .print-only-container, .print-only-container * { visibility: visible !important; }
          .print-only-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; overflow: visible !important; }
          .print-hide { display: none !important; visibility: hidden !important; }
          .print-page { padding: 0 !important; max-width: none !important; }
          /* Neutraliza o body::before (paper-grain do front-logo) no PDF */
          body::before, body::after { display: none !important; }
        }
      `}</style>
    </div>
  );
}

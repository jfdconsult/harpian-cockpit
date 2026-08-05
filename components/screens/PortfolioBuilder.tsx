"use client";
// ============================================================
// PORTFOLIO BUILDER — construcao de portfolio a quatro maos
// ------------------------------------------------------------
// Pensado para ser operado AO VIVO, na frente do cliente: ele escolhe as
// estrategias, define o peso (ou o piso e o teto), e a curva se refaz na hora.
// O ato termina na linha do tempo: "em 20/11/2008 voce estava carregando o que?"
//
// Nenhum calculo de momento acontece aqui. RetMes%/IR chegam prontos do motor
// do Diogo; este arquivo so traduz momento em peso e compoe as curvas.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart, ColorType, LineStyle, type IChartApi,
} from "lightweight-charts";
import {
  checkFeasibility, emDefesa, holdingsEm, simulate, LIMIAR_DEFESA,
} from "@/lib/portfolio-builder/engine";
import type {
  AllocMode, Benchmark, Catalog, Janela, PortfolioConfig, RebalanceFreq,
  RegimeStats, ScoreBasis, SimResult, Sleeve, StrategyMeta, StrategySeries, WindowMode,
} from "@/lib/portfolio-builder/types";
import { JANELAS } from "@/lib/portfolio-builder/types";
import {
  configDoSet, descricaoDoSet, ehBloco, presetsVitrine, seriesDosBlocos,
} from "@/lib/portfolio-builder/presets";
import type { BenchmarkSetsData, SetDef } from "@/lib/portfolio-builder/benchmark-sets";
import { SETS, avaliarSet, EXPLICACAO_BLOCO } from "@/lib/portfolio-builder/benchmark-sets";
import ApresentacaoPortfolio from "./ApresentacaoPortfolio";
import ReportPrint from "./ReportPrint";
import { classificar, idsDeDefesa } from "@/lib/portfolio-builder/defesa";

const pct = (v: number, d = 1) => (v * 100).toFixed(d) + "%";
const money = (v: number) =>
  v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B"
  : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M"
  : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "k"
  : "$" + v.toFixed(0);
const brDate = (iso: string) => iso.split("-").reverse().join("/");
/** 41434.48 -> "41.434×". Numero grande com uma casa decimal nao se le. */
const multiplo = (v: number) =>
  (v >= 100 ? Math.round(v).toLocaleString("pt-BR") : v.toFixed(1)) + "×";

/** Um número do painel: o tile mostra k e v; `explica` abre na faixa do topo. */
interface Metrica {
  id: string;
  k: string;
  v: string;
  tom?: "pos" | "neg";
  explica: string;
}

const CORES = [
  "#C9A02C", "#4F9CD9", "#5FB98C", "#D97757", "#9B7FD4", "#D9B84F",
  "#6FC2C2", "#C97CA8", "#8FB85F", "#D96A6A", "#7A9BD4", "#B8935F",
];

// ── Faixa de defesa ──────────────────────────────────────────────────────────
// Tira fina sob o grafico: quanto do portfolio estava blindado em cada dia.
// SVG proprio em vez de serie do lightweight-charts porque aqui o que importa
// e a leitura de bloco ("esse pedaco todo estava defendido"), nao o valor.
function FaixaDefesa({
  frac, dates, largura = 1000, altura = 34, onHover, marcado,
}: {
  frac: number[]; dates: string[]; largura?: number; altura?: number;
  onHover?: (i: number | null) => void; marcado?: number | null;
}) {
  const cols = useMemo(() => {
    const n = frac.length;
    const alvo = Math.min(largura, n);
    const passo = n / alvo;
    const out: { x: number; w: number; v: number; i: number }[] = [];
    for (let c = 0; c < alvo; c++) {
      const a = Math.floor(c * passo);
      const b = Math.max(a + 1, Math.floor((c + 1) * passo));
      let max = 0;
      for (let i = a; i < b && i < n; i++) if (frac[i] > max) max = frac[i];
      out.push({ x: (c / alvo) * largura, w: largura / alvo + 0.6, v: max, i: a });
    }
    return out;
  }, [frac, largura]);

  const marca = marcado != null && frac.length
    ? (marcado / frac.length) * largura : null;

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none"
      style={{ width: "100%", height: altura, display: "block", cursor: "crosshair" }}
      onMouseLeave={() => onHover?.(null)}
      onMouseMove={(e) => {
        if (!onHover) return;
        const r = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
        if (!r) return;
        const rel = (e.clientX - r.left) / r.width;
        onHover(Math.max(0, Math.min(frac.length - 1, Math.round(rel * frac.length))));
      }}
    >
      <rect x={0} y={0} width={largura} height={altura} fill="rgba(255,255,255,.03)" />
      {cols.map((c, k) => (
        <rect
          key={k} x={c.x} y={altura - c.v * altura} width={c.w} height={c.v * altura}
          fill={emDefesa(c.v) ? "#4F9CD9" : "rgba(79,156,217,.42)"}
        />
      ))}
      {marca != null && (
        <line x1={marca} x2={marca} y1={0} y2={altura} stroke="#C9A02C" strokeWidth={1.5} />
      )}
      {dates.length > 0 && (
        <>
          <text x={4} y={altura - 4} fill="var(--tx3)" fontSize={9}>{dates[0]?.slice(0, 4)}</text>
          <text x={largura - 4} y={altura - 4} fill="var(--tx3)" fontSize={9} textAnchor="end">
            {dates[dates.length - 1]?.slice(0, 4)}
          </text>
        </>
      )}
    </svg>
  );
}

// ── Grafico de capital ───────────────────────────────────────────────────────
function CurvaCapital({
  dates, equity, benchmark, height = 300,
}: { dates: string[]; equity: number[]; benchmark: (number | null)[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const key = dates.length + ":" + (dates[0] ?? "") + ":" + equity[equity.length - 1];

  useEffect(() => {
    if (!ref.current || dates.length < 2) return;
    const chart: IChartApi = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#7d96b3", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "#16304f", mode: 1 },
      timeScale: { borderColor: "#16304f", timeVisible: false, minBarSpacing: 0.02, rightOffset: 0 },
      crosshair: { mode: 0, vertLine: { color: "#C9A02C", style: LineStyle.Dashed }, horzLine: { color: "#C9A02C", style: LineStyle.Dashed } },
      width: ref.current.clientWidth, height,
    });

    const port = chart.addLineSeries({
      color: "#C9A02C", lineWidth: 2, priceLineVisible: false,
      priceFormat: { type: "custom", formatter: money, minMove: 1 },
    });
    port.setData(dates.map((t, i) => ({ time: t, value: equity[i] })) as never);

    let bench: ReturnType<IChartApi["addLineSeries"]> | null = null;
    if (benchmark.some((v) => v != null)) {
      bench = chart.addLineSeries({
        color: "#5a7391", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false,
        lastValueVisible: false, priceFormat: { type: "custom", formatter: money, minMove: 1 },
      });
      bench.setData(
        dates.map((t, i) => ({ time: t, value: benchmark[i] }))
          .filter((p) => p.value != null) as never,
      );
    }
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((p) => {
      const tip = tipRef.current;
      if (!tip || !ref.current) return;
      if (!p.time || !p.point) { tip.style.display = "none"; return; }
      const a = p.seriesData.get(port) as { value?: number } | undefined;
      const b = bench ? (p.seriesData.get(bench) as { value?: number } | undefined) : undefined;
      if (!a?.value) { tip.style.display = "none"; return; }
      tip.innerHTML =
        `<div style="color:#C9A02C">Portfólio: <b>${money(a.value)}</b></div>` +
        (b?.value ? `<div style="color:#5a7391">Referência: <b>${money(b.value)}</b></div>` : "");
      tip.style.display = "block";
      tip.style.left = Math.min(p.point.x + 14, ref.current.clientWidth - 160) + "px";
      tip.style.top = Math.max(8, p.point.y - 10) + "px";
    });

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [key, dates, equity, benchmark, height]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={ref} style={{ width: "100%" }} />
      <div ref={tipRef} style={{
        position: "absolute", display: "none", background: "rgba(4,9,16,.95)",
        border: "1px solid var(--line2)", borderRadius: 6, padding: "6px 9px",
        fontFamily: "var(--mono)", fontSize: 11, pointerEvents: "none", zIndex: 5,
      }} />
    </div>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────────────
export default function PortfolioBuilder() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [calendar, setCalendar] = useState<string[]>([]);
  const [bench, setBench] = useState<Benchmark | null>(null);
  const [series, setSeries] = useState<Record<string, StrategySeries>>({});
  const [carregando, setCarregando] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  const [sleeves, setSleeves] = useState<Sleeve[]>([]);
  const [mode, setMode] = useState<AllocMode>("linear");
  const [basis, setBasis] = useState<ScoreBasis>("retmes");
  const [rebalance, setRebalance] = useState<RebalanceFreq>("monthly");
  const [janela, setJanela] = useState<Janela>("10a");
  const [windowMode, setWindowMode] = useState<WindowMode>("common");
  const [dropNegative, setDropNegative] = useState(false);
  const [capital, setCapital] = useState(100000);

  // SETs pre-montados: carregam um setup inteiro no builder. `setAtivo` guarda
  // qual esta carregado — qualquer mexida do cliente nos pesos o solta, porque
  // dali em diante deixa de ser o SET validado.
  const [setsData, setSetsData] = useState<BenchmarkSetsData | null>(null);
  const [setAtivo, setSetAtivo] = useState<string | null>(null);
  const [descAberta, setDescAberta] = useState(false);
  // Relatório imprimível
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportAutor, setReportAutor] = useState("");
  const [reportCliente, setReportCliente] = useState("");
  const [reportRNCliente, setReportRNCliente] = useState<string>("");
  const [showReport, setShowReport] = useState(false);
  // Origem dos dados: "questionario" = veio do Ato 2 via URL; "manual" = digitado
  const [dadosOrigem, setDadosOrigem] = useState<"questionario" | "manual">("manual");

  // Le params do Ato 2 (URL) na primeira renderizacao — cliente, RN, capital.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const q = new URLSearchParams(window.location.search);
      const rn = q.get("rn");
      const cliente = q.get("cliente");
      const cap = q.get("capital");
      if (rn || cliente || cap) setDadosOrigem("questionario");
      if (rn) setReportRNCliente(rn);
      if (cliente) setReportCliente(cliente);
      if (cap) {
        const n = Number(cap);
        if (Number.isFinite(n) && n > 0) setCapital(n);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [volTarget, setVolTarget] = useState<PortfolioConfig["volTarget"]>(null);
  const [periodoFixo, setPeriodoFixo] = useState<PortfolioConfig["periodoFixo"]>(null);

  const [apresentando, setApresentando] = useState(false);

  const [metricaAberta, setMetricaAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<"todos" | "etf" | "acoes" | "defesa">("todos");
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/strategy-catalog")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error);
        setCatalog(j.catalog);
        setCalendar(j.calendar);
        setBench(j.benchmark?.["S&P 500"] ?? null);
      })
      .catch((e) => setErro(String(e.message ?? e)));
  }, []);

  // Os blocos dos SETs entram como series sinteticas: o motor compoe por curva
  // de capital, entao para ele um bloco e uma "estrategia" como outra qualquer.
  useEffect(() => {
    fetch("/api/benchmark-sets")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok === false) return;
        const d = j as BenchmarkSetsData;
        setSetsData(d);
        setSeries((m) => ({ ...m, ...seriesDosBlocos(d) }));
      })
      .catch(() => { /* sem SETs a tela segue funcionando normalmente */ });
  }, []);

  const carregarSerie = useCallback(async (id: string) => {
    if (series[id]) return;
    setCarregando((s) => new Set(s).add(id));
    try {
      const r = await fetch(`/api/strategy-series/${id}`);
      const j = (await r.json()) as StrategySeries;
      setSeries((m) => ({ ...m, [id]: j }));
    } catch {
      setErro("Falha ao carregar a série de " + id);
    } finally {
      setCarregando((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [series]);

  const meta = useMemo(() => {
    const m: Record<string, StrategyMeta> = {};
    catalog?.estrategias.forEach((e) => { m[e.id] = e; });
    // Os blocos dos SETs nao estao no catalogo — mas a lista de sleeves e a
    // barra de alocacao leem o rotulo daqui, entao entram com o nome deles.
    Object.values(series).filter((s) => ehBloco(s.id)).forEach((s) => {
      m[s.id] = { ...(m[s.id] ?? {}), id: s.id, label: s.label, nome: s.label,
                  grupo: "outras", sub: "" } as StrategyMeta;
    });
    return m;
  }, [catalog, series]);

  /** Quais das 41 preservam capital — derivado do universo que cada uma negocia. */
  const defensivas = useMemo(
    () => idsDeDefesa(catalog?.estrategias ?? []),
    [catalog],
  );

  /** Carrega um SET inteiro: sleeves, pesos, rebalance, janela travada e overlay. */
  const carregarSet = (setId: string) => {
    if (!setsData) return;
    const preset = presetsVitrine().find((p) => p.id === setId);
    if (!preset) return;
    if (setAtivo === setId) { limparSet(); return; }
    const cfg = configDoSet(preset.def, setsData, capital);
    setSleeves(cfg.sleeves);
    setMode(cfg.mode);
    setRebalance(cfg.rebalance);
    setWindowMode(cfg.window);
    setDropNegative(cfg.dropNegative);
    setVolTarget(cfg.volTarget ?? null);
    setPeriodoFixo(cfg.periodoFixo ?? null);
    setSetAtivo(setId);
    setCursor(null);
  };

  const limparSet = () => {
    setSleeves([]);
    setVolTarget(null);
    setPeriodoFixo(null);
    setSetAtivo(null);
  };

  /** Qualquer mexida na composicao solta o SET: deixou de ser o validado. */
  const soltarSet = () => {
    if (!setAtivo) return;
    setSetAtivo(null);
    setVolTarget(null);
    setPeriodoFixo(null);
  };

  const adicionar = (id: string) => {
    if (sleeves.some((s) => s.id === id)) return;
    soltarSet();
    void carregarSerie(id);
    setSleeves((prev) => {
      const n = prev.length + 1;
      const igual = 1 / n;
      // ao adicionar, reparte igualmente: o cliente ajusta depois.
      // O teto sugerido e o dobro do peso igual — nunca acima de 100%, que e
      // o portfolio inteiro e nao existe alocacao maior que isso.
      const teto = Math.min(1, Math.max(0.25, igual * 2));
      return [...prev.map((s) => ({ ...s, weight: igual })),
        { id, weight: igual, min: 0, max: teto }];
    });
  };
  const remover = (id: string) => {
    soltarSet();
    setSleeves((prev) => {
      const rest = prev.filter((s) => s.id !== id);
      const igual = rest.length ? 1 / rest.length : 0;
      return rest.map((s) => ({ ...s, weight: igual }));
    });
  };
  const igualar = () => {
    soltarSet();
    setSleeves((prev) => prev.map((s) => ({ ...s, weight: prev.length ? 1 / prev.length : 0 })));
  };

  const patch = (id: string, campo: keyof Sleeve, v: number) => {
    soltarSet();
    setSleeves((prev) => prev.map((s) => (s.id === id ? { ...s, [campo]: v } : s)));
  };

  const cfg: PortfolioConfig = useMemo(() => ({
    sleeves, mode, basis, rebalance, janela, window: windowMode, dropNegative, capital,
    volTarget, periodoFixo,
  }), [sleeves, mode, basis, rebalance, janela, windowMode, dropNegative, capital,
       volTarget, periodoFixo]);

  const viab = useMemo(() => checkFeasibility(cfg), [cfg]);

  /**
   * O PAR SEM OVERLAY do SET carregado.
   *
   * D5/D6 e SET2/SET3 tem a MESMA composicao — 50/30/20 nos dois casos. A unica
   * coisa que separa o Conservador do Balanceado e o overlay de vol-target. Sem
   * este comparativo, o cliente troca de um para o outro, ve os mesmos tres
   * pesos e conclui que a tela travou ou que os produtos sao iguais — e as duas
   * leituras matam a venda do Conservador, que e o SET de maior Sharpe E menor
   * queda da linha.
   *
   * Os numeros saem de `avaliarSet` nos dois SETs, na janela travada da
   * validacao: se a spec mudar, o texto acompanha sozinho.
   */
  const comparativoOverlay = useMemo(() => {
    if (!setAtivo || !setsData) return null;
    const alvo = SETS.find((s) => s.id === setAtivo);
    if (!alvo?.volTarget) return null;
    const assinatura = (s: SetDef) => s.composicao.map((c) => `${c.bloco}:${c.peso}`).join(" ");
    const par = SETS.find(
      (s) => s.id !== alvo.id && !s.volTarget && assinatura(s) === assinatura(alvo),
    );
    if (!par) return null;
    try {
      return {
        par,
        com: avaliarSet(alvo, setsData, capital).full,
        sem: avaliarSet(par, setsData, capital).full,
      };
    } catch {
      return null;
    }
  }, [setAtivo, setsData, capital]);
  const prontas = sleeves.filter((s) => series[s.id]).length;
  const todasCarregadas = sleeves.length > 0 && prontas === sleeves.length;

  const [sim, setSim] = useState<SimResult | null>(null);
  const [simErro, setSimErro] = useState<string | null>(null);

  useEffect(() => {
    if (!todasCarregadas || !viab.ok || !calendar.length) { setSim(null); return; }
    const t = setTimeout(() => {
      try {
        setSim(simulate(cfg, series, calendar, bench));
        setSimErro(null);
      } catch (e) {
        setSim(null);
        setSimErro(e instanceof Error ? e.message : String(e));
      }
    }, 120);
    return () => clearTimeout(t);
  }, [cfg, series, calendar, bench, todasCarregadas, viab.ok]);

  // cursor da linha do tempo: comeca no ultimo dia
  useEffect(() => {
    if (sim && (cursor == null || cursor >= sim.dates.length)) setCursor(sim.dates.length - 1);
  }, [sim, cursor]);

  const holdings = useMemo(() => {
    if (!sim || cursor == null) return [];
    return holdingsEm(cfg, series, sim, Math.min(cursor, sim.dates.length - 1));
  }, [sim, cursor, cfg, series]);

  // O tile mostra só título e valor. A explicação vive na faixa do topo, sob
  // demanda — cabe texto de verdade lá, e o quadro de correlação sobe.
  const metricas: Metrica[] = useMemo(() => {
    const m = sim?.metrics;
    if (!m) return [];
    const anos = m.anos.toFixed(m.anos < 3 ? 1 : 0);
    const bateuIndice = m.benchCagr != null && m.cagr > m.benchCagr;
    return [
      {
        id: "capital", k: "Capital final", v: money(m.capitalFinal),
        explica: `${multiplo(m.multiplo)} o capital inicial, em ${anos} anos. É o que ` +
          `${money(capital)} teriam virado se investidos no primeiro dia da janela e deixados ` +
          `rodando com o rebalance escolhido, sem aporte nem retirada.`,
      },
      {
        id: "cagr", k: "Retorno ao ano", v: pct(m.cagr, 2), tom: bateuIndice ? "pos" : undefined,
        explica: m.benchCagr != null
          ? `Retorno composto ao ano, já líquido das taxas do AlphaDroid. O S&P 500 rendeu ` +
            `${pct(m.benchCagr, 2)} ao ano na mesma janela — ` +
            `${bateuIndice ? `uma diferença de ${pct(m.cagr - m.benchCagr, 2)} ao ano a favor do portfólio`
                           : `o portfólio ficou atrás nesta janela`}. ` +
            `Composto, não é a média dos anos: um ano de −50% precisa de +100% para voltar ao zero.`
          : `Retorno composto ao ano, líquido das taxas do AlphaDroid.`,
      },
      {
        id: "dd", k: "Maior queda", v: pct(m.maxDrawdown, 1), tom: "neg",
        explica: `A pior distância entre um topo e o fundo seguinte: de ${brDate(m.maxDrawdownFrom)} ` +
          `a ${brDate(m.maxDrawdownTo)}. É o número que o cliente sente — quanto ele teria visto ` +
          `sumir da tela antes de recuperar. Um portfólio só é aceitável se esse número for ` +
          `suportável, por melhor que seja o retorno.`,
      },
      {
        id: "corr", k: "Correlação com S&P", v: m.correlacaoSP != null ? m.correlacaoSP.toFixed(2) : "—",
        explica: `Quanto o portfólio se move junto com o índice: 1 é sombra, 0 é indiferente, ` +
          `−1 é espelho. Mas este número sozinho engana — ele é a média de dois regimes opostos ` +
          `(${m.regimeExposto.correlacao?.toFixed(2) ?? "—"} exposto, ` +
          `${m.regimeDefesa.correlacao?.toFixed(2) ?? "—"} com a defesa armada). Veja o quadro abaixo.`,
      },
      {
        id: "vol", k: "Volatilidade", v: pct(m.volAnual, 1),
        explica: `Desvio-padrão anualizado dos retornos diários — o tamanho do sobe-e-desce ` +
          `do dia a dia, não a chance de perder. É o denominador do Sharpe ao lado: mesmo ` +
          `retorno com metade da volatilidade vale o dobro de Sharpe.`,
      },
      {
        id: "sharpe", k: "Sharpe", v: m.sharpe.toFixed(2),
        explica: `Retorno ao ano dividido pela volatilidade (taxa livre de risco = 0, padrão ` +
          `de toda a validação da casa). É a régua clássica de retorno por unidade de risco. ` +
          `Atenção: ele conta a oscilação de ALTA como risco — num portfólio de momento isso ` +
          `pune quem sobe rápido. Por isso o Sortino ao lado.`,
      },
      {
        id: "sortino", k: "Sortino", v: m.sortino.toFixed(2),
        explica: `Como o Sharpe, mas dividindo só pelo desvio das QUEDAS. Corrige o defeito de ` +
          `tratar um mês de +30% como risco. Aqui está em ${m.sortino.toFixed(2)} contra Sharpe ` +
          `de ${m.sharpe.toFixed(2)} — a diferença entre os dois é o tamanho da volatilidade que ` +
          `era de alta e estava sendo cobrada como se fosse perigo.`,
      },
      {
        id: "calmar", k: "Calmar", v: m.calmar.toFixed(2),
        explica: `Retorno ao ano dividido pela maior queda: ${pct(m.cagr, 1)} ÷ ` +
          `${pct(Math.abs(m.maxDrawdown), 1)}. É retorno por unidade de dor. Um portfólio que ` +
          `rende 30% com queda de 60% e outro que rende 15% com queda de 30% têm o mesmo Calmar ` +
          `— e é essa a comparação que o cliente faz na pele, não no Excel.`,
      },
      {
        id: "melhor", k: "Melhor ano", v: m.melhorAno ? pct(m.melhorAno.ret, 0) : "—", tom: "pos",
        explica: m.melhorAno
          ? `Melhor ano-calendário da janela: ${m.melhorAno.ano}, com ${pct(m.melhorAno.ret, 1)}. ` +
            `Anos parciais no começo e no fim da janela não concorrem — quatro meses não disputam ` +
            `com doze.`
          : `A janela é curta demais para ter um ano-calendário completo.`,
      },
      {
        id: "pior", k: "Pior ano", v: m.piorAno ? pct(m.piorAno.ret, 0) : "—", tom: "neg",
        explica: m.piorAno
          ? `Pior ano-calendário da janela: ${m.piorAno.ano}, com ${pct(m.piorAno.ret, 1)}. ` +
            `Vale olhar junto com a maior queda: o ano pode fechar de lado e ainda assim ter tido ` +
            `um tombo violento no meio.`
          : `A janela é curta demais para ter um ano-calendário completo.`,
      },
    ];
  }, [sim, capital]);

  const aberta = metricas.find((x) => x.id === metricaAberta) ?? null;

  /**
   * Nome curto pra leitura rapida. NAO confia em e.nome — o pipeline atual
   * gera valores truncados ("Developed Cou" em vez de "Developed Countries").
   * Deriva sempre do label + sub:
   *   1) se label tem " - <Nome legivel>", usa isso
   *   2) se o "depois de - " parece codigo (C22ACT1CD 154), pula pro sub
   *   3) se label NAO tem " - ", usa sub (formato setorial 154-171)
   *   4) fallback: label todo
   */
  const nomeCurto = useCallback((e: StrategyMeta): string => {
    const label = (e.label || "").trim();
    const sub = (e.sub || "").trim();
    const i = label.lastIndexOf(" - ");
    if (i >= 0) {
      const after = label.slice(i + 3).trim();
      // Descarta se o "depois de - " for codigo tipo "C22ACT1CD 154"
      // (letras/digitos com espaco curto — nao e nome humano de setor).
      if (after && !/^[A-Z0-9]+ ?\d*$/.test(after)) return after;
    }
    if (sub) return sub;
    return label;
  }, []);

  const lista = useMemo(() => {
    if (!catalog) return [];
    const q = busca.trim().toLowerCase();
    const filtradas = catalog.estrategias.filter((e) => {
      // "defesa" corta atravessado: nao e um grupo do catalogo, e o papel da
      // estrategia no portfolio, e ha defensivas tanto em ETF quanto em ações
      if (grupo === "defesa") { if (!defensivas.has(e.id)) return false; }
      else if (grupo !== "todos" && e.grupo !== grupo) return false;
      if (!q) return true;
      return (e.label + " " + e.sub + " " + e.simbolo_hoje).toLowerCase().includes(q);
    });
    // Ordena alfabeticamente pela chave de exibicao (nomeCurto). JD pediu:
    // Communications 1, Communications 2, Consumer Discretionary 1, 2,
    // Energy 1, 2, Financials 1, 2 — mais facil de localizar e ver que a
    // estrategia tem irmas 1 e 2 lado a lado. Usa localeCompare com
    // sensitivity 'base' pra ignorar acentos/caixa.
    return filtradas.sort((a, b) =>
      nomeCurto(a).localeCompare(nomeCurto(b), "pt-BR", {
        sensitivity: "base", numeric: true,
      })
    );
  }, [catalog, busca, grupo, defensivas, nomeCurto]);

  /**
   * Numeracao 1,2,3... quando existem varias estrategias do mesmo nome curto
   * (ex: duas "Energy"). Ordem estavel: mais antiga = 1.
   */
  const rotuloIndex = useMemo(() => {
    const out: Record<string, number> = {};
    if (!catalog) return out;
    const count: Record<string, number> = {};
    for (const e of catalog.estrategias) {
      const k = nomeCurto(e);
      count[k] = (count[k] ?? 0) + 1;
    }
    const seen: Record<string, number> = {};
    const ordenadas = [...catalog.estrategias].sort(
      (a, b) => (a.primeiro_dia || "").localeCompare(b.primeiro_dia || "")
    );
    for (const e of ordenadas) {
      const k = nomeCurto(e);
      if ((count[k] ?? 0) > 1) {
        seen[k] = (seen[k] ?? 0) + 1;
        out[e.id] = seen[k];
      }
    }
    return out;
  }, [catalog, nomeCurto]);

  // custo em historico de adicionar cada estrategia, no modo janela comum
  const inicioAtual = sleeves.length
    ? Math.max(...sleeves.filter((s) => meta[s.id]).map((s) => meta[s.id].start))
    : 0;

  /**
   * Quantos anos de historico o SET carregado tem. Usado pra desabilitar os
   * botoes de periodo maiores que o SET pode cobrir — sem isso o cliente
   * clica "20 anos" com o SET ativo e a janela colapsa pro maximo real
   * silenciosamente, o que confunde.
   *
   * Le direto do setsData.janela (que foi validada no export) — nao pode ser
   * derivado das sleeves porque os SETs usam blocos ("rotacao20", "aggbond")
   * que nao estao no catalogo de estrategias e nao tem primeiro_dia.
   */
  const anosMaxDoSet = useMemo(() => {
    if (!setAtivo || !setsData?.janela) return null;
    const inicio = new Date(setsData.janela.de + "T00:00:00Z").getTime();
    const fim = new Date(setsData.janela.ate + "T00:00:00Z").getTime();
    return Math.ceil((fim - inicio) / (365.25 * 86400 * 1000));
  }, [setAtivo, setsData]);

  if (erro) return <div style={{ padding: 24, color: "var(--red)" }}>{erro}</div>;
  if (!catalog) return <div style={{ padding: 24, color: "var(--tx3)" }}>Carregando catálogo…</div>;

  const somaPeso = sleeves.reduce((a, s) => a + s.weight, 0);
  const m = sim?.metrics;

  return (
    <div style={{ padding: "18px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* cabecalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-.02em" }}>
            Construção de portfólio
            <span style={{ color: "var(--tx3)", fontSize: 14, fontWeight: 400, marginLeft: 10 }}>
              {catalog.n_estrategias} estratégias · dados até {brDate(catalog.data_ref)}
            </span>
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--tx2)", fontSize: 13, maxWidth: 78 + "ch" }}>
            Escolha as estratégias, defina o peso de cada uma e veja o portfólio que teria existido —
            com os períodos em que a defesa esteve armada e o que estava carregado em cada dia.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <Segmentado
            valor={mode}
            onChange={(v) => setMode(v as AllocMode)}
            opcoes={[
              { v: "linear", label: "Alocação linear", hint: "peso fixo o tempo todo" },
              { v: "dynamic", label: "Alocação dinâmica", hint: "peso segue a força do momento" },
            ]}
          />
          {/* O botão que leva para a frente do cliente. Só acende com portfólio
              pronto — apresentar uma tela vazia é pior que não apresentar. */}
          <button
            onClick={() => setApresentando(true)}
            disabled={!sim}
            title={sim ? "Abrir em tela cheia e rodar a simulação" : "Monte um portfólio ou carregue um SET primeiro"}
            style={{
              font: "inherit", textAlign: "left", padding: "7px 15px", borderRadius: 6,
              cursor: sim ? "pointer" : "not-allowed",
              border: "1px solid " + (sim ? "var(--gold)" : "var(--line)"),
              background: sim ? "rgba(201,160,44,.18)" : "transparent",
              color: sim ? "var(--gold)" : "var(--tx3)",
              opacity: sim ? 1 : 0.55,
            }}
          >
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 650 }}>▶ Modo apresentação</span>
            <span style={{ display: "block", fontSize: 10.5, opacity: .75 }}>simular em tempo real</span>
          </button>
          <button
            onClick={() => setReportModalOpen(true)}
            disabled={!sim}
            title={sim ? "Gerar relatório em PDF pra levar pro cliente" : "Monte um portfólio primeiro"}
            style={{
              font: "inherit", textAlign: "left", padding: "7px 15px", borderRadius: 6,
              cursor: sim ? "pointer" : "not-allowed",
              border: "1px solid " + (sim ? "var(--line2)" : "var(--line)"),
              background: "transparent",
              color: sim ? "var(--tx1)" : "var(--tx3)",
              opacity: sim ? 1 : 0.55,
            }}
          >
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 650 }}>📄 Ver Relatório</span>
            <span style={{ display: "block", fontSize: 10.5, opacity: .75 }}>Análise + PDF</span>
          </button>
          <a
            href="/presentation/biblioteca-ativos"
            target="_blank"
            rel="noopener noreferrer"
            title="Consulta o universo completo de tickers de cada estratégia — abre em nova aba"
            style={{
              font: "inherit", textAlign: "left", padding: "7px 15px", borderRadius: 6,
              cursor: "pointer", textDecoration: "none",
              border: "1px solid var(--line2)",
              background: "transparent",
              color: "var(--tx1)",
              display: "inline-block",
            }}
          >
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 650 }}>📚 Biblioteca de Ativos</span>
            <span style={{ display: "block", fontSize: 10.5, opacity: .75 }}>o que está dentro</span>
          </a>
        </div>
      </div>

      {/* janela de analise — o controle principal do ato:
          "e se eu tivesse investido ha X?" */}
      <div style={{
        background: "var(--panel)", border: "1px solid var(--line)",
        borderRadius: "var(--r-md)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px" }}>
          <span style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)", fontWeight: 600 }}>
            Se eu tivesse investido
          </span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {JANELAS.map((j) => {
              const on = j.id === janela;
              // desabilita periodos que ultrapassam o historico do SET carregado
              // (SETs comecam em 2012 — ~14 anos —, entao 20a/30a/Tudo ficam off)
              const disabled = anosMaxDoSet != null && (j.anos == null || j.anos > anosMaxDoSet);
              return (
                <button key={j.id}
                  disabled={disabled}
                  title={disabled
                    ? `SET tem histórico de ~${anosMaxDoSet} anos — este período não é disponível`
                    : undefined}
                  onClick={() => {
                    if (disabled) return;
                    // libera a janela travada do SET assim que o cliente escolhe
                    // um periodo — a composicao do SET continua carregada, mas
                    // agora os numeros e o grafico respondem a cada clique
                    if (periodoFixo) setPeriodoFixo(null);
                    setJanela(j.id);
                  }} style={{
                    font: "inherit", fontSize: 12.5, fontWeight: on ? 600 : 500,
                    padding: "5px 12px", borderRadius: 5,
                    cursor: disabled ? "not-allowed" : "pointer",
                    border: "1px solid " + (on ? "var(--gold)" : "var(--line2)"),
                    background: on ? "rgba(201,160,44,.16)" : "transparent",
                    color: on ? "var(--gold)" : "var(--tx2)",
                    opacity: disabled ? 0.35 : 1,
                  }}>{j.label}</button>
              );
            })}
          </div>
          {sim && (
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--tx3)" }}>
              {brDate(sim.dates[0])} → {brDate(sim.dates[sim.dates.length - 1])}
            </span>
          )}
        </div>

        {/* SETs prontos — do lado dos anos, com cara diferente de propósito:
            estes botões não filtram a janela, eles TROCAM o portfólio inteiro. */}
        {setsData && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "10px 14px", borderTop: "1px solid var(--line)",
            background: "rgba(201,160,44,.04)",
          }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)", fontWeight: 600 }}>
              Ou carregue um SET pronto
            </span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {presetsVitrine().map((p) => {
                const on = setAtivo === p.id;
                return (
                  <button key={p.id} onClick={() => carregarSet(p.id)} aria-pressed={on} style={{
                    font: "inherit", fontSize: 12.5, fontWeight: on ? 650 : 550,
                    padding: "5px 12px 5px 6px", borderRadius: 5, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 8,
                    border: "1px solid " + (on ? "var(--gold)" : "var(--line2)"),
                    background: on ? "rgba(201,160,44,.2)" : "var(--bg2)",
                    color: on ? "var(--gold)" : "var(--tx1)",
                  }}>
                    <span style={{
                      fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em",
                      padding: "2px 5px", borderRadius: 3,
                      background: on ? "var(--gold)" : "var(--line2)",
                      color: on ? "#0b1220" : "var(--tx2)",
                    }}>SET</span>
                    {p.rotulo}
                  </button>
                );
              })}
            </div>
            {setAtivo && (
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <button
                  onClick={() => setDescAberta((v) => !v)}
                  aria-pressed={descAberta}
                  title="Ver a composição do SET e o papel de cada bloco"
                  style={{
                    font: "inherit", fontSize: 12, background: "transparent", border: 0,
                    color: descAberta ? "var(--gold)" : "var(--tx2)",
                    cursor: "pointer", textDecoration: "underline",
                    textUnderlineOffset: 3, padding: 0,
                  }}
                >{descAberta ? "fechar descrição" : "descrição"}</button>
                <button onClick={limparSet} style={{
                  font: "inherit", fontSize: 12, background: "transparent", border: 0,
                  color: "var(--tx3)", cursor: "pointer", textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}>limpar</button>
              </div>
            )}
            <span style={{ fontSize: 11.5, color: "var(--tx3)", marginLeft: "auto" }}>
              {setAtivo
                ? (periodoFixo
                    ? "janela travada no período validado — clique um período pra liberar"
                    : "janela livre — os números respondem a cada período")
                : "sobe montado, com os percentuais já fechados"}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 16, alignItems: "start" }}>
        {/* ── coluna esquerda: catalogo + portfolio ─────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Painel titulo="Catálogo">
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {([["todos", "Todas"], ["etf", "ETF / Macro"], ["acoes", "Ações setoriais"]] as const).map(([g, l]) => (
                <button key={g} onClick={() => setGrupo(g)} style={chip(grupo === g)}>{l}</button>
              ))}
              <button
                onClick={() => setGrupo("defesa")}
                title="As que preservam capital em crise: renda fixa, ouro e commodities"
                style={{
                  ...chip(grupo === "defesa"),
                  borderColor: grupo === "defesa" ? "#5FB98C" : "var(--line2)",
                  background: grupo === "defesa" ? "rgba(95,185,140,.16)" : "transparent",
                  color: grupo === "defesa" ? "#5FB98C" : "var(--tx2)",
                }}
              >
                Defesa <span style={{ opacity: .7 }}>{defensivas.size}</span>
              </button>
            </div>
            <input
              value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar estratégia ou ticker…"
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 6, marginBottom: 8,
                background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--tx)",
                font: "inherit", fontSize: 13,
              }}
            />
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {lista.map((e) => {
                const dentro = sleeves.some((s) => s.id === e.id);
                const custo = windowMode === "common" && sleeves.length > 0 && e.start > inicioAtual
                  ? Math.round((e.start - inicioAtual) / 252) : 0;
                return (
                  <button
                    key={e.id} onClick={() => (dentro ? remover(e.id) : adicionar(e.id))}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                      padding: "6px 8px", borderRadius: 5, cursor: "pointer", font: "inherit",
                      background: dentro ? "rgba(201,160,44,.12)" : "transparent",
                      border: "1px solid " + (dentro ? "rgba(201,160,44,.4)" : "transparent"),
                      color: "var(--tx)",
                    }}
                  >
                    <span style={{ color: dentro ? "var(--gold)" : "var(--tx3)", fontSize: 13, width: 12 }}>
                      {dentro ? "−" : "+"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {/* Nome curto (branco, caixa alta e baixa, tamanho normal) — leitura rapida. */}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>
                        <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {nomeCurto(e)}{rotuloIndex[e.id] ? " " + rotuloIndex[e.id] : ""}
                        </span>
                        {/* escudo nas que preservam capital — vale ver mesmo com o
                            filtro em "Todas", que e onde o cliente navega */}
                        {defensivas.has(e.id) && (
                          <span title={classificar(e).porque} style={{
                            flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
                            padding: "1px 5px", borderRadius: 3, background: "rgba(95,185,140,.18)",
                            color: "#5FB98C",
                          }}>DEFESA</span>
                        )}
                      </span>
                      {/* Codigo AlphaDroid + ano, em mono e escurinho — descrição tecnica. */}
                      <span style={{ display: "block", fontSize: 10.5, color: "var(--tx3)", fontFamily: "var(--mono)", marginTop: 1 }}>
                        {e.label} · desde {e.primeiro_dia.slice(0, 4)}
                        {e.em_defesa_hoje && <span style={{ color: "var(--blue)" }}> · em defesa hoje</span>}
                      </span>
                    </span>
                    {custo > 0 && (
                      <span title={`Entra em ${e.primeiro_dia}: recorta o backtest em ${custo} anos`}
                        style={{ fontSize: 10, color: "var(--orange)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                        −{custo}a
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Painel>

          <Painel
            titulo={`Meu portfólio · ${sleeves.length}`}
            acao={sleeves.length > 0 ? (
              <div style={{ display: "flex", gap: 6 }}>
                {mode === "linear" && <button onClick={igualar} style={chip(false)}>Igualar</button>}
                <button onClick={() => setSleeves([])} style={chip(false)}>Limpar</button>
              </div>
            ) : null}
          >
            {sleeves.length === 0 ? (
              <p style={{ margin: 0, color: "var(--tx3)", fontSize: 12.5 }}>
                Nenhuma estratégia ainda. Escolha no catálogo acima para começar.
              </p>
            ) : (
              <>
                {mode === "linear" && (
                  <BarraAlocacao sleeves={sleeves} meta={meta} soma={somaPeso} />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {sleeves.map((s, i) => (
                    <SleeveRow
                      key={s.id} sleeve={s} meta={meta[s.id]} cor={CORES[i % CORES.length]}
                      mode={mode} carregando={carregando.has(s.id)}
                      nomeCurto={meta[s.id] ? nomeCurto(meta[s.id]) : undefined}
                      explicacao={explicacaoSleeve(s.id, meta[s.id])}
                      onPatch={(c, v) => patch(s.id, c, v)} onRemove={() => remover(s.id)}
                    />
                  ))}
                </div>

                {/* O SLEEVE QUE FALTAVA NA TELA.
                    O overlay de vol-target move dinheiro de verdade para caixa —
                    `exposicao` ja e calculado dia a dia no motor, e (1−e) rende
                    zero. Sem esta linha, trocar Balanceado por Conservador nao
                    mexe nada aqui (a composicao dos dois E identica) e a tela
                    parece travada. Isto nao e enfeite: e a quarta posicao real
                    da carteira, que ate agora nao estava representada. */}
                {volTarget && (() => {
                  const e = sim?.exposicao ?? null;
                  const caixaMedia = e && e.length
                    ? 1 - e.reduce((a, b) => a + b, 0) / e.length : null;
                  const caixaMax = e && e.length ? 1 - Math.min(...e) : null;
                  return (
                    <div style={{
                      marginTop: 8, padding: "9px 11px", borderRadius: 6,
                      border: "1px dashed rgba(201,160,44,.45)",
                      background: "rgba(201,160,44,.06)",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "baseline",
                        justifyContent: "space-between", gap: 8,
                      }}>
                        <span style={{ fontSize: 12.5, color: "var(--tx1)", fontWeight: 600 }}>
                          Caixa · proteção de volatilidade
                        </span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--gold)" }}>
                          {caixaMedia == null ? "—" : `${(caixaMedia * 100).toFixed(0)}% médio`}
                        </span>
                      </div>
                      <p style={{ margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.45, color: "var(--tx2)" }}>
                        Este peso <b>não é fixo</b>: toda semana o sistema mede a volatilidade
                        das últimas {volTarget.lookback} sessões e, se ela passou do teto de{" "}
                        {(volTarget.alvo * 100).toFixed(0)}% ao ano, tira risco sozinho.
                        {caixaMax != null && ` No momento mais tenso da janela chegou a ${(caixaMax * 100).toFixed(0)}% em caixa.`}{" "}
                        <span style={{ color: "var(--tx3)" }}>Nunca alavanca; o caixa rende zero.</span>
                      </p>
                    </div>
                  );
                })()}

                {/* Por que os sliders estao colados. O cliente ve min = max e
                    acha que a tela esta quebrada — a razao e que num SET
                    validado o peso TEM de ser o testado, senao os numeros
                    deixam de ser os da validacao. */}
                {setAtivo && (
                  <p style={{ margin: "9px 0 0", fontSize: 11.5, lineHeight: 1.45, color: "var(--tx3)" }}>
                    <b style={{ color: "var(--tx2)" }}>Pesos travados.</b> Este é um SET validado —
                    mínimo e máximo estão colados no peso que foi testado, para os números serem
                    exatamente os da validação. Mexer em qualquer slider solta o SET, e a partir daí
                    a carteira é sua.
                  </p>
                )}
              </>
            )}

            {viab.problemas.length > 0 && (
              <div style={{
                marginTop: 10, padding: "8px 10px", borderRadius: 6, fontSize: 12,
                background: "rgba(217,119,87,.1)", border: "1px solid rgba(217,119,87,.35)", color: "var(--orange)",
              }}>
                {viab.problemas.map((p, i) => <div key={i}>{p}</div>)}
              </div>
            )}
          </Painel>

          <Painel titulo="Como rodar">
            <Campo label="Capital inicial">
              <select value={capital} onChange={(e) => setCapital(+e.target.value)} style={sel}>
                {(() => {
                  const base = [10000, 100000, 1000000];
                  // Se o capital atual (vindo do URL, por exemplo) nao esta na
                  // lista, adiciona como opcao extra pra ele aparecer selecionado.
                  const opts = base.includes(capital) ? base : [...base, capital].sort((a, b) => a - b);
                  return opts.map((v) => <option key={v} value={v}>{money(v)}</option>);
                })()}
              </select>
            </Campo>
            <Campo label="Rebalance">
              <select value={rebalance} onChange={(e) => setRebalance(e.target.value as RebalanceFreq)} style={sel}>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </Campo>
            <Campo label="Janela" hint="quando as estratégias nascem em datas diferentes">
              <select value={windowMode} onChange={(e) => setWindowMode(e.target.value as WindowMode)} style={sel}>
                <option value="common">Só o período em comum</option>
                <option value="inception">Cada uma entra quando nasce</option>
              </select>
            </Campo>
            {mode === "dynamic" && (
              <>
                <Campo label="O peso segue" hint="qual métrica define a força">
                  <select value={basis} onChange={(e) => setBasis(e.target.value as ScoreBasis)} style={sel}>
                    <option value="retmes">Momento (RetMes%)</option>
                    <option value="ir">Momento ajustado a risco (IR)</option>
                  </select>
                </Campo>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--tx2)", marginTop: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={dropNegative} onChange={(e) => setDropNegative(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>Zerar quem está com momento negativo <span style={{ color: "var(--tx3)" }}>— em vez de deixar no piso</span></span>
                </label>
              </>
            )}
          </Painel>
        </div>

        {/* ── coluna direita: resultado ─────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Descrição do SET saiu daqui: agora abre embaixo do grafico pelo
              botao "descricao" ao lado de "limpar". Os numeros aparecem
              sempre em cima do grafico, e a descricao/decisao fica no
              rodape — navegacao top-down. */}
          {!sim ? (
            <Painel titulo="Resultado">
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--tx3)", fontSize: 13 }}>
                {simErro ? <span style={{ color: "var(--orange)" }}>{simErro}</span>
                  : sleeves.length === 0 ? "Escolha as estratégias à esquerda — a curva aparece aqui."
                  : !todasCarregadas ? `Carregando séries… ${prontas}/${sleeves.length}`
                  : "Ajuste os pesos para somar 100%."}
              </div>
            </Painel>
          ) : (
            <>
              {/* NÚMEROS EM CIMA — a leitura vai de cima pra baixo: primeiro o
                  veredito numerico (retorno, drawdown, sharpe...), depois a
                  curva que produziu esses numeros. */}
              {/* RÉGUA FIXA. Calibrar peso na mão exige ver o número reagir,
                  e os sliders ficam na coluna da esquerda, muito abaixo da
                  dobra. Sem isto o gestor rola até o slider, mexe, rola de
                  volta pra ler o Sharpe, e repete — o loop de otimização
                  manual fica inviável. Grudada no topo, ele mexe e lê no
                  mesmo golpe de vista.

                  IMPORTANTE: o sticky esta como filho DIRETO da coluna
                  direita (o fragment <> que é irmao do gráfico, blindagem,
                  correlacao...). Se envolver num wrapper curto, o containing
                  block seria esse wrapper e o sticky se descolaria assim
                  que o wrapper saisse do viewport — que é logo. Assim
                  fica preso enquanto a coluna direita inteira existir.

                  `--pb-sticky-top`: cada host diz de quanto é o próprio
                  cabeçalho fixo (52px na apresentação, 86px no shell do
                  cockpit). Sem a variável, gruda em 0 e continua correto. */}
              {metricas.length > 0 && (
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 8,
                  position: "sticky", top: "var(--pb-sticky-top, 0px)", zIndex: 30,
                  // fundo opaco: sem ele o conteúdo passa por trás dos gaps da grade
                  background: "var(--bg, #0B1626)", padding: "8px 0",
                  boxShadow: "0 8px 18px -10px rgba(0,0,0,.75)",
                }}>
                  {metricas.map((x) => (
                    <Tile
                      key={x.id} k={x.k} v={x.v} tom={x.tom}
                      ativo={x.id === metricaAberta}
                      onClick={() => setMetricaAberta((a) => (a === x.id ? null : x.id))}
                    />
                  ))}
                </div>
              )}

              {/* explicação do número clicado — irma direta da régua pra
                  não voltar a criar um containing block curto. */}
              {aberta && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "10px 13px 11px", borderRadius: "var(--r-md)",
                  background: "rgba(201,160,44,.07)", border: "1px solid rgba(201,160,44,.32)",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--gold)", fontWeight: 700 }}>
                        {aberta.k}
                      </span>
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: 15,
                        color: aberta.tom === "pos" ? "var(--green)" : aberta.tom === "neg" ? "var(--red)" : "var(--tx)",
                      }}>{aberta.v}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--tx2)", maxWidth: "104ch" }}>
                      {aberta.explica}
                    </p>
                  </div>
                  <button
                    onClick={() => setMetricaAberta(null)} title="Fechar"
                    style={{
                      font: "inherit", fontSize: 15, lineHeight: 1, color: "var(--tx3)",
                      background: "transparent", border: "none", cursor: "pointer", padding: "0 2px",
                    }}
                  >×</button>
                </div>
              )}

              <Painel
                titulo="Capital do portfólio"
                acao={<span style={{ fontSize: 11.5, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
                  {brDate(sim.dates[0])} → {brDate(sim.dates[sim.dates.length - 1])} · {sim.dates.length.toLocaleString("pt-BR")} pregões
                </span>}
              >
                {sim.warnings.map((w, i) => (
                  <div key={i} style={{
                    marginBottom: 10, padding: "8px 10px", borderRadius: 6, fontSize: 12,
                    background: "rgba(217,184,79,.1)", border: "1px solid rgba(217,184,79,.3)", color: "var(--gold2)",
                  }}>{w}</div>
                ))}
                <CurvaCapital dates={sim.dates} equity={sim.equity} benchmark={sim.benchmark} />
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tx3)", fontWeight: 600 }}>
                      Quanto do portfólio estava blindado
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
                      {m && pct(m.pctDefesa / 100, 1)} dos pregões com mais de {LIMIAR_DEFESA * 100}% em defesa
                    </span>
                  </div>
                  <FaixaDefesa
                    frac={sim.defenseFrac} dates={sim.dates}
                    marcado={cursor} onHover={(i) => i != null && setCursor(i)}
                  />
                </div>
              </Painel>

              {/* DESCRIÇÃO DO SET — abre logo abaixo do grafico quando o cliente
                  clica em "descricao" no bloco de sets. Fica escondida quando
                  nao ha SET ativo ou o botao esta fechado. */}
              {setAtivo && descAberta && (() => {
                const preset = presetsVitrine().find((p) => p.id === setAtivo);
                if (!preset) return null;
                const composicao = descricaoDoSet(preset.def);
                return (
                  <Painel titulo={`Descrição · ${preset.rotulo}`}
                    acao={
                      <button onClick={() => setDescAberta(false)}
                        title="Fechar descrição"
                        style={{ font: "inherit", fontSize: 15, lineHeight: 1, color: "var(--tx3)", background: "transparent", border: "none", cursor: "pointer", padding: "0 2px" }}
                      >×</button>
                    }
                  >
                    <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.55, color: "var(--tx2)" }}>
                      {preset.def.tese}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {composicao.map((c) => (
                        <div key={c.bloco} style={{
                          display: "grid", gridTemplateColumns: "60px minmax(0,1fr)", gap: 12,
                          padding: "10px 12px", borderRadius: 6, background: "rgba(255,255,255,.025)",
                          border: "1px solid var(--line2)",
                        }}>
                          <span style={{
                            fontFamily: "var(--mono)", fontSize: 15, fontWeight: 700, color: "var(--gold)",
                            alignSelf: "start",
                          }}>{Math.round(c.peso * 100)}%</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", marginBottom: 2 }}>
                              {c.nome}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "var(--mono)", letterSpacing: ".02em", marginBottom: 4 }}>
                              {c.atribuicao}
                            </div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--tx2)" }}>
                              {c.explicacao}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {preset.def.volTarget && (
                      <div style={{
                        marginTop: 12, padding: "9px 12px", borderRadius: 6,
                        background: "rgba(79,156,217,.08)", border: "1px solid rgba(79,156,217,.35)",
                        fontSize: 12.5, color: "var(--tx1)", lineHeight: 1.5,
                      }}>
                        <strong style={{ color: "var(--blue)" }}>Alvo de volatilidade:</strong>{" "}
                        {Math.round(preset.def.volTarget.alvo * 100)}% ao ano ·{" "}
                        janela de {preset.def.volTarget.lookback} pregões. Reduz posição
                        automaticamente quando a volatilidade realizada sobe acima do alvo.
                      </div>
                    )}
                  </Painel>
                );
              })()}

              {m && (m.regimeDefesa.correlacao != null || m.regimeExposto.correlacao != null) && (
                <Painel titulo="Correlação com o S&P 500, por regime">
                  {/* as duas ressalvas ficam no pé de cada caixa, e não em faixas
                      atravessando a largura toda: cada uma explica o número que
                      está logo acima dela, e a linha some do layout */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10 }}>
                    <RegimeCard
                      titulo="Exposto ao mercado" cor="var(--tx2)" borda="var(--line2)"
                      r={m.regimeExposto}
                      nota="Segue o índice — é assim que o retorno é feito."
                      rodape={
                        <>
                          A correlação cheia da janela é{" "}
                          <b style={{ color: "var(--tx)" }}>{m.correlacaoSP?.toFixed(2) ?? "—"}</b> — a média deste
                          regime com o da direita. Sendo média de dois opostos, não descreve nenhum dos dois.
                        </>
                      }
                    />
                    <RegimeCard
                      titulo="Com a defesa armada" cor="var(--blue)" borda="rgba(79,156,217,.45)"
                      r={m.regimeDefesa}
                      nota="Saiu do índice: o dinheiro está em título, ouro ou caixa."
                      rodape={
                        <>
                          Os retornos são anualizados a partir da média diária de cada regime. Os dias de defesa são
                          salteados ao longo da janela, não um bloco contínuo: leia como{" "}
                          <i>&ldquo;no ritmo desses dias, o portfólio andaria a tanto por ano&rdquo;</i>.
                        </>
                      }
                    />
                  </div>
                </Painel>
              )}

              <Painel
                titulo="O que você estava carregando"
                colapsavel
                acao={<span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--gold)" }}>
                  {cursor != null && sim.dates[cursor] ? brDate(sim.dates[cursor]) : ""}
                </span>}
              >
                <input
                  type="range" min={0} max={sim.dates.length - 1} value={cursor ?? sim.dates.length - 1}
                  onChange={(e) => setCursor(+e.target.value)}
                  style={{ width: "100%", accentColor: "var(--gold)", marginBottom: 12 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {holdings.map((h) => (
                    <div key={h.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 5,
                      background: h.defense ? "rgba(79,156,217,.1)" : "var(--bg2)",
                      border: "1px solid " + (h.defense ? "rgba(79,156,217,.3)" : "var(--line)"),
                    }}>
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, minWidth: 62, color: h.defense ? "var(--blue)" : "var(--tx)" }}>
                        {h.symbol}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--tx2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.label}
                      </span>
                      {h.defense && (
                        <span style={{ fontSize: 10, letterSpacing: ".08em", color: "var(--blue)", fontWeight: 700 }}>DEFESA</span>
                      )}
                      <span style={{ fontFamily: "var(--mono)", fontSize: 13, minWidth: 54, textAlign: "right" }}>
                        {pct(h.weight, 1)}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--tx3)" }}>
                  <b style={{ color: "var(--blue)" }}>DEFESA</b> = a estratégia saiu do próprio universo e foi
                  para título, ouro ou caixa. É o StormGuard Armor tendo disparado naquele dia — lido do
                  histórico real, não de uma lista de crises escrita à mão.
                </p>
              </Painel>

              {sim.defensePeriods.length > 0 && (
                <Painel titulo={`Períodos de defesa · ${sim.defensePeriods.length}`} colapsavel abertoInicial={false}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 240, overflowY: "auto" }}>
                    {[...sim.defensePeriods].sort((a, b) => b.dias - a.dias).map((p, i) => (
                      <button key={i} onClick={() => setCursor(sim.dates.indexOf(p.from))} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "6px 9px", borderRadius: 5,
                        background: "transparent", border: "1px solid var(--line)", cursor: "pointer",
                        font: "inherit", color: "var(--tx)", textAlign: "left",
                      }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--tx2)" }}>
                          {brDate(p.from)} → {brDate(p.to)}
                        </span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--tx3)" }}>{p.dias} pregões</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--blue)", minWidth: 46, textAlign: "right" }}>
                          {pct(p.pico, 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                </Painel>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tela cheia, por cima de tudo: o momento em que o portfólio deixa de ser
          construído e passa a ser apresentado. */}
      {apresentando && sim && (
        <ApresentacaoPortfolio
          titulo={setAtivo
            ? presetsVitrine().find((p) => p.id === setAtivo)?.def.nome ?? "Portfólio"
            : `Portfólio · ${sleeves.length} estratégia${sleeves.length === 1 ? "" : "s"}`}
          subtitulo={setAtivo
            ? "SET pré-montado · rebalance mensal"
            : `${mode === "linear" ? "alocação linear" : "alocação dinâmica"} · rebalance ${
                { daily: "diário", weekly: "semanal", monthly: "mensal",
                  quarterly: "trimestral", yearly: "anual" }[rebalance]}`}
          cfg={cfg}
          sim={sim}
          meta={meta}
          setsData={setsData}
          onFechar={() => setApresentando(false)}
        />
      )}

      {/* Modal: pede autor e cliente antes de abrir o relatorio imprimivel. */}
      {reportModalOpen && sim && (
        <div
          onClick={() => setReportModalOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9998,
            background: "rgba(0,0,0,.6)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)", border: "1px solid var(--line)",
              borderRadius: 10, padding: "22px 24px", width: "min(440px, 92vw)",
              boxShadow: "0 10px 40px rgba(0,0,0,.6)",
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 17 }}>Gerar relatório</h3>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--tx3)" }}>
              PDF profissional com todos os números, gráfico, composição e análise do <b style={{ color: "var(--gold)" }}>JIM AI</b>.
            </p>
            {dadosOrigem === "questionario" ? (
              <div style={{
                marginBottom: 16, padding: "8px 12px", borderRadius: 5,
                background: "rgba(10,122,59,.12)", border: "1px solid rgba(10,122,59,.35)",
                fontSize: 11.5, color: "#0a7a3b",
              }}>
                <b>✓ Dados do Ato II carregados</b> — cliente, RN e capital vieram da apresentação.
              </div>
            ) : (
              <div style={{
                marginBottom: 16, padding: "10px 12px", borderRadius: 5,
                background: "rgba(224,132,32,.10)", border: "1px solid rgba(224,132,32,.35)",
                fontSize: 11.5, color: "#a15a10", lineHeight: 1.55,
              }}>
                <b>⚠ Sem dados do Ato II</b> — a URL não trouxe <code>?rn=</code> nem <code>?capital=</code>.
                Preencha manualmente abaixo, ou volte pra apresentação e clique no card do <b>Ato IV</b>
                (o link é montado com os dados que você inseriu no simulator-metas).
              </div>
            )}

            <label style={{ display: "block", fontSize: 11.5, color: "var(--tx2)", marginBottom: 4 }}>Nome do autor (quem montou)</label>
            <input
              value={reportAutor}
              onChange={(e) => setReportAutor(e.target.value)}
              placeholder="Ex: João Daniel"
              autoFocus
              style={{
                width: "100%", padding: "8px 11px", borderRadius: 5, marginBottom: 14,
                background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--tx)",
                font: "inherit", fontSize: 13,
              }}
            />

            <label style={{ display: "block", fontSize: 11.5, color: "var(--tx2)", marginBottom: 4 }}>Nome do cliente</label>
            <input
              value={reportCliente}
              onChange={(e) => setReportCliente(e.target.value)}
              placeholder="Ex: Family Office XYZ"
              style={{
                width: "100%", padding: "8px 11px", borderRadius: 5, marginBottom: 14,
                background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--tx)",
                font: "inherit", fontSize: 13,
              }}
            />

            <label style={{ display: "block", fontSize: 11.5, color: "var(--tx2)", marginBottom: 4 }}>
              Risk Number do cliente <span style={{ color: "var(--tx3)", fontSize: 10.5 }}>(do questionário — opcional)</span>
            </label>
            <input
              type="number" min={1} max={99}
              value={reportRNCliente}
              onChange={(e) => setReportRNCliente(e.target.value)}
              placeholder="1 a 99 (ex: 45)"
              style={{
                width: "100%", padding: "8px 11px", borderRadius: 5, marginBottom: 20,
                background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--tx)",
                font: "inherit", fontSize: 13,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setReportModalOpen(false);
                  setShowReport(true);
                }
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setReportModalOpen(false)}
                style={{
                  font: "inherit", padding: "8px 16px", borderRadius: 5,
                  background: "transparent", color: "var(--tx2)",
                  border: "1px solid var(--line)", cursor: "pointer",
                }}
              >Cancelar</button>
              <button
                onClick={() => { setReportModalOpen(false); setShowReport(true); }}
                style={{
                  font: "inherit", padding: "8px 18px", borderRadius: 5,
                  background: "var(--gold)", color: "#0b1220", fontWeight: 700,
                  border: "none", cursor: "pointer",
                }}
              >Gerar relatório →</button>
            </div>
          </div>
        </div>
      )}

      {/* Relatorio imprimivel — full screen com toolbar. Fecha voltando pro builder. */}
      {showReport && sim && (
        <ReportPrint
          autor={reportAutor}
          cliente={reportCliente}
          sim={sim}
          sleeves={sleeves}
          meta={meta}
          nomeCurto={nomeCurto}
          kpis={metricas.map((x) => ({ k: x.k, v: x.v, tom: x.tom }))}
          set={setAtivo ? SETS.find((s) => s.id === setAtivo) ?? null : null}
          setsData={setsData}
          mode={mode}
          rebalance={{ daily: "diário", weekly: "semanal", monthly: "mensal", quarterly: "trimestral", yearly: "anual" }[rebalance]}
          capital={capital}
          janelaLabel={JANELAS.find((j) => j.id === janela)?.label ?? "—"}
          curvaCapitalEl={<CurvaCapital dates={sim.dates} equity={sim.equity} benchmark={sim.benchmark} />}
          faixaDefesaEl={<FaixaDefesa frac={sim.defenseFrac} dates={sim.dates} marcado={null} onHover={() => {}} />}
          series={series}
          maxDrawdown={Math.abs(sim.metrics?.maxDrawdown ?? 0)}
          cagr={sim.metrics?.cagr ?? 0}
          volAnual={sim.metrics?.volAnual ?? 0}
          rnCliente={reportRNCliente ? Number(reportRNCliente) : null}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

// ── pecinhas ─────────────────────────────────────────────────────────────────
const sel: React.CSSProperties = {
  background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--tx)",
  borderRadius: 6, padding: "5px 8px", font: "inherit", fontSize: 12.5, width: "100%",
};

function chip(on: boolean): React.CSSProperties {
  return {
    font: "inherit", fontSize: 11.5, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
    border: "1px solid " + (on ? "var(--gold)" : "var(--line2)"),
    background: on ? "rgba(201,160,44,.15)" : "transparent",
    color: on ? "var(--gold)" : "var(--tx2)",
  };
}

function Painel({ titulo, acao, children, colapsavel, abertoInicial = true }: {
  titulo: string; acao?: React.ReactNode; children: React.ReactNode;
  colapsavel?: boolean; abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const mostra = !colapsavel || aberto;
  return (
    <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: mostra ? "13px 15px 15px" : "11px 15px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: mostra ? 10 : 0 }}>
        <h2
          onClick={colapsavel ? () => setAberto((v) => !v) : undefined}
          style={{
            margin: 0, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase",
            color: "var(--tx3)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
            cursor: colapsavel ? "pointer" : "default", userSelect: "none",
          }}
        >
          {colapsavel && (
            <span style={{
              display: "inline-block", transition: "transform .15s",
              transform: aberto ? "rotate(90deg)" : "none", color: "var(--gold)", fontSize: 9,
            }}>▶</span>
          )}
          {titulo}
        </h2>
        {acao}
      </header>
      {mostra && children}
    </section>
  );
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 11.5, color: "var(--tx2)", marginBottom: 3 }}>
        {label}{hint && <span style={{ color: "var(--tx3)" }}> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Só título e valor. A explicação saiu de dentro do tile porque o texto curto
 * deixava uma faixa morta à direita em cada um — nove tiles, nove buracos.
 * Clicar abre a explicação inteira na barra do topo, onde há largura para ela.
 */
function Tile({ k, v, tom, ativo, onClick }: {
  k: string; v: string; tom?: "pos" | "neg"; ativo: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      title="Ver o que este número significa"
      style={{
        font: "inherit", textAlign: "left", cursor: "pointer", width: "100%",
        background: ativo ? "rgba(201,160,44,.10)" : "var(--panel)",
        border: "1px solid " + (ativo ? "var(--gold)" : "var(--line)"),
        borderRadius: "var(--r-md)", padding: "9px 11px 10px",
        transition: "border-color .12s, background .12s",
      }}
    >
      <div style={{
        fontSize: 9.5, letterSpacing: ".09em", textTransform: "uppercase",
        color: ativo ? "var(--gold)" : "var(--tx3)", fontWeight: 600,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{k}</div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 23, lineHeight: 1.15, letterSpacing: "-.02em", marginTop: 3,
        color: tom === "pos" ? "var(--green)" : tom === "neg" ? "var(--red)" : "var(--tx)",
      }}>{v}</div>
    </button>
  );
}

/** Um dos dois regimes: quanto tempo, quanto andou junto, quanto rendeu de cada lado. */
function RegimeCard({ titulo, cor, borda, r, nota, rodape }: {
  titulo: string; cor: string; borda: string; r: RegimeStats; nota: string;
  rodape?: React.ReactNode;
}) {
  const linha = (k: string, v: string, tom?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginTop: 5 }}>
      <span style={{ fontSize: 12, color: "var(--tx2)" }}>{k}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: tom ?? "var(--tx)" }}>{v}</span>
    </div>
  );
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid " + borda, borderRadius: 6, padding: "12px 14px 13px" }}>
      <div style={{ fontSize: 10.5, letterSpacing: ".09em", textTransform: "uppercase", color: cor, fontWeight: 700 }}>
        {titulo}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 30, letterSpacing: "-.02em", marginTop: 5, color: cor }}>
        {r.correlacao != null ? r.correlacao.toFixed(2) : "—"}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--tx3)", marginBottom: 8 }}>
        {r.correlacao == null ? "poucos dias para medir"
          : r.correlacao < 0 ? "anda na direção oposta ao índice"
          : r.correlacao < 0.3 ? "praticamente não segue o índice"
          : r.correlacao < 0.6 ? "segue o índice em parte"
          : "acompanha o índice de perto"}
      </div>
      {linha("Pregões", `${r.dias.toLocaleString("pt-BR")} · ${pct(r.fracao, 0)} da janela`)}
      {linha("Portfólio", pct(r.retPortfolio, 1), r.retPortfolio >= 0 ? "var(--green)" : "var(--red)")}
      {linha("S&P 500", pct(r.retBenchmark, 1), r.retBenchmark >= 0 ? "var(--green)" : "var(--red)")}
      <p style={{ margin: "9px 0 0", fontSize: 11.5, color: "var(--tx3)", lineHeight: 1.4 }}>{nota}</p>
      {rodape && (
        <p style={{
          margin: "9px 0 0", paddingTop: 9, borderTop: "1px solid var(--line)",
          fontSize: 11, color: "var(--tx3)", lineHeight: 1.45,
        }}>{rodape}</p>
      )}
    </div>
  );
}

function Segmentado({ valor, onChange, opcoes }: {
  valor: string; onChange: (v: string) => void;
  opcoes: { v: string; label: string; hint: string }[];
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {opcoes.map((o) => {
        const on = o.v === valor;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            font: "inherit", textAlign: "left", padding: "7px 13px", borderRadius: 6, cursor: "pointer",
            border: "1px solid " + (on ? "var(--gold)" : "var(--line2)"),
            background: on ? "rgba(201,160,44,.14)" : "transparent",
            color: on ? "var(--gold)" : "var(--tx2)",
          }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{o.label}</span>
            <span style={{ display: "block", fontSize: 10.5, opacity: .75 }}>{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Barra empilhada: o cliente vê os 100% em vez de somar de cabeça. */
function BarraAlocacao({ sleeves, meta, soma }: {
  sleeves: Sleeve[]; meta: Record<string, StrategyMeta>; soma: number;
}) {
  const sobra = Math.max(0, 1 - soma);
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bg2)", border: "1px solid var(--line)" }}>
        {sleeves.map((s, i) => (
          <div key={s.id} title={`${meta[s.id]?.label ?? s.id} · ${pct(s.weight)}`}
            style={{ width: pct(Math.max(0, s.weight)), background: CORES[i % CORES.length] }} />
        ))}
        {sobra > 0.001 && <div style={{ width: pct(sobra), background: "transparent" }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11.5, fontFamily: "var(--mono)" }}>
        <span style={{ color: soma > 1.0001 ? "var(--red)" : soma < 0.9999 ? "var(--orange)" : "var(--green)" }}>
          {pct(soma)} alocado
        </span>
        {sobra > 0.001 && <span style={{ color: "var(--tx3)" }}>{pct(sobra)} sem destino</span>}
      </div>
    </div>
  );
}

/**
 * Monta o texto explicativo do sleeve pro popover do icone (?).
 *  - Blocos dos SETs (rotacao20, corrmin20, aggbond, maxcagr10):
 *    usa EXPLICACAO_BLOCO — texto denso e comercial.
 *  - Estrategias individuais do catalogo: assembla a partir do meta
 *    (subclasse, benchmark, retorno anual, sharpe, maxdd, universo).
 */
function explicacaoSleeve(id: string, m?: StrategyMeta): string {
  const bloco = EXPLICACAO_BLOCO[id as keyof typeof EXPLICACAO_BLOCO];
  if (bloco) return bloco;
  if (!m) return "";
  const partes: string[] = [];
  if (m.sub) partes.push(m.sub);
  if (m.referencia_nome) partes.push(`Benchmark: ${m.referencia_nome}`);
  const kpis: string[] = [];
  if (m.ann_return_all) kpis.push(`retorno anual ${m.ann_return_all}`);
  if (m.sharpe_all)     kpis.push(`Sharpe ${m.sharpe_all}`);
  if (m.maxdd_all)      kpis.push(`Max DD ${m.maxdd_all}`);
  if (kpis.length) partes.push(kpis.join(" · "));
  if (Array.isArray(m.universo) && m.universo.length) {
    partes.push(`Universo: ${m.universo.length} ativo${m.universo.length > 1 ? "s" : ""}`);
  }
  return partes.join(" · ");
}

function SleeveRow({ sleeve, meta, cor, mode, carregando, nomeCurto: nomeCurtoStr, explicacao, onPatch, onRemove }: {
  sleeve: Sleeve; meta?: StrategyMeta; cor: string; mode: AllocMode; carregando: boolean;
  nomeCurto?: string;
  explicacao?: string;
  onPatch: (campo: keyof Sleeve, v: number) => void; onRemove: () => void;
}) {
  const nomeExibicao = nomeCurtoStr || meta?.label || sleeve.id;
  const codigoExibicao = meta?.label && meta.label !== nomeExibicao ? meta.label : null;
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0, marginTop: 5 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Nome curto no topo — leitura rápida */}
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nomeExibicao}
            </span>
            {explicacao && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
                title="O que é isso?"
                aria-expanded={aberto}
                style={{
                  font: "inherit", flexShrink: 0,
                  width: 16, height: 16, borderRadius: "50%",
                  border: "1px solid var(--tx3)", background: "transparent",
                  color: "var(--tx3)", cursor: "pointer",
                  fontSize: 10, lineHeight: 1, padding: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >?</button>
            )}
          </span>
          {/* Código AlphaDroid embaixo em mono/escuro */}
          {codigoExibicao && (
            <span style={{ display: "block", fontSize: 10.5, color: "var(--tx3)", fontFamily: "var(--mono)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {codigoExibicao}
            </span>
          )}
        </span>
        {carregando && <span style={{ fontSize: 10.5, color: "var(--tx3)" }}>carregando…</span>}
        <button onClick={onRemove} title="Remover" style={{
          font: "inherit", fontSize: 14, lineHeight: 1, color: "var(--tx3)", background: "transparent",
          border: "none", cursor: "pointer", padding: "0 2px",
        }}>×</button>
      </div>

      {aberto && explicacao && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            margin: "-2px 0 8px", padding: "9px 11px",
            background: "rgba(201,160,44,0.08)",
            border: "1px solid rgba(201,160,44,0.35)",
            borderRadius: 5,
            fontSize: 11.5, lineHeight: 1.5, color: "var(--tx2)",
          }}
        >
          {explicacao}
        </div>
      )}

      {mode === "linear" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <input type="range" min={0} max={100} step={1} value={Math.round(sleeve.weight * 100)}
            onChange={(e) => onPatch("weight", +e.target.value / 100)}
            style={{ flex: 1, accentColor: cor }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, minWidth: 44, textAlign: "right" }}>
            {pct(sleeve.weight, 0)}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12 }}>
          <MinMax label="Mínimo" cor="var(--tx3)" v={sleeve.min}
            onChange={(v) => onPatch("min", Math.min(v, sleeve.max))} />
          <MinMax label="Máximo" cor={cor} v={sleeve.max}
            onChange={(v) => onPatch("max", Math.max(v, sleeve.min))} />
        </div>
      )}
    </div>
  );
}

function MinMax({ label, v, cor, onChange }: {
  label: string; v: number; cor: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--tx3)", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontFamily: "var(--mono)", color: "var(--tx2)" }}>{pct(v, 0)}</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={Math.round(v * 100)}
        onChange={(e) => onChange(+e.target.value / 100)}
        style={{ width: "100%", accentColor: cor }} />
    </div>
  );
}

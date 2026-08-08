// ============================================================
// PORTFOLIO BUILDER — motor de alocacao e simulacao
// ------------------------------------------------------------
// FRONTEIRA IMPORTANTE
// Este arquivo NAO calcula momento. RetMes%, IR, Slope e Sigma chegam prontos,
// dia a dia, do motor do Diogo (cascata dupla de EMA, d=30), conferido contra a
// planilha original com erro < 1e-14. Aqui so se faz duas coisas:
//   1. traduzir o momento ja calculado em PESO de portfolio
//   2. compor as curvas de capital das estrategias nesse peso
//
// SEM LOOK-AHEAD: o peso de um rebalance usa o momento do fechamento do dia t e
// so passa a valer a partir do dia t+1. Nenhuma decisao usa informacao futura.
// ============================================================

import type {
  Benchmark,
  DefensePeriod,
  Feasibility,
  Holding,
  Janela,
  PortfolioConfig,
  PortfolioMetrics,
  RegimeStats,
  SimResult,
  StrategySeries,
} from "./types";
import { JANELAS } from "./types";

const DIAS_ANO = 252;
/** a partir de que fracao blindada o dia conta como "portfolio em defesa" */
export const LIMIAR_DEFESA = 0.5;
/**
 * Tolerancia do limiar. Num portfolio 50/50 com uma estrategia defendida, a
 * fracao blindada cai EXATAMENTE em cima de 0,5 e a borda do periodo passaria a
 * ser decidida por ruido de ponto flutuante — periodos terminando no dia do
 * rebalance por acaso, nao por decisao do mercado. Com a folga, meio portfolio
 * blindado sempre conta como blindado, que e a leitura que o cliente espera.
 */
const FOLGA = 1e-9;
export const emDefesa = (frac: number) => frac >= LIMIAR_DEFESA - FOLGA;

// ── Resolucao dos pesos ──────────────────────────────────────────────────────

/**
 * Distribui 100% entre as estrategias proporcionalmente ao score, respeitando
 * piso e teto de cada uma.
 *
 * O algoritmo e um water-filling: reparte proporcionalmente, trava quem estourou
 * um limite, e redistribui o que sobrou entre as livres — ate ninguem violar
 * mais nada. Sem isso, um simples "proporcional depois corta no teto" devolveria
 * uma soma diferente de 100%.
 *
 * Score zero para todo mundo (nenhuma estrategia com momento positivo) cai no
 * rateio igualitario do que sobra acima dos pisos. Note que isso NAO deixa o
 * portfolio exposto: quando o momento some, as proprias estrategias ja estao
 * dentro de titulo/caixa pelo StormGuard. A defesa mora dentro delas.
 */
export function solveWeights(
  scores: number[],
  mins: number[],
  maxs: number[],
): number[] {
  const n = scores.length;
  if (n === 0) return [];

  const w = new Array<number>(n).fill(0);
  const travado = new Array<boolean>(n).fill(false);

  for (let iter = 0; iter <= n + 1; iter++) {
    let orcamento = 1;
    for (let i = 0; i < n; i++) if (travado[i]) orcamento -= w[i];

    const livres: number[] = [];
    for (let i = 0; i < n; i++) if (!travado[i]) livres.push(i);
    if (livres.length === 0) break;
    if (orcamento < 0) orcamento = 0;

    let soma = 0;
    for (const i of livres) soma += Math.max(0, scores[i]);

    for (const i of livres) {
      w[i] = soma > 0
        ? (orcamento * Math.max(0, scores[i])) / soma
        : orcamento / livres.length;
    }

    // trava o pior violador de cada rodada; converge em no maximo n rodadas
    let pior = -1;
    let excesso = 0;
    for (const i of livres) {
      const acimaDoTeto = w[i] - maxs[i];
      const abaixoDoPiso = mins[i] - w[i];
      const v = Math.max(acimaDoTeto, abaixoDoPiso);
      if (v > 1e-12 && v > excesso) {
        excesso = v;
        pior = i;
      }
    }
    if (pior < 0) break;
    w[pior] = w[pior] > maxs[pior] ? maxs[pior] : mins[pior];
    travado[pior] = true;
  }

  // normaliza residuo numerico
  let total = 0;
  for (let i = 0; i < n; i++) total += w[i];
  if (total > 0 && Math.abs(total - 1) > 1e-9) {
    for (let i = 0; i < n; i++) w[i] /= total;
  }
  return w;
}

/** Confere se os limites que o cliente pediu sao matematicamente possiveis. */
export function checkFeasibility(cfg: PortfolioConfig): Feasibility {
  const problemas: string[] = [];
  const somaMin = cfg.sleeves.reduce((a, s) => a + s.min, 0);
  const somaMax = cfg.sleeves.reduce((a, s) => a + s.max, 0);
  const somaPeso = cfg.sleeves.reduce((a, s) => a + s.weight, 0);

  if (cfg.sleeves.length === 0) {
    problemas.push("Nenhuma estratégia no portfólio.");
  }

  if (cfg.mode === "linear") {
    if (somaPeso > 1 + 1e-9) {
      problemas.push(
        `Os pesos somam ${(somaPeso * 100).toFixed(1)}% — passou de 100%.`,
      );
    }
  } else {
    if (somaMin > 1 + 1e-9) {
      problemas.push(
        `Os pisos somam ${(somaMin * 100).toFixed(1)}% — não cabem em 100%. ` +
          `Baixe o mínimo de alguma estratégia ou tire uma do portfólio.`,
      );
    }
    if (somaMax < 1 - 1e-9) {
      problemas.push(
        `Os tetos somam ${(somaMax * 100).toFixed(1)}% — não dá para alocar ` +
          `100% do portfólio. Suba o máximo de alguma estratégia.`,
      );
    }
    for (const s of cfg.sleeves) {
      if (s.min > s.max + 1e-9) {
        problemas.push(`Mínimo maior que o máximo em ${s.id}.`);
      }
    }
  }
  return { ok: problemas.length === 0, somaMin, somaMax, somaPeso, problemas };
}

// ── Calendario de rebalance ──────────────────────────────────────────────────

function ehDiaDeRebalance(freq: string, anterior: string, atual: string): boolean {
  if (freq === "daily") return true;
  const a = anterior.split("-");
  const b = atual.split("-");
  if (freq === "yearly") return a[0] !== b[0];
  if (freq === "quarterly") {
    const qa = Math.floor((+a[1] - 1) / 3);
    const qb = Math.floor((+b[1] - 1) / 3);
    return a[0] !== b[0] || qa !== qb;
  }
  if (freq === "monthly") return a[0] !== b[0] || a[1] !== b[1];
  if (freq === "weekly") return segundaFeiraDe(anterior) !== segundaFeiraDe(atual);
  return false;
}

/**
 * A segunda-feira da semana de `iso`. Serve para decidir "e o primeiro pregao da
 * semana?" comparando duas datas.
 *
 * Cuidado: dividir o epoch por 6048e5 NAO da isso. A epoca Unix comeca numa
 * quinta-feira, entao aquele bucket troca de semana na quinta — e o "primeiro
 * pregao da semana" cairia na quinta, nao na segunda. Toda a literatura e o
 * codigo de referencia usam semana ISO.
 */
function segundaFeiraDe(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dia = (d.getUTCDay() + 6) % 7;   // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

// ── Janela de analise ────────────────────────────────────────────────────────

/**
 * Primeiro pregao da janela pedida, contando para tras a partir do ultimo dia
 * com dado — nao a partir de hoje. O dado e de 31/07/2026; "5 anos" tem que
 * significar 31/07/2021, senao a janela encolhe sozinha conforme o arquivo
 * envelhece e o mesmo botao passa a mostrar numero diferente a cada semana.
 */
export function inicioDaJanela(calendar: string[], to: number, janela: Janela): number {
  const def = JANELAS.find((j) => j.id === janela);
  if (!def || def.anos === null) return 0;
  const fim = calendar[to];

  let alvo: string;
  if (def.anos === 0) {
    alvo = fim.slice(0, 4) + "-01-01"; // YTD
  } else {
    const [a, m, d] = fim.split("-").map(Number);
    alvo = `${a - def.anos}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return primeiroPregaoDe(calendar, alvo, to);
}

/** Primeiro pregao com data >= `alvo` (busca binaria: o calendario e ordenado). */
export function primeiroPregaoDe(calendar: string[], alvo: string, ate?: number): number {
  let lo = 0, hi = ate ?? calendar.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (calendar[mid] < alvo) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Ultimo pregao com data <= `alvo`; −1 se nenhum. */
export function ultimoPregaoAte(calendar: string[], alvo: string): number {
  let lo = 0, hi = calendar.length - 1, r = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (calendar[mid] <= alvo) { r = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return r;
}

// ── Simulacao ────────────────────────────────────────────────────────────────

export function simulate(
  cfg: PortfolioConfig,
  series: Record<string, StrategySeries>,
  calendar: string[],
  benchmark?: Benchmark | null,
): SimResult {
  const warnings: string[] = [];
  const sleeves = cfg.sleeves.filter((s) => series[s.id]);
  const k = sleeves.length;
  if (k === 0) throw new Error("Nenhuma estratégia carregada para simular.");

  const ini = sleeves.map((s) => series[s.id].start);
  const fim = sleeves.map((s) => series[s.id].start + series[s.id].n - 1);

  const dispDe = cfg.window === "common" ? Math.max(...ini) : Math.min(...ini);
  let to = cfg.window === "common" ? Math.min(...fim) : Math.max(...fim);

  // As series sinteticas de bloco (SET) tem uma folga de 1 dia no fim (o dia 0
  // do equity e o baseline, antes do primeiro retorno real — n = retornos + 1
  // — mas o `start` nao desconta esse dia, entao `fim` calculado aqui aponta
  // 1 pregao depois do ultimo pregao real do calendario). Isso e inofensivo
  // enquanto `periodoFixo` corta de volta pro dia validado, mas sem ele (ex.:
  // cliente clica num periodo por ano com o SET carregado) o indice passa do
  // fim do calendario e quebra tudo que le `calendar[to]`. Nenhuma serie real
  // pode ir alem do que o calendario tem — entao trava aqui, pra qualquer sleeve.
  if (to > calendar.length - 1) to = calendar.length - 1;

  // Periodo fixo: os SETs pre-montados foram medidos e aprovados num intervalo
  // especifico. Deixar o cliente mover a janela faria o numero da tela divergir
  // do numero validado — entao aqui a janela nao e negociavel.
  if (cfg.periodoFixo) {
    const ate = ultimoPregaoAte(calendar, cfg.periodoFixo.ate);
    if (ate >= 0) to = Math.min(to, ate);
  }

  if (to <= dispDe) {
    throw new Error(
      "As estratégias escolhidas não têm nenhum período em comum. " +
        "Troque para o modo de janela por nascimento ou remova a mais recente.",
    );
  }

  // a janela pedida nunca pode passar do que existe de dado
  const pedido = cfg.periodoFixo
    ? primeiroPregaoDe(calendar, cfg.periodoFixo.de)
    : inicioDaJanela(calendar, to, cfg.janela);
  const from = Math.max(dispDe, pedido);
  const janelaCurta = !cfg.periodoFixo && pedido < dispDe;

  if (to - from < 20) {
    throw new Error(
      `Sobram só ${to - from + 1} pregões nessa combinação de janela e estratégias. ` +
        `Escolha uma janela maior.`,
    );
  }

  if (janelaCurta) {
    const def = JANELAS.find((j) => j.id === cfg.janela);
    warnings.push(
      `Não há ${def?.label.toLowerCase()} de histórico com essas estratégias — ` +
        `a mais recente nasceu em ${calendar[dispDe]}. O gráfico mostra ` +
        `${((to - from) / 252).toFixed(1)} anos, e não a janela inteira.`,
    );
  }

  if (cfg.window === "common" && !janelaCurta) {
    const maisNova = sleeves[ini.indexOf(dispDe)];
    const perdidos = dispDe - Math.min(...ini);
    if (perdidos > 250 && cfg.janela === "max") {
      warnings.push(
        `A janela começa em ${calendar[dispDe]} por causa de ` +
          `${series[maisNova.id].label} — a mais recente do portfólio. ` +
          `Isso descarta ${Math.round(perdidos / 252)} anos de histórico das outras.`,
      );
    }
  }

  const ativo = (i: number, t: number) => t >= ini[i] && t <= fim[i];
  const local = (i: number, t: number) => t - ini[i];

  /** score de cada sleeve no fechamento do dia t (0 quando inativo/negativo) */
  const scoresEm = (t: number): number[] => {
    return sleeves.map((s, i) => {
      if (!ativo(i, t)) return 0;
      const ser = series[s.id];
      const arr = cfg.basis === "ir" ? ser.ir : ser.retmes;
      const v = arr[local(i, t)];
      if (v === null || !Number.isFinite(v)) return 0;
      return Math.max(0, v);
    });
  };

  const pesosAlvo = (t: number): number[] => {
    const vivos = sleeves.map((_, i) => ativo(i, t));
    const nVivos = vivos.filter(Boolean).length;
    if (nVivos === 0) return sleeves.map(() => 0);

    if (cfg.mode === "linear") {
      // peso fixo, renormalizado entre as que ja nasceram
      let soma = 0;
      sleeves.forEach((s, i) => { if (vivos[i]) soma += s.weight; });
      return sleeves.map((s, i) => (vivos[i] && soma > 0 ? s.weight / soma : 0));
    }

    const sc = scoresEm(t);
    const mins = sleeves.map((s, i) => {
      if (!vivos[i]) return 0;
      // momento negativo (score 0) zera a posicao, se o cliente pediu isso
      if (cfg.dropNegative && sc[i] <= 0) return 0;
      return s.min;
    });
    const maxs = sleeves.map((s, i) => {
      if (!vivos[i]) return 0;
      if (cfg.dropNegative && sc[i] <= 0) return 0;
      return s.max;
    });

    // reescala os limites para caberem em 100% quando so parte nasceu
    const somaMax = maxs.reduce((a, b) => a + b, 0);
    const somaMin = mins.reduce((a, b) => a + b, 0);
    if (somaMax < 1 && somaMax > 0) {
      const f = 1 / somaMax;
      for (let i = 0; i < k; i++) { maxs[i] *= f; mins[i] = Math.min(mins[i] * f, maxs[i]); }
    } else if (somaMin > 1) {
      const f = 1 / somaMin;
      for (let i = 0; i < k; i++) mins[i] *= f;
    }
    return solveWeights(sc, mins, maxs);
  };

  // ── loop principal ─────────────────────────────────────────────────────────
  const nDias = to - from + 1;
  const dates: string[] = new Array(nDias);
  const equity = new Array<number>(nDias);
  const defenseFrac = new Array<number>(nDias);
  const weights: number[][] = new Array(nDias);
  const benchOut = new Array<number | null>(nDias);
  const rebalanceDays: number[] = [];

  let valores = pesosAlvo(from).map((w) => cfg.capital * w);
  let vivosAnterior = sleeves.map((_, i) => ativo(i, from)).join(",");

  // Referencia do SISTEMA, nao da primeira estrategia da lista. Se saisse de uma
  // das selecionadas, trocar uma estrategia mudaria o benchmark junto — e a
  // correlacao com o S&P deixaria de ser comparavel entre dois portfolios.
  const benchIdx = (t: number) =>
    benchmark && t >= benchmark.start && t < benchmark.start + benchmark.n
      ? benchmark.valores[t] : null;
  const benchBase = benchIdx(from);

  for (let t = from; t <= to; t++) {
    const d = t - from;
    dates[d] = calendar[t];

    if (d > 0) {
      for (let i = 0; i < k; i++) {
        if (!ativo(i, t) || !ativo(i, t - 1)) {
          if (ativo(i, t) && !ativo(i, t - 1)) valores[i] = 0; // nasce zerada
          continue;
        }
        const ser = series[sleeves[i].id];
        const li = local(i, t);
        const p = ser.equity[li - 1];
        const c = ser.equity[li];
        valores[i] *= p > 0 ? c / p : 1;
      }
    }

    let port = 0;
    for (let i = 0; i < k; i++) port += valores[i];
    equity[d] = port;

    const wDia = new Array<number>(k);
    let blindado = 0;
    for (let i = 0; i < k; i++) {
      const w = port > 0 ? valores[i] / port : 0;
      wDia[i] = w;
      if (ativo(i, t)) {
        const ser = series[sleeves[i].id];
        const li = local(i, t);
        // Bloco de SET e cesta: pode estar 30% blindado. `defesaFrac` traz essa
        // fracao; estrategia individual segue binaria (dentro ou fora do universo).
        const df = ser.defesaFrac
          ? (ser.defesaFrac[li] ?? 0)
          : (ser.defensivo[ser.sym[li]] ? 1 : 0);
        blindado += w * df;
      }
    }
    weights[d] = wDia;
    defenseFrac[d] = blindado;

    const bv = benchIdx(t);
    benchOut[d] = benchBase && bv !== null ? (bv / benchBase) * cfg.capital : null;

    // rebalance no fechamento => passa a valer amanha (sem look-ahead)
    const vivosAgora = sleeves.map((_, i) => ativo(i, t)).join(",");
    const nasceuAlguem = vivosAgora !== vivosAnterior;
    const naData =
      d > 0 && ehDiaDeRebalance(cfg.rebalance, dates[d - 1], dates[d]);

    if (port > 0 && (nasceuAlguem || naData)) {
      const alvo = pesosAlvo(t);
      for (let i = 0; i < k; i++) valores[i] = port * alvo[i];
      rebalanceDays.push(d);
    }
    vivosAnterior = vivosAgora;
  }

  // ── overlay de vol targeting ───────────────────────────────────────────────
  // Aplicado DEPOIS do loop, sobre o retorno do portfolio ja composto: a
  // volatilidade que dimensiona a exposicao e a da carteira SEM escala. Medir na
  // serie ja escalada realimentaria a propria decisao — depois de um susto a
  // exposicao nunca voltaria a subir.
  //
  // A exposicao e decidida no primeiro pregao da semana com os `lookback`
  // retornos ATE A VESPERA, e vale desse dia em diante. Nao olha para frente.
  const exposicao = cfg.volTarget ? new Array<number>(nDias).fill(1) : null;
  if (cfg.volTarget && exposicao) {
    const { alvo, lookback } = cfg.volTarget;
    const base = new Array<number>(nDias).fill(0);
    for (let d = 1; d < nDias; d++) {
      base[d] = equity[d - 1] > 0 ? equity[d] / equity[d - 1] - 1 : 0;
    }
    let e = 1;
    let capitalAcum = equity[0];
    const novo = new Array<number>(nDias);
    novo[0] = equity[0];
    for (let d = 1; d < nDias; d++) {
      if (ehDiaDeRebalance("weekly", dates[d - 1], dates[d]) && d - 1 >= lookback) {
        const vol = desvioPop(base, d - lookback, d) * Math.sqrt(DIAS_ANO);
        e = vol > 0 ? Math.min(1, alvo / vol) : 1;
      }
      exposicao[d] = e;
      capitalAcum *= 1 + e * base[d];   // (1−e) em caixa a rf = 0
      novo[d] = capitalAcum;
    }
    exposicao[0] = exposicao.length > 1 ? exposicao[1] : 1;
    for (let d = 0; d < nDias; d++) equity[d] = novo[d];
  }

  const drawdown = new Array<number>(nDias);
  let pico = -Infinity;
  let ddMin = 0;
  let ddIni = 0;
  let ddFim = 0;
  let picoIdx = 0;
  for (let d = 0; d < nDias; d++) {
    if (equity[d] > pico) { pico = equity[d]; picoIdx = d; }
    const dd = pico > 0 ? equity[d] / pico - 1 : 0;
    drawdown[d] = dd;
    if (dd < ddMin) { ddMin = dd; ddIni = picoIdx; ddFim = d; }
  }

  return {
    from,
    to,
    dates,
    equity,
    drawdown,
    defenseFrac,
    weights,
    exposicao,
    benchmark: benchOut,
    rebalanceDays,
    warnings,
    defensePeriods: comprimirDefesa(dates, defenseFrac),
    metrics: metricas(cfg.capital, dates, equity, ddMin, dates[ddIni], dates[ddFim],
                      defenseFrac, benchOut),
  };
}

function metricas(
  capital: number,
  dates: string[],
  equity: number[],
  maxDD: number,
  ddDe: string,
  ddAte: string,
  defenseFrac: number[],
  bench: (number | null)[],
): PortfolioMetrics {
  const n = equity.length;
  const anos = n / DIAS_ANO;
  const final = equity[n - 1];

  const rets: number[] = [];
  for (let d = 1; d < n; d++) {
    if (equity[d - 1] > 0) rets.push(equity[d] / equity[d - 1] - 1);
  }
  const media = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const varia =
    rets.reduce((a, b) => a + (b - media) ** 2, 0) / (rets.length || 1);
  const volAnual = Math.sqrt(varia) * Math.sqrt(DIAS_ANO);

  // Sortino: so o desvio das QUEDAS. Nao pune quem sobe rapido, que e o defeito
  // do Sharpe num portfolio de momento — la, um mes de +30% conta como "risco".
  // Denominador com N cheio (nao so os dias negativos): senao a metrica premia
  // quem cai pouco por ter caido poucas vezes.
  let somaBaixa = 0;
  for (const r of rets) if (r < 0) somaBaixa += r * r;
  const downside = Math.sqrt(somaBaixa / (rets.length || 1)) * Math.sqrt(DIAS_ANO);

  // Correlacao contra o S&P 500 — cheia e separada por estado da defesa.
  //
  // O par de retornos do dia d e classificado pela defesa DO DIA d, nao do dia
  // anterior: o retorno de d foi ganho carregando a posicao de d, e e a posicao
  // que decide se o portfolio esta seguindo o indice ou nao.
  const rp: number[] = [], rb: number[] = [];
  const rpDef: number[] = [], rbDef: number[] = [];
  const rpExp: number[] = [], rbExp: number[] = [];
  for (let d = 1; d < n; d++) {
    const b0 = bench[d - 1], b1 = bench[d];
    if (!(equity[d - 1] > 0 && b0 != null && b1 != null && b0 > 0)) continue;
    const p = equity[d] / equity[d - 1] - 1;
    const q = b1 / b0 - 1;
    rp.push(p); rb.push(q);
    if (emDefesa(defenseFrac[d])) { rpDef.push(p); rbDef.push(q); }
    else { rpExp.push(p); rbExp.push(q); }
  }

  const correlacaoSP = pearson(rp, rb);
  const regimeDefesa = regime(rpDef, rbDef, rp.length);
  const regimeExposto = regime(rpExp, rbExp, rp.length);

  let benchCagr: number | null = null;
  const bIni = bench.find((v) => v != null);
  const bFim = [...bench].reverse().find((v) => v != null);
  if (bIni && bFim && anos > 0) benchCagr = (bFim / bIni) ** (1 / anos) - 1;

  // retorno por ano-calendario
  const porAno = new Map<number, { ini: number; fim: number; dias: number }>();
  for (let d = 0; d < n; d++) {
    const ano = +dates[d].slice(0, 4);
    const e = porAno.get(ano);
    if (!e) porAno.set(ano, { ini: d > 0 ? equity[d - 1] : capital, fim: equity[d], dias: 1 });
    else { e.fim = equity[d]; e.dias++; }
  }
  let melhor: { ano: number; ret: number } | null = null;
  let pior: { ano: number; ret: number } | null = null;
  for (const [ano, v] of porAno) {
    if (v.ini <= 0) continue;
    // o 1o e o ultimo ano quase sempre sao parciais: um pedaco de 4 meses nao
    // pode concorrer a "melhor ano" contra doze meses inteiros
    if (v.dias < 200) continue;
    const r = v.fim / v.ini - 1;
    if (!melhor || r > melhor.ret) melhor = { ano, ret: r };
    if (!pior || r < pior.ret) pior = { ano, ret: r };
  }

  const diasBlindados = defenseFrac.filter(emDefesa).length;
  const cagr = anos > 0 && capital > 0 ? (final / capital) ** (1 / anos) - 1 : 0;

  return {
    capitalFinal: final,
    multiplo: capital > 0 ? final / capital : 0,
    cagr,
    volAnual,
    sortino: downside > 0 ? (media * DIAS_ANO) / downside : 0,
    // Calmar: retorno anual por unidade de dor. Um portfolio que rende 30% ao
    // ano com queda de 60% e um que rende 15% com queda de 30% tem o mesmo
    // Calmar — e e essa a comparacao que o cliente sente na pele.
    calmar: maxDD < 0 ? cagr / Math.abs(maxDD) : 0,
    correlacaoSP,
    regimeDefesa,
    regimeExposto,
    benchCagr,
    // Sharpe com taxa livre de risco = 0. Comparavel entre portfolios montados
    // aqui; nao e comparavel com o Sharpe historico do AlphaDroid, que usa
    // janela e convencao propria.
    sharpe: volAnual > 0 ? (media * DIAS_ANO) / volAnual : 0,
    maxDrawdown: maxDD,
    maxDrawdownFrom: ddDe,
    maxDrawdownTo: ddAte,
    melhorAno: melhor,
    piorAno: pior,
    anos,
    pctDefesa: n > 0 ? (diasBlindados / n) * 100 : 0,
  };
}

/** Desvio-padrao populacional de `v[de .. ate-1]`. */
function desvioPop(v: number[], de: number, ate: number): number {
  const n = ate - de;
  if (n <= 0) return 0;
  let s = 0;
  for (let i = de; i < ate; i++) s += v[i];
  const m = s / n;
  let acc = 0;
  for (let i = de; i < ate; i++) { const d = v[i] - m; acc += d * d; }
  return Math.sqrt(acc / n);
}

/** Correlacao de Pearson. Devolve null com amostra pequena demais para valer. */
function pearson(a: number[], b: number[]): number | null {
  if (a.length < 30) return null;
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  const den = Math.sqrt(va * vb);
  return den > 0 ? cov / den : null;
}

/**
 * Retrato de um regime. O retorno e anualizado a partir da MEDIA diaria dos dias
 * daquele regime — nao do capital acumulado, que nao existe isolado: os dias de
 * defesa sao salteados ao longo de 38 anos, nao um bloco contiguo. Le-se como
 * "no ritmo desses dias, o portfolio andaria a X% ao ano".
 */
function regime(rp: number[], rb: number[], totalDias: number): RegimeStats {
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  return {
    dias: rp.length,
    fracao: totalDias > 0 ? rp.length / totalDias : 0,
    correlacao: pearson(rp, rb),
    retPortfolio: media(rp) * DIAS_ANO,
    retBenchmark: media(rb) * DIAS_ANO,
  };
}

/** Junta dias blindados consecutivos em periodos apresentaveis. */
function comprimirDefesa(dates: string[], frac: number[]): DefensePeriod[] {
  const out: DefensePeriod[] = [];
  let i = 0;
  while (i < frac.length) {
    if (emDefesa(frac[i])) {
      let j = i;
      let pico = frac[i];
      while (j + 1 < frac.length && emDefesa(frac[j + 1])) {
        j++;
        if (frac[j] > pico) pico = frac[j];
      }
      out.push({ from: dates[i], to: dates[j], dias: j - i + 1, pico });
      i = j + 1;
    } else i++;
  }
  return out;
}

/** O que o portfolio estava carregando num dia — ticker a ticker. */
export function holdingsEm(
  cfg: PortfolioConfig,
  series: Record<string, StrategySeries>,
  sim: SimResult,
  d: number,
): Holding[] {
  const sleeves = cfg.sleeves.filter((s) => series[s.id]);
  const t = sim.from + d;
  // Chaveado pela estrategia, nao pelo sleeve: a mesma estrategia pode estar em
  // dois blocos do mesmo SET (rotacao20 E corrmin20 escolhem as 41 do mesmo
  // universo). Duas linhas de 2,0% e 1,3% para a mesma posicao subdeclaram a
  // exposicao real de 3,3% — o painel responde "quanto eu tinha disso", entao
  // soma. Tickers iguais de estrategias DIFERENTES seguem separados: sao
  // posicoes distintas, com tese distinta, e o rotulo desambigua.
  const acc = new Map<string, Holding>();
  const somar = (h: Holding) => {
    const ja = acc.get(h.id);
    if (ja) ja.weight += h.weight;
    else acc.set(h.id, h);
  };
  sleeves.forEach((s, i) => {
    const ser = series[s.id];
    const li = t - ser.start;
    if (li < 0 || li >= ser.n) return;
    const w = sim.weights[d]?.[i] ?? 0;
    if (w <= 1e-6) return;

    // Bloco de SET: abre a cesta. Mostrar "Rotação mensal entre estratégias ·
    // 50%" nao responde a pergunta do painel — o gestor quer o ATIVO que estava
    // carregado naquele dia, e cada uma das 20 dentro do bloco carregava um.
    const comp = ser.composicaoBloco;
    if (comp) {
      comp.ids.forEach((sid, k) => {
        const wIn = comp.pesos[k]?.[li] ?? 0;
        if (wIn <= 1e-6) return;
        const tk = comp.ticker(k, li);
        if (!tk) return;
        somar({
          id: sid,                  // a estrategia, nao o par bloco/estrategia
          label: comp.labels[sid] ?? sid,
          symbol: tk.symbol,
          weight: w * wIn,          // peso no portfolio = peso do bloco x peso dentro
          defense: tk.defense,
        });
      });
      return;
    }

    const si = ser.sym[li];
    somar({
      id: s.id,
      label: ser.label,
      symbol: ser.simbolos[si],
      weight: w,
      defense: !!ser.defensivo[si],
    });
  });
  return [...acc.values()].sort((a, b) => b.weight - a.weight);
}

// ============================================================
// PORTFOLIO BUILDER — os 3 SETs demonstrativos (benchmarks pre-montados)
// ------------------------------------------------------------
// Spec: C:\dev\estrategias salvas para apresentacao\_lab\SPEC_3_SETS_BUILDER.md
// (v3 — 100% AlphaDroid)
//
// ATRIBUICAO (§0 da spec) — isto NAO e detalhe de copy, e o contrato comercial:
//   - as 41 estrategias, o motor de trading, o indicador de momento e a defesa
//     StormGuard sao do ecossistema AlphaDroid. A Harpian faz SO a alocacao.
//   - nenhum motor proprietario Harpian entra na composicao. A v3 tirou o
//     HC-US IG justamente para que a carteira seja 100% AlphaDroid e a Harpian
//     apareca so onde ela de fato atua: no balanceamento entre os motores.
//
// OS DOIS BLOCOS, AMBOS ALPHADROID
//   Rotacao — as 20 de maior momento do mes, teto de 10% cada.
//   Minima correlacao — as 20 que menos andam juntas, peso igual.
//   Sao contrapesos: uma persegue forca, a outra busca diferenca. A correlacao
//   entre elas sustenta o Sharpe da mistura acima do de qualquer uma sozinha.
//
// FRONTEIRA (a mesma do resto do modulo)
// Aqui NAO se seleciona estrategia. Os dois blocos-base rodam offline em
// `_pipeline\export_3sets.py` — a rotacao precisa do RetMes das 41 mes a mes, e
// o corr-min de uma matriz de correlacao de 252 pregoes a cada rebalance. Eles
// chegam como streams de retorno diario, junto com o Agg.Bond.
//
// O que ESTE arquivo faz e a composicao, que e o que o cliente ve mudar:
//   1. misturar os blocos com peso fixo, rebalanceando todo mes
//   2. aplicar o overlay de vol-target com sleeve de caixa
//   3. medir o resultado com as convencoes da §4.4 do HANDOFF_OTIMIZACAO
//
// CONVENCAO t/t+1: o rebalance mensal acontece no FECHAMENTO do dia t — o
// retorno de t ja foi acumulado com os pesos antigos, e os pesos novos so valem
// a partir de t+1. O overlay decide a exposicao ANTES do retorno do dia, com a
// volatilidade dos 21 pregoes ATE A VESPERA. Nenhum dos dois olha para frente.
//
// rf = 0: a parte nao investida pelo overlay (1−e) fica em caixa rendendo zero.
// ============================================================

const DIAS_ANO = 252;

/** Um bloco e uma fonte de retorno diario que os SETs combinam. */
export type BlocoId = "rotacao20" | "corrmin20" | "aggbond" | "maxcagr10" | "suavemin15";

/** 1 = comercial dinamica (rotacao) · 2 = institucional (corr-min). */
export type LinhaId = 1 | 2;

/** Payload de `data/strategies/benchmark-sets.json`. */
export interface BenchmarkSetsData {
  gerado_em: string;
  spec: string;
  origem: string;
  convencoes: {
    rebalance: string;
    rf: number;
    artefatoHcusigExpurgado: string;
    corrmin: { k: number; lookback: number; criterio: string };
    rotacao: { k: number; teto: number; criterio: string };
    /** a chave de regime: abaixo desta amplitude a carteira sai de risco */
    gatilho: { amplitudeMinima: number; criterio: string; idsDefesa: string[] };
    /** o SET de retorno maximo: 10 de ataque fixas, teto 25%, defesa no excedente */
    maxcagr: { k: number; teto: number; criterio: string; idsAtaque: string[] };
  };
  janela: { de: string; ate: string; fromIdx: number; toIdx: number; n: number };
  /** cortes in-sample / hold-out, em indices do vetor de retornos */
  cortes: { isFim: string; hoInicio: string; nIs: number; iHo: number };
  /** uma data por retorno: datas[i] e o dia do retorno rho[i] */
  datas: string[];
  blocos: Record<BlocoId, number[]>;
  /** regua: equal-weight das 41, rebalance mensal */
  ew41: number[];
  /** retorno diario do S&P 500, para a correlacao */
  spx: (number | null)[];
  /** indices i em que cai o primeiro pregao do mes */
  rebalMensal: number[];
  /** indices i em que cai o primeiro pregao da semana */
  rebalSemanal: number[];
  trocasPorRebalance: number;
  selecaoVigente: { data: string; ids: string[] } | null;
  /** carteira do bloco de rotacao no ultimo rebalance, com os pesos */
  rotacaoVigente: { data: string; emDefesa: boolean; pesos: { id: string; peso: number }[] } | null;
  /** carteira do SET de retorno maximo no ultimo rebalance */
  maxcagrVigente: { data: string; emDefesa: boolean; pesos: { id: string; peso: number }[] } | null;
  suavemin15Vigente?: { data: string; emDefesa: boolean; pesos: { id: string; peso: number }[] } | null;
  /** meses em que o gatilho de amplitude disparou */
  mesesEmDefesa: string[];
  historicoSelecao: { data: string; ids: string[] }[];
  labels: Record<string, string>;
  /** ordem das linhas de `pesosDiarios` */
  idsUniverso: string[];
  /**
   * Peso DIARIO de cada estrategia dentro de cada bloco, em decimo de ponto
   * percentual (450 = 4,5%). `pesosDiarios.rotacao20[i][d]` = peso da
   * estrategia `idsUniverso[i]` no dia `d`, contando o dia base.
   *
   * Nao e o peso do rebalance: dentro do mes ele deriva com o desempenho de
   * cada uma, e e essa deriva que a tela de apresentacao mostra respirando.
   */
  pesosDiarios: Record<"rotacao20" | "corrmin20" | "maxcagr10" | "suavemin15", number[][]>;
  /**
   * A analise tecnica por estrategia que o relatorio imprime quando um SET
   * esta carregado. Pre-computada no export (mesma janela validada) porque o
   * SET chega ao motor como bloco sintetico unico e o navegador nao tem as
   * 41 series individuais. Pesos sao DENTRO do bloco — o relatorio escala
   * pela composicao fixa do SET.
   */
  estatisticasBloco: Record<
    "rotacao20" | "corrmin20" | "maxcagr10" | "suavemin15",
    { estrategias: EstatisticaEstrategia[]; simbolosNegociados: string[] }
  >;
}

/** Estatistica tecnica de uma estrategia dentro de um bloco, na janela do export. */
export interface EstatisticaEstrategia {
  id: string;
  /** primeiro dia da serie da estrategia (inception, nao a janela) */
  desde: string;
  pesoMedio: number;
  pesoMax: number;
  pctTempoAtiva: number;
  retornoJanela: number;
  trocas: number;
  nAtivos: number;
  pctDefesa: number;
  mesesNeg: number;
  mesesTotal: number;
  retMesMedio: number;
  melhorMes: number;
  piorMes: number;
  topAtivos: { simbolo: string; retorno: number; dias: number }[];
}

export interface SetDef {
  id: string;
  nome: string;
  /** o texto do botao na barra do topo — curto, sem caixa alta */
  rotuloCurto: string;
  linha: LinhaId;
  perfil: "agressivo" | "balanceado" | "conservador";
  /** o que o cliente precisa entender em uma linha */
  tese: string;
  composicao: { bloco: BlocoId; peso: number }[];
  /** overlay de vol targeting, quando existe */
  volTarget?: { alvo: number; lookback: number };
}

export interface LinhaDef {
  id: LinhaId;
  nome: string;
  subtitulo: string;
  /** o argumento que essa linha carrega na mesa */
  narrativa: string;
}

export const LINHAS: LinhaDef[] = [
  {
    id: 1,
    nome: "Dinâmica AlphaDroid",
    subtitulo: "o mercado é o alocador",
    narrativa:
      "Dois critérios complementares sobre as mesmas 41 estratégias: um persegue quem " +
      "está forte, o outro busca quem anda diferente. E uma chave de regime que tira a " +
      "carteira inteira de risco quando o momento seca no universo todo.",
  },
];

/**
 * Os 3 SETs da spec v3 — 100% AlphaDroid.
 *
 * O QUE MUDOU NA v3 (decisao do Joao, 03/08/2026)
 * Saiu o bloco HC-US IG, que era o motor proprietario Harpian de acoes
 * individuais e ocupava 30-40% de cada SET. A regra virou: os SETs sao feitos
 * SO com os motores do AlphaDroid, e o trabalho da Harpian e balancear entre
 * eles.
 *
 * O custo foi medido antes de decidir: Sharpe caiu de 1,64/1,65/1,70 para
 * 1,63/1,64/1,63 — dentro do ruido. O preco real foi 2022, que era ~0% com o
 * motor proprietario e passa a −8%. Ainda metade da queda da regua (−15,3%).
 *
 * O que substituiu a maquina de regime que saiu junto com aquele motor: o
 * GATILHO DE AMPLITUDE, abaixo. Nao e enfeite — ele leva o Calmar de 1,17 para
 * 1,47 e e o unico mecanismo que tira a carteira TODA de risco (a defesa
 * StormGuard mora dentro de cada estrategia e nao conversa entre elas).
 */
export const SETS: SetDef[] = [
  {
    id: "d3",
    nome: "DINÂMICO AGRESSIVO",
    rotuloCurto: "Dinâmico Agressivo",
    linha: 1,
    perfil: "agressivo",
    tese: "Os dois critérios de alocação em peso igual, sem amortecedor. É o de maior retorno da casa.",
    composicao: [
      { bloco: "rotacao20", peso: 0.5 },
      { bloco: "corrmin20", peso: 0.5 },
    ],
  },
  {
    id: "d5",
    nome: "DINÂMICO BALANCEADO",
    rotuloCurto: "Dinâmico Balanceado",
    linha: 1,
    perfil: "balanceado",
    tese: "Os mesmos dois critérios com 20% em renda fixa: tira um quinto da queda e sobe o Sharpe.",
    composicao: [
      { bloco: "rotacao20", peso: 0.4 },
      { bloco: "corrmin20", peso: 0.4 },
      { bloco: "aggbond", peso: 0.2 },
    ],
  },
  {
    id: "d6",
    nome: "DINÂMICO CONSERVADOR",
    rotuloCurto: "Dinâmico Conservador",
    linha: 1,
    perfil: "conservador",
    tese: "O balanceado com alvo de volatilidade de 12% ao ano. Sai de risco sozinho quando o mercado agita.",
    composicao: [
      { bloco: "rotacao20", peso: 0.4 },
      { bloco: "corrmin20", peso: 0.4 },
      { bloco: "aggbond", peso: 0.2 },
    ],
    volTarget: { alvo: 0.12, lookback: 21 },
  },
  // O SET de retorno maximo (missao de 04/08/2026). Nao e da mesma familia dos
  // tres acima: o objetivo e CAGR maximo com Sharpe >= 1,1, nao Sharpe maximo.
  // As 10 de ataque foram escolhidas por busca de 65.213 combinacoes
  // (`_lab\max_cagr_10atk_5def.py`), com nucleo de 6 presente em 100% dos
  // top-50. A alocacao continua 100% dinamica: peso por momento com teto de
  // 25% por ataque, e o mesmo gatilho de amplitude dos outros blocos.
  {
    id: "dmax",
    nome: "MAX RETORNO DINÂMICO",
    rotuloCurto: "Max Retorno Dinâmico",
    linha: 1,
    perfil: "agressivo",
    tese:
      "Dez estratégias de ataque escolhidas para retorno máximo, com teto de 25% cada, " +
      "e as cinco de preservação de capital. Retorno primeiro — a volatilidade é o preço.",
    composicao: [{ bloco: "maxcagr10", peso: 1 }],
  },
  // 5o SET (missao 04/08/2026 · noite) — o espelho defensivo do DMAX.
  // Cesta selecionada por Sharpe max s.a. maxDD >= -4.5%, CAGR >= 6.5%, sem
  // ano negativo, entre 23.754 tentativas (`SUAVE_HANDOFF/suave_ledger.csv`).
  // 10 de ataque + 5 de preservacao com PISO de 1% em todas (ninguem zera),
  // motor DMAX por baixo, e OVERLAY de vol-target 3.5% aa (decisao semanal)
  // fabricando a suavidade. Exposicao media do overlay: 22%. Metricas de
  // conferencia em `SUAVE_HANDOFF/metricas_conferencia.json`: Sharpe 1,824,
  // CAGR 8,85%, vol 4,71%, maxDD -4,42%, 0 ano negativo em 15 anos.
  // SOBE SEM SELO DE VALIDACAO (pendencia Arena/custos, como o DMAX).
  {
    id: "dsuave",
    nome: "INSTITUCIONAL DINÂMICO",
    rotuloCurto: "Institucional Dinâmico",
    linha: 1,
    perfil: "conservador",
    tese:
      "O motor do DMAX na dose mínima. Cesta de 15 estratégias (piso de 1% em cada) " +
      "com overlay de volatilidade-alvo de 3,5% ao ano — exposição média ao motor de 22%, " +
      "o resto em caixa. Sharpe alto pela suavidade, não pelo retorno.",
    composicao: [{ bloco: "suavemin15", peso: 1 }],
    volTarget: { alvo: 0.035, lookback: 21 },
  },
];

/**
 * Rotulos dos blocos, com a atribuicao correta (§0 da spec).
 *
 * NUNCA escrever "Overnight" aqui: e o nome do repositorio e do robo de
 * monitoramento noturno, nao o nome do algoritmo. O que o cliente ve e HC-US IG,
 * que e proprietario Harpian — ao contrario das 41, que sao AlphaDroid.
 */
export const NOMES_BLOCO: Record<BlocoId, string> = {
  rotacao20: "Rotação mensal entre estratégias",
  corrmin20: "Seleção por mínima correlação",
  aggbond: "Renda fixa (Agg.Bond)",
  maxcagr10: "Retorno máximo — 10 de ataque + 5 de defesa",
  suavemin15: "Institucional Dinâmico — 15 estratégias com piso e overlay de vol",
};

/** De quem e cada bloco. Aparece na tela como legenda de atribuicao. */
export const ATRIBUICAO: Record<BlocoId, string> = {
  rotacao20: "20 estratégias AlphaDroid · alocação Harpian",
  corrmin20: "20 estratégias AlphaDroid · alocação Harpian",
  aggbond: "índice de referência",
  maxcagr10: "15 estratégias AlphaDroid · seleção e alocação Harpian",
  suavemin15: "15 estratégias AlphaDroid · seleção e alocação Harpian",
};

/**
 * O QUE CADA BLOCO FAZ, em uma frase que o cliente entende sem glossario.
 *
 * Por que isto existe: "Rotacao por momento" e "HC-US IG" nao dizem nada para
 * quem esta do outro lado da mesa. Pior, "rotacao" convida a leitura errada —
 * de que se rotaciona ENTRE CLASSES DE ATIVO, saindo de acao para renda fixa.
 * Nao e isso: rotaciona-se ENTRE ESTRATEGIAS, e o peso em renda fixa e fixo.
 * Um nome que o interlocutor interpreta errado custa mais que um nome opaco.
 *
 * FRONTEIRA DE DIVULGACAO do HC-US IG: pode-se dizer o PAPEL que ele cumpre na
 * carteira — classe de ativo, janela distinta, correlacao com o outro bloco —
 * porque e isso que sustenta a decisao de aloca-lo. Nao se diz o METODO. E
 * "Overnight" continua proibido: e nome de repositorio e do robo de
 * monitoramento noturno, nao do algoritmo.
 */
export const EXPLICACAO_BLOCO: Record<BlocoId, string> = {
  rotacao20:
    "Todo mês, das 41 estratégias do AlphaDroid ficam as 20 de maior retorno no mês " +
    "anterior, com teto de 10% em cada. Rotaciona entre estratégias — não entre " +
    "classes de ativo. Quando menos de 12 das 41 têm momento positivo, o bloco inteiro " +
    "sai de risco e vai para renda fixa, ouro e commodities.",
  corrmin20:
    "Todo mês, das 41 estratégias ficam as 20 menos correlacionadas entre si, com peso " +
    "igual. Troca pouco: 1,67 estratégia por rebalance, em média. É o contrapeso da " +
    "rotação — enquanto ela persegue quem está forte, esta busca quem anda diferente.",
  aggbond:
    "Índice agregado de renda fixa americana. Não é motor da casa: é o amortecedor, e " +
    "está aqui como referência de mercado.",
  maxcagr10:
    "Dez estratégias de ataque escolhidas para retorno máximo, com peso dinâmico pelo " +
    "momento e teto de 25% em cada, mais as cinco de preservação de capital. Quando o " +
    "momento seca entre as dez, o excedente vai para a preservação — e quando menos de " +
    "12 das 41 têm momento positivo, a carteira inteira sai de risco.",
  suavemin15:
    "O mesmo motor do Max Retorno, na dose mínima. Quinze estratégias (10 de ataque + 5 " +
    "de preservação) com piso de 1% em cada — ninguém zera. Por cima, um overlay de " +
    "volatilidade-alvo de 3,5% ao ano decide semanalmente quanto expor ao motor: em " +
    "média 22%, o resto em caixa. A queda máxima histórica foi de −4,42% em 15 anos, sem " +
    "nenhum ano negativo. É o mandato conservador com a mesma engenharia.",
};

// ── composicao ───────────────────────────────────────────────────────────────

/**
 * Mistura blocos com peso fixo, rebalanceando nos dias marcados.
 *
 * O valor de cada bloco anda com o proprio retorno ao longo do mes (a alocacao
 * deriva de proposito — e isso que um portfolio real faz) e volta ao peso alvo
 * no primeiro pregao do mes seguinte. O retorno do dia do rebalance ainda e
 * ganho com a alocacao antiga: a volta ao alvo acontece no fechamento.
 */
export function misturarBlocos(
  streams: number[][],
  pesos: number[],
  rebalance: Set<number>,
): number[] {
  if (streams.length === 0) return [];
  const n = streams[0].length;
  const V = pesos.slice();
  const out = new Array<number>(n);
  let anterior = 1;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < V.length; j++) V[j] *= 1 + streams[j][i];
    let p = 0;
    for (let j = 0; j < V.length; j++) p += V[j];
    out[i] = p / anterior - 1;
    anterior = p;
    if (rebalance.has(i)) {
      for (let j = 0; j < V.length; j++) V[j] = p * pesos[j];
    }
  }
  return out;
}

/**
 * Overlay de vol targeting com sleeve de caixa.
 *
 * `e = min(1, alvo / vol_realizada)` — nunca alavanca. `vol_realizada` sai dos
 * `lookback` retornos diarios ANTERIORES da base sem escala, ate o fechamento da
 * vespera, anualizada por √252. A exposicao e recalculada no primeiro pregao de
 * cada semana e vale desse dia em diante; o resto (1−e) fica em caixa a rf = 0.
 *
 * A vol e medida sempre na base SEM escala, nao no resultado ja escalado: senao
 * o overlay realimentaria a propria decisao e a exposicao nunca voltaria a subir
 * depois de um susto.
 */
export function overlayVolTarget(
  base: number[],
  alvo: number,
  lookback: number,
  rebalance: Set<number>,
): { retornos: number[]; exposicao: number[] } {
  const n = base.length;
  const retornos = new Array<number>(n);
  const exposicao = new Array<number>(n);
  let e = 1;

  for (let i = 0; i < n; i++) {
    if (rebalance.has(i) && i >= lookback) {
      const vol = desvioPadrao(base, i - lookback, i) * Math.sqrt(DIAS_ANO);
      e = vol > 0 ? Math.min(1, alvo / vol) : 1;
    }
    exposicao[i] = e;
    retornos[i] = e * base[i];
  }
  return { retornos, exposicao };
}

/** Desvio-padrao populacional de `v[de .. ate-1]`. */
function desvioPadrao(v: number[], de: number, ate: number): number {
  const n = ate - de;
  if (n <= 0) return 0;
  let soma = 0;
  for (let i = de; i < ate; i++) soma += v[i];
  const media = soma / n;
  let acc = 0;
  for (let i = de; i < ate; i++) {
    const d = v[i] - media;
    acc += d * d;
  }
  return Math.sqrt(acc / n);
}

/** Monta o stream de retorno diario de um SET a partir dos blocos exportados. */
export function comporSet(
  def: SetDef,
  data: BenchmarkSetsData,
): { retornos: number[]; base: number[]; exposicao: number[] | null } {
  const mensal = new Set(data.rebalMensal);
  const streams = def.composicao.map((c) => {
    const s = data.blocos[c.bloco];
    if (!s) throw new Error(`Bloco ausente no dataset: ${c.bloco}`);
    return s;
  });
  const pesos = def.composicao.map((c) => c.peso);
  const base = misturarBlocos(streams, pesos, mensal);

  if (!def.volTarget) return { retornos: base, base, exposicao: null };

  const semanal = new Set(data.rebalSemanal);
  const { retornos, exposicao } = overlayVolTarget(
    base,
    def.volTarget.alvo,
    def.volTarget.lookback,
    semanal,
  );
  return { retornos, base, exposicao };
}

// ── metricas (§4.4 do HANDOFF_OTIMIZACAO) ────────────────────────────────────

export interface SetMetrics {
  n: number;
  anos: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  cagr: number;
  vol: number;
  maxDD: number;
  maxDDde: string | null;
  maxDDate: string | null;
  correlacaoSP: number | null;
}

/**
 * Sharpe com rf = 0; Sortino com denominador de N cheio (nao so os dias
 * negativos — senao a metrica premia quem caiu poucas vezes em vez de quem caiu
 * pouco); Calmar = CAGR / |maxDD|.
 */
export function metricasSet(
  rho: number[],
  spx?: (number | null)[],
  datas?: string[],
): SetMetrics {
  const n = rho.length;
  if (n === 0) throw new Error("Série vazia.");
  const anos = n / DIAS_ANO;

  let soma = 0;
  for (const r of rho) soma += r;
  const media = soma / n;

  let acc = 0;
  for (const r of rho) {
    const d = r - media;
    acc += d * d;
  }
  const vol = Math.sqrt(acc / n) * Math.sqrt(DIAS_ANO);

  let baixa = 0;
  for (const r of rho) if (r < 0) baixa += r * r;
  const downside = Math.sqrt(baixa / n) * Math.sqrt(DIAS_ANO);

  let p = 1;
  let pico = -Infinity;
  let maxDD = 0;
  let iPico = 0;
  let ddDe = 0;
  let ddAte = 0;
  for (let i = 0; i < n; i++) {
    p *= 1 + rho[i];
    if (p > pico) {
      pico = p;
      iPico = i;
    }
    const dd = p / pico - 1;
    if (dd < maxDD) {
      maxDD = dd;
      ddDe = iPico;
      ddAte = i;
    }
  }
  const cagr = Math.pow(p, DIAS_ANO / n) - 1;

  return {
    n,
    anos,
    sharpe: vol > 0 ? (media * DIAS_ANO) / vol : 0,
    sortino: downside > 0 ? (media * DIAS_ANO) / downside : 0,
    calmar: maxDD < 0 ? cagr / Math.abs(maxDD) : 0,
    cagr,
    vol,
    maxDD,
    maxDDde: datas ? datas[ddDe] ?? null : null,
    maxDDate: datas ? datas[ddAte] ?? null : null,
    correlacaoSP: spx ? correlacao(rho, spx) : null,
  };
}

/** Pearson entre o portfolio e o indice, ignorando os dias sem indice. */
function correlacao(rho: number[], spx: (number | null)[]): number | null {
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < rho.length; i++) {
    const s = spx[i];
    if (s === null || s === undefined || !Number.isFinite(s)) continue;
    a.push(rho[i]);
    b.push(s);
  }
  if (a.length < 30) return null;
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  const den = Math.sqrt(va * vb);
  return den > 0 ? cov / den : null;
}

// ── resultado pronto para a tela ─────────────────────────────────────────────

export interface SetResultado {
  def: SetDef;
  retornos: number[];
  /** curva de capital, comecando no capital pedido */
  equity: number[];
  /** exposicao do overlay por dia; null quando o SET nao tem overlay */
  exposicao: number[] | null;
  full: SetMetrics;
  is: SetMetrics;
  ho: SetMetrics;
  /** retorno por ano-calendario, em fracao */
  porAno: { ano: string; ret: number; parcial: boolean }[];
}

export function curvaDeCapital(rho: number[], capital: number): number[] {
  const out = new Array<number>(rho.length + 1);
  out[0] = capital;
  for (let i = 0; i < rho.length; i++) out[i + 1] = out[i] * (1 + rho[i]);
  return out;
}

export function retornoPorAno(
  rho: number[],
  datas: string[],
): { ano: string; ret: number; parcial: boolean }[] {
  const acc = new Map<string, { f: number; dias: number }>();
  for (let i = 0; i < rho.length; i++) {
    const ano = datas[i].slice(0, 4);
    const e = acc.get(ano);
    if (e) {
      e.f *= 1 + rho[i];
      e.dias++;
    } else acc.set(ano, { f: 1 + rho[i], dias: 1 });
  }
  return [...acc.entries()].map(([ano, v]) => ({
    ano,
    ret: v.f - 1,
    // o primeiro e o ultimo ano da janela quase sempre sao pedacos de ano
    parcial: v.dias < 200,
  }));
}

/** Avalia um SET inteiro: composicao, curva, metricas FULL/IS/HO e anos. */
export function avaliarSet(def: SetDef, data: BenchmarkSetsData, capital = 100000): SetResultado {
  const { retornos, exposicao } = comporSet(def, data);
  const { nIs, iHo } = data.cortes;
  return {
    def,
    retornos,
    equity: curvaDeCapital(retornos, capital),
    exposicao,
    full: metricasSet(retornos, data.spx, data.datas),
    is: metricasSet(retornos.slice(0, nIs), data.spx.slice(0, nIs), data.datas.slice(0, nIs)),
    ho: metricasSet(retornos.slice(iHo - 1), data.spx.slice(iHo - 1), data.datas.slice(iHo - 1)),
    porAno: retornoPorAno(retornos, data.datas),
  };
}

/** A regua: equal-weight das 41, mesma janela e mesmas convencoes. */
export function avaliarRegua(data: BenchmarkSetsData, capital = 100000): SetResultado {
  const def: SetDef = {
    id: "ew41",
    nome: "EW-41",
    rotuloCurto: "Régua EW-41",
    linha: 2,
    perfil: "balanceado",
    tese: "As 41 estratégias AlphaDroid com o mesmo peso, sem alocação nenhuma. É a régua: qualquer SET tem que bater isto.",
    composicao: [],
  };
  const { nIs, iHo } = data.cortes;
  const rho = data.ew41;
  return {
    def,
    retornos: rho,
    equity: curvaDeCapital(rho, capital),
    exposicao: null,
    full: metricasSet(rho, data.spx, data.datas),
    is: metricasSet(rho.slice(0, nIs), data.spx.slice(0, nIs), data.datas.slice(0, nIs)),
    ho: metricasSet(rho.slice(iHo - 1), data.spx.slice(iHo - 1), data.datas.slice(iHo - 1)),
    porAno: retornoPorAno(rho, data.datas),
  };
}

export function avaliarTodos(data: BenchmarkSetsData, capital = 100000): SetResultado[] {
  return [...SETS.map((s) => avaliarSet(s, data, capital)), avaliarRegua(data, capital)];
}

/** Os SETs de uma linha, na ordem da apresentacao. */
export function avaliarLinha(
  linha: LinhaId,
  data: BenchmarkSetsData,
  capital = 100000,
): SetResultado[] {
  return SETS.filter((s) => s.linha === linha).map((s) => avaliarSet(s, data, capital));
}

// ============================================================
// PORTFOLIO BUILDER — tipos
// ------------------------------------------------------------
// Construcao de portfolio a quatro maos sobre as estrategias do
// AlphaDroid. NADA aqui recalcula momento: o RetMes%/IR diario
// vem pronto do motor do Diogo (cascata dupla de EMA, d=30),
// exportado dia a dia pelo pipeline em
//   C:\dev\estrategias salvas para apresentacao\_pipeline\export_dataset.py
// ============================================================

/** Como os pesos das estrategias se comportam ao longo do tempo. */
export type AllocMode =
  /** peso fixo, escolhido pelo cliente, constante o tempo todo */
  | "linear"
  /** peso varia com a forca do momento, entre um piso e um teto por estrategia */
  | "dynamic";

/** Em que metrica a alocacao dinamica se apoia. */
export type ScoreBasis =
  /** RetMes% — retorno mensal esperado. O ranking principal do Diogo. */
  | "retmes"
  /** IR — retorno por unidade de risco. Favorece quem entrega com menos vol. */
  | "ir";

export type RebalanceFreq = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

/**
 * Janela de analise. A pergunta que o cliente faz na mesa e sempre "e se eu
 * tivesse investido ha X?" — entao a escolha e discreta, nunca um arrastar de
 * mouse. `ytd` = desde o primeiro pregao do ano corrente.
 */
export type Janela =
  | "ytd" | "1a" | "2a" | "3a" | "5a" | "10a" | "15a" | "20a" | "30a" | "max";

export const JANELAS: { id: Janela; label: string; anos: number | null }[] = [
  { id: "ytd", label: "Este ano", anos: 0 },
  { id: "1a", label: "1 ano", anos: 1 },
  { id: "2a", label: "2 anos", anos: 2 },
  { id: "3a", label: "3 anos", anos: 3 },
  { id: "5a", label: "5 anos", anos: 5 },
  { id: "10a", label: "10 anos", anos: 10 },
  { id: "15a", label: "15 anos", anos: 15 },
  { id: "20a", label: "20 anos", anos: 20 },
  { id: "30a", label: "30 anos", anos: 30 },
  { id: "max", label: "Tudo", anos: null },
];

/** O que fazer quando as estrategias selecionadas nascem em datas diferentes. */
export type WindowMode =
  /** backtest comeca quando a ultima estrategia selecionada nasceu */
  | "common"
  /** usa todo o historico; pesos renormalizados entre as que ja existem */
  | "inception";

/** Uma estrategia dentro do portfolio, com os limites que o cliente definiu. */
export interface Sleeve {
  id: string;
  /** modo linear: peso alvo fixo. 0..1 */
  weight: number;
  /** modo dinamico: piso de alocacao. 0..1 */
  min: number;
  /** modo dinamico: teto de alocacao. 0..1 */
  max: number;
}

export interface PortfolioConfig {
  sleeves: Sleeve[];
  mode: AllocMode;
  basis: ScoreBasis;
  rebalance: RebalanceFreq;
  /** "e se eu tivesse investido ha X anos?" */
  janela: Janela;
  window: WindowMode;
  /**
   * Modo dinamico: estrategia com momento negativo cai para zero em vez de
   * parar no piso. Deixa o portfolio sair de quem esta perdendo forca.
   */
  dropNegative: boolean;
  /** capital inicial, so para exibicao */
  capital: number;
  /**
   * Overlay de vol targeting sobre o portfolio inteiro. Quando presente, a
   * exposicao vira `e = min(1, alvo / vol_realizada)` — nunca alavanca — e a
   * parte nao investida (1−e) fica em caixa rendendo rf = 0.
   *
   * E a unica coisa no motor que nao soma 100% investido, e por isso e opcional:
   * so os SETs conservadores usam.
   */
  volTarget?: {
    /** volatilidade anual alvo, em fracao (0,12 = 12% a.a.) */
    alvo: number;
    /** quantos pregoes anteriores entram na medida de volatilidade */
    lookback: number;
  } | null;
  /**
   * Janela fixa, em datas ISO. Quando presente, ignora `janela` — e o que os
   * SETs pre-montados usam: eles foram medidos e aprovados num periodo
   * especifico, e deixar o cliente mover a janela faria o numero da tela
   * divergir do numero validado.
   */
  periodoFixo?: { de: string; ate: string } | null;
}

/** Serie diaria de uma estrategia, como sai do export_dataset.py */
export interface StrategySeries {
  id: string;
  label: string;
  /** offset da primeira data no calendario mestre */
  start: number;
  n: number;
  contigua: boolean;
  /** dicionario de simbolos negociados */
  simbolos: string[];
  /** 1 = simbolo fora do universo declarado => camada de defesa armada */
  defensivo: number[];
  /** indice em `simbolos`, por dia */
  sym: number[];
  /**
   * SO PARA SERIES SINTETICAS DE BLOCO. Fracao do bloco que estava em defesa
   * naquele dia, 0..1 — porque um bloco e uma cesta: 6 das 20 estrategias
   * podem estar blindadas ao mesmo tempo, e `defensivo[sym[]]` so sabe dizer
   * sim/nao para o sleeve inteiro. Quando presente, o motor usa isto; quando
   * ausente, cai no comportamento binario de sempre.
   */
  defesaFrac?: number[];
  /**
   * SO PARA SERIES SINTETICAS DE BLOCO. As estrategias que compoem o bloco,
   * para o painel "o que voce estava carregando" abrir a cesta em vez de
   * mostrar so o nome do bloco.
   */
  composicaoBloco?: {
    /** ids na ordem das linhas de `pesos` */
    ids: string[];
    /** peso de cada estrategia DENTRO do bloco, por dia local (0..1) */
    pesos: number[][];
    /** ticker e flag de defesa de cada estrategia, por dia local */
    ticker: (i: number, diaLocal: number) => { symbol: string; defense: boolean } | null;
    /** rotulo legivel de cada estrategia */
    labels: Record<string, string>;
  };
  /** curva de capital: comeca em 1000 */
  equity: number[];
  referencia: (number | null)[];
  retmes: (number | null)[];
  ir: (number | null)[];
  slope: (number | null)[];
  sigma: (number | null)[];
}

export interface StrategyMeta {
  id: string;
  label: string;
  nome: string;
  grupo: "etf" | "acoes" | "outras";
  sub: string;
  variante: number | null;
  config: string;
  /** indice que o AlphaDroid usa de referencia: "S&P 500" ou "Agg.Bond" */
  referencia_nome?: string;
  bornon: string;
  score: string;
  r_risk: string;
  universo: string[];
  start: number;
  n: number;
  primeiro_dia: string;
  ultimo_dia: string;
  equity_final: number;
  simbolo_hoje: string;
  em_defesa_hoje: boolean;
  dias_defesa: number;
  pct_defesa: number;
  ann_return_all: string;
  sharpe_all: string;
  maxdd_all: string;
}

export interface Catalog {
  data_ref: string;
  n_estrategias: number;
  estrategias: StrategyMeta[];
}

/** Uma posicao do portfolio num dia — o que o cliente estava carregando. */
export interface Holding {
  id: string;
  label: string;
  /** ticker efetivamente carregado naquele dia */
  symbol: string;
  /** peso no portfolio naquele dia, ja com a deriva desde o ultimo rebalance */
  weight: number;
  /** o ticker estava fora do universo da estrategia => defesa armada */
  defense: boolean;
}

export interface SimResult {
  /** indices no calendario mestre, do primeiro ao ultimo dia simulado */
  from: number;
  to: number;
  dates: string[];
  /** curva de capital do portfolio, comecando em `capital` */
  equity: number[];
  /** drawdown corrente, 0..-1 */
  drawdown: number[];
  /** fracao do portfolio com a defesa armada, 0..1, por dia */
  defenseFrac: number[];
  /** peso de cada sleeve por dia, na ordem de config.sleeves */
  weights: number[][];
  /**
   * Fracao investida por dia quando ha overlay de vol-target; null sem overlay.
   * O resto (1−e) esta em caixa a rf = 0.
   */
  exposicao: number[] | null;
  /** benchmark de referencia da 1a estrategia, reescalado ao capital */
  benchmark: (number | null)[];
  metrics: PortfolioMetrics;
  /** periodos em que a defesa esteve armada em pelo menos metade do portfolio */
  defensePeriods: DefensePeriod[];
  rebalanceDays: number[];
  warnings: string[];
}

/** Serie de referencia do sistema, no calendario mestre. */
export interface Benchmark {
  fonte: string;
  start: number;
  n: number;
  valores: (number | null)[];
}

/**
 * Recorte da janela por estado da defesa. A correlacao cheia mistura dois
 * regimes opostos e nao descreve nenhum dos dois: exposto o portfolio anda com
 * o indice, blindado ele descola. O numero unico e a media disso — inutil.
 */
export interface RegimeStats {
  dias: number;
  /** fracao dos pregoes da janela neste regime */
  fracao: number;
  correlacao: number | null;
  /** retorno anualizado do portfolio so nestes dias */
  retPortfolio: number;
  /** retorno anualizado do S&P 500 so nestes dias */
  retBenchmark: number;
}

export interface PortfolioMetrics {
  capitalFinal: number;
  multiplo: number;
  cagr: number;
  volAnual: number;
  sharpe: number;
  /** so a volatilidade das quedas — nao pune quem sobe rapido */
  sortino: number;
  /** CAGR dividido pela maior queda: retorno por unidade de dor */
  calmar: number;
  /** correlacao de Pearson dos retornos diarios contra o S&P 500 na janela */
  correlacaoSP: number | null;
  /** a mesma correlacao, separada pelo estado da defesa */
  regimeDefesa: RegimeStats;
  regimeExposto: RegimeStats;
  /** retorno do S&P 500 na mesma janela, para comparar lado a lado */
  benchCagr: number | null;
  maxDrawdown: number;
  maxDrawdownFrom: string;
  maxDrawdownTo: string;
  melhorAno: { ano: number; ret: number } | null;
  piorAno: { ano: number; ret: number } | null;
  anos: number;
  /** % de pregoes com pelo menos metade do portfolio em defesa */
  pctDefesa: number;
}

export interface DefensePeriod {
  from: string;
  to: string;
  dias: number;
  /** pico de fracao do portfolio blindada no periodo */
  pico: number;
}

export interface Feasibility {
  ok: boolean;
  somaMin: number;
  somaMax: number;
  somaPeso: number;
  problemas: string[];
}

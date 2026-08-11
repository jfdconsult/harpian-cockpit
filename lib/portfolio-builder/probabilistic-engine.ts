/**
 * Motor probabilístico — HARPIAN.
 *
 * Responde duas perguntas de negócio distintas, com métodos estatísticos
 * diferentes (framing formal em ambas antes de qualquer número — ver
 * `analista-estatistico` no laboratório):
 *
 *  1) TOLERÂNCIA — dado o histórico real do SET, com que probabilidade o
 *     Risk Number REALIZADO em janelas móveis fica dentro da tolerância que o
 *     cliente informou (Ato II)? Método: frequência empírica em janelas
 *     rolling sobre a série real (sem premissa de distribuição), com
 *     intervalo de confiança de Wilson pra proporção — não é Monte Carlo,
 *     é o que já aconteceu.
 *
 *  2) META — com que probabilidade o capital acumulado até o horizonte
 *     pedido atinge a meta? Método: Monte Carlo por BLOCK BOOTSTRAP dos
 *     retornos diários reais do SET (blocos de ~1 mês, não dia-a-dia solto —
 *     retorno financeiro tem autocorrelação/regime, reamostrar i.i.d.
 *     quebraria essa estrutura). É projeção pro futuro, logo tem mais
 *     incerteza que (1); os dois números NÃO devem ser confundidos.
 *
 * Ambas usam a mesma fórmula de Risk Number já em produção no relatório
 * (`calcularRiskNumber`, replicação Nitrogen/Riskalyze com anchors públicos)
 * — nenhuma calibração nova foi inventada aqui.
 *
 * Limitação conhecida, documentada e não escondida do usuário: o RN em si
 * assume uma cauda de retorno ~normal no downside de 6M (VaR paramétrico a
 * 1,64σ). Mercados reais têm cauda mais gorda que isso (ver Taleb,
 * "Statistical Consequences of Fat Tails") — a probabilidade de tolerância
 * aqui reportada tende a ser um LIMITE SUPERIOR otimista da segurança real
 * em eventos de cauda extrema. Isso é dito explicitamente na UI, não só aqui.
 */

import { calcularRiskNumber } from "./risk-number";

const DIAS_ANO = 252;

// ── taxa interna de retorno necessária ──────────────────────────────────────

/** Valor futuro de um capital inicial + anuidade anual a uma taxa `r`. */
export function valorFuturo(capital: number, aporteAnual: number, r: number, anos: number): number {
  if (r === 0) return capital + aporteAnual * anos;
  const f = Math.pow(1 + r, anos);
  return capital * f + aporteAnual * (f - 1) / r;
}

/**
 * TIR necessária pra levar `capital` + `aporteAnual` até `meta` em `anos`.
 * Bisecção, mesma implementação do `solveForRate` do Ato II
 * (simulator-metas.html) — replicada aqui de propósito: o cockpit NÃO pode
 * depender de a taxa chegar correta pela querystring. Se ela vier ausente
 * (relatório preenchido à mão, sem apresentação) ou inconsistente com a
 * meta, o cabeçalho e a curva-objetivo do gráfico passam a mostrar números
 * que não fecham entre si — foi exatamente esse o defeito observado
 * (relatório dizia "10,75%/ano" para uma meta que exige 18,72%/ano).
 */
export function taxaNecessaria(capital: number, aporteAnual: number, anos: number, meta: number): number {
  if (!(meta > 0) || !(anos > 0) || meta <= capital) return 0;
  let lo = 0, hi = 5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (valorFuturo(capital, aporteAnual, mid, anos) < meta) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── proporção + intervalo de confiança ──────────────────────────────────────

export interface WilsonCI {
  p: number;
  lo: number;
  hi: number;
  n: number;
}

/** Intervalo de confiança de Wilson pra uma proporção — mais robusto que a
 * aproximação normal quando p está perto de 0 ou 1 ou n é pequeno (Wasserman,
 * All of Statistics, cap. 5). z=1.96 → 95%. */
export function wilsonCI(successes: number, n: number, z = 1.959963985): WilsonCI {
  if (n <= 0) return { p: NaN, lo: NaN, hi: NaN, n: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centro = p + z2 / (2 * n);
  const margem = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    p,
    lo: Math.max(0, (centro - margem) / denom),
    hi: Math.min(1, (centro + margem) / denom),
    n,
  };
}

// ── (1) probabilidade de permanência dentro da tolerância de risco ─────────

export interface ToleranceResult {
  clienteRN: number;
  portfolioRNPontual: number;
  janelaAnos: number;
  amostras: number;
  /** janelas em que o risco ficou DENTRO (≤) da tolerância — o resultado desejado */
  dentro: number;
  probabilidade: number;
  ic95: WilsonCI;
  /** janelas em que o risco ESTOUROU a tolerância — o único modo de falha */
  excedeu: number;
  probabilidadeExcedeu: number;
  /** folga mediana em pontos de RN entre a tolerância e o risco realizado
   * (positivo = portfólio roda abaixo do que o cliente aceita) */
  folgaMediana: number;
  /** distribuição dos RN realizados por janela — pra eventual histograma */
  distribuicaoRN: number[];
}

/**
 * Probabilidade de o risco do portfólio permanecer DENTRO da tolerância do
 * cliente ao longo do histórico real.
 *
 * Assimetria proposital: rodar ABAIXO da tolerância não é desvio, é o
 * resultado desejado — o cliente autorizou até RN X, não exigiu RN X. O
 * único modo de falha é ESTOURAR o teto. (Uma versão anterior media
 * "aderência" a uma faixa ±5 em torno do RN do cliente, o que penalizava o
 * portfólio conservador e invertia a leitura de risco.)
 *
 * O RN de cada janela é calculado com o retorno esperado ESTRUTURAL do
 * portfólio (CAGR do período completo) e a volatilidade DAQUELA janela.
 * Usar o CAGR realizado da própria janela — como se fazia antes — mistura
 * sorte com risco: um ano de retorno ruim produzia RN alto mesmo com
 * volatilidade normal, e a distribuição saía bimodal (metade das janelas em
 * RN≈1, cauda até RN 83, num portfólio de RN estrutural 28). O Risk Number
 * do Nitrogen/Riskalyze é forward-looking — mede quanto risco a carteira
 * assume, não o que aconteceu de fato naquele ano.
 *
 * @param retornos   retornos diários do portfólio (SetResultado.retornos)
 * @param clienteRN  tolerância do cliente (Ato II), 1-99
 * @param janelaDias tamanho da janela rolling (default 252 = 1 ano)
 * @param passoDias  passo entre janelas (default 21 = ~1 mês, evita
 *                    sobreposição excessiva que infla artificialmente n)
 */
export function probabilidadeDentroTolerancia(
  retornos: number[],
  clienteRN: number,
  janelaDias = DIAS_ANO,
  passoDias = 21,
): ToleranceResult {
  const pontual = metricasJanela(retornos);
  const distribuicaoRN: number[] = [];
  for (let ini = 0; ini + janelaDias <= retornos.length; ini += passoDias) {
    const janela = retornos.slice(ini, ini + janelaDias);
    const { volAnual } = metricasJanela(janela);
    // retorno esperado estrutural + vol da janela → isola risco de sorte
    distribuicaoRN.push(calcularRiskNumber(pontual.cagr, volAnual).rn);
  }

  const dentro = distribuicaoRN.filter((rn) => rn <= clienteRN).length;
  const n = distribuicaoRN.length;
  const excedeu = n - dentro;

  const folgas = distribuicaoRN.map((rn) => clienteRN - rn).sort((a, b) => a - b);
  const folgaMediana = folgas.length ? folgas[Math.floor(folgas.length / 2)] : NaN;

  return {
    clienteRN,
    portfolioRNPontual: calcularRiskNumber(pontual.cagr, pontual.volAnual).rn,
    janelaAnos: janelaDias / DIAS_ANO,
    amostras: n,
    dentro,
    probabilidade: n > 0 ? dentro / n : NaN,
    ic95: wilsonCI(dentro, n),
    excedeu,
    probabilidadeExcedeu: n > 0 ? excedeu / n : NaN,
    folgaMediana,
    distribuicaoRN,
  };
}

function metricasJanela(rho: number[]): { cagr: number; volAnual: number } {
  const n = rho.length;
  let soma = 0;
  for (const r of rho) soma += r;
  const media = soma / n;
  let acc = 0;
  for (const r of rho) { const d = r - media; acc += d * d; }
  const volAnual = Math.sqrt(acc / n) * Math.sqrt(DIAS_ANO);
  let p = 1;
  for (const r of rho) p *= 1 + r;
  const cagr = Math.pow(p, DIAS_ANO / n) - 1;
  return { cagr, volAnual };
}

// ── (2) probabilidade de atingir a meta no horizonte ────────────────────────

export interface HorizonteResultado {
  anos: number;
  nPaths: number;
  atingiuMeta: number;
  probabilidade: number;
  ic95: WilsonCI;
  capitalFinalP10: number;
  capitalFinalP50: number;
  capitalFinalP90: number;
}

export interface ParametrosMeta {
  capitalInicial: number;
  aporteAnual: number;
  meta: number;
  horizontesAnos: number[];
}

/**
 * Block bootstrap Monte Carlo: reamostra blocos de `blocoDias` dias corridos
 * (com reposição) da série real de retornos, com aporte anual aplicado a cada
 * 252 dias simulados, e mede a fração de trajetórias que bateu a meta.
 *
 * Bloco default de 21 dias (~1 mês de pregão): preserva autocorrelação de
 * curto prazo e efeito de regime sem exigir um modelo paramétrico de regime
 * (Shumway & Stoffer não exigem — mas i.i.d. dia-a-dia destruiria a
 * estrutura que faz a estratégia funcionar, então não é usado aqui).
 *
 * TRAJETÓRIA ÚNICA COM CHECKPOINTS: cada caminho é simulado uma só vez até o
 * horizonte mais longo, registrando o capital ao cruzar cada horizonte pedido.
 * A versão anterior refazia `nPaths` caminhos do zero para CADA horizonte —
 * em [8,9,10,11,12] anos isso era 50 anos-trajetória por caminho contra os 12
 * de agora (~4x de trabalho desperdiçado).
 *
 * Isso NÃO troca precisão por velocidade: o processo é o mesmo para frente, e
 * a distribuição marginal do capital no ano 8 é idêntica quer o caminho pare
 * ali, quer siga até o ano 12 — truncar não altera o que já aconteceu. Cada
 * horizonte continua estimado com os mesmos `nPaths`. A única mudança é que
 * as estimativas passam a ser positivamente correlacionadas entre horizontes
 * (compartilham os sorteios), o que inclusive elimina o artefato de um
 * horizonte curto exibir probabilidade maior que um longo por puro ruído
 * amostral. A equivalência foi verificada empiricamente contra a versão
 * independente antes da troca.
 */
export function probabilidadeDeMeta(
  retornos: number[],
  params: ParametrosMeta,
  opts: { nPaths?: number; blocoDias?: number } = {},
): HorizonteResultado[] {
  const nPaths = opts.nPaths ?? 2000;
  const blocoDias = opts.blocoDias ?? 21;
  const { capitalInicial, aporteAnual, meta, horizontesAnos } = params;
  const N = retornos.length;
  if (N < blocoDias) throw new Error("Série curta demais para block bootstrap.");

  // checkpoints ordenados por dia — o caminho registra o capital ao cruzá-los
  const marcos = horizontesAnos
    .map((anos) => ({ anos, dia: Math.round(anos * DIAS_ANO) }))
    .sort((a, b) => a.dia - b.dia);
  const diaMax = marcos[marcos.length - 1].dia;

  // finais[m][p] = capital do caminho p ao cruzar o marco m
  const finais = marcos.map(() => new Array<number>(nPaths));

  for (let p = 0; p < nPaths; p++) {
    let capital = capitalInicial;
    let diasSimulados = 0;
    let proximoAporte = DIAS_ANO;
    let marcoAtual = 0;
    while (diasSimulados < diaMax) {
      const inicioBloco = Math.floor(Math.random() * (N - blocoDias + 1));
      const restam = diaMax - diasSimulados;
      const tamanho = Math.min(blocoDias, restam);
      for (let i = 0; i < tamanho; i++) {
        capital *= 1 + retornos[inicioBloco + i];
        diasSimulados++;
        if (aporteAnual > 0 && diasSimulados >= proximoAporte) {
          capital += aporteAnual;
          proximoAporte += DIAS_ANO;
        }
        // pode cruzar mais de um marco se dois horizontes ficarem muito perto
        while (marcoAtual < marcos.length && diasSimulados === marcos[marcoAtual].dia) {
          finais[marcoAtual][p] = capital;
          marcoAtual++;
        }
      }
    }
  }

  return marcos.map((marco, idxMarco) => {
    const anos = marco.anos;
    const finaisDoMarco = finais[idxMarco];
    let atingiuMeta = 0;
    for (let p = 0; p < nPaths; p++) if (finaisDoMarco[p] >= meta) atingiuMeta++;

    const ordenados = [...finaisDoMarco].sort((a, b) => a - b);
    const pct = (q: number) => ordenados[Math.min(nPaths - 1, Math.floor(q * nPaths))];

    return {
      anos,
      nPaths,
      atingiuMeta,
      probabilidade: atingiuMeta / nPaths,
      ic95: wilsonCI(atingiuMeta, nPaths),
      capitalFinalP10: pct(0.10),
      capitalFinalP50: pct(0.50),
      capitalFinalP90: pct(0.90),
    };
  });
}

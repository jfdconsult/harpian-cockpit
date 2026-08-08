// ============================================================
// PORTFOLIO BUILDER — os SETs como SETUP CARREGAVEL
// ------------------------------------------------------------
// Um SET nao e um painel separado: e uma configuracao que entra no builder e
// roda pelo mesmo motor que o portfolio que o cliente monta a mao. Clicar no
// botao troca os sleeves, os pesos, o rebalance, a janela e o overlay — e o
// painel de Resultado se enche sozinho, com capital final, maior queda,
// correlacao por regime, ano a ano, tudo.
//
// POR QUE OS BLOCOS ENTRAM COMO SERIES SINTETICAS
// O motor compoe sleeves pela curva de capital de cada um. Os tres blocos —
// rotacao por momento, HC-US IG e renda fixa — chegam do export como retorno
// diario; virar curva de capital e uma linha. Feito isso, o motor nao precisa
// saber que sao "externos": a mistura mensal com peso fixo que ele ja faz E a
// composicao do SET, exatamente.
//
// ATRIBUICAO (§0 da spec): a rotacao e sobre as 41 estrategias AlphaDroid, com
// alocacao Harpian. O HC-US IG e proprietario Harpian. "Overnight" nunca aparece.
// ============================================================
import type { BenchmarkSetsData, BlocoId, SetDef } from "./benchmark-sets";
import { ATRIBUICAO, EXPLICACAO_BLOCO, NOMES_BLOCO, SETS } from "./benchmark-sets";
import type { PortfolioConfig, Sleeve, StrategySeries } from "./types";

/** id do sleeve de um bloco, para nao colidir com id de estrategia */
export const idBloco = (b: BlocoId) => `bloco-${b}`;
export const ehBloco = (id: string) => id.startsWith("bloco-");
export const blocoDoId = (id: string) => id.replace(/^bloco-/, "") as BlocoId;

/**
 * Transforma os retornos diarios de um bloco na curva de capital que o motor
 * espera. `start` e o pregao ANTERIOR ao primeiro retorno — e o dia em que a
 * curva vale 1000, igual a como as estrategias do AlphaDroid comecam.
 */
export function blocoComoSerie(
  bloco: BlocoId,
  data: BenchmarkSetsData,
): StrategySeries {
  const r = data.blocos[bloco];
  const n = r.length + 1;
  const equity = new Array<number>(n);
  equity[0] = 1000;
  for (let i = 0; i < r.length; i++) equity[i + 1] = equity[i] * (1 + r[i]);

  const vazio = new Array<number | null>(n).fill(null);

  // A cesta por dentro. Sem isto o bloco chega ao motor como um ticker cego:
  // a tira "quanto do portfolio estava blindado" fica cravada em 0% e o painel
  // "o que voce estava carregando" mostra o nome do bloco em vez dos ativos.
  // `universoDetalhe` (do export) da o ticker e a flag de defesa de cada uma
  // das 41 em qualquer dia; `pesosDiarios` da o peso dentro do bloco.
  const matriz = data.pesosDiarios?.[bloco as keyof typeof data.pesosDiarios];
  const detalhe = data.universoDetalhe;
  let defesaFrac: number[] | undefined;
  let composicaoBloco: StrategySeries["composicaoBloco"];

  if (matriz && detalhe) {
    // RLE -> lookup por dia. Um cursor por estrategia avanca junto com o loop,
    // entao a expansao inteira e O(dias + runs), nao O(dias x runs).
    const ids = data.idsUniverso;
    const cursores = new Array<number>(ids.length).fill(0);
    const simAtual = new Array<number>(ids.length).fill(-1);

    const avanca = (i: number, dia: number) => {
      const runs = detalhe[ids[i]]?.runs;
      if (!runs) return -1;
      let c = cursores[i];
      // o cursor so anda para frente; se o dia recuar, reinicia
      if (runs[c] && runs[c][0] > dia) c = 0;
      while (c + 1 < runs.length && runs[c + 1][0] <= dia) c++;
      cursores[i] = c;
      return runs[c] && runs[c][0] <= dia ? runs[c][1] : -1;
    };

    // pesos normalizados 0..1 (o export guarda em decimo de ponto percentual)
    const pesos: number[][] = ids.map((_, i) =>
      (matriz[i] ?? []).map((v) => (v || 0) / 1000),
    );

    defesaFrac = new Array<number>(n).fill(0);
    for (let d = 0; d < n; d++) {
      let blind = 0;
      for (let i = 0; i < ids.length; i++) {
        const w = pesos[i]?.[d] ?? 0;
        if (w <= 0) continue;
        const si = avanca(i, d);
        simAtual[i] = si;
        if (si < 0) continue;
        if (detalhe[ids[i]]?.defensivo[si]) blind += w;
      }
      // O export arredonda cada peso para decimo de ponto, entao a coluna pode
      // fechar em 1000,2 e a fracao passar de 1. Trava em 1 para a tira de
      // defesa nunca desenhar mais que a largura cheia.
      defesaFrac[d] = blind > 1 ? 1 : blind;
    }

    composicaoBloco = {
      ids,
      pesos,
      labels: data.labels,
      ticker: (i, dia) => {
        const u = detalhe[ids[i]];
        if (!u) return null;
        const runs = u.runs;
        // busca binaria: o painel consulta um dia por vez, sem cursor util
        let lo = 0, hi = runs.length - 1, si = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (runs[mid][0] <= dia) { si = runs[mid][1]; lo = mid + 1; }
          else hi = mid - 1;
        }
        if (si < 0) return null;
        return { symbol: u.simbolos[si], defense: !!u.defensivo[si] };
      },
    };
  }

  return {
    id: idBloco(bloco),
    label: NOMES_BLOCO[bloco],
    start: data.janela.fromIdx,
    n,
    contigua: true,
    // O bloco e uma cesta, nao um ticker. O "simbolo" e o proprio nome do bloco
    // — usado so quando nao ha composicao (aggbond, que e indice puro).
    simbolos: [NOMES_BLOCO[bloco]],
    defensivo: [0],
    sym: new Array<number>(n).fill(0),
    defesaFrac,
    composicaoBloco,
    equity,
    referencia: vazio.slice(),
    retmes: vazio.slice(),
    ir: vazio.slice(),
    slope: vazio.slice(),
    sigma: vazio.slice(),
  };
}

/** Todas as series sinteticas dos blocos, prontas para entrar no motor. */
export function seriesDosBlocos(data: BenchmarkSetsData): Record<string, StrategySeries> {
  const out: Record<string, StrategySeries> = {};
  for (const b of Object.keys(data.blocos) as BlocoId[]) {
    out[idBloco(b)] = blocoComoSerie(b, data);
  }
  return out;
}

/**
 * A configuracao de um SET.
 *
 * MODO DINAMICO, e isso e uma decisao com pegadinha. Um SET E dinamico — a
 * carteira de cada mes foi decidida pelo momento daquele mes —, entao a tela tem
 * de acender "Alocacao dinamica"; acender "linear" mentiria sobre o produto.
 *
 * Mas o peso ENTRE OS BLOCOS e fixo (60/40, 50/30/20), e no modo dinamico o
 * motor distribui por score. Como os blocos nao tem score (`retmes` nulo), sem
 * cuidado o water-filling rachraria tudo em partes iguais e quebraria os
 * numeros validados.
 *
 * O que trava isso: `min = max = peso`. Com piso e teto colados, o water-filling
 * converge para exatamente aquele peso, qualquer que seja o score. O rotulo fica
 * honesto e a matematica nao se mexe — `presets.test.ts` confere as duas tabelas
 * de validacao justamente por este caminho.
 */
export function configDoSet(
  def: SetDef,
  data: BenchmarkSetsData,
  capital = 100000,
): PortfolioConfig {
  const sleeves: Sleeve[] = def.composicao.map((c) => ({
    id: idBloco(c.bloco),
    weight: c.peso,
    min: c.peso,
    max: c.peso,
  }));
  return {
    sleeves,
    mode: "dynamic",
    basis: "retmes",
    rebalance: "monthly",
    janela: "max",
    window: "common",
    dropNegative: false,
    capital,
    volTarget: def.volTarget ? { alvo: def.volTarget.alvo, lookback: def.volTarget.lookback } : null,
    periodoFixo: { de: data.janela.de, ate: data.janela.ate },
  };
}

export interface Preset {
  id: string;
  /** o que vai no botao */
  rotulo: string;
  def: SetDef;
}

/** A vitrine dos 10 SETs, agrupada por familia e ordenada por risco crescente.
 *  Familia 10.5 (motor suavemin15 · piso 1% · dial de vol-target, 6 perfis)
 *  ocupa a espinha dorsal da escala; familia 41 (top-K rotativo) e Max Retorno
 *  aparecem depois. Numeros validados na janela 20 anos (2006-2026). */
const ORDEM_VITRINE = [
  "d105ins",   // 3,5% vol-target (Institucional)
  "d105con",   // 5,0% (Conservador)
  "d105mod",   // 8,0% (Moderado)
  "d105adv",   // 12,0% (Advanced)
  "d105agr",   // 18,0% (Agressivo)
  "d105max",   // 25,0% (Max)
  "d6",        // Dinamico 41 Conservador (rot+corr+aggbond + vt 12%)
  "d5",        // Dinamico 41 Balanceado
  "d3",        // Dinamico 41 Agressivo
  "dmax",      // Max Retorno Dinamico (sem overlay)
];
export function presetsVitrine(): Preset[] {
  const linha1 = SETS.filter((s) => s.linha === 1);
  const rank = (id: string) => {
    const i = ORDEM_VITRINE.indexOf(id);
    return i < 0 ? ORDEM_VITRINE.length : i;
  };
  return [...linha1]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((s) => ({ id: s.id, rotulo: s.rotuloCurto, def: s }));
}

/** Todos os SETs, incluindo a linha institucional. */
export function todosOsPresets(): Preset[] {
  return SETS.map((s) => ({ id: s.id, rotulo: s.rotuloCurto, def: s }));
}

/** Descricao da composicao para a tela, ja com a atribuicao e a explicacao. */
export function descricaoDoSet(def: SetDef): {
  bloco: BlocoId; peso: number; nome: string; atribuicao: string; explicacao: string;
}[] {
  return def.composicao.map((c) => ({
    bloco: c.bloco,
    peso: c.peso,
    nome: NOMES_BLOCO[c.bloco],
    atribuicao: ATRIBUICAO[c.bloco],
    explicacao: EXPLICACAO_BLOCO[c.bloco],
  }));
}

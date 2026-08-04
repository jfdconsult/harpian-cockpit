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
  return {
    id: idBloco(bloco),
    label: NOMES_BLOCO[bloco],
    start: data.janela.fromIdx,
    n,
    contigua: true,
    // O bloco e uma cesta, nao um ticker. O "simbolo" e o proprio nome do bloco
    // para o painel de carregamento dizer algo verdadeiro.
    simbolos: [NOMES_BLOCO[bloco]],
    // Um bloco nao tem flag de defesa: a defesa mora dentro das estrategias que
    // o compoem, e o export nao traz a fracao blindada dia a dia.
    defensivo: [0],
    sym: new Array<number>(n).fill(0),
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

/** Os botoes da barra do topo — so a linha comercial, que e a vitrine. */
export function presetsVitrine(): Preset[] {
  return SETS.filter((s) => s.linha === 1).map((s) => ({
    id: s.id,
    rotulo: s.rotuloCurto,
    def: s,
  }));
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

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

  // ── Familia 4 MOTORES: o interior vem de `motores4m`, nao de `pesosDiarios` ──
  //
  // Este bloco nao roda sobre as 41 estrategias: roda sobre 4 motores que se
  // dividem em 70 constituintes (11 cestas de industria, 40 estrategias, 15 do
  // DMAX, 5 sleeves de hedge). O contrato de `pesosDiarios` e indexado por
  // `idsUniverso` (as 40), entao nao serve — e sem isto a tira "quanto do
  // portfolio estava blindado" ficava cravada em 0%, afirmando que a carteira
  // NUNCA esteve defendida. Falso: o Industry Leaders vai a caixa em 15% dos
  // dias e o Tail Shield fica em caixa 79% do tempo.
  //
  // Os pesos aqui ja sao fracao do PORTFOLIO (decimo de ponto percentual), nao
  // do motor, entao somam direto sem reescalar.
  if (bloco === "combo4m" && data.motores4m) {
    const cs = data.motores4m.constituintes;
    const cursores = new Array<number>(cs.length).fill(0);
    const df = new Array<number>(n).fill(0);
    for (let d = 0; d < n; d++) {
      // o dia 0 da serie e o dia-base (curva = 1000, sem retorno): os pesos
      // valem de `d-1` no eixo do dataset, mesma convencao do resto do arquivo
      const dia = d - 1;
      if (dia < 0) continue;
      let blind = 0;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        const w = (c.peso[dia] || 0) / 1000;
        if (w <= 0) continue;
        const runs = c.runs;
        let k = cursores[i];
        if (runs[k] && runs[k][0] > dia) k = 0;
        while (k + 1 < runs.length && runs[k + 1][0] <= dia) k++;
        cursores[i] = k;
        const si = runs[k] && runs[k][0] <= dia ? runs[k][1] : -1;
        if (si >= 0 && c.defensivo[si]) blind += w;
      }
      df[d] = blind > 1 ? 1 : blind;
    }
    defesaFrac = df;
    // A composicao por dentro, que e o que anima o painel da esquerda no modo
    // apresentacao: cada linha e um constituinte e a barra respira com o peso
    // dele no dia. Sao 70 linhas (11 cestas de industria + 40 estrategias + 15
    // do DMAX + 5 sleeves de hedge) contra as 40 dos outros blocos.
    //
    // `labels` sai do proprio export: as cestas do Industry Leaders ja vem
    // nomeadas por industria, nao como "CORE11 Cesta 2".
    composicaoBloco = {
      ids: cs.map((c) => c.id),
      pesos: cs.map((c) => c.peso.map((v) => (v || 0) / 1000)),
      labels: Object.fromEntries(cs.map((c) => [c.id, c.label])),
      ticker: (i, dia) => {
        const c = cs[i];
        if (!c) return null;
        const runs = c.runs;
        // busca binaria: o painel consulta um dia por vez, sem cursor util
        let lo = 0, hi = runs.length - 1, si = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (runs[mid][0] <= dia) { si = runs[mid][1]; lo = mid + 1; }
          else hi = mid - 1;
        }
        if (si < 0) return null;
        return { symbol: c.simbolos[si], defense: !!c.defensivo[si] };
      },
    };
  }

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
/**
 * Janela efetiva de um SET: o eixo do dataset apertado pela inception dos
 * blocos que ele usa.
 *
 * Por que existe: o eixo e comum, mas cada motor tem a sua vida. O bloco vale
 * 0 fora dela, e zero num dia de pregao nao e "nao rendeu" — e "nao existia".
 * Deixar esses dias dentro da conta aplana o grafico nas pontas e dilui CAGR e
 * Sharpe. Cortando pela intersecao, o grafico vai ate o ultimo dia em que HA
 * dado e as metricas batem com as do laboratorio.
 *
 * Quando o motor for reprocessado ate uma data mais nova, basta o dataset
 * novo: nao ha nada a mudar aqui.
 */
export function janelaDoSet(
  def: SetDef,
  data: BenchmarkSetsData,
): { de: string; ate: string } {
  let de = data.janela.de;
  let ate = data.janela.ate;
  for (const c of def.composicao) {
    const inc = data.inceptionBloco?.[c.bloco];
    if (!inc) continue;
    if (inc.de > de) de = inc.de;
    if (inc.ate < ate) ate = inc.ate;
  }
  return { de, ate };
}

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
    // A janela vem do bloco, nao do eixo: ver janelaDoSet acima.
    periodoFixo: janelaDoSet(def, data),
  };
}

export interface Preset {
  id: string;
  /** o que vai no botao */
  rotulo: string;
  def: SetDef;
}

/** A vitrine dos 12 SETs, agrupada por familia e ordenada por risco crescente.
 *  Familia 10.5 (motor suavemin15 · piso 1% · dial de vol-target, 6 perfis)
 *  ocupa a espinha dorsal da escala; familia 41 (top-K rotativo) e Max Retorno
 *  aparecem depois. Numeros validados na janela 20 anos (2006-2026). */
const ORDEM_VITRINE = [
  // DUAS FAMILIAS, e so. Decisao do Joao: "quem tem tudo nao tem nada" — um
  // seletor com dez linhas obriga o cliente a comparar em vez de escolher.
  //
  // Familia 4 MOTORES (bloco combo4m, trial 451): a mais eficiente que a casa
  // produziu, Sharpe 2,381 no cru e 2,248 no institucional.
  "d4mins",    // vol-target 5%  · Sharpe 2,248 · DD  -8,8%
  "d4mmax",    // motor cru      · Sharpe 2,381 · DD -20,2%
  // Familia 10.5 (bloco suavemin15): a escala de perfil de risco, do
  // institucional ao max, com o mesmo motor por baixo.
  "d105ins",   // 3,5% vol-target
  "d105con",   // 5,0%
  "d105mod",   // 8,0%
  "d105adv",   // 12,0%
  "d105agr",   // 18,0%
  "d105max",   // 25,0%
  // FORA da vitrine por decisao de 17/08, mas vivos e carregaveis por URL
  // (?set=d3): a familia 41 (d3/d5/d6) e o Max Retorno (dmax).
];
/**
 * A vitrine — o que aparece no seletor do cliente.
 *
 * SO os SETs listados em ORDEM_VITRINE, nessa ordem. Antes esta funcao
 * devolvia TODOS os SETs de linha 1 e mandava os nao-listados para o fim, o que
 * enchia o seletor com 50 opcoes: os 36 experimentos v2..v8 do laboratorio
 * apareciam para o cliente junto com os produtos. Quem esta do outro lado da
 * mesa nao tem como saber que "Institucional v6" e rascunho e "Dynamic 4
 * Engines Institutional" e produto.
 *
 * Os experimentos NAO foram removidos: continuam em `SETS` e carregam por URL
 * (`?set=d105con-v6`) via `presetPorId`, que e como o Joao compara versoes.
 */
export function presetsVitrine(): Preset[] {
  const porId = new Map(SETS.map((s) => [s.id, s]));
  return ORDEM_VITRINE
    .map((id) => porId.get(id))
    .filter((s): s is SetDef => !!s && s.linha === 1)
    .map((s) => ({ id: s.id, rotulo: s.rotuloCurto, def: s }));
}

/**
 * Busca por id em TODOS os SETs, curados ou nao.
 *
 * Existe porque a vitrine passou a filtrar: quem resolve `?set=` na URL ou o
 * SET ativo tem de continuar achando os experimentos, senao carregar um deles
 * por link deixaria a tela em branco.
 */
export function presetPorId(id: string | null | undefined): Preset | undefined {
  if (!id) return undefined;
  const s = SETS.find((x) => x.id === id);
  return s ? { id: s.id, rotulo: s.rotuloCurto, def: s } : undefined;
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

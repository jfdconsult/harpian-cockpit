// ============================================================
// QUAIS DAS 41 SAO ESTRATEGIAS DE DEFESA
// ------------------------------------------------------------
// Nao e lista escrita a mao: sai do dado que o proprio AlphaDroid publica.
//
// O CRITERIO
// Uma estrategia e de defesa quando o UNIVERSO QUE ELA NEGOCIA e de preservacao
// de capital — renda fixa, ouro/metais ou commodities. O universo declarado vem
// no cabecalho do bloco de trades de cada CSV e esta em `meta.universo`; a
// classe de cada ticker e fato publico, nao opiniao.
//
// Reforco independente: nas tres de renda fixa o proprio AlphaDroid escolheu o
// `Agg.Bond` como indice de referencia em vez do S&P 500. Quando os dois sinais
// batem, a classificacao esta ancorada duas vezes.
//
// POR QUE NAO CLASSIFICAR POR COMPORTAMENTO EM CRISE
// Tentador e errado. Medindo o retorno nos 9 piores meses do S&P na janela,
// a Big Tech aparece com +39,5% e a Real Estate 1 com +14,6% — elas NAO sao
// defensivas. Aquilo e o StormGuard DENTRO delas rodando para caixa e titulo, o
// que toda estrategia do AlphaDroid faz. Classificar por ai marcaria meia
// carteira de ações como "defesa" e destruiria o argumento na frente do cliente.
//
// A defesa que mora dentro de cada estrategia continua sendo mostrada pela faixa
// "quanto do portfolio estava blindado". Isto aqui e outra coisa: o PAPEL da
// estrategia no portfolio.
// ============================================================
import type { StrategyMeta } from "./types";

/** Renda fixa: T-bill, Treasury, credito, high yield, municipais. */
const RENDA_FIXA = new Set([
  "BIL", "SGOV", "SHV", "SCHO", "SCHR", "SPTL", "SPTI", "SPTS", "TLH-", "TLT-",
  "VGIT", "VGSH", "VCSH", "IEF-", "TIP", "TIPX", "TIPZ", "TIP2", "BND-", "BNDX",
  "BWX", "AGG-", "IGIB", "IGLB", "IGSB", "IUSB", "LQD", "MBB", "SPIB", "VCIT",
  "VCLT", "SPAB", "HYMB", "MUB", "ANGL", "EMB", "EMLC", "HYG-", "HYLB", "JNK-",
  "SHYG", "SJNK", "SINK", "SPHY", "USHY", "VWOB", "FALN", "CORP", "GNMA", "FIBR",
  "GVI", "SUB", "NYF", "HYD", "PHYL", "PZA", "TFI", "ICSH", "BSV", "NEAR", "FLOT",
]);

/** Ouro, metais e commodities — ativo real. */
const METAL_COMMO = new Set([
  "GLD-", "GLD", "SLV", "IAU", "PPLT", "PALL", "GUNR", "DBC", "DBA", "PDBC",
  "BCI", "USO", "UNG", "DJP", "GDX-", "GDXJ", "SIL", "XME", "COPX", "URA",
  "LIT", "REMX", "WOOD", "MOO", "CORN", "WEAT", "SOYB",
]);

/** Hedge de cauda: vol longa e inverso alavancado — protecao por construcao
 * (ganha quando a bolsa cai forte), nao por comportamento observado em crise.
 * Adicionado 18/08/2026 junto com o Tail Shield (Motor 4 / hedge_sleeve). */
const VOL_INVERSO = new Set([
  "UVIX", "VXX", "VIXY", "UVXY", "SPXU", "SPXS", "SDS", "SH",
]);

/**
 * REITs sao ativo real, mas caem junto com a bolsa quando a coisa aperta —
 * ficam fora da conta. E por isso que a Alternative Investments da 9/11 e nao
 * 11/11: `IYR` e `VNQ` nao contam.
 */
const FRACAO_MINIMA = 0.6;

export interface Classificacao {
  defesa: boolean;
  /** quantos tickers do universo sao de preservacao de capital */
  protetores: number;
  total: number;
  /** o AlphaDroid compara a estrategia com um indice de renda fixa */
  referenciaRendaFixa: boolean;
  /** frase curta para a tela */
  porque: string;
}

export function classificar(meta: StrategyMeta | undefined): Classificacao {
  const universo = (meta?.universo ?? []).map((t) => t.trim()).filter(Boolean);
  const total = universo.length;
  let rf = 0;
  let mc = 0;
  let vi = 0;
  for (const t of universo) {
    if (RENDA_FIXA.has(t)) rf++;
    else if (METAL_COMMO.has(t)) mc++;
    else if (VOL_INVERSO.has(t)) vi++;
  }
  const protetores = rf + mc + vi;
  const refRF = !!meta && meta.referencia_nome !== "S&P 500" && !!meta.referencia_nome;
  const defesa = total > 0 && protetores / total >= FRACAO_MINIMA;

  let porque = "";
  if (defesa) {
    const classe = vi >= rf && vi >= mc ? "hedge de cauda (vol longa/inverso)" : (rf >= mc ? "renda fixa" : "ouro e commodities");
    porque = `${protetores} dos ${total} ativos que ela negocia são de ${classe}` +
      (refRF ? "; o AlphaDroid compara ela com um índice de renda fixa" : "");
  }
  return { defesa, protetores, total, referenciaRendaFixa: refRF, porque };
}

/** Ids das estrategias de defesa dentro de um catalogo. */
export function idsDeDefesa(estrategias: StrategyMeta[]): Set<string> {
  const s = new Set<string>();
  for (const e of estrategias) if (classificar(e).defesa) s.add(e.id);
  return s;
}

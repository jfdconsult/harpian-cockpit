// ============================================================================
// FUNDAMENTOS — tipos da base e a MEMORIA DE CALCULO que o JIM recebe
//
// A regra que este arquivo obedece: o JIM nao pode receber so o placar. Se ele
// receber apenas "HS = 3", vai parafrasear em prosa o numero que o gestor ja
// esta lendo na tela — o modo mais caro de nao dizer nada. O que vai junto e a
// CADEIA: de onde veio o dado, qual formula produziu cada ancora, como cada
// ancora votou, e o que o conjunto NAO consegue afirmar.
//
// Por isso o texto declara explicitamente as ancoras que nao foram avaliadas.
// Uma empresa com 2 de 5 ancoras pode ter o mesmo placar de uma com 5 de 5, e
// sao afirmacoes de forca completamente diferente.
//
// Fica fora do componente porque e texto de dominio, nao interface: muda quando
// a metodologia muda, nao quando a tela muda.
// ============================================================================
import { fmtUSD } from "@/lib/data";

export interface Setor {
  setor: string; empresas: number; valor_tri: number | null;
  score_medio: number | null; score_ponderado: number | null;
  amplitude_mom_pct: number | null; amplitude_fund_pct: number | null;
  mom_mediano: number | null; cobertura_mom_pct: number | null;
  pl_mediano: number | null; percentil_hist: number | null;
  top3_pct: number | null; f_score_mediano: number | null;
  divergencia_mediana: number | null; subsetores: number;
  grau_score: string | null; grau_mom: string | null; grau_preco: string | null;
}

export interface Subsetor {
  setor: string; subsetor: string; empresas: number; valor_tri: number | null;
  pct_do_setor: number | null; score_medio: number | null;
  score_ponderado: number | null; amplitude_mom_pct: number | null;
  mom_mediano: number | null; pl_mediano: number | null;
  percentil_hist: number | null; top1_pct: number | null; top3_pct: number | null;
  f_score_mediano: number | null; confianca: string | null;
  grau_score: string | null; grau_mom: string | null;
}

export interface Empresa {
  ticker: string; nome: string; setor_hx: string; subsetor_hx: string;
  confianca_hx: string | null; valor_mercado: number | null;
  fechamento: number | null; JD_SCORE_FUND: number | null; postura: string | null;
  HFS: number | null; F_Score: number | null; PL: number | null;
  PL_percentil_hist: number | null; PVPA: number | null; EV_EBIT: number | null;
  fcf_yield_pct: number | null; ROE: number | null; ROIC: number | null;
  RevGrowth: number | null; mom_12_1: number | null; divergencia: number | null;
  preco_compra_hist: number | null; preco_venda_hist: number | null;
  preco_compra_gordon: number | null; preco_compra_fcf: number | null;
  upside_gordon_pct: number | null;
  n_gatilhos: number | null; qualidade_dado: string | null;
  estrangeiro: boolean | null; segmento_nome: string | null;
  idade_preco_dias: number | null;
  // ---- memoria de calculo: o que permite explicar a ORIGEM do placar ----
  voto_hist: number | null; voto_setor: number | null; voto_gordon: number | null;
  voto_fcf: number | null; voto_magic: number | null;
  ancoras_avaliadas: number | null; votos_barato: number | null; votos_caro: number | null;
  gatilho_qualidade_fraca: number | null; gatilho_alavancagem_extrema: number | null;
  gatilho_patrimonio_negativo: number | null;
  beta: number | null; Ke: number | null; g_sustentavel: number | null;
  PVPA_justo: number | null; preco_justo_gordon: number | null;
  PL_mediana_hist: number | null; PL_percentil_setor: number | null;
  EV_EBITDA: number | null; earn_yield: number | null; MagicFormula: number | null;
  GrossMargin: number | null; OperMargin: number | null; NetMargin: number | null;
  HFS_mercado: number | null; z_QUALIDADE: number | null; z_CRESCIMENTO: number | null;
  z_SOLIDEZ: number | null; z_CAIXA: number | null;
  grupo_comparacao: string | null; nivel_faixa: string | null; sic_descricao: string | null;
  dias_desde_filing: number | null; F_criterios_avaliados: number | null;
  premio_sobre_tesouro_pp: number | null;
}

export interface Doc {
  gerado_em: string;
  data_preco: string;   // ultima observacao real de preco
  balde_ref: string;    // rotulo do balde mensal do valuation — NAO e data observada
  cobertura_preco_mensal: { mes: string; tickers: number }[];
  universo: {
    empresas: number; setores: number; subsetores: number;
    valor_tri_domestico: number; com_momento: number; estrangeiros: number;
  };
  ressalvas: string[];
  setores: Setor[]; subsetores: Subsetor[]; empresas: Empresa[];
}

const votoTxt = (v: number | null | undefined) =>
  v === null || v === undefined ? "nao avaliada"
    : v > 0 ? "BARATO (+1)" : v < 0 ? "CARO (-1)" : "NEUTRO (0)";

export function memoriaDeCalculo(e: Empresa, doc: Doc): string {
  const p = (v: number | null | undefined, d = 2, suf = "") =>
    v === null || v === undefined ? "sem dado" : `${v.toFixed(d)}${suf}`;
  const pct = (v: number | null | undefined, d = 1) =>
    v === null || v === undefined ? "sem dado" : `${(v * 100).toFixed(d)}%`;
  const L: string[] = [];

  L.push(`EMPRESA: ${e.nome} (${e.ticker})`);
  L.push(
    `Classificacao Harpian: ${e.setor_hx} > ${e.subsetor_hx}` +
    ` (confianca da classificacao: ${e.confianca_hx ?? "n/d"}).` +
    ` Registro SIC da SEC: "${e.sic_descricao ?? "n/d"}" — o SIC e cadastral e foi` +
    ` revisado pela ultima vez em 1987, entao o agrupamento usado aqui e economico,` +
    ` nao o SIC.`
  );
  L.push(
    `Grupo de comparacao dos multiplos: ${e.grupo_comparacao ?? "n/d"}` +
    `${e.nivel_faixa ? ` (nivel ${e.nivel_faixa})` : ""}.`
  );
  L.push(
    `Valor de mercado: ${e.valor_mercado ? fmtUSD(e.valor_mercado) : "sem dado"}` +
    `${e.estrangeiro
      ? " — ATENCAO: emissor estrangeiro (20-F/40-F). Contagem de acoes em ordinarias" +
        " e preco em ADR: o valor de mercado NAO e comparavel com o das domesticas."
      : "."}`
  );

  L.push("");
  L.push("ORIGEM DO DADO");
  L.push(
    `Fundamento: SEC XBRL (companyfacts), leitura point-in-time — cada numero e o` +
    ` que estava publicado NA DATA, sem restatement posterior contaminando o passado.` +
    ` Ultimo filing ha ${e.dias_desde_filing ?? "n/d"} dias.`
  );
  L.push(
    `Preco: ultimo fechamento da base, ${doc.data_preco}` +
    `${e.idade_preco_dias ? `, com ${e.idade_preco_dias} dias de defasagem nesta empresa` : ""}.`
  );
  L.push(
    `Qualidade do dado: ${e.qualidade_dado ?? "n/d"}. Este eixo mede FRESCOR e e` +
    ` separado da postura de mercado — dado velho nao vira opiniao negativa.`
  );

  L.push("");
  L.push(`PLACAR HS (Harpian Score) = ${p(e.JD_SCORE_FUND, 1)} | postura: ${e.postura ?? "n/d"}`);
  L.push(
    `HS e a SOMA dos votos de ate 5 ancoras independentes, cada uma votando +1` +
    ` (barato), 0 (neutro) ou -1 (caro). Escala -5 a +5. Nesta empresa foram` +
    ` avaliadas ${e.ancoras_avaliadas ?? 0} de 5 ancoras` +
    ` (${e.votos_barato ?? 0} barato, ${e.votos_caro ?? 0} caro).`
  );
  L.push(
    `Ancora nao avaliada NAO conta como neutra: ela reduz a forca da afirmacao.` +
    ` Se o numero de ancoras for baixo, diga isso antes de qualquer conclusao.`
  );

  L.push("");
  L.push("1) ANCORA HISTORICA — o multiplo contra a propria historia da empresa");
  L.push(
    `   P/L atual ${p(e.PL, 1)} contra mediana historica ${p(e.PL_mediana_hist, 1)};` +
    ` percentil ${p(e.PL_percentil_hist, 0)} (0 = mais barato que ja esteve,` +
    ` 100 = mais caro que ja esteve).`
  );
  L.push(
    `   Precos de gatilho derivados: compra ${p(e.preco_compra_hist)}, venda` +
    ` ${p(e.preco_venda_hist)}. Sao o fundo e o topo da FAIXA DE MULTIPLO da propria` +
    ` empresa aplicados ao lucro corrente — nao sao preco-alvo de casa nem consenso` +
    ` de mercado. Voto: ${votoTxt(e.voto_hist)}.`
  );

  L.push("");
  L.push("2) ANCORA SETORIAL — o multiplo contra os pares do mesmo grupo economico");
  L.push(
    `   Percentil do P/L dentro de ${e.grupo_comparacao ?? "seu grupo"}:` +
    ` ${p(e.PL_percentil_setor, 0)}. Esta ancora existe porque cada setor tem sua` +
    ` propria faixa normal de multiplo: industria pesada e software nao se comparam` +
    ` pelo mesmo P/L. Voto: ${votoTxt(e.voto_setor)}.`
  );

  L.push("");
  L.push("3) ANCORA GORDON — P/VPA justificado pelo retorno sobre o patrimonio");
  L.push(
    `   Formula: P/VPA justo = (ROE - g) / (Ke - g). ROE ${pct(e.ROE)},` +
    ` g sustentavel ${pct(e.g_sustentavel)}, Ke ${pct(e.Ke)}` +
    ` (custo de capital proprio, via beta ${p(e.beta)}).`
  );
  L.push(
    `   P/VPA justo ${p(e.PVPA_justo)} contra P/VPA atual ${p(e.PVPA)} => preco justo` +
    ` ${p(e.preco_justo_gordon)} (upside ${p(e.upside_gordon_pct, 1, "%")}).` +
    ` Voto: ${votoTxt(e.voto_gordon)}.`
  );
  L.push(
    `   LIMITE CONHECIDO da formula: quando g se aproxima de Ke o denominador tende a` +
    ` zero e o preco justo explode. Se o upside vier absurdo, a causa e essa — diga` +
    ` que a ancora perdeu validade, em vez de repetir o numero.`
  );

  L.push("");
  L.push("4) ANCORA DE CAIXA — geracao de caixa contra o preco");
  L.push(
    `   FCF yield ${p(e.fcf_yield_pct, 1, "%")}; earnings yield ${pct(e.earn_yield)};` +
    ` premio sobre o Tesouro de 10 anos ${p(e.premio_sobre_tesouro_pp, 1, " p.p.")}.` +
    ` Preco de compra pelo caixa: ${p(e.preco_compra_fcf)}. Voto: ${votoTxt(e.voto_fcf)}.`
  );
  L.push(
    `   E a ancora que menos depende de escolha contabil: caixa e mais dificil de` +
    ` maquiar do que lucro.`
  );

  L.push("");
  L.push("5) ANCORA MAGIC FORMULA (Greenblatt) — retorno sobre capital + lucro sobre EV");
  L.push(
    `   Ranking combinado: ${p(e.MagicFormula, 0)}. ROIC ${pct(e.ROIC)},` +
    ` EV/EBIT ${p(e.EV_EBIT, 1)}, EV/EBITDA ${p(e.EV_EBITDA, 1)}.` +
    ` Voto: ${votoTxt(e.voto_magic)}.`
  );
  L.push(
    `   Nao se aplica a banco, seguradora nem utility: capital tangivel nao tem o` +
    ` mesmo significado nesses negocios.`
  );

  const g: string[] = [];
  if (e.gatilho_qualidade_fraca) g.push("qualidade fraca");
  if (e.gatilho_alavancagem_extrema) g.push("alavancagem extrema");
  if (e.gatilho_patrimonio_negativo) g.push("patrimonio negativo");
  L.push("");
  L.push("GATILHOS DEFENSIVOS");
  L.push(
    g.length
      ? `ACIONADOS: ${g.join(", ")}. Gatilho defensivo SOBREPOE o placar — uma empresa` +
        ` barata com patrimonio negativo nao e oportunidade, e risco de estrutura.` +
        ` Trate isso como a informacao principal, nao como nota de rodape.`
      : "Nenhum acionado."
  );

  L.push("");
  L.push("QUALIDADE E SOLIDEZ");
  L.push(
    `HFS ${p(e.HFS, 0)} de 100 — percentil neutro por setor, 5 pilares. Pilares em` +
    ` z-score: qualidade ${p(e.z_QUALIDADE)}, crescimento ${p(e.z_CRESCIMENTO)},` +
    ` solidez ${p(e.z_SOLIDEZ)}, caixa ${p(e.z_CAIXA)}.`
  );
  L.push(
    `NOMENCLATURA: HS (-5 a +5) e o placar de valuation desta tela. HFS (0 a 100) e o` +
    ` indice de qualidade. Sao medidas diferentes — nunca as trate como a mesma coisa.`
  );
  L.push(
    `Piotroski F-Score ${e.F_Score ?? "n/d"} de 9` +
    ` (${e.F_criterios_avaliados ?? "n/d"} criterios avaliaveis). Margens: bruta` +
    ` ${pct(e.GrossMargin)}, operacional ${pct(e.OperMargin)}, liquida ${pct(e.NetMargin)}.` +
    ` Crescimento de receita ${pct(e.RevGrowth)}.`
  );

  L.push("");
  L.push("MOMENTO E DIVERGENCIA");
  if (e.mom_12_1 === null) {
    L.push(
      `Esta empresa NAO tem serie de preco suficiente na base: o momento nao foi` +
      ` calculado. Nao construa leitura de tendencia — diga que o eixo nao existe aqui.`
    );
  } else {
    L.push(
      `Momento 12-1: ${pct(e.mom_12_1)}. Divergencia (percentil de fundamento menos` +
      ` percentil de momento na mesma secao transversal): ${p(e.divergencia, 0)}.`
    );
    L.push(
      `Positiva = fundamento melhor do que o preco reconhece (candidata a entrada).` +
      ` Negativa = preco a frente do fundamento (posicao a vigiar, nao venda automatica).` +
      ` Momento bom nao valida fundamento ruim, e vice-versa: sao dois eixos, e a leitura` +
      ` so vale a pena justamente quando eles discordam.`
    );
  }

  L.push("");
  L.push("COMO RESPONDER");
  L.push(
    `Explique a cadeia: dado -> formula -> voto -> placar. Diga o que cada ancora viu e` +
    ` por que votou assim. Aponte as contradicoes entre ancoras em vez de esconde-las` +
    ` numa media. Se um numero estiver fora de faixa plausivel, desconfie do dado antes` +
    ` de desconfiar da empresa. Nao use o momento para justificar o fundamento.`
  );
  L.push(
    `COMPLIANCE: isto e interpretacao de dados publicos da SEC, nao e recomendacao de` +
    ` compra ou venda, nao e consultoria de investimento e nao considera objetivo,` +
    ` situacao financeira ou necessidade de nenhum investidor. Desempenho passado nao` +
    ` garante resultado futuro.`
  );

  return L.join("\n");
}

export function perguntasSugeridas(e: Empresa): string[] {
  const q = [
    `Por que ${e.ticker} tem HS ${e.JD_SCORE_FUND?.toFixed(0) ?? "n/d"}? Abra ancora por ancora.`,
    `Quais ancoras de ${e.ticker} discordam entre si, e qual delas eu deveria pesar mais?`,
  ];
  if (e.n_gatilhos) q.push(`O que exatamente disparou o gatilho defensivo em ${e.ticker}?`);
  if (e.mom_12_1 !== null && (e.divergencia ?? 0) > 30)
    q.push(`O fundamento de ${e.ticker} esta a frente do preco — o que o mercado pode estar vendo que a base nao ve?`);
  if (e.mom_12_1 === null)
    q.push(`${e.ticker} nao tem momento na base. O que isso limita na leitura?`);
  return q;
}

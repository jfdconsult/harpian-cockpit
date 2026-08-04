// Teste dos 3 SETs demonstrativos contra a tabela de validacao da
// SPEC_3_SETS_BUILDER.md (v3 — 100% AlphaDroid).
// rodar: npx tsx lib/portfolio-builder/benchmark-sets.test.ts
//
// A spec e explicita: "a implementacao DEVE reproduzir isto". Entao o teste nao
// checa "parecido" — checa cada numero publicado, na precisao em que foi
// publicado. Se um dia o dataset for reexportado e um numero sair do lugar, este
// arquivo quebra antes de a apresentacao ir para a frente do cliente.
import fs from "node:fs";
import path from "node:path";
import {
  ATRIBUICAO,
  EXPLICACAO_BLOCO,
  LINHAS,
  NOMES_BLOCO,
  SETS,
  avaliarRegua,
  avaliarSet,
  comporSet,
  metricasSet,
  misturarBlocos,
  overlayVolTarget,
} from "./benchmark-sets";
import type { BenchmarkSetsData, BlocoId } from "./benchmark-sets";

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log("  ok   " + msg);
  else {
    console.log("  FALHA " + msg);
    falhas++;
  }
}
/** compara depois de arredondar na mesma casa em que a spec publicou o numero */
function publicado(valor: number, esperado: number, casas: number, msg: string) {
  const r = Number(valor.toFixed(casas));
  ok(r === esperado, `${msg}: ${r.toFixed(casas)} (spec ${esperado.toFixed(casas)})`);
}

const DIR = path.join(process.cwd(), "data", "strategies");
const data: BenchmarkSetsData = JSON.parse(
  fs.readFileSync(path.join(DIR, "benchmark-sets.json"), "utf8"),
);

console.log("\n== dataset ==");
console.log(`  janela ${data.janela.de} -> ${data.janela.ate}  (${data.janela.n} retornos)`);
console.log(`  gerado em ${data.gerado_em} por ${data.origem}`);
ok(data.janela.de === "2011-08-01", "janela comeca em 2011-08-01");
ok(data.janela.ate === "2026-06-04", "janela termina em 2026-06-04");
ok(data.convencoes.rf === 0, "caixa rende zero (rf = 0)");
ok(data.datas.length === data.janela.n, "uma data por retorno");
for (const b of ["rotacao20", "corrmin20", "aggbond", "maxcagr10"] as const) {
  ok(data.blocos[b]?.length === data.janela.n, `bloco ${b} alinhado com a janela`);
}
ok(data.ew41.length === data.janela.n, "regua EW-41 alinhada com a janela");
ok(data.convencoes.corrmin.k === 20, "corr-min com K = 20");
ok(data.convencoes.corrmin.lookback === 252, "correlacao sobre 252 pregoes");
ok(data.convencoes.rotacao.k === 20, "rotacao com K = 20");
ok(data.convencoes.rotacao.teto === 0.1, "rotacao com teto de 10% por estrategia");

console.log("\n== v3 — a composicao e 100% AlphaDroid ==");
{
  // A regra da v3: nenhum motor proprietario Harpian na composicao. O que a
  // Harpian assina e a ALOCACAO entre os motores do AlphaDroid.
  ok(
    (data.blocos as Record<string, unknown>).hcusig === undefined,
    "o dataset nao traz mais o bloco proprietario",
  );
  ok(
    SETS.every((s) => s.composicao.every((c) => (c.bloco as string) !== "hcusig")),
    "nenhum SET usa bloco proprietario",
  );
  const textos = [
    ...Object.values(NOMES_BLOCO),
    ...Object.values(ATRIBUICAO),
    ...Object.values(EXPLICACAO_BLOCO),
    ...SETS.map((s) => s.nome + " " + s.tese),
    ...LINHAS.map((l) => l.nome + " " + l.subtitulo + " " + l.narrativa),
  ].join(" ").toLowerCase();
  ok(!textos.includes("overnight"), 'nenhum rotulo diz "Overnight"');
  ok(!textos.includes("hc-us"), "nenhum rotulo cita o motor que saiu na v3");
  ok(ATRIBUICAO.rotacao20.includes("AlphaDroid"), "a rotacao creditada ao AlphaDroid");
  ok(ATRIBUICAO.corrmin20.includes("AlphaDroid"), "a minima correlacao creditada ao AlphaDroid");
  ok(
    ATRIBUICAO.corrmin20.includes("alocação Harpian"),
    "a Harpian aparece como responsavel pela alocacao, nao pelas estrategias",
  );
}

console.log("\n== o gatilho de amplitude — a chave de regime ==");
{
  const g = data.convencoes.gatilho;
  ok(g.amplitudeMinima === 12, "dispara abaixo de 12 das 41 com momento positivo");
  ok(g.idsDefesa.length === 5, "manda para as 5 estrategias de preservacao de capital");
  console.log(`       disparou em ${data.mesesEmDefesa.length} de 178 rebalances`);
  console.log(`       ${data.mesesEmDefesa.join(", ")}`);
  ok(data.mesesEmDefesa.length === 11, "disparou 11 vezes em 15 anos");
  const em2022 = data.mesesEmDefesa.filter((d) => d.startsWith("2022")).length;
  ok(em2022 === 7, `7 dos 11 disparos foram em 2022 (achou ${em2022})`);
  ok(
    EXPLICACAO_BLOCO.rotacao20.includes("12 das 41"),
    "a copy da tela anuncia o gatilho",
  );
  // O gatilho e a razao de o Calmar sair de 1,17 (rotacao pura) para 1,47.
  // Sem ele nao ha nada que tire a carteira TODA de risco: a defesa StormGuard
  // mora dentro de cada estrategia e nao conversa entre elas.
}

console.log("\n== a linha e os 4 SETs ==");
{
  ok(LINHAS.length === 1, "uma linha de produto");
  ok(SETS.map((s) => s.id).join(",") === "d3,d5,d6,dmax", "os SETs sao D3 / D5 / D6 / DMAX");
  // A familia Sharpe (D3/D5/D6) balanceia os DOIS criterios; o DMAX e outra
  // prateleira — retorno maximo — e usa o proprio bloco de 10+5.
  const classicos = SETS.filter((s) => ["d3", "d5", "d6"].includes(s.id));
  ok(
    classicos.every((s) => s.composicao.some((c) => c.bloco === "rotacao20")
                        && s.composicao.some((c) => c.bloco === "corrmin20")),
    "todo SET da familia Sharpe usa os DOIS blocos — e o balanceamento que a Harpian assina",
  );
  ok(
    SETS.every((s) => Math.abs(s.composicao.reduce((a, c) => a + c.peso, 0) - 1) < 1e-12),
    "os pesos de bloco de todo SET somam 100%",
  );
  const comp = (id: string) =>
    SETS.find((s) => s.id === id)!.composicao.map((c) => `${c.bloco}:${c.peso}`).join(" ");
  ok(comp("d3") === "rotacao20:0.5 corrmin20:0.5", "D3 = 50% rotação + 50% mínima correlação");
  ok(comp("d5") === "rotacao20:0.4 corrmin20:0.4 aggbond:0.2", "D5 = 40/40/20");
  ok(comp("d6") === comp("d5"), "D6 tem a MESMA composição do D5 — o que muda é o overlay");
  ok(SETS.find((s) => s.id === "d6")!.volTarget?.alvo === 0.12, "D6 tem vol-target 12%");
  ok(!SETS.find((s) => s.id === "d5")!.volTarget, "D5 não tem overlay");
  ok(comp("dmax") === "maxcagr10:1", "DMAX = 100% do bloco de retorno máximo");
  ok(!SETS.find((s) => s.id === "dmax")!.volTarget, "DMAX não tem overlay — retorno primeiro");
  const mx = data.convencoes.maxcagr;
  ok(mx.k === 10 && mx.teto === 0.25, "DMAX: 10 de ataque com teto de 25%");
  ok(mx.idsAtaque.length === 10, "as 10 de ataque estao publicadas no dataset");
  ok(
    mx.idsAtaque.every((id) => !data.convencoes.gatilho.idsDefesa.includes(id)),
    "nenhuma das 10 de ataque e estrategia de defesa",
  );
}

console.log("\n== convencao t/t+1: nada olha para frente ==");
{
  const corte = 2000;
  const cheio = comporSet(SETS[2], data).retornos;
  const cortado = comporSet(SETS[2], {
    ...data,
    janela: { ...data.janela, n: corte },
    datas: data.datas.slice(0, corte),
    blocos: {
      rotacao20: data.blocos.rotacao20.slice(0, corte),
      corrmin20: data.blocos.corrmin20.slice(0, corte),
      aggbond: data.blocos.aggbond.slice(0, corte),
    } as Record<BlocoId, number[]>,
    ew41: data.ew41.slice(0, corte),
    spx: data.spx.slice(0, corte),
  }).retornos;
  let maiorDif = 0;
  for (let i = 0; i < corte; i++) maiorDif = Math.max(maiorDif, Math.abs(cheio[i] - cortado[i]));
  ok(maiorDif < 1e-15, `cortar a serie no dia ${corte} nao muda o passado (dif ${maiorDif.toExponential(1)})`);
}
{
  const { exposicao } = overlayVolTarget([...data.blocos.corrmin20], 0.12, 21, new Set(data.rebalSemanal));
  ok(exposicao.slice(0, 21).every((e) => e === 1), "os 21 primeiros dias ficam sem overlay (sem amostra)");
  ok(exposicao.every((e) => e <= 1 + 1e-12), "o overlay nunca alavanca (e <= 1)");
}
{
  const so = misturarBlocos([data.blocos.aggbond], [1], new Set(data.rebalMensal));
  let dif = 0;
  for (let i = 0; i < so.length; i++) dif = Math.max(dif, Math.abs(so[i] - data.blocos.aggbond[i]));
  ok(dif < 1e-12, "misturar um bloco unico devolve o proprio bloco");
}

// SET | Sharpe IS / HO / FULL | Sortino | Calmar | CAGR | vol | maxDD | corr S&P
const TABELA: Record<string, {
  is: number; ho: number; full: number;
  sortino: number; calmar: number; cagr: number; vol: number; maxDD: number; corr: number;
}> = {
  d3:   { is: 1.63, ho: 1.63, full: 1.63, sortino: 2.42, calmar: 1.47, cagr: 0.343, vol: 0.192, maxDD: -0.234, corr: 0.42 },
  d5:   { is: 1.65, ho: 1.61, full: 1.64, sortino: 2.44, calmar: 1.46, cagr: 0.275, vol: 0.156, maxDD: -0.188, corr: 0.42 },
  d6:   { is: 1.59, ho: 1.73, full: 1.63, sortino: 2.43, calmar: 1.48, cagr: 0.205, vol: 0.119, maxDD: -0.139, corr: 0.42 },
  dmax: { is: 1.69, ho: 1.59, full: 1.65, sortino: 2.60, calmar: 1.77, cagr: 0.675, vol: 0.351, maxDD: -0.381, corr: 0.33 },
  ew41: { is: 1.54, ho: 1.61, full: 1.57, sortino: 2.27, calmar: 1.20, cagr: 0.254, vol: 0.151, maxDD: -0.211, corr: 0.49 },
};

const resultados = [...SETS.map((s) => avaliarSet(s, data)), avaliarRegua(data)];

console.log("\n== a tabela de validacao (v3) ==");
for (const r of resultados) {
  const esp = TABELA[r.def.id];
  if (!esp) { ok(false, `SET sem linha na tabela: ${r.def.id}`); continue; }
  console.log(`\n  ${r.def.id.toUpperCase()} — ${r.def.nome}`);
  publicado(r.is.sharpe, esp.is, 2, "Sharpe IS");
  publicado(r.ho.sharpe, esp.ho, 2, "Sharpe HO");
  publicado(r.full.sharpe, esp.full, 2, "Sharpe FULL");
  publicado(r.full.sortino, esp.sortino, 2, "Sortino FULL");
  publicado(r.full.calmar, esp.calmar, 2, "Calmar FULL");
  publicado(r.full.cagr, esp.cagr, 3, "CAGR");
  publicado(r.full.vol, esp.vol, 3, "vol");
  publicado(r.full.maxDD, esp.maxDD, 3, "maxDD");
  publicado(r.full.correlacaoSP ?? NaN, esp.corr, 2, "corr S&P");
}

console.log("\n== ano a ano (material de venda) ==");
{
  const ANOS: Record<string, [number, number, number]> = {
    // ano: [D3, D5, D6]
    "2013": [59.5, 45.0, 39.0],
    "2016": [16.5, 13.7, 12.1],
    "2018": [18.3, 14.6, 11.9],
    "2020": [146.8, 111.6, 39.7],
    "2022": [-7.6, -8.7, -8.3],
    "2023": [32.1, 26.6, 25.2],
    "2024": [79.0, 61.1, 40.5],
    "2025": [63.5, 50.9, 39.3],
  };
  const porId = Object.fromEntries(resultados.map((r) => [r.def.id, r]));
  for (const [ano, esperados] of Object.entries(ANOS)) {
    const linha = (["d3", "d5", "d6"] as const).map((id, k) => {
      const a = porId[id].porAno.find((x) => x.ano === ano);
      if (!a) { ok(false, `${id} sem ${ano}`); return "—"; }
      publicado(a.ret * 100, esperados[k], 1, `${ano} ${id.toUpperCase()} (%)`);
      return (a.ret * 100).toFixed(1);
    });
    console.log(`       ${ano}: D3 ${linha[0]}%  D5 ${linha[1]}%  D6 ${linha[2]}%`);
  }
  // DMAX validado a parte — a escala e outra (RESULTADO_MAX_CAGR §vencedor)
  const ANOS_MAX: Record<string, number> = {
    "2013": 130.1, "2017": 98.7, "2020": 457.1, "2022": 1.2, "2024": 176.3, "2025": 126.7,
  };
  for (const [ano, esperado] of Object.entries(ANOS_MAX)) {
    const a = porId.dmax.porAno.find((x) => x.ano === ano);
    if (!a) { ok(false, `dmax sem ${ano}`); continue; }
    publicado(a.ret * 100, esperado, 1, `${ano} DMAX (%)`);
  }
}

console.log("\n== 2022, o teste acido ==");
{
  const esperado: Record<string, number> = { d3: -7.6, d5: -8.7, d6: -8.3, dmax: 1.2, ew41: -15.3 };
  for (const r of resultados) {
    const a = r.porAno.find((x) => x.ano === "2022");
    if (!a) { ok(false, `${r.def.id} sem 2022`); continue; }
    publicado(a.ret * 100, esperado[r.def.id], 1, `${r.def.id} em 2022 (%)`);
  }
  const ew = resultados.find((r) => r.def.id === "ew41")!;
  const b = ew.porAno.find((x) => x.ano === "2022")!.ret;
  for (const r of resultados.filter((x) => x.def.id !== "ew41")) {
    const a = r.porAno.find((x) => x.ano === "2022")!.ret;
    ok(a > b / 1.5,
       `${r.def.id} cai bem menos que a régua em 2022 (${(a * 100).toFixed(1)}% vs ${(b * 100).toFixed(1)}%)`);
  }
}

console.log("\n== coerencia interna ==");
{
  const porId = Object.fromEntries(resultados.map((r) => [r.def.id, r]));
  const ew = porId.ew41;

  const b = porId.d5, a = porId.d6;
  ok(a.full.vol < b.full.vol, "d6: o vol-target entrega menos volatilidade que d5");
  ok(Math.abs(a.full.vol / 0.12 - 1) < 0.15,
     `d6: a vol realizada fica perto do alvo de 12% (${(a.full.vol * 100).toFixed(1)}%)`);
  ok(a.exposicao !== null, "d6 expoe a serie de exposicao do overlay");
  ok(b.exposicao === null, "d5 nao tem overlay");
  const exp = a.exposicao!;
  const media = exp.reduce((x, y) => x + y, 0) / exp.length;
  console.log(`       d6: exposicao media ${(media * 100).toFixed(1)}%  min ${(Math.min(...exp) * 100).toFixed(1)}%`);
  ok(media < 1, "d6: o overlay desliga risco em parte do tempo");
  ok(a.full.maxDD > b.full.maxDD,
     `d6: o overlay corta a maior queda contra d5 ` +
     `(${(a.full.maxDD * 100).toFixed(1)}% vs ${(b.full.maxDD * 100).toFixed(1)}%)`);

  for (const r of resultados.filter((x) => x.def.id !== "ew41")) {
    ok(r.full.sharpe > ew.full.sharpe, `${r.def.id} bate a régua EW-41 no Sharpe`);
    ok(r.full.calmar > ew.full.calmar, `${r.def.id} bate a régua no Calmar`);
    ok((r.full.correlacaoSP ?? 1) < (ew.full.correlacaoSP ?? 0),
       `${r.def.id} tem correlação com o S&P menor que a régua`);
  }
  ok(porId.d3.equity[0] === 100000, "a curva comeca no capital pedido");
  ok(porId.d3.equity.length === porId.d3.retornos.length + 1,
     "a curva tem um ponto a mais que os retornos");
}
{
  const rho = resultados[0].retornos;
  const negs = rho.filter((r) => r < 0);
  const somaQ = negs.reduce((a, b) => a + b * b, 0);
  const dnCheio = Math.sqrt(somaQ / rho.length) * Math.sqrt(252);
  const dnErrado = Math.sqrt(somaQ / negs.length) * Math.sqrt(252);
  const media = rho.reduce((a, b) => a + b, 0) / rho.length;
  ok(Math.abs((media * 252) / dnCheio - resultados[0].full.sortino) < 1e-12,
     "Sortino usa o denominador de N cheio (§4.4)");
  ok((media * 252) / dnErrado < resultados[0].full.sortino,
     "com N so dos negativos o Sortino sairia diferente — a convencao importa");
  for (const r of resultados) {
    ok(Math.abs(r.full.calmar - r.full.cagr / Math.abs(r.full.maxDD)) < 1e-12,
       `${r.def.id}: Calmar = CAGR / |maxDD|`);
  }
}

console.log("\n== estatistica tecnica por estrategia (relatorio) ==");
{
  const eb = data.estatisticasBloco;
  ok(!!eb, "o dataset traz estatisticasBloco");
  for (const b of ["rotacao20", "corrmin20", "maxcagr10"] as const) {
    ok((eb?.[b]?.estrategias.length ?? 0) > 0, `${b} tem estrategias decompostas`);
  }
  const mx = eb.maxcagr10;
  ok(mx.estrategias.length === 15, "DMAX decompoe em 15 estrategias (10 ataque + 5 defesa)");
  const somaPeso = mx.estrategias.reduce((a, e) => a + e.pesoMedio, 0);
  ok(Math.abs(somaPeso - 1) < 0.02, `pesos medios do DMAX somam ~100% (${(somaPeso * 100).toFixed(1)}%)`);
  ok(mx.estrategias.every((e) => e.mesesTotal === mx.estrategias[0].mesesTotal),
     "mesma contagem de meses para todas");
  ok(mx.estrategias.every((e) => e.topAtivos.length <= 3 && e.nAtivos > 0),
     "cada estrategia traz ate 3 melhores ativos e o total negociado");
  console.log(`       DMAX: ${mx.simbolosNegociados.length} tickers distintos, ` +
              `${mx.estrategias.reduce((a, e) => a + e.trocas, 0)} giros somados`);
  ok(mx.simbolosNegociados.length > 50, "universo de tickers do DMAX e real (> 50)");
}

console.log("\n== carteiras vigentes ==");
{
  const rot = data.rotacaoVigente;
  ok(rot !== null, "o dataset traz a carteira do ultimo rebalance da rotacao");
  if (rot) {
    const soma = rot.pesos.reduce((a, p) => a + p.peso, 0);
    console.log(`       rotação: ${rot.data}, ${rot.pesos.length} estratégias` +
                (rot.emDefesa ? " (EM REGIME DE DEFESA)" : ""));
    ok(rot.data === "2026-06-01", "a carteira vigente e a do rebalance de 2026-06-01");
    ok(Math.abs(soma - 1) < 1e-9, `os pesos somam 100% (${(soma * 100).toFixed(4)}%)`);
    ok(rot.pesos.every((p) => p.peso <= 0.1 + 1e-9), "ninguem passa do teto de 10%");
  }
  const sel = data.selecaoVigente;
  ok(sel !== null && sel.ids.length === 20, "corr-min vigente com 20 estrategias");
  console.log(`       trocas por rebalance: ${data.trocasPorRebalance.toFixed(2)}`);
  ok(Math.abs(data.trocasPorRebalance - 1.7) < 0.2, "~1,7 trocas por rebalance no corr-min");

  const mx = data.maxcagrVigente;
  ok(mx !== null, "o dataset traz a carteira vigente do DMAX");
  if (mx) {
    const soma = mx.pesos.reduce((a, p) => a + p.peso, 0);
    console.log(`       DMAX: ${mx.data}, ${mx.pesos.length} estratégias` +
                (mx.emDefesa ? " (EM REGIME DE DEFESA)" : ""));
    ok(mx.data === "2026-06-01", "a carteira vigente e a do rebalance de 2026-06-01");
    ok(Math.abs(soma - 1) < 1e-9, `os pesos do DMAX somam 100% (${(soma * 100).toFixed(4)}%)`);
    const ataque = new Set(data.convencoes.maxcagr.idsAtaque);
    ok(
      mx.pesos.filter((p) => ataque.has(p.id)).every((p) => p.peso <= 0.25 + 1e-9),
      "nenhuma estrategia de ataque passa do teto de 25%",
    );
  }
}

console.log(falhas === 0 ? "\nVEREDITO: OK\n" : `\nVEREDITO: ${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);

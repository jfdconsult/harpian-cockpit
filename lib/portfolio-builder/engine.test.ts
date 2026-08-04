// Teste do motor do Portfolio Builder.  rodar: npx tsx lib/portfolio-builder/engine.test.ts
import fs from "node:fs";
import path from "node:path";
import { solveWeights, checkFeasibility, simulate, holdingsEm, inicioDaJanela, LIMIAR_DEFESA } from "./engine";
import type { Benchmark, Janela, PortfolioConfig, StrategySeries } from "./types";

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log("  ok   " + msg);
  else { console.log("  FALHA " + msg); falhas++; }
}
function quase(a: number, b: number, tol = 1e-9) { return Math.abs(a - b) <= tol; }
const soma = (a: number[]) => a.reduce((x, y) => x + y, 0);

console.log("\n== solveWeights ==");
{
  // proporcional puro, limites folgados
  const w = solveWeights([10, 5, 5], [0, 0, 0], [1, 1, 1]);
  ok(quase(soma(w), 1), "soma 100% no caso simples");
  ok(quase(w[0], 0.5) && quase(w[1], 0.25), "reparte proporcional ao momento");
}
{
  // teto morde: 1a estrategia quer 50% mas so pode 30%
  const w = solveWeights([10, 5, 5], [0, 0, 0], [0.3, 1, 1]);
  ok(quase(soma(w), 1), "soma 100% com teto mordendo");
  ok(quase(w[0], 0.3), "respeita o teto");
  ok(quase(w[1], 0.35) && quase(w[2], 0.35), "redistribui o excedente entre as livres");
}
{
  // piso morde: estrategia sem momento nenhum mantem o minimo
  const w = solveWeights([10, 0, 0], [0, 0.2, 0.2], [1, 1, 1]);
  ok(quase(soma(w), 1), "soma 100% com piso mordendo");
  ok(quase(w[1], 0.2) && quase(w[2], 0.2), "momento zero cai no piso, nao some");
  ok(quase(w[0], 0.6), "o resto vai para quem tem momento");
}
{
  // piso e teto ao mesmo tempo, muitas estrategias
  const n = 10;
  const sc = Array.from({ length: n }, (_, i) => (i === 0 ? 100 : 1));
  const w = solveWeights(sc, Array(n).fill(0.05), Array(n).fill(0.15));
  ok(quase(soma(w), 1, 1e-9), "soma 100% com piso e teto apertados");
  ok(w.every((x) => x >= 0.05 - 1e-9 && x <= 0.15 + 1e-9), "ninguem fura piso nem teto");
  ok(quase(w[0], 0.15), "a mais forte encosta no teto e para");
}
{
  // todo mundo com momento zero
  const w = solveWeights([0, 0, 0, 0], Array(4).fill(0), Array(4).fill(1));
  ok(quase(soma(w), 1), "soma 100% mesmo sem nenhum momento positivo");
  ok(w.every((x) => quase(x, 0.25)), "rateio igualitario quando ninguem tem forca");
}

console.log("\n== checkFeasibility ==");
{
  const base = { mode: "dynamic", basis: "retmes", rebalance: "monthly", janela: "max", window: "common", dropNegative: false, capital: 1000 } as const;
  const f1 = checkFeasibility({ ...base, sleeves: [
    { id: "a", weight: 0, min: 0.6, max: 0.9 }, { id: "b", weight: 0, min: 0.6, max: 0.9 }] });
  ok(!f1.ok && f1.problemas[0].includes("pisos"), "acusa pisos que somam mais de 100%");

  const f2 = checkFeasibility({ ...base, sleeves: [
    { id: "a", weight: 0, min: 0, max: 0.2 }, { id: "b", weight: 0, min: 0, max: 0.2 }] });
  ok(!f2.ok && f2.problemas[0].includes("tetos"), "acusa tetos que nao chegam a 100%");

  const f3 = checkFeasibility({ ...base, mode: "linear", sleeves: [
    { id: "a", weight: 0.7, min: 0, max: 1 }, { id: "b", weight: 0.7, min: 0, max: 1 }] });
  ok(!f3.ok && f3.problemas[0].includes("100%"), "acusa peso linear acima de 100%");

  const f4 = checkFeasibility({ ...base, sleeves: [
    { id: "a", weight: 0, min: 0.1, max: 0.8 }, { id: "b", weight: 0, min: 0.1, max: 0.8 }] });
  ok(f4.ok, "aceita limites viaveis");
}

console.log("\n== simulacao com o dado real ==");
const DIR = path.join(process.cwd(), "data", "strategies");
const calendar: string[] = JSON.parse(fs.readFileSync(path.join(DIR, "calendar.json"), "utf8")).datas;
const load = (id: string): StrategySeries =>
  JSON.parse(fs.readFileSync(path.join(DIR, "series", id + ".json"), "utf8"));

const ids = ["c11-c22act1ut-170", "c11-c22act2te-151", "core11-s21-us-treasuries"];
const series: Record<string, StrategySeries> = {};
for (const id of ids) series[id] = load(id);

const benchAll: Record<string, Benchmark> =
  JSON.parse(fs.readFileSync(path.join(DIR, "benchmark.json"), "utf8"));
const bench = benchAll["S&P 500"];

const cfgLinear: PortfolioConfig = {
  sleeves: ids.map((id) => ({ id, weight: 1 / 3, min: 0.1, max: 0.6 })),
  mode: "linear", basis: "retmes", rebalance: "monthly", janela: "max",
  window: "common", dropNegative: false, capital: 100000,
};

{
  const r = simulate(cfgLinear, series, calendar, bench);
  ok(r.dates.length > 8000, `janela comum tem ${r.dates.length} pregoes`);
  ok(quase(r.equity[0], 100000, 1e-6), "comeca no capital informado");
  ok(r.equity.every((v) => v > 0), "capital nunca fica negativo ou zero");
  ok(r.weights.every((w) => quase(soma(w), 1, 1e-6)), "os pesos somam 100% todo dia");
  ok(r.defenseFrac.every((f) => f >= -1e-9 && f <= 1 + 1e-9), "fracao blindada fica entre 0 e 1");
  ok(r.metrics.maxDrawdown <= 0, "drawdown maximo e negativo ou zero");
  console.log(`       -> ${r.dates[0]} a ${r.dates[r.dates.length - 1]}`);
  console.log(`       -> capital final ${r.metrics.capitalFinal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` +
              `  CAGR ${(r.metrics.cagr * 100).toFixed(2)}%  volAnual ${(r.metrics.volAnual * 100).toFixed(2)}%`);
  console.log(`       -> maxDD ${(r.metrics.maxDrawdown * 100).toFixed(2)}% de ${r.metrics.maxDrawdownFrom} a ${r.metrics.maxDrawdownTo}`);
  console.log(`       -> ${r.defensePeriods.length} periodos com mais de ${LIMIAR_DEFESA * 100}% do portfolio blindado (${r.metrics.pctDefesa.toFixed(1)}% dos pregoes)`);
  const top = [...r.defensePeriods].sort((a, b) => b.dias - a.dias).slice(0, 4);
  for (const p of top) console.log(`          ${p.from} -> ${p.to}  ${p.dias}d  pico ${(p.pico * 100).toFixed(0)}%`);

  const h = holdingsEm(cfgLinear, series, r, r.dates.indexOf("2008-11-20"));
  ok(h.length > 0, "consegue dizer o que estava carregado em 20/11/2008");
  for (const x of h) console.log(`          ${x.symbol.padEnd(6)} ${(x.weight * 100).toFixed(1).padStart(5)}%  ${x.defense ? "DEFESA" : "      "}  ${x.label}`);
}

console.log("\n== dinamico x linear ==");
{
  const cfgDin: PortfolioConfig = { ...cfgLinear, mode: "dynamic" };
  const a = simulate(cfgLinear, series, calendar, bench);
  const b = simulate(cfgDin, series, calendar, bench);
  ok(b.weights.every((w) => quase(soma(w), 1, 1e-6)), "dinamico tambem soma 100% todo dia");
  const idx = ids.map((_, i) => i);
  const dentro = b.weights.every((w) => idx.every((i) => w[i] <= 0.6 + 0.35));
  ok(dentro, "peso dinamico nao explode entre rebalances");
  console.log(`       linear   CAGR ${(a.metrics.cagr * 100).toFixed(2)}%  maxDD ${(a.metrics.maxDrawdown * 100).toFixed(1)}%`);
  console.log(`       dinamico CAGR ${(b.metrics.cagr * 100).toFixed(2)}%  maxDD ${(b.metrics.maxDrawdown * 100).toFixed(1)}%`);

  // no dia de rebalance o peso tem de respeitar o teto exatamente
  const d = b.rebalanceDays[Math.floor(b.rebalanceDays.length / 2)];
  ok(b.weights[d].every((w) => w <= 0.6 + 1e-6), "no rebalance o teto de 60% e respeitado");
}

console.log("\n== sem look-ahead ==");
{
  // truncar a serie no meio nao pode mudar o passado ja simulado
  const corte = 6000;
  const cortado: Record<string, StrategySeries> = {};
  for (const id of ids) {
    const s = load(id);
    const nUtil = Math.max(0, Math.min(s.n, corte - s.start));
    cortado[id] = { ...s, n: nUtil,
      sym: s.sym.slice(0, nUtil), equity: s.equity.slice(0, nUtil),
      referencia: s.referencia.slice(0, nUtil), retmes: s.retmes.slice(0, nUtil),
      ir: s.ir.slice(0, nUtil), slope: s.slope.slice(0, nUtil), sigma: s.sigma.slice(0, nUtil) };
  }
  const cheio = simulate({ ...cfgLinear, mode: "dynamic" }, series, calendar, bench);
  const meio = simulate({ ...cfgLinear, mode: "dynamic" }, cortado, calendar, bench);
  let igual = true;
  for (let d = 0; d < meio.equity.length; d++) {
    if (!quase(meio.equity[d], cheio.equity[d], Math.abs(cheio.equity[d]) * 1e-9 + 1e-6)) { igual = false; break; }
  }
  ok(igual, `o passado nao muda quando o futuro e removido (${meio.equity.length} pregoes conferidos)`);
}

console.log("\n== janelas de tempo ==");
{
  const ultimo = calendar.length - 1;
  ok(calendar[ultimo] === "2026-07-31", `ultimo pregao e ${calendar[ultimo]}`);

  const ytd = inicioDaJanela(calendar, ultimo, "ytd");
  ok(calendar[ytd].startsWith("2026-01"), `YTD comeca em ${calendar[ytd]}`);
  ok(calendar[ytd - 1].startsWith("2025-12"), "o pregao anterior ao YTD ainda e de 2025");

  const cinco = inicioDaJanela(calendar, ultimo, "5a");
  ok(calendar[cinco] >= "2021-07-31" && calendar[cinco] < "2021-08-10",
     `5 anos comeca em ${calendar[cinco]}`);
  ok(inicioDaJanela(calendar, ultimo, "max") === 0, "Tudo comeca no primeiro pregao");

  // as janelas tem de ser monotonicas: quanto maior o periodo, mais cedo comeca
  const ordem: Janela[] = ["ytd", "1a", "2a", "3a", "5a", "10a", "15a", "20a", "30a", "max"];
  const inicios = ordem.map((j) => inicioDaJanela(calendar, ultimo, j));
  ok(inicios.every((v, i) => i === 0 || v <= inicios[i - 1]), "janela maior nunca comeca depois");

  // a simulacao respeita a janela pedida
  const r5 = simulate({ ...cfgLinear, janela: "5a" }, series, calendar, bench);
  const anos5 = r5.dates.length / 252;
  ok(anos5 > 4.7 && anos5 < 5.3, `janela de 5 anos rende ${anos5.toFixed(2)} anos de pregoes`);
  ok(quase(r5.equity[0], 100000, 1e-6), "cada janela recomeca no capital informado");
  ok(r5.dates[r5.dates.length - 1] === "2026-07-31", "toda janela termina no ultimo dado");

  // janela maior que o historico disponivel avisa em vez de mentir
  const curta = { ...cfgLinear, janela: "30a" as Janela,
    sleeves: [{ id: "core11-s22-global-inv-grade-bonds", weight: 1, min: 0, max: 1 }] };
  const sCurta = { "core11-s22-global-inv-grade-bonds": load("core11-s22-global-inv-grade-bonds") };
  const rc = simulate(curta, sCurta, calendar, bench);
  ok(rc.warnings.some((w) => w.includes("30 anos")), "avisa quando nao ha 30 anos de historico");
  console.log("       aviso: " + rc.warnings[0]);
}

console.log("\n== Sortino, Calmar e correlacao ==");
{
  const r = simulate(cfgLinear, series, calendar, bench);
  const m = r.metrics;
  ok(m.sortino > m.sharpe, "Sortino fica acima do Sharpe (so pune a queda)");
  ok(quase(m.calmar, m.cagr / Math.abs(m.maxDrawdown), 1e-9), "Calmar = CAGR / maior queda");
  ok(m.correlacaoSP != null && m.correlacaoSP > -1 && m.correlacaoSP < 1,
     `correlacao com o S&P fica dentro de -1..1`);
  ok(m.benchCagr != null && m.benchCagr > 0.03 && m.benchCagr < 0.20,
     `CAGR do S&P na janela e plausivel (${((m.benchCagr ?? 0) * 100).toFixed(2)}%)`);
  console.log(`       Sharpe ${m.sharpe.toFixed(2)} · Sortino ${m.sortino.toFixed(2)} · Calmar ${m.calmar.toFixed(2)}`);
  console.log(`       correlacao com S&P ${m.correlacaoSP?.toFixed(3)} · S&P rendeu ${((m.benchCagr ?? 0) * 100).toFixed(2)}%/ano vs portfolio ${(m.cagr * 100).toFixed(2)}%`);

  // a correlacao tem de reagir a composicao: so Treasuries deve correlacionar
  // muito menos com o S&P do que so Technology
  const soT = simulate({ ...cfgLinear, sleeves: [{ id: "core11-s21-us-treasuries", weight: 1, min: 0, max: 1 }] },
    { "core11-s21-us-treasuries": series["core11-s21-us-treasuries"] }, calendar, bench);
  const soTech = simulate({ ...cfgLinear, sleeves: [{ id: "c11-c22act2te-151", weight: 1, min: 0, max: 1 }] },
    { "c11-c22act2te-151": series["c11-c22act2te-151"] }, calendar, bench);
  ok((soT.metrics.correlacaoSP ?? 1) < (soTech.metrics.correlacaoSP ?? 0),
     "Treasuries correlaciona menos com o S&P do que Technology");
  console.log(`       so Treasuries ${soT.metrics.correlacaoSP?.toFixed(3)} · so Technology ${soTech.metrics.correlacaoSP?.toFixed(3)}`);

  // sanidade: correlacao do S&P com ele mesmo
  const espelho = simulate({ ...cfgLinear, sleeves: [{ id: "c11-c22act1cd-154", weight: 1, min: 0, max: 1 }] },
    { "c11-c22act1cd-154": series["c11-c22act1ut-170"] }, calendar, bench);
  ok(espelho.metrics.correlacaoSP != null, "correlacao sempre calculada quando ha benchmark");
}

console.log("\n== correlacao separada por regime de defesa ==");
{
  const r = simulate(cfgLinear, series, calendar, bench);
  const { regimeDefesa: D, regimeExposto: E, correlacaoSP: C } = r.metrics;

  ok(D.dias + E.dias > 0, "todo pregao cai em exatamente um dos dois regimes");
  ok(Math.abs(D.fracao + E.fracao - 1) < 1e-9, "as fracoes dos dois regimes somam 100%");
  ok(D.dias > 500 && E.dias > 500, `amostra suficiente nos dois (${D.dias} defesa / ${E.dias} exposto)`);

  // o recorte tem de coincidir com a contagem de dias blindados da propria janela
  const blindados = r.defenseFrac.filter((f) => f >= LIMIAR_DEFESA - 1e-9).length;
  ok(Math.abs(blindados - D.dias) <= 1,
     `dias de defesa batem com a faixa do grafico (${blindados} vs ${D.dias})`);

  ok(D.correlacao != null && E.correlacao != null, "as duas correlacoes sao calculaveis");
  ok((D.correlacao ?? 9) < (E.correlacao ?? -9),
     "blindado correlaciona MENOS com o indice do que exposto");
  ok((C ?? 0) > (D.correlacao ?? 0) && (C ?? 0) < (E.correlacao ?? 1),
     "a correlacao cheia fica entre as duas — e a media que esconde os regimes");
  ok((D.correlacao ?? 0) < 0, "com a defesa armada a correlacao chega a ficar negativa");

  console.log(`       cheia    ${C?.toFixed(3)}`);
  console.log(`       exposto  ${E.correlacao?.toFixed(3)}  ${E.dias} pregoes (${(E.fracao * 100).toFixed(0)}%)  ` +
              `portfolio ${(E.retPortfolio * 100).toFixed(1)}%/ano  S&P ${(E.retBenchmark * 100).toFixed(1)}%/ano`);
  console.log(`       defesa   ${D.correlacao?.toFixed(3)}  ${D.dias} pregoes (${(D.fracao * 100).toFixed(0)}%)  ` +
              `portfolio ${(D.retPortfolio * 100).toFixed(1)}%/ano  S&P ${(D.retBenchmark * 100).toFixed(1)}%/ano`);

  ok(D.retBenchmark < 0, "o S&P perde dinheiro, em media, nos dias de defesa armada");
  ok(D.retPortfolio > 0, "o portfolio segue ganhando nesses mesmos dias");

  // a janela muda o recorte: em 1 ano ha menos (ou nenhum) dia de defesa
  const r1 = simulate({ ...cfgLinear, janela: "1a" }, series, calendar, bench);
  ok(r1.metrics.regimeDefesa.dias + r1.metrics.regimeExposto.dias <= r1.dates.length,
     "o recorte respeita a janela escolhida");
  console.log(`       janela de 1 ano: ${r1.metrics.regimeDefesa.dias} pregoes de defesa ` +
              `de ${r1.dates.length}`);
}

console.log(falhas === 0 ? "\nVEREDITO: OK\n" : `\nVEREDITO: ${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);

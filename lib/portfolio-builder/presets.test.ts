// Teste do caminho REAL da tela: o SET carregado como setup no builder tem que
// devolver, pelo motor do builder, os mesmos numeros das tabelas de validacao.
// rodar: npx tsx lib/portfolio-builder/presets.test.ts
//
// Isto e diferente de benchmark-sets.test.ts. La se testa a composicao isolada;
// aqui se testa o que o cliente ve: simulate() com os sleeves, os pesos, a
// janela travada e o overlay que o preset monta.
import fs from "node:fs";
import path from "node:path";
import { simulate } from "./engine";
import { SETS } from "./benchmark-sets";
import { configDoSet, seriesDosBlocos, presetsVitrine } from "./presets";
import type { BenchmarkSetsData } from "./benchmark-sets";
import type { Benchmark } from "./types";

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log("  ok   " + msg);
  else { console.log("  FALHA " + msg); falhas++; }
}
function publicado(valor: number, esperado: number, casas: number, msg: string) {
  const r = Number(valor.toFixed(casas));
  ok(r === esperado, `${msg}: ${r.toFixed(casas)} (spec ${esperado.toFixed(casas)})`);
}

const DIR = path.join(process.cwd(), "data", "strategies");
const data: BenchmarkSetsData = JSON.parse(
  fs.readFileSync(path.join(DIR, "benchmark-sets.json"), "utf8"));
const calendar: string[] = JSON.parse(
  fs.readFileSync(path.join(DIR, "calendar.json"), "utf8")).datas;
const bench: Benchmark = JSON.parse(
  fs.readFileSync(path.join(DIR, "benchmark.json"), "utf8"))["S&P 500"];

const series = seriesDosBlocos(data);

console.log("\n== os blocos como series do motor ==");
{
  const r = series["bloco-rotacao20"];
  ok(r.start === data.janela.fromIdx, "a serie do bloco comeca no primeiro dia da janela");
  ok(r.n === data.janela.n + 1, "tem um ponto a mais que os retornos (o dia base)");
  ok(r.equity[0] === 1000, "a curva do bloco comeca em 1000, como as do AlphaDroid");
  ok(calendar[r.start] === data.janela.de, `o dia base e ${data.janela.de}`);
  const ultimo = r.equity[r.n - 1] / r.equity[0];
  console.log(`       rotação: ${ultimo.toFixed(1)}× em ${(data.janela.n / 252).toFixed(1)} anos`);
}

// SET | Sharpe FULL | Sortino | Calmar | CAGR | vol | maxDD | corr S&P
const TABELA: Record<string, { sharpe: number; cagr: number; vol: number; maxDD: number; corr: number }> = {
  d3: { sharpe: 1.63, cagr: 0.343, vol: 0.192, maxDD: -0.234, corr: 0.42 },
  d5: { sharpe: 1.64, cagr: 0.275, vol: 0.156, maxDD: -0.188, corr: 0.42 },
  d6: { sharpe: 1.63, cagr: 0.205, vol: 0.119, maxDD: -0.139, corr: 0.42 },
};

console.log("\n== cada SET rodado pelo motor do builder ==");
for (const def of SETS) {
  const esp = TABELA[def.id];
  const cfg = configDoSet(def, data);
  const sim = simulate(cfg, series, calendar, bench);
  const m = sim.metrics;
  console.log(`\n  ${def.id.toUpperCase()} — ${def.nome}`);
  console.log(`       ${sim.dates[0]} → ${sim.dates[sim.dates.length - 1]} · ` +
              `${sim.dates.length} pregões · capital final ${(m.capitalFinal / 1e6).toFixed(2)}M`);
  ok(sim.dates[0] === data.janela.de, "a janela travada comeca onde o SET foi validado");
  ok(sim.dates[sim.dates.length - 1] === data.janela.ate, "e termina onde o SET foi validado");
  publicado(m.sharpe, esp.sharpe, 2, "Sharpe");
  publicado(m.cagr, esp.cagr, 3, "CAGR");
  publicado(m.volAnual, esp.vol, 3, "vol");
  publicado(m.maxDrawdown, esp.maxDD, 3, "maxDD");
  publicado(m.correlacaoSP ?? NaN, esp.corr, 2, "corr S&P");
  publicado(m.sortino, ({ d3: 2.42, d5: 2.44, d6: 2.43 } as Record<string, number>)[def.id], 2, "Sortino");
  publicado(m.calmar, ({ d3: 1.47, d5: 1.46, d6: 1.48 } as Record<string, number>)[def.id], 2, "Calmar");
}

console.log("\n== modo dinâmico com peso de bloco travado ==");
{
  // Um SET carrega em modo DINAMICO, porque e isso que ele e — e a tela precisa
  // acender "Alocacao dinamica" quando o cliente clica num SET. Mas o peso ENTRE
  // OS BLOCOS e fixo, e no modo dinamico o motor distribui por score. Como os
  // blocos nao tem score, sem `min = max = peso` o water-filling racharia tudo
  // em partes iguais e o D3 viraria 50/50 em vez de 60/40.
  //
  // Este bloco existe para quebrar se alguem "simplificar" isso um dia.
  for (const def of SETS) {
    const cfg = configDoSet(def, data);
    ok(cfg.mode === "dynamic", `${def.id}: carrega em modo dinâmico`);
    const travados = cfg.sleeves.every((s, i) =>
      Math.abs(s.min - def.composicao[i].peso) < 1e-12 &&
      Math.abs(s.max - def.composicao[i].peso) < 1e-12);
    ok(travados, `${def.id}: piso e teto colados no peso de cada bloco`);

    // Nao existe dia em que o peso seja EXATAMENTE o alvo: o rebalance acontece
    // no fechamento de t e o peso de t+1 ja carrega um dia de deriva. Entao o
    // que se checa e que a trava segura — o desvio fica na ordem da deriva de um
    // dia (~0,5 pp) e nao na ordem do rateio igual, que para o D3 daria 10 pp.
    const sim = simulate(cfg, series, calendar, bench);
    const k = cfg.sleeves.length;
    const igual = 1 / k;
    const piorRateio = Math.max(...def.composicao.map((c) => Math.abs(igual - c.peso)));
    let pior = 0;
    for (const d of sim.rebalanceDays.slice(1)) {
      if (d + 1 >= sim.weights.length) continue;
      for (let i = 0; i < k; i++) {
        pior = Math.max(pior, Math.abs(sim.weights[d + 1][i] - def.composicao[i].peso));
      }
    }
    const alvo = def.composicao.map((c) => (c.peso * 100).toFixed(0) + "%").join("/");
    // 5 pp de folga absoluta cobre a deriva de um dia ruim. O segundo teste —
    // ficar longe do que um rateio igual produziria — so faz sentido quando o
    // alvo NAO e o proprio rateio igual: no D3 (50/50 entre dois blocos) o alvo
    // E o rateio igual, entao `piorRateio` da zero e a comparacao nao diz nada.
    const vale = piorRateio > 1e-9;
    ok(pior < 0.05 && (!vale || pior < piorRateio / 3),
       `${def.id}: os blocos seguram ${alvo} — desvio máximo ${(pior * 100).toFixed(2)} pp ` +
       `(rateio igual daria ${(piorRateio * 100).toFixed(0)} pp)`);
  }
}

console.log("\n== o overlay dentro do motor ==");
{
  const comOverlay = simulate(configDoSet(SETS.find((s) => s.id === "d6")!, data), series, calendar, bench);
  const sem = simulate(configDoSet(SETS.find((s) => s.id === "d5")!, data), series, calendar, bench);
  ok(comOverlay.exposicao !== null, "o SET com vol-target devolve a serie de exposicao");
  ok(sem.exposicao === null, "o SET sem vol-target nao devolve exposicao");
  const e = comOverlay.exposicao!;
  ok(e.every((v) => v <= 1 + 1e-12), "a exposicao nunca passa de 100% — nao alavanca");
  const media = e.reduce((a, b) => a + b, 0) / e.length;
  console.log(`       exposicao media ${(media * 100).toFixed(1)}% · minima ${(Math.min(...e) * 100).toFixed(1)}%`);
  ok(media < 1, "o overlay desliga risco em parte do tempo");
  ok(comOverlay.metrics.volAnual < sem.metrics.volAnual, "com overlay a volatilidade cai");
  ok(comOverlay.metrics.maxDrawdown > sem.metrics.maxDrawdown, "com overlay a maior queda encolhe");
}

console.log("\n== os botoes da vitrine ==");
{
  const p = presetsVitrine();
  ok(p.length === 3, "sao tres botoes na barra do topo");
  ok(p.map((x) => x.id).join(",") === "d3,d5,d6", "e sao D3 / D5 / D6");
  ok(p.map((x) => x.rotulo).join(" · ") === "Dinâmico Agressivo · Dinâmico Balanceado · Dinâmico Conservador",
     "com o texto que o Joao pediu: " + p.map((x) => x.rotulo).join(" · "));
}

console.log("\n== sem look-ahead, tambem pelo motor ==");
{
  // Truncar o calendario nao pode mudar o passado simulado.
  const def = SETS.find((s) => s.id === "d6")!;
  const cfg = configDoSet(def, data);
  const cheio = simulate(cfg, series, calendar, bench);
  const corte = 2000;
  const cfgCurto = { ...cfg, periodoFixo: { de: data.janela.de, ate: data.datas[corte] } };
  const curto = simulate(cfgCurto, series, calendar, bench);
  let dif = 0;
  for (let i = 0; i < curto.equity.length; i++) {
    dif = Math.max(dif, Math.abs(curto.equity[i] - cheio.equity[i]) / cheio.equity[i]);
  }
  ok(dif < 1e-12, `cortar a serie em ${data.datas[corte]} nao muda o passado (dif ${dif.toExponential(1)})`);
}

console.log(falhas === 0 ? "\nVEREDITO: OK\n" : `\nVEREDITO: ${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);

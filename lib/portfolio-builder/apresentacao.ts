// ============================================================
// MODO APRESENTACAO — a alocacao das 41, dia a dia
// ------------------------------------------------------------
// A tela de apresentacao mostra uma barra por estrategia crescendo e encolhendo
// enquanto o tempo anda. Para isso precisa do peso de CADA estrategia em CADA
// dia — e num SET isso nao esta nos sleeves: o portfolio tem 2 ou 3 blocos, e as
// 41 vivem dentro do bloco de rotacao.
//
// Este arquivo desmonta essa boneca russa:
//     peso da estrategia i no dia d
//         = peso do BLOCO no portfolio naquele dia   (vem do motor, com deriva)
//         × peso da estrategia DENTRO do bloco       (vem do export, com deriva)
//
// Num portfolio montado a mao nao ha bloco nenhum e cada sleeve ja e uma linha.
// Os dois casos saem daqui com o mesmo formato, entao a tela nao precisa saber
// de qual veio.
// ============================================================
import type { BenchmarkSetsData } from "./benchmark-sets";
import { NOMES_BLOCO } from "./benchmark-sets";
import { classificar } from "./defesa";
import { blocoDoId, ehBloco } from "./presets";
import type { PortfolioConfig, SimResult, StrategyMeta } from "./types";

export interface LinhaAlocacao {
  id: string;
  label: string;
  /** rotulo curto para caber na coluna estreita */
  curto: string;
  /** peso 0..1 por dia da simulacao */
  pesos: Float32Array;
  /** true quando a linha e um bloco inteiro (HC-US IG, renda fixa) */
  bloco: boolean;
  /** ataque em ações, ataque em ETF, ou preservacao de capital */
  secao: "acoes" | "etf" | "defesa";
  /** maior peso que a linha atingiu na janela — serve de escala da barra */
  pico: number;
  /** em quantos dias a linha teve peso */
  diasDentro: number;
}

/** Encurta so o que nao cabe, sem virar sigla. */
const ABREVIA: [RegExp, string][] = [
  [/^Consumer Discretionary$/, "Cons. Discretionary"],
  [/^Consumer Staples$/, "Cons. Staples"],
];

/**
 * O nome que vai na coluna da apresentacao.
 *
 * `C11 - C22ACT1CO 152` nao diz nada para quem esta assistindo — e "CO 1" diz
 * menos ainda. O catalogo ja carrega o setor em `sub` e a variante em
 * `variante`, entao a linha vira **Communications 1**. Nos ETFs o nome util e a
 * parte descritiva do label, depois do hifen: `CORE11 S21 - US Treasuries` vira
 * **US Treasuries**.
 */
export function nomeDeApresentacao(label: string, meta?: StrategyMeta): string {
  if (meta?.grupo === "acoes" && meta.sub) {
    let s = meta.sub;
    for (const [re, curto] of ABREVIA) if (re.test(s)) s = curto;
    return meta.variante ? `${s} ${meta.variante}` : s;
  }
  // ETF/macro: fica com a parte que descreve, sem o codigo interno
  const limpo = label.replace(/^!?(XX )?/, "").replace(/^!/, "");
  const i = limpo.indexOf(" - ");
  return i > 0 ? limpo.slice(i + 3) : limpo;
}

/**
 * Cor da barra em funcao de quanto ela esta cheia.
 *
 * A barra nao muda so de tamanho, muda de temperatura: comeca amarelo palido,
 * esquenta para o dourado da casa, vira verde-oliva e termina num verde-azulado
 * forte quando a estrategia esta pesada no portfolio. Assim a coluna inteira se
 * le de relance — o olho acha o que esta grande pela COR, sem precisar comparar
 * 41 comprimentos.
 */
/**
 * As paradas sao apertadas de proposito na metade de baixo. Nenhuma estrategia
 * fica sozinha com o portfolio inteiro — na pratica a barra passa a maior parte
 * do tempo entre 25% e 60% de preenchimento. Com a rampa espalhada ate 1,0 a
 * coluna ficava amarela quase sempre e a cor nao dizia nada. Aqui o verde ja
 * comeca a aparecer aos 40% e o topo e um verde escuro, para o pico ter peso
 * visual de verdade.
 */
const RAMPA: [number, [number, number, number]][] = [
  [0.00, [242, 231, 168]],   // amarelo bem claro
  [0.14, [232, 194,  74]],   // amarelo
  [0.28, [201, 160,  44]],   // dourado Harpian
  [0.42, [157, 174,  60]],   // amarelo-esverdeado
  [0.58, [ 86, 168, 107]],   // verde
  [0.78, [ 26, 130, 100]],   // verde-azulado
  [1.00, [ 10,  92,  70]],   // verde escuro — concentracao maxima
];

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** `[cor do inicio da barra, cor do fim]` — o degrade dentro da propria barra. */
export function corDaBarra(f: number): [string, string] {
  const x = Math.max(0, Math.min(1, f));
  let i = 0;
  while (i < RAMPA.length - 2 && x > RAMPA[i + 1][0]) i++;
  const [x0, c0] = RAMPA[i];
  const [x1, c1] = RAMPA[i + 1];
  const t = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
  const r = lerp(c0[0], c1[0], t), g = lerp(c0[1], c1[1], t), b = lerp(c0[2], c1[2], t);
  // o inicio da barra fica um degrau mais claro que o fim: da profundidade sem
  // inventar uma segunda cor
  const clarear = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.28));
  return [`rgb(${clarear(r)},${clarear(g)},${clarear(b)})`, `rgb(${r},${g},${b})`];
}

/**
 * Uma linha por estrategia do universo (sempre as 41, mesmo as que estao em
 * zero — a coluna cheia e o que faz a leitura visual funcionar), mais uma linha
 * por bloco que nao se desmonta.
 */
export function linhasDeAlocacao(
  cfg: PortfolioConfig,
  sim: SimResult,
  meta: Record<string, StrategyMeta>,
  setsData: BenchmarkSetsData | null,
): LinhaAlocacao[] {
  const nDias = sim.dates.length;
  const sleeves = cfg.sleeves;

  // acumulador por id de estrategia
  const acc = new Map<string, Float32Array>();

  const garante = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = new Float32Array(nDias); acc.set(id, a); }
    return a;
  };

  // O universo inteiro entra, mesmo quem nunca recebe peso.
  if (setsData) for (const id of setsData.idsUniverso) garante(id);

  sleeves.forEach((s, i) => {
    const pesoDia = (d: number) => sim.weights[d]?.[i] ?? 0;

    if (ehBloco(s.id)) {
      const b = blocoDoId(s.id);
      const matriz = setsData?.pesosDiarios?.[b as "rotacao20" | "corrmin20" | "maxcagr10" | "suavemin15"];
      if (matriz && setsData) {
        // bloco que se desmonta: distribui o peso do bloco entre as 41
        const base = setsData.janela.fromIdx;
        setsData.idsUniverso.forEach((sid, k) => {
          const linha = matriz[k];
          if (!linha) return;
          const a = garante(sid);
          for (let d = 0; d < nDias; d++) {
            const idx = sim.from + d - base;
            const dentro = linha[idx];
            if (dentro) a[d] += pesoDia(d) * (dentro / 1000);
          }
        });
      }
      // Bloco que NAO se desmonta (HC-US IG, renda fixa) nao vira linha: ele
      // fica praticamente cravado no peso alvo o tempo todo, e uma barra que
      // nunca se mexe nao informa nada — so rouba atencao das 41 que respiram.
      // O peso dele aparece na descricao do SET, no builder.
    } else {
      const a = garante(s.id);
      for (let d = 0; d < nDias; d++) a[d] = pesoDia(d);
    }
  });

  const linhas: LinhaAlocacao[] = [];
  for (const [id, pesos] of acc) {
    let pico = 0;
    let diasDentro = 0;
    for (let d = 0; d < nDias; d++) {
      if (pesos[d] > pico) pico = pesos[d];
      if (pesos[d] > 5e-5) diasDentro++;
    }
    const ehB = ehBloco(id);
    const label = ehB ? NOMES_BLOCO[blocoDoId(id)] : meta[id]?.label ?? id;
    const curto = ehB ? label : nomeDeApresentacao(label, meta[id]);
    const m = meta[id];
    const secao: LinhaAlocacao["secao"] =
      classificar(m).defesa ? "defesa" : m?.grupo === "acoes" ? "acoes" : "etf";
    linhas.push({ id, label, curto, pesos, bloco: ehB, secao, pico, diasDentro });
  }

  // Ataque em cima, defesa embaixo — a coluna conta a mesma historia da
  // apresentacao: primeiro as ações, depois os ETF/macro, e no rodape o que
  // preserva capital. Dentro de cada faixa, a ordem do catalogo.
  const ORDEM: Record<LinhaAlocacao["secao"], number> = { acoes: 0, etf: 1, defesa: 2 };
  const posicao = new Map<string, number>();
  setsData?.idsUniverso.forEach((id, i) => posicao.set(id, i));
  linhas.sort((a, b) => {
    if (a.secao !== b.secao) return ORDEM[a.secao] - ORDEM[b.secao];
    const pa = posicao.get(a.id), pb = posicao.get(b.id);
    if (pa != null && pb != null) return pa - pb;
    if (pa != null) return -1;
    if (pb != null) return 1;
    return a.label.localeCompare(b.label, "pt");
  });
  return linhas;
}

export const ROTULO_SECAO: Record<LinhaAlocacao["secao"], string> = {
  acoes: "Ações setoriais",
  etf: "ETF / Macro",
  defesa: "Defesa",
};

/**
 * Escala das barras. Nao e o pico global: uma unica estrategia que chegou a 12%
 * achataria as outras 40 o tempo todo. E o pico TIPICO — o percentil 95 dos
 * picos de cada linha — com um piso, para a barra ter amplitude util.
 */
export function escalaDaBarra(linhas: LinhaAlocacao[]): number {
  const picos = linhas.filter((l) => !l.bloco && l.pico > 0).map((l) => l.pico).sort((a, b) => a - b);
  if (!picos.length) return 0.1;
  const p95 = picos[Math.min(picos.length - 1, Math.floor(picos.length * 0.95))];
  return Math.max(0.02, p95);
}

/** Quantos pregoes por segundo, por velocidade escolhida. */
export const VELOCIDADES = [
  { id: "lenta", label: "0,5×", pregoesPorSegundo: 120 },
  { id: "normal", label: "1×", pregoesPorSegundo: 250 },
  { id: "rapida", label: "2×", pregoesPorSegundo: 500 },
  { id: "turbo", label: "4×", pregoesPorSegundo: 1000 },
] as const;

export type VelocidadeId = (typeof VELOCIDADES)[number]["id"];

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { SETS, avaliarSet, type BenchmarkSetsData } from "@/lib/portfolio-builder/benchmark-sets";
import { probabilidadeDentroTolerancia, probabilidadeDeMeta } from "@/lib/portfolio-builder/probabilistic-engine";

export const runtime = "nodejs";

const ARQ = path.join(process.cwd(), "data", "strategies", "benchmark-sets.json");

/** Sem horizonte do cliente (relatorio manual, sem Ato II), cai numa regua
 * generica de referencia — nao faz sentido perguntar "e em 30 anos?" pra um
 * cliente sem meta definida, mas ainda assim precisa mostrar algo. */
const HORIZONTES_FALLBACK = [5, 10, 15, 20, 30];

/**
 * Horizontes a testar SEMPRE centrados no horizonte real do cliente — nao um
 * range generico. Pedir "e em 20 anos?" pra quem pediu 5 anos e ruido: o
 * cliente quer ver o proprio numero cercado (2 pontos pra tras, 2 pra
 * frente), pra entender a sensibilidade da probabilidade perto do horizonte
 * QUE ELE escolheu.
 *
 * O passo entre os pontos escala com o horizonte: em 5 ou 10 anos (o caso
 * mais comum) o passo e 1 ano — sensibilidade fina onde mais importa. Em
 * horizontes longos (20, 30 anos) um passo de 1 ano so adiciona ruido —
 * a diferenca de probabilidade entre 20 e 21 anos e minima comparada a
 * entre 20 e 23. O passo cresce com o proprio horizonte pra manter a mesma
 * amplitude RELATIVA em vez de absoluta.
 */
function horizontesCentrados(horizonteAnos: number, pontos = 2): number[] {
  const base = Math.round(horizonteAnos);
  const passo = Math.max(1, Math.round(base / 8));
  const out = new Set<number>();
  for (let d = -pontos; d <= pontos; d++) {
    const h = base + d * passo;
    if (h >= 1) out.add(h);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * POST /api/probabilidade
 * body: { setId: string, capital: number, aporteAnual?: number, meta?: number,
 *         clienteRN?: number, horizonteAnos?: number }
 *
 * Roda inteiramente server-side a partir do id do SET — quem chama (terminal
 * ou apresentação) não precisa ter a série nem recompor o portfólio.
 */
export async function POST(req: Request) {
  let body: {
    setId?: string;
    capital?: number;
    aporteAnual?: number;
    meta?: number;
    clienteRN?: number;
    horizonteAnos?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido — esperado JSON." }, { status: 400 });
  }

  const { setId, capital, aporteAnual = 0, meta, clienteRN, horizonteAnos } = body;
  if (!setId || typeof capital !== "number" || capital <= 0) {
    return NextResponse.json({ ok: false, error: "setId e capital (>0) são obrigatórios." }, { status: 400 });
  }

  const def = SETS.find((s) => s.id === setId);
  if (!def) {
    return NextResponse.json({ ok: false, error: `SET desconhecido: ${setId}` }, { status: 404 });
  }

  let data: BenchmarkSetsData;
  try {
    const raw = await fs.readFile(ARQ, "utf8");
    data = JSON.parse(raw) as BenchmarkSetsData;
  } catch {
    return NextResponse.json({ ok: false, error: "benchmark-sets.json não encontrado." }, { status: 404 });
  }

  let resultado;
  try {
    resultado = avaliarSet(def, data, capital);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }

  const horizontes = horizonteAnos && horizonteAnos > 0
    ? horizontesCentrados(horizonteAnos)
    : HORIZONTES_FALLBACK;

  const metaResult = meta && meta > 0
    ? probabilidadeDeMeta(resultado.retornos, {
        capitalInicial: capital,
        aporteAnual,
        meta,
        horizontesAnos: horizontes,
      })
    : null;

  const toleranciaResult = clienteRN
    ? probabilidadeDentroTolerancia(resultado.retornos, clienteRN)
    : null;

  return NextResponse.json({
    ok: true,
    setId,
    setNome: def.nome,
    capital,
    portfolioCagr: resultado.full.cagr,
    portfolioVol: resultado.full.vol,
    tolerancia: toleranciaResult,
    meta: metaResult,
    horizonteClienteAnos: horizonteAnos ?? null,
  });
}

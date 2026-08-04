import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Os 3 SETs demonstrativos do Portfolio Builder (benchmarks pre-montados).
//
// O arquivo traz os STREAMS dos blocos — corr-min 20 walk-forward, overnight e
// Agg.Bond — mais a regua EW-41. A composicao (mistura mensal e overlay de
// vol-target) NAO vem pronta: ela e feita no app, em
// lib/portfolio-builder/benchmark-sets.ts, e validada contra a §3 da spec em
// benchmark-sets.test.ts. O que a tela mostra e calculado pelo codigo da tela.
//
// Gerado por _pipeline\export_3sets.py na pasta da apresentacao.
const ARQ = path.join(process.cwd(), "data", "strategies", "benchmark-sets.json");

export async function GET() {
  try {
    const raw = await fs.readFile(ARQ, "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json",
        // mesma razao do catalogo: o conteudo muda quando o dataset e
        // reexportado, entao cache longo faria a tela mostrar numero velho
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "benchmark-sets.json não encontrado em data/strategies. " +
          "Rode _pipeline\\export_3sets.py na pasta da apresentação.",
      },
      { status: 404 },
    );
  }
}

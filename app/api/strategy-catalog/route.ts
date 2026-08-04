import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Catalogo das estrategias do AlphaDroid com o calendario mestre.
// Gerado por _pipeline\export_dataset.py na pasta da apresentacao; o momento
// diario vem do motor do Diogo, nao e recalculado aqui.
const DIR = path.join(process.cwd(), "data", "strategies");

export async function GET() {
  try {
    const [cat, cal, bench] = await Promise.all([
      fs.readFile(path.join(DIR, "strategies.json"), "utf8"),
      fs.readFile(path.join(DIR, "calendar.json"), "utf8"),
      fs.readFile(path.join(DIR, "benchmark.json"), "utf8"),
    ]);
    const res = NextResponse.json({
      ok: true,
      catalog: JSON.parse(cat),
      calendar: JSON.parse(cal).datas as string[],
      benchmark: JSON.parse(bench),
    });
    // no-cache, nao no-store: o navegador ainda revalida com ETag e economiza
    // banda, mas nunca serve uma versao velha. O dataset e reexportado toda vez
    // que uma estrategia nova entra, e cache longo aqui faz o painel mentir a
    // contagem por uma hora depois da atualizacao.
    res.headers.set("Cache-Control", "no-cache");
    return res;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dataset das estratégias não encontrado em data/strategies." },
      { status: 404 },
    );
  }
}

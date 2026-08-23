import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Os tres niveis fundamentalistas: setor, subsetor e empresa.
//
// Gerado por harpian-fundamentals\pipeline\export_cockpit.py a partir da base
// point-in-time da SEC (XBRL). Mesmo contrato de benchmark-sets.json: um script
// Python escreve o arquivo, esta rota so entrega.
//
// A razao de nao ler o DuckDB daqui e que o pipeline REESCREVE o banco inteiro a
// cada reconstrucao — a tela leria meio estado no meio de um L2. O JSON troca de
// forma atomica e o que esta em tela e sempre um snapshot coerente.
const ARQ = path.join(process.cwd(), "data", "fundamentos", "fundamentos.json");

export async function GET() {
  try {
    const raw = await fs.readFile(ARQ, "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json",
        // o conteudo muda a cada reexportacao; cache longo mostraria numero velho
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json(
      {
        erro: "base fundamentalista nao exportada",
        como: "rode: python harpian-fundamentals\\pipeline\\export_cockpit.py",
        arquivo: ARQ,
      },
      { status: 503 },
    );
  }
}

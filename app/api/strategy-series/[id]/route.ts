import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "data", "strategies", "series");

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  // o id vem da URL: so aceita o formato de slug que o exportador gera
  if (!/^[a-z0-9-]{1,80}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }
  try {
    const raw = await fs.readFile(path.join(DIR, id + ".json"), "utf8");
    const res = new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json",
        // mesma razao do catalogo: o conteudo de um id muda quando o dataset e
        // reexportado, entao "immutable" serviria serie velha para id igual
        "Cache-Control": "no-cache",
      },
    });
    return res;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Série não encontrada: " + id },
      { status: 404 },
    );
  }
}

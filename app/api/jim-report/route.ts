import { NextResponse } from "next/server";

/**
 * JIM AI — análise em tempo real do portfólio pra imprimir no relatório.
 *
 * Recebe métricas + composição + parâmetros. Chama Claude Haiku direto na API
 * da Anthropic (sem SDK — fetch cru) e devolve 3-4 parágrafos analisando:
 *   - o que funcionou
 *   - o que foi bem / mal
 *   - o que mudaria
 *   - o que dá pra melhorar
 *
 * Custo por chamada ~$0.01. Timeout de 30s.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KPI { k: string; v: string; tom?: "pos" | "neg" }
interface ReqBody {
  cliente?: string;
  autor?: string;
  setNome?: string | null;
  setTese?: string | null;
  mode: "linear" | "dynamic";
  rebalance: string;
  capital: number;
  janela: string;
  kpis: KPI[];
  composicao: { id: string; nome: string; peso: number }[];
}

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 900;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 503 });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const kpisTxt = body.kpis.map((k) => `- ${k.k}: ${k.v}`).join("\n");
  const compTxt = body.composicao
    .map((c) => `- ${c.nome} · ${(c.peso * 100).toFixed(0)}%`)
    .join("\n");

  const system = `Você é o JIM AI, analista quantitativo da Harpian que revisa portfolios em tempo real. Escreva em português brasileiro, tom institucional e direto, sem pieguice. 3 a 4 parágrafos curtos (2-4 frases cada). Não use bullets nem títulos — só prosa. Cite números específicos do relatório. Termine dizendo o que ajustaria ou monitoraria daqui pra frente.`;

  const user = `Analise este portfólio construído no Manager Cockpit.

CLIENTE: ${body.cliente || "não informado"}
AUTOR DO PORTFÓLIO: ${body.autor || "não informado"}
CAPITAL INICIAL: ${body.capital.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
JANELA: ${body.janela}
MODO DE ALOCAÇÃO: ${body.mode === "linear" ? "linear (peso fixo o tempo todo)" : "dinâmica (peso segue a força do momento)"}
REBALANCE: ${body.rebalance}
${body.setNome ? `SET BASE: ${body.setNome}${body.setTese ? ` — ${body.setTese}` : ""}` : "SEM SET base — portfólio custom"}

MÉTRICAS FINAIS:
${kpisTxt}

COMPOSIÇÃO (${body.composicao.length} estratégias):
${compTxt}

Sua análise deve responder, em 3 a 4 parágrafos:
1) O que este portfólio entregou (retorno, risco, correlação com S&P) e como isso se lê institucionalmente.
2) O que funcionou bem — quais decisões de composição ou alocação sustentaram o resultado.
3) Onde estão as fraquezas ou trade-offs — drawdown máximo, concentração, vulnerabilidade a regime.
4) O que você ajustaria ou monitoraria daqui pra frente — recomendação clara pro cliente.`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 30000);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `Anthropic ${r.status}: ${t.slice(0, 200)}` }, { status: 502 });
    }
    const d = await r.json();
    const analise = d?.content?.[0]?.text?.trim();
    if (!analise) return NextResponse.json({ error: "Resposta vazia do Claude" }, { status: 502 });
    return NextResponse.json({ analise });
  } catch (e) {
    clearTimeout(to);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

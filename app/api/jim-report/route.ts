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
  /** Anos reais da janela simulada — evita JIM chutar "10 anos" quando na verdade sao 15. */
  anos?: number;
  /** Overlay de vol-target ativo no SET (ex. 0.035 = 3.5% aa). */
  volTargetAlvo?: number | null;
  /** Exposicao media do overlay ao motor (ex. 0.225 = 22.5%). Complemento vai pra caixa. */
  expoMedia?: number | null;
  /** Convencao de remuneracao do caixa no backtest ('rf=0' = nao remunerado). */
  caixaConvencao?: string;
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

  // O prompt e ENDURECIDO contra fabricacao. Motivo: revisao de 04/08/2026 pegou
  // o JIM inventando comparacoes ("100% DMAX = 12%aa/vol 8%" — real: 67% CAGR/35% vol),
  // errando janela ("10 anos" quando eram 15), e sugerindo monitores vazios. Regras
  // abaixo cortam esses vetores.
  const system = `Você é o JIM AI, analista quantitativo da Harpian que revisa portfolios em tempo real. Escreva em português brasileiro, tom institucional e direto, sem pieguice. 3 a 4 parágrafos curtos (2-4 frases cada). Não use bullets nem títulos — só prosa. Termine dizendo o que ajustaria ou monitoraria daqui pra frente.

REGRAS DE INTEGRIDADE (não quebrar em hipótese nenhuma):
1. USE SÓ NÚMEROS DO RELATÓRIO. Nunca invente comparações "num cenário X seria Y" nem cite CAGR/vol/Sharpe de estratégias fora da carteira (ex. "DMAX puro faria 12%aa" — não faz, e você não sabe). Se quiser comparar, use apenas o S&P que já está nas métricas.
2. RESPEITE A JANELA. O campo "JANELA" traz o intervalo real; se estiver escrito 15 anos, é 15 anos — não converta pra 10.
3. NÃO CONFUNDA CADÊNCIA. O motor rebalanceia mensal, mas se houver overlay de vol-target ele decide semanalmente — é o overlay que fabrica a suavidade, não o rebalance.
4. CAIXA NÃO É INIMIGO. Se o backtest usa "rf=0" (informado abaixo), a diferença de retorno em regimes de juro alto vem da CONVENÇÃO, não do mercado. Não diga "renda fixa baixa custou" quando a taxa foi alta.
5. MONITORES CONCRETOS. "Monitorar vol acima de 6%" só faz sentido se a série líquida costuma ficar abaixo disso. Aponte gatilhos numéricos que EXISTEM no relatório — corr com S&P em stress, exposição do overlay, drawdown vs banda esperada.
6. SEM SELO. Não use as palavras "validado", "aprovado" ou "seguro". A carteira é candidata; a validação é institucional (Arena / custos) e não passa por texto do modelo.`;

  const anosStr = body.anos ? `${body.anos.toFixed(1)} anos` : body.janela;
  const overlay = body.volTargetAlvo != null
    ? `Overlay de vol-target: ${(body.volTargetAlvo * 100).toFixed(1)}% ao ano (decisão SEMANAL).` +
      (body.expoMedia != null
        ? ` Exposição média do overlay ao motor: ${(body.expoMedia * 100).toFixed(1)}%.` +
          ` Caixa médio: ${((1 - body.expoMedia) * 100).toFixed(1)}%.`
        : "")
    : "SEM overlay de vol-target — exposição total ao motor o tempo todo.";
  const caixa = body.caixaConvencao || "rf=0 (caixa não remunerado no backtest)";

  const user = `Analise este portfólio construído no Manager Cockpit.

CLIENTE: ${body.cliente || "não informado"}
AUTOR DO PORTFÓLIO: ${body.autor || "não informado"}
CAPITAL INICIAL: ${body.capital.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
JANELA: ${body.janela}${body.anos ? ` (${anosStr} corridos)` : ""}
MODO DE ALOCAÇÃO: ${body.mode === "linear" ? "linear (peso fixo o tempo todo)" : "dinâmica (peso segue a força do momento)"}
REBALANCE DO MOTOR: ${body.rebalance}
${overlay}
CONVENÇÃO DE CAIXA: ${caixa}
${body.setNome ? `SET BASE: ${body.setNome}${body.setTese ? ` — ${body.setTese}` : ""}` : "SEM SET base — portfólio custom"}

MÉTRICAS FINAIS (use APENAS estes números — não invente outros):
${kpisTxt}

COMPOSIÇÃO (${body.composicao.length} sleeves):
${compTxt}

Sua análise deve responder, em 3 a 4 parágrafos:
1) O que este portfólio entregou (retorno, risco, correlação com S&P do relatório) e como isso se lê institucionalmente.
2) O que funcionou bem — quais decisões de composição, overlay ou alocação sustentaram o resultado (referencie os fatos acima, não invente cenários alternativos).
3) Onde estão as fraquezas ou trade-offs — drawdown máximo, concentração, sensibilidade à convenção de caixa se aplicável.
4) O que você ajustaria ou monitoraria daqui pra frente — recomendação clara e MENSURÁVEL (gatilho numérico + métrica do próprio relatório).`;

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

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * JIM AI — analise em tempo real do portfolio para imprimir no relatorio.
 *
 * Recebe: metricas + composicao + parametros da tela.
 * Chama Claude Haiku (fetch cru na Anthropic API).
 * Devolve: 3-4 paragrafos analisando entrega, mecanica, trade-offs, monitores.
 *
 * ANCORAGEM POR FATOS (correcao de 04/08/2026):
 * Se o SET analisado tem um `fatos_<setId>.json` em data/strategies/facts/,
 * carregamos e injetamos no prompt como "FATOS VERIFICADOS" — a unica fonte
 * de numeros que o JIM pode citar. Se existe um few-shot em
 * data/strategies/facts/few-shot/<setId>.md, injetamos como exemplo do TOM/
 * ESTRUTURA (nao pra copiar, so pra ancorar). Sem fatos, o JIM roda no modo
 * generico anterior (menos rigoroso, para SETs sem catalogo formal).
 *
 * Doc completa: SUAVE_HANDOFF/CORRECAO_JIM_HANDOFF.md
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KPI { k: string; v: string; tom?: "pos" | "neg" }
interface ReqBody {
  cliente?: string;
  autor?: string;
  setId?: string | null;       // NOVO: id do SET (ex.: 'dsuave', 'd6') pra puxar facts
  setNome?: string | null;
  setTese?: string | null;
  mode: "linear" | "dynamic";
  rebalance: string;
  capital: number;
  janela: string;
  kpis: KPI[];
  composicao: { id: string; nome: string; peso: number }[];
  anos?: number;
  volTargetAlvo?: number | null;
  expoMedia?: number | null;
  caixaConvencao?: string;
}

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1200;
const FACTS_DIR = path.join(process.cwd(), "data", "strategies", "facts");

/** Carrega o bloco de fatos + few-shot de um SET, se existirem. */
async function carregaFacts(setId: string | null | undefined): Promise<{
  fatos: string | null; fewShot: string | null;
}> {
  if (!setId) return { fatos: null, fewShot: null };
  const safe = setId.replace(/[^a-z0-9_-]/gi, "");
  if (!safe) return { fatos: null, fewShot: null };
  const [fatos, fewShot] = await Promise.all([
    fs.readFile(path.join(FACTS_DIR, `${safe}.json`), "utf8").catch(() => null),
    fs.readFile(path.join(FACTS_DIR, "few-shot", `${safe}.md`), "utf8").catch(() => null),
  ]);
  return { fatos, fewShot };
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 200 de propósito: é um estado esperado (feature degradada), não uma
    // falha de infra — o front-end já trata `error` no corpo sem checar
    // status. Um 5xx aqui só produz um "Failed to load resource" assustador
    // no console do cliente por um caminho que já é tratado com elegância.
    return NextResponse.json({ error: "JIM AI indisponível (chave não configurada)" }, { status: 200 });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { fatos, fewShot } = await carregaFacts(body.setId);
  const modoAncorado = fatos != null;

  const kpisTxt = body.kpis.map((k) => `- ${k.k}: ${k.v}`).join("\n");
  const compTxt = body.composicao
    .map((c) => `- ${c.nome} · ${(c.peso * 100).toFixed(0)}%`)
    .join("\n");

  const anosStr = body.anos ? `${body.anos.toFixed(1)} anos` : body.janela;
  const overlay = body.volTargetAlvo != null
    ? `Overlay de vol-target: ${(body.volTargetAlvo * 100).toFixed(1)}% ao ano (decisão SEMANAL).` +
      (body.expoMedia != null
        ? ` Exposição média do overlay ao motor: ${(body.expoMedia * 100).toFixed(1)}%.` +
          ` Caixa médio: ${((1 - body.expoMedia) * 100).toFixed(1)}%.`
        : "")
    : "SEM overlay de vol-target — exposição total ao motor o tempo todo.";
  const caixa = body.caixaConvencao || "rf=0 (caixa não remunerado no backtest)";

  // System prompt: em modo ancorado, regras HARD (bloco de fatos e a unica
  // fonte); em modo generico, regras SOFT (mesmas do preview de 04/08/2026).
  const systemBase = `Você é o JIM AI, analista quantitativo da Harpian que revisa portfolios em tempo real. Escreva em português brasileiro, tom institucional e direto, sem pieguice. 3 a 4 parágrafos curtos (2-4 frases cada). Não use bullets nem títulos — só prosa. Termine dizendo o que ajustaria ou monitoraria daqui pra frente.`;

  const systemAncorado = `${systemBase}

REGRAS DE ANCORAGEM (bloco FATOS_VERIFICADOS abaixo é sua ÚNICA fonte de números):
1. USE APENAS NÚMEROS DO BLOCO. Se um número não está lá, escreva "não medido" — NUNCA estime, arredonde de memória ou invente comparativos. Se quiser comparar com outro produto, use SÓ o \`dmax_referencia\` do bloco (é a única comparação permitida).
2. Não proponha limiar de monitoramento sem citar a estatística histórica que o calibra. Use exclusivamente os itens de \`monitores_calibrados\` do bloco. Não crie monitor sobre caixa persistente ou vol do motor — o bloco explica por quê.
3. A janela é a que está em \`janelas.producao_tela\` do bloco (${body.anos ? body.anos.toFixed(1) + " anos" : "ver bloco"}). Aritmética de capital final deve bater com \`capitalFinal100k\`.
4. Cite a correlação em stress (\`correlacao_spx.mensal_nos_10pct_piores_meses_spx\`) como o argumento de descorrelação — não a correlação média sozinha.
5. Toda análise TERMINA com as três ressalvas de \`ressalvas_obrigatorias\` (seleção 23.754 / custos / Arena pendente) reunidas em uma frase de rodapé.
6. Palavras PROIBIDAS: "validado", "aprovado", "seguro", "garantido". O SET é candidato.
7. Piso de 1% é MÍNIMO de alocação, não a alocação — a mecânica está em \`mecanica.piso_significado\`. Não escreva que o piso "dilui".`;

  const systemGenerico = `${systemBase}

REGRAS DE INTEGRIDADE:
1. USE SÓ NÚMEROS DO RELATÓRIO. Nunca invente comparações "num cenário X seria Y" nem cite CAGR/vol/Sharpe de estratégias fora da carteira. Se quiser comparar, use apenas o S&P que já está nas métricas.
2. RESPEITE A JANELA informada em "JANELA".
3. NÃO CONFUNDA CADÊNCIA: motor rebalanceia mensal; overlay decide semanalmente.
4. CAIXA NÃO É INIMIGO: se rf=0 (convenção), o custo de retorno em regime de juro alto vem da CONVENÇÃO, não do mercado.
5. MONITORES CONCRETOS: aponte gatilhos numéricos que existem no relatório.
6. SEM SELO: proibidas as palavras "validado", "aprovado", "seguro".`;

  const system = modoAncorado ? systemAncorado : systemGenerico;

  // User prompt: no modo ancorado, o bloco de fatos VEM PRIMEIRO (contexto),
  // depois o resumo da tela (que confirma), depois o few-shot como exemplo.
  const contextoTela = `RESUMO DA TELA (o que o cliente está vendo):
CLIENTE: ${body.cliente || "não informado"}
AUTOR DO PORTFÓLIO: ${body.autor || "não informado"}
CAPITAL INICIAL: ${body.capital.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
JANELA: ${body.janela}${body.anos ? ` (${anosStr} corridos)` : ""}
MODO DE ALOCAÇÃO: ${body.mode === "linear" ? "linear (peso fixo o tempo todo)" : "dinâmica (peso segue a força do momento)"}
REBALANCE DO MOTOR: ${body.rebalance}
${overlay}
CONVENÇÃO DE CAIXA: ${caixa}
${body.setNome ? `SET BASE: ${body.setNome}${body.setTese ? ` — ${body.setTese}` : ""}` : "SEM SET base — portfólio custom"}

MÉTRICAS FINAIS DA TELA:
${kpisTxt}

COMPOSIÇÃO (${body.composicao.length} sleeves):
${compTxt}`;

  let user: string;
  if (modoAncorado) {
    user = `FATOS_VERIFICADOS (fonte única de números permitidos):
\`\`\`json
${fatos}
\`\`\`

${contextoTela}
${fewShot ? `\nEXEMPLO DE TOM/ESTRUTURA (não copiar literalmente, usar como referência de rigor e ancoragem):\n---\n${fewShot}\n---\n` : ""}
Agora escreva a análise deste portfólio em 3–4 parágrafos, seguindo TODAS as regras de ancoragem. A análise deve:
1) Ler o que o portfólio entregou usando os números de \`janelas.producao_tela\`, com a citação de \`correlacao_spx.mensal_nos_10pct_piores_meses_spx\` como o argumento institucional.
2) Explicar o que sustentou o resultado usando \`mecanica\` (destacar o significado do piso, a cadência semanal do overlay).
3) Trade-off: o custo da convenção rf=0, referenciando \`caixa_remunerado_projecao\` explicitamente rotulado como "projeção".
4) Terminar com os 3 monitores de \`monitores_calibrados\` + a frase de rodapé com as 3 \`ressalvas_obrigatorias\`.`;
  } else {
    user = `Analise este portfólio construído no Manager Cockpit.

${contextoTela}

Sua análise deve responder, em 3 a 4 parágrafos:
1) O que este portfólio entregou (retorno, risco, correlação com S&P) e como isso se lê institucionalmente.
2) O que funcionou bem — quais decisões de composição, overlay ou alocação sustentaram o resultado.
3) Fraquezas ou trade-offs — drawdown, concentração, sensibilidade à convenção de caixa se aplicável.
4) O que ajustaria ou monitoraria — recomendação clara e MENSURÁVEL (gatilho numérico + métrica do relatório).`;
  }

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 45000);

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
      // Log completo (com o motivo real — ex.: credito Anthropic esgotado)
      // fica no server; ao cliente devolvemos so uma mensagem generica em
      // 200, porque isso e uma falha esperada/degradada do fornecedor, nao
      // um erro da nossa API — o front-end ja mostra "JIM AI temporariamente
      // indisponivel" sem exigir status HTTP de erro.
      console.error(`[jim-report] Anthropic ${r.status}: ${t.slice(0, 500)}`);
      return NextResponse.json({ error: "JIM AI temporariamente indisponível" }, { status: 200 });
    }
    const d = await r.json();
    const analise = d?.content?.[0]?.text?.trim();
    if (!analise) return NextResponse.json({ error: "Resposta vazia do Claude" }, { status: 200 });
    return NextResponse.json({ analise, modo: modoAncorado ? "ancorado" : "generico" });
  } catch (e) {
    clearTimeout(to);
    console.error(`[jim-report] falha na chamada Anthropic: ${String(e)}`);
    return NextResponse.json({ error: "JIM AI temporariamente indisponível" }, { status: 200 });
  }
}

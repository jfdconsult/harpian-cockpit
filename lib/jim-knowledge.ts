const BLACK_LIBRARY_URL = process.env.BLACK_LIBRARY_URL || "https://cpa-jd.fly.dev";
const JD_NEWS_URL = process.env.JD_NEWS_URL || "https://jd-news-api.fly.dev";

interface BlackLibrarySource {
  author: string;
  type: string;
  confidence: number;
  relevance: string;
}

interface BlackLibraryResponse {
  request_interpretation: string;
  knowledge_domains_detected: string[];
  source_map: BlackLibrarySource[];
  key_concepts: string[];
  extracted_intelligence: string;
  cross_framework_synthesis: { conflicts: string[]; resolution: string };
  application_guidance: string;
  output_package: string;
  limitations: string;
}

export async function consultBlackLibrary(question: string): Promise<string> {
  try {
    const res = await fetch(`${BLACK_LIBRARY_URL}/blacklibrary/consult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requesting_agent: "JIM-Cockpit",
        task_objective: question.slice(0, 200),
        domain: ["macro_quant", "strategy", "risk_management"],
        output_needed: "research_brief",
        proprietary_context: "Harpian",
        depth: "quick",
        constraints: "Responda em português do Brasil, máximo 3 parágrafos. Foco em dados e fontes verificáveis.",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as BlackLibraryResponse;
    if (!data.output_package && !data.extracted_intelligence) return "";

    const parts: string[] = [];
    if (data.extracted_intelligence) parts.push(data.extracted_intelligence);
    if (data.application_guidance) parts.push(data.application_guidance);
    if (data.source_map?.length) {
      const refs = data.source_map
        .slice(0, 3)
        .map((s) => `${s.author} (${s.type}, relevância: ${s.relevance})`)
        .join("; ");
      parts.push(`Fontes: ${refs}`);
    }
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

interface NewsArticle {
  emoji: string;
  titulo: string;
  b1: string;
  b2: string;
  b3: string;
  b4: string;
  fonte: string;
}

interface NewsResponse {
  success: boolean;
  articles: NewsArticle[];
}

export async function fetchNewsIntelligence(): Promise<string> {
  try {
    const res = await fetch(`${JD_NEWS_URL}/api/latest_news?limit=5`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as NewsResponse;
    if (!data.success || !data.articles?.length) return "";

    return data.articles
      .slice(0, 5)
      .map((a) => `${a.emoji} **${a.titulo}** (${a.fonte})\n${a.b1}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

export function buildKnowledgeContext(
  blackLibrary: string,
  news: string,
): string {
  const parts: string[] = [];
  if (blackLibrary) {
    parts.push(
      "\n\n--- CONHECIMENTO INSTITUCIONAL (Black Library) ---\n" +
        "Inteligência consultada na base de conhecimento da Harpian. " +
        "Use para fundamentar a resposta quando relevante.\n\n" +
        blackLibrary,
    );
  }
  if (news) {
    parts.push(
      "\n\n--- INTELIGÊNCIA MACRO DO DIA (JD NEWS) ---\n" +
        "Notícias curadas do dia — use quando a pergunta envolver mercado, macro, ou atualidades.\n\n" +
        news,
    );
  }
  return parts.join("");
}

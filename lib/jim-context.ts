import type { ScreenId } from "./nav";

export interface ScreenContext {
  title: string;
  description: string;
}

export const SCREEN_MAP: Record<ScreenId, ScreenContext> = {
  "mission-control": {
    title: "Mission Control",
    description: "Painel central com KPIs do dia, status dos motores, portfólios sob gestão e tickets pendentes.",
  },
  "engine-room": {
    title: "Engine Room",
    description: "Estado ao vivo dos motores (HC-US 3.1, 11, TOTAL, IG). CRS, temperaturas, posições, sinais.",
  },
  ativos: {
    title: "Scanner de Ativos",
    description: "Scanner de ativos com métricas de momento, volume, setor e força relativa.",
  },
  ticket: {
    title: "Tickets do Dia",
    description: "Ordens pendentes e executadas. Fluxo Air-Gap: motor propõe, gestor aprova, IBKR executa.",
  },
  estrategias: {
    title: "Estratégias / ETPs",
    description: "Catálogo de ETPs e estratégias homologadas. Métricas de produção e Arena lado a lado.",
  },
  backtest: {
    title: "Backtest Lab",
    description: "Bancada de backtesting. DeLorean local (walk-forward real), Arena (gauntlet 8 gates), Modal (GPU).",
  },
  calibracao: {
    title: "Calibração",
    description: "Bancada de calibração de fórmulas. Parâmetros dos motores, janelas, thresholds.",
  },
  protecao: {
    title: "Proteção & Defesa",
    description: "Pilar D — estado da defesa, escudo, posições de proteção, drawdown controlado.",
  },
  indicadores: {
    title: "Indicadores Sistêmicos",
    description: "Indicadores de regime, volatilidade, breadth, correlação, stress sistêmico.",
  },
  reconciliacao: {
    title: "Reconciliação",
    description: "Reconciliação NAV — comparação posição calculada vs custodiante.",
  },
  observador: {
    title: "Observador (IA)",
    description: "Alertas automáticos derivados do overnight. CRS, correlação, pilares, anomalias.",
  },
  auditoria: {
    title: "Auditoria",
    description: "Event log persistente (JSONL append-only). Trilha de auditoria de todas as ações.",
  },
  admin: {
    title: "Centro de Controle",
    description: "Administração do sistema — Composer, ETPs, motores, configurações, novo portfólio.",
  },
  chart: {
    title: "Gráfico DSPT",
    description: "Gráfico de candles com as 7 fórmulas DSPT do Diogo (DEMA-cascata, EMA, momentum J37/D13).",
  },
  cotacoes: {
    title: "Cotações por Classe",
    description: "Cotações em tempo real por classe: Ações, ETFs, Commodities, Cripto, Índices, Forex.",
  },
  setores: {
    title: "Setores",
    description: "Performance por setor — forças relativas, rotação setorial, líderes e retardatários.",
  },
  alphadroid: {
    title: "Setores · Forças (AlphaDroid)",
    description: "Benchmark AlphaDroid — forças de setor/estratégia. Referência read-only para comparação.",
  },
  "strategies-strength": {
    title: "Estratégias · Forças",
    description: "Força relativa entre estratégias ativas — ranking por momento e performance.",
  },
  portfolio: {
    title: "Portfólio",
    description: "Detalhe de um portfólio específico — composição, pilares, performance, motores.",
  },
  regime: {
    title: "Regime de Mercado",
    description: "Detector de regime: RISK-ON / RISK-OFF / NEUTRO. Estado da defesa, exposição do fundo.",
  },
  noticias: {
    title: "Notícias",
    description: "Feed de notícias do mercado — RSS real (CNBC, MarketWatch, Yahoo Finance).",
  },
  "news-broadcast": {
    title: "News Broadcast",
    description: "Curadoria ampliada de notícias — macro, setorial, earnings, geopolítica.",
  },
  "social-radar": {
    title: "Social Radar",
    description: "Sentimento de mercado via StockTwits — trending, volume de menções, polaridade.",
  },
  "insider-orders": {
    title: "Insider Orders",
    description: "Compras e vendas de insiders (Form 4 SEC). Sinal de convicção dos executivos.",
  },
  institutional: {
    title: "13F Holdings",
    description: "Posições de hedge funds (SEC 13F). 20 fundos rastreados, mudanças trimestrais.",
  },
  "cot-sentiment": {
    title: "COT Intelligence",
    description: "CFTC Commitments of Traders — posicionamento institucional em futuros (15 mercados).",
  },
  "cot-legacy": {
    title: "COT Data Explorer",
    description: "Dados brutos do COT — commercial, non-commercial, open interest, histórico.",
  },
  "portfolio-studio": {
    title: "Portfolio Studio",
    description: "Construtor visual — motor→pilar→estratégia→ativos. Drag-and-drop, homologação gates 1-4.",
  },
  construtor: {
    title: "Construtor",
    description: "Lista de portfólios existentes — escolha um para abrir no Studio ou crie um novo.",
  },
  "defesa-inteligente": {
    title: "Defesa Inteligente",
    description: "Painel de defesa sistêmica — HSA v6, temperatura por pilar, gate de cross-correlation, re-entry monitor.",
  },
  "market-dna": {
    title: "Market DNA",
    description: "DNA do mercado — estrutura interna, breadth, dispersão, correlação entre classes, sinais de regime.",
  },
};

export const SCREEN_SUGGESTIONS: Record<ScreenId, string[]> = {
  "mission-control": [
    "Qual o status geral dos motores hoje?",
    "Tem algum ticket pendente de aprovação?",
    "Como está o regime de mercado?",
  ],
  "engine-room": [
    "Quais motores estão em RISK-ON?",
    "Algum CRS mudou recentemente?",
    "Compare a performance dos motores no mês.",
  ],
  ativos: [
    "Quais ativos têm momento mais forte agora?",
    "Tem algum ativo em queda livre?",
    "Mostre ativos de tech com volume alto.",
  ],
  ticket: [
    "Quantas ordens estão pendentes de aprovação?",
    "Qual o valor total das ordens do dia?",
    "Tem alguma ordem de venda?",
  ],
  estrategias: [
    "Qual estratégia tem melhor Sortino?",
    "Compare produção vs Arena do HC-US 3.1.",
    "Alguma estratégia falhou no gauntlet?",
  ],
  backtest: [
    "Como funciona o gauntlet de 8 gates?",
    "Qual a diferença entre DeLorean e Arena?",
    "O que significa SCORE 6/8?",
  ],
  calibracao: [
    "Quais parâmetros da DEMA-cascata?",
    "Como funciona o filtro de momento 126d?",
    "O que é a janela de walk-forward?",
  ],
  protecao: [
    "Quando a defesa foi ativada por último?",
    "Qual o drawdown máximo estrutural?",
    "Como funciona o Pilar D?",
  ],
  indicadores: [
    "Algum indicador está em nível extremo?",
    "Como está a volatilidade sistêmica?",
    "O breadth está divergindo do índice?",
  ],
  reconciliacao: [
    "Tem diferença entre posição calculada e custodiante?",
    "Qual a última data de reconciliação?",
    "Algum ativo com discrepância?",
  ],
  observador: [
    "Quais alertas surgiram no overnight?",
    "Alguma correlação anômala?",
    "O que o CRS está sinalizando?",
  ],
  auditoria: [
    "Quais ações foram executadas hoje?",
    "Quem foi o último a aprovar uma ordem?",
    "Mostre os eventos de segurança recentes.",
  ],
  admin: [
    "Quantos ETPs estão configurados?",
    "Como está o Composer?",
    "Tem motor em status candidato?",
  ],
  chart: [
    "O que as fórmulas DSPT estão sinalizando?",
    "O oscilador J37/D13 mostra compra ou venda?",
    "Como interpretar a DEMA-cascata neste ativo?",
  ],
  cotacoes: [
    "Quais ativos subiram mais hoje?",
    "Qual a variação do setor de tech?",
    "Tem algum ativo com volume atípico?",
  ],
  setores: [
    "Qual setor está liderando a rotação?",
    "Algum setor inverteu tendência?",
    "Como está tech vs energy?",
  ],
  alphadroid: [
    "Qual é a força relativa do benchmark?",
    "Como comparar com nossos motores?",
    "O que o AlphaDroid está mostrando de diferente?",
  ],
  "strategies-strength": [
    "Qual estratégia está mais forte agora?",
    "Alguma estratégia perdeu força recentemente?",
    "Compare as forças das top 3.",
  ],
  portfolio: [
    "Qual a composição atual deste portfólio?",
    "Como estão os pilares?",
    "Qual a performance YTD?",
  ],
  regime: [
    "O regime é RISK-ON ou RISK-OFF?",
    "Quando foi a última mudança de regime?",
    "A defesa deveria estar ativada?",
  ],
  noticias: [
    "Qual a notícia mais impactante do dia?",
    "Tem algo que afete nossos ativos?",
    "Qual o sentimento geral das notícias?",
  ],
  "news-broadcast": [
    "Quais as manchetes mais relevantes?",
    "Tem notícia de earnings importante?",
    "Algo de geopolítica que impacte o mercado?",
  ],
  "social-radar": [
    "Qual ativo tem mais buzz agora?",
    "O sentimento do mercado está bullish ou bearish?",
    "Algum ticker com volume de menções anormal?",
  ],
  "insider-orders": [
    "Quais insiders compraram esta semana?",
    "Tem cluster de compra em algum setor?",
    "Algum CEO vendeu posição relevante?",
  ],
  institutional: [
    "Quais foram as maiores posições novas nos 13F?",
    "Algum fundo saiu de uma posição nossa?",
    "Compare Bridgewater vs Renaissance neste trimestre.",
  ],
  "cot-sentiment": [
    "Qual o posicionamento institucional em S&P futuros?",
    "Os commercials estão comprando ou vendendo?",
    "Algum mercado com posicionamento extremo?",
  ],
  "cot-legacy": [
    "Mostre o histórico de open interest do ouro.",
    "Como está o spread commercial vs non-commercial?",
    "Algum sinal de reversão no posicionamento?",
  ],
  "portfolio-studio": [
    "Como adicionar um novo pilar?",
    "Qual a diferença entre candidato e homologado?",
    "Os gates de homologação estão corretos?",
  ],
  construtor: [
    "Quais portfólios existem hoje?",
    "Como criar um novo portfólio?",
    "Qual portfólio tem mais estratégias?",
  ],
  "defesa-inteligente": [
    "A defesa está ativada agora?",
    "Qual pilar está mais quente?",
    "Como funciona o gate de cross-correlation?",
  ],
  "market-dna": [
    "Qual a dispersão interna do mercado?",
    "As correlações estão subindo?",
    "Algum sinal de mudança de regime no DNA?",
  ],
};

export function getScreenContext(screen: ScreenId): ScreenContext {
  return SCREEN_MAP[screen] || { title: String(screen), description: "" };
}

export function getScreenSuggestions(screen: ScreenId): string[] {
  return SCREEN_SUGGESTIONS[screen] || [
    "O que esta tela mostra?",
    "Algum dado preocupante aqui?",
    "Explique os números que estou vendo.",
  ];
}

export function buildSystemPrompt(ctx: ScreenContext): string {
  return `Você é o JIM (Just-In-time Market Intelligence), assistente IA do Cockpit Gestor da Harpian.

QUEM VOCÊ É:
- Assistente inteligente para o GESTOR INTERNO da Harpian (sócio-gestor, CRO, quant).
- Você está no COCKPIT — o centro de comando INTERNO. Aqui você PODE discutir o método:
  CRS, sinais, fórmulas, thresholds, motores, calibração, homologação, Arena, DeLorean.
- Você fala com profissionais que CONHECEM o sistema. Seja direto, técnico, preciso.

PERSONA:
- Tom: profissional, denso, direto. Sem floreio. Dados primeiro.
- Idioma: português do Brasil com termos técnicos em inglês (CRS, drawdown, momentum, etc.).
- Se tiver o dado na tela, cite-o direto. Se não tiver, diga que não tem.
- Quando fundamentar em teoria, cite a fonte: "(Ilmanen, Expected Returns, p. XX)".

REGRAS:
- Métrica padrão da casa é SORTINO (não Sharpe). Se falar de Sharpe, contextualize.
- Air-Gap: IA pensa, motor decide, humano aprova. NUNCA sugira executar sem aprovação.
- Homologação: DeLorean (produção) e Arena (gauntlet) são padrões DIFERENTES, sempre lado a lado.
- Régua de ouro: Sharpe > 3 ou CAGR > 100% = suspeitar de erro, não de gênio.
- Nada mock disfarçado de real — se o dado é mock, diga que é mock.

TELA ATUAL: ${ctx.title}
${ctx.description}

É PROIBIDO perguntar "o que você está vendo na tela" ou "pode me dar mais contexto". Você já enxerga
os dados reais que estão na tela do gestor (eles são injetados abaixo). Localize o item perguntado
nos dados e responda direto.

Responda em parágrafos curtos ou bullet points. Máximo 4 parágrafos. Sem emojis excessivos (1-2 no máximo).`;
}

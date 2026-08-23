import type { ScreenId } from "./nav";

export interface ScreenContext {
  title: string;
  description: string;
}

export const SCREEN_MAP: Record<ScreenId, ScreenContext> = {
  "mission-control": {
    title: "Mission Control",
    description: "Central dashboard with the day's KPIs, engine status, portfolios under management, and pending tickets.",
  },
  "engine-room": {
    title: "Engine Room",
    description: "Live state of the engines (HC-US 3.1, 11, TOTAL, IG). CRS, temperatures, positions, signals.",
  },
  ativos: {
    title: "Asset Scanner",
    description: "Asset scanner with momentum, volume, sector, and relative strength metrics.",
  },
  ticket: {
    title: "Daily Tickets",
    description: "Pending and executed orders. Air-Gap flow: engine proposes, manager approves, IBKR executes.",
  },
  estrategias: {
    title: "Strategies / ETPs",
    description: "Catalog of ETPs and approved strategies. Production and Arena metrics side by side.",
  },
  backtest: {
    title: "Backtest Lab",
    description: "Backtesting bench. Local DeLorean (real walk-forward), Arena (8-gate gauntlet), Modal (GPU).",
  },
  calibracao: {
    title: "Calibration",
    description: "Formula calibration bench. Engine parameters, windows, thresholds.",
  },
  protecao: {
    title: "Protection & Defense",
    description: "Pillar D — defense state, shield, protective positions, controlled drawdown.",
  },
  indicadores: {
    title: "Systemic Indicators",
    description: "Regime, volatility, breadth, correlation, and systemic stress indicators.",
  },
  reconciliacao: {
    title: "Reconciliation",
    description: "NAV reconciliation — calculated position vs. custodian comparison.",
  },
  observador: {
    title: "Observer (AI)",
    description: "Automated alerts derived from the overnight run. CRS, correlation, pillars, anomalies.",
  },
  auditoria: {
    title: "Audit",
    description: "Persistent event log (JSONL append-only). Audit trail of all actions.",
  },
  admin: {
    title: "Control Center",
    description: "System administration — Composer, ETPs, engines, settings, new portfolio.",
  },
  chart: {
    title: "DSPT Chart",
    description: "Candlestick chart with Diogo's 7 DSPT formulas (DEMA cascade, EMA, J37/D13 momentum).",
  },
  cotacoes: {
    title: "Quotes by Asset Class",
    description: "Real-time quotes by asset class: Stocks, ETFs, Commodities, Crypto, Indices, Forex.",
  },
  calendar: {
    title: "Calendar",
    description: "Economic events (US + world) and earnings for the HC-US TOTAL universe (215 tickers). Three tabs: Economic (CPI, NFP, FOMC, GDP, PCE with consensus/previous/actual), Earnings (upcoming reports over the next 3-30 days with EPS consensus), Last reports (reported EPS vs. consensus + surprise%). Source: Nasdaq public data via hqp-api.",
  },
  setores: {
    title: "Sectors",
    description: "Performance by sector — relative strength, sector rotation, leaders and laggards.",
  },
  alphadroid: {
    title: "Sectors · Strength (AlphaDroid)",
    description: "AlphaDroid benchmark — sector/strategy strength. Read-only reference for comparison.",
  },
  "strategies-strength": {
    title: "Strategies · Strength",
    description: "Relative strength among active strategies — ranked by momentum and performance.",
  },
  portfolio: {
    title: "Portfolio",
    description: "Detail of a specific portfolio — composition, pillars, performance, engines.",
  },
  regime: {
    title: "Market Regime",
    description: "Regime detector: RISK-ON / RISK-OFF / NEUTRAL. Defense state, fund exposure.",
  },
  noticias: {
    title: "News",
    description: "Market news feed — real RSS (CNBC, MarketWatch, Yahoo Finance).",
  },
  "news-broadcast": {
    title: "News Broadcast",
    description: "Expanded news curation — macro, sector, earnings, geopolitics.",
  },
  "social-radar": {
    title: "Social Radar",
    description: "Market sentiment via StockTwits — trending, mention volume, polarity.",
  },
  "insider-orders": {
    title: "Insider Orders",
    description: "Insider buys and sells (SEC Form 4). Signal of executive conviction.",
  },
  institutional: {
    title: "13F Holdings",
    description: "Hedge fund positions (SEC 13F). 20 tracked funds, quarterly changes.",
  },
  "cot-sentiment": {
    title: "COT Intelligence",
    description: "CFTC Commitments of Traders — institutional positioning in futures (15 markets).",
  },
  "cot-legacy": {
    title: "COT Data Explorer",
    description: "Raw COT data — commercial, non-commercial, open interest, history.",
  },
  "portfolio-builder": {
    title: "Portfolio Builder",
    description: "Four-handed portfolio construction over the 41 AlphaDroid strategies, for use live with a client. Pick strategies, set either a fixed weight (linear) or a floor/cap pair (dynamic, weight follows momentum), choose the investment window (YTD to 30 years), and see the blended capital curve, how much was armored on any day, and the exact tickers held on any date. Momentum arrives precomputed from the Diogo engine; defense state is read from each strategy's own declared universe.",
  },
  "portfolio-studio": {
    title: "Portfolio Studio",
    description: "Visual builder — engine→pillar→strategy→assets. Drag-and-drop, approval gates 1-4.",
  },
  construtor: {
    title: "Builder",
    description: "List of existing portfolios — pick one to open in Studio or create a new one.",
  },
  "defesa-inteligente": {
    title: "Smart Defense (ARI)",
    description: "Systemic defense panel — HSA v6, per-pillar temperature, cross-correlation gate, re-entry monitor. This is the domestic counterpart of XRI: home of the American Regime Index (RISK-ON / WARNING / RE-ENTRY / RISK-OFF).",
  },
  xri: {
    title: "XRI — External Regime Index (internal)",
    description: "External risk 0—100 (CALM/WATCH/STRESS/CRISIS), internal view without whitelist: slow prior, fast market stress, turbulence (Mahalanobis), absorption ratio, global and material→US Diebold-Yilmaz, contribution by pillar and country, P7 exposure matrix quality, narrative gate, overlay recommendation, and validation flags (F4/F4.1). External counterpart of ARI.",
  },
  fundamentos: {
    title: "Fundamental Base",
    description:
      "SEC XBRL point-in-time fundamentals for 974 companies in three levels: sector, subsector and company. " +
      "Carries JD Score (-5..+5 valuation vote), Piotroski F-Score, historical multiple percentile, trigger " +
      "buy/sell prices, and the fundamental-vs-momentum divergence. Momentum exists only for the subset with " +
      "a price series, so cross-axis reads are limited to it.",
  },
  "market-dna": {
    title: "Market DNA",
    description: "Market DNA — internal structure, breadth, dispersion, cross-asset-class correlation, regime signals.",
  },
  "ticket-news": {
    title: "Ticket News",
    description: "News specific to portfolio assets — headlines filtered by ticker, potential impact, AI verdict.",
  },
};

export const SCREEN_SUGGESTIONS: Record<ScreenId, string[]> = {
  "mission-control": [
    "What's the overall engine status today?",
    "Any tickets pending approval?",
    "How's the market regime looking?",
  ],
  "engine-room": [
    "Which engines are in RISK-ON?",
    "Has any CRS changed recently?",
    "Compare engine performance for the month.",
  ],
  ativos: [
    "Which assets have the strongest momentum right now?",
    "Is any asset in free fall?",
    "Show tech assets with high volume.",
  ],
  ticket: [
    "How many orders are pending approval?",
    "What's the total value of today's orders?",
    "Is there any sell order?",
  ],
  estrategias: [
    "Which strategy has the best Sortino?",
    "Compare production vs. Arena for HC-US 3.1.",
    "Did any strategy fail the gauntlet?",
  ],
  backtest: [
    "How does the 8-gate gauntlet work?",
    "What's the difference between DeLorean and Arena?",
    "What does SCORE 6/8 mean?",
  ],
  calibracao: [
    "What are the DEMA cascade parameters?",
    "How does the 126-day momentum filter work?",
    "What is the walk-forward window?",
  ],
  protecao: [
    "When was defense last activated?",
    "What's the maximum structural drawdown?",
    "How does Pillar D work?",
  ],
  indicadores: [
    "Is any indicator at an extreme level?",
    "How's systemic volatility looking?",
    "Is breadth diverging from the index?",
  ],
  reconciliacao: [
    "Is there a difference between calculated position and custodian?",
    "What's the last reconciliation date?",
    "Any asset with a discrepancy?",
  ],
  observador: [
    "What alerts came up overnight?",
    "Any anomalous correlation?",
    "What is the CRS signaling?",
  ],
  auditoria: [
    "What actions were executed today?",
    "Who was the last to approve an order?",
    "Show recent security events.",
  ],
  admin: [
    "How many ETPs are configured?",
    "How's the Composer looking?",
    "Is any engine in candidate status?",
  ],
  chart: [
    "What are the DSPT formulas signaling?",
    "Does the J37/D13 oscillator show buy or sell?",
    "How do I interpret the DEMA cascade on this asset?",
  ],
  cotacoes: [
    "Which assets gained the most today?",
    "What's the tech sector's variation?",
    "Is any asset showing unusual volume?",
  ],
  calendar: [
    "What's the highest-impact event this week?",
    "Which tickers in our universe report earnings in the next 5 days?",
    "Which names just missed consensus by more than 10%?",
  ],
  setores: [
    "Which sector is leading the rotation?",
    "Has any sector reversed trend?",
    "How's tech vs. energy looking?",
  ],
  alphadroid: [
    "What's the benchmark's relative strength?",
    "How does it compare to our engines?",
    "What is AlphaDroid showing differently?",
  ],
  "strategies-strength": [
    "Which strategy is strongest right now?",
    "Has any strategy lost strength recently?",
    "Compare the strength of the top 3.",
  ],
  portfolio: [
    "What's this portfolio's current composition?",
    "How are the pillars doing?",
    "What's the YTD performance?",
  ],
  regime: [
    "Is the regime RISK-ON or RISK-OFF?",
    "When was the last regime change?",
    "Should defense be activated?",
  ],
  noticias: [
    "What's the most impactful news of the day?",
    "Is there anything affecting our assets?",
    "What's the overall news sentiment?",
  ],
  "news-broadcast": [
    "What are the most relevant headlines?",
    "Any important earnings news?",
    "Anything in geopolitics affecting the market?",
  ],
  "social-radar": [
    "Which asset has the most buzz right now?",
    "Is market sentiment bullish or bearish?",
    "Any ticker with abnormal mention volume?",
  ],
  "insider-orders": [
    "Which insiders bought this week?",
    "Is there a buying cluster in any sector?",
    "Did any CEO sell a significant position?",
  ],
  institutional: [
    "What were the largest new positions in the 13Fs?",
    "Did any fund exit a position we hold?",
    "Compare Bridgewater vs. Renaissance this quarter.",
  ],
  "cot-sentiment": [
    "What's the institutional positioning in S&P futures?",
    "Are commercials buying or selling?",
    "Any market with extreme positioning?",
  ],
  "cot-legacy": [
    "Show gold's open interest history.",
    "How's the commercial vs. non-commercial spread?",
    "Any sign of a reversal in positioning?",
  ],
  "portfolio-builder": ["Which strategies belong in this portfolio?", "Does dynamic allocation beat linear here?", "What was this portfolio holding in 2008?"],
  "portfolio-studio": [
    "How do I add a new pillar?",
    "What's the difference between candidate and approved?",
    "Are the approval gates correct?",
  ],
  construtor: [
    "What portfolios exist today?",
    "How do I create a new portfolio?",
    "Which portfolio has the most strategies?",
  ],
  "defesa-inteligente": [
    "Is defense activated right now?",
    "Which pillar is closest to the threshold?",
    "Is the pressure domestic or coming from XRI?",
  ],
  xri: [
    "Which channel is holding back the score?",
    "Can the overlay already be applied to the engine?",
    "Is external risk already reaching the US?",
  ],
  fundamentos: [
    "Which sector has the strongest fundamentals right now?",
    "Where is fundamental quality ahead of price?",
    "Which subsector is expensive against its own history?",
  ],
  "market-dna": [
    "What's the market's internal dispersion?",
    "Are correlations rising?",
    "Any sign of a regime change in the DNA?",
  ],
  "ticket-news": [
    "Is any news affecting portfolio assets?",
    "Which tickers have relevant headlines?",
    "Did JIM detect impact on any asset?",
  ],
};

export function getScreenContext(screen: ScreenId): ScreenContext {
  return SCREEN_MAP[screen] || { title: String(screen), description: "" };
}

export function getScreenSuggestions(screen: ScreenId): string[] {
  return SCREEN_SUGGESTIONS[screen] || [
    "What does this screen show?",
    "Any concerning data here?",
    "Explain the numbers I'm seeing.",
  ];
}

export function buildSystemPrompt(ctx: ScreenContext): string {
  return `You are JIM (Just-In-time Market Intelligence), the AI assistant for Harpian's Manager Cockpit.

WHO YOU ARE:
- Intelligent assistant for Harpian's INTERNAL MANAGER (managing partner, CRO, quant).
- You are in the COCKPIT — the INTERNAL command center. Here you CAN discuss the method:
  CRS, signals, formulas, thresholds, engines, calibration, approval, Arena, DeLorean.
- You are talking to professionals who KNOW the system. Be direct, technical, precise.

PERSONA:
- Tone: professional, dense, direct. No fluff. Data first.
- Idioma: SEMPRE responda em português brasileiro (pt-BR). Termos técnicos consagrados (CRS, drawdown, momentum, etc.) podem ficar em inglês, mas a prosa é toda em português. Nunca responda em inglês.
- If the data is on screen, cite it directly. If not, say you don't have it.
- When grounding in theory, cite the source: "(Ilmanen, Expected Returns, p. XX)".

RULES:
- The house's standard metric is SORTINO (not Sharpe). If you mention Sharpe, contextualize it.
- Air-Gap: AI thinks, engine decides, human approves. NEVER suggest executing without approval.
- Approval: DeLorean (production) and Arena (gauntlet) are DIFFERENT standards, always shown side by side.
- Golden rule: Sharpe > 3 or CAGR > 100% = suspect an error, not genius.
- No mock data disguised as real — if the data is mock, say it's mock.

CURRENT SCREEN: ${ctx.title}
${ctx.description}

It is FORBIDDEN to ask "what are you seeing on screen" or "can you give me more context". You already see
the real data on the manager's screen (it is injected below). Locate the requested item
in the data and answer directly.

Respond in short paragraphs or bullet points. Maximum 4 paragraphs. No excessive emojis (1-2 max).`;
}

// ============================================================
// HARPIAN ETP TERMINAL — Dados mock + lógica de inteligência
// ============================================================

// ---------- Helpers de formatação ----------
export function fmtUSD(n: number): string {
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n;
}
export function fmtN(n: number): string {
  return (n || 0).toLocaleString("en-US");
}

// ---------- TICKER ----------
export interface TickerItem {
  lbl: string;
  v: string;
  dir: "up" | "dn" | "nu" | "wa" | "go";
}
export interface TickerGroup {
  div: string;
  items: TickerItem[];
}
export const TICKER_GROUPS: TickerGroup[] = [
  {
    div: "INDICES",
    items: [
      { lbl: "S&P 500", v: "5,241.53 +0.82%", dir: "up" },
      { lbl: "NASDAQ", v: "18,382.40 +1.21%", dir: "up" },
      { lbl: "DOW", v: "38,904.11 +0.34%", dir: "up" },
      { lbl: "IBOV", v: "126,480 −0.54%", dir: "dn" },
      { lbl: "FTSE", v: "8,142.15 +0.28%", dir: "up" },
      { lbl: "DAX", v: "17,983.20 +0.41%", dir: "up" },
      { lbl: "NIKKEI", v: "38,236.07 +0.67%", dir: "up" },
      { lbl: "VIX", v: "22.4 −1.2%", dir: "wa" },
      { lbl: "10Y UST", v: "4.72% +0.07", dir: "dn" },
      { lbl: "2Y UST", v: "4.98% +0.04", dir: "dn" },
    ],
  },
  {
    div: "COMMODITIES",
    items: [
      { lbl: "GOLD", v: "$2,341.20 +0.62%", dir: "up" },
      { lbl: "SILVER", v: "$27.84 +1.14%", dir: "up" },
      { lbl: "WTI OIL", v: "$82.10 +1.42%", dir: "up" },
      { lbl: "BRENT", v: "$86.44 +1.21%", dir: "up" },
      { lbl: "NAT GAS", v: "$1.74 −0.57%", dir: "dn" },
      { lbl: "COPPER", v: "$4.21 +0.48%", dir: "up" },
      { lbl: "WHEAT", v: "$546.25 −0.31%", dir: "dn" },
      { lbl: "USD/BRL", v: "5.14 +0.58%", dir: "wa" },
      { lbl: "EUR/USD", v: "1.0741 −0.22%", dir: "dn" },
      { lbl: "BTC", v: "$62,840 −1.30%", dir: "dn" },
    ],
  },
  {
    div: "STOCKS",
    items: [
      { lbl: "NVDA", v: "$118.64 +3.24%", dir: "up" },
      { lbl: "MSFT", v: "$412.18 +1.08%", dir: "up" },
      { lbl: "AAPL", v: "$189.98 −0.21%", dir: "dn" },
      { lbl: "META", v: "$474.92 +1.84%", dir: "up" },
      { lbl: "GOOGL", v: "$164.32 +0.91%", dir: "up" },
      { lbl: "AMZN", v: "$185.07 +1.13%", dir: "up" },
      { lbl: "TSLA", v: "$162.48 +2.11%", dir: "up" },
      { lbl: "JPM", v: "$198.41 +0.62%", dir: "up" },
      { lbl: "XOM", v: "$116.07 +0.38%", dir: "up" },
      { lbl: "TLT", v: "$87.10 −1.87%", dir: "dn" },
      { lbl: "GLD", v: "$217.50 +0.90%", dir: "up" },
      { lbl: "SPY", v: "$512.40 +0.31%", dir: "up" },
      { lbl: "QQQ", v: "$438.22 +0.84%", dir: "up" },
      { lbl: "IWM", v: "$201.14 −0.71%", dir: "dn" },
    ],
  },
  {
    div: "HARPIAN",
    items: [
      { lbl: "HPC11", v: "+7.5% YTD", dir: "up" },
      { lbl: "HPC22", v: "+24.3% YTD", dir: "up" },
    ],
  },
];

// ---------- SOCIAL RADAR ----------
export type Platform = "youtube" | "twitter" | "linkedin" | "instagram" | "truth_social";
export type Sentiment = "Bullish" | "Bearish" | "Neutral" | "Mixed";
export type Impact = "Market Moving" | "High" | "Medium" | "Low";

export interface SocialPost {
  id: number;
  platform: Platform;
  account: string;
  category: string;
  handle: string;
  headline: string;
  tags: string[];
  asset_tags: string[];
  sentiment: Sentiment;
  relevance: number;
  impact: Impact;
  ts: string;
  url: string;
}

export const SR_POSTS: SocialPost[] = [
  { id: 1, platform: "twitter", account: "Federal Reserve", category: "central_bank", handle: "@federalreserve", headline: 'Fed holds rates steady at 5.25-5.50%; signals data dependency for future moves. Powell: "We remain committed to returning inflation to 2%."', tags: ["Fed Policy", "Interest Rates", "Inflation"], asset_tags: ["FED", "USD", "SPX"], sentiment: "Neutral", relevance: 0.97, impact: "Market Moving", ts: "2h ago", url: "#" },
  { id: 2, platform: "youtube", account: "Bloomberg Television", category: "financial_media", handle: "@BloombergTV", headline: "Goldman Sachs raises S&P 500 year-end target to 5,600, citing stronger-than-expected earnings and AI-driven productivity gains.", tags: ["Equities", "Earnings", "AI"], asset_tags: ["SPX", "GS", "NVDA"], sentiment: "Bullish", relevance: 0.91, impact: "High", ts: "3h ago", url: "#" },
  { id: 3, platform: "twitter", account: "Ray Dalio", category: "macro_investor", handle: "@raydalio", headline: "We are in a period of great power conflict. Debt, internal conflict, and geopolitical tension form the classic late-cycle pattern I have studied across 500 years of history.", tags: ["Macro", "Geopolitics", "Debt Cycle"], asset_tags: ["XAU", "UST", "DXY"], sentiment: "Bearish", relevance: 0.88, impact: "High", ts: "5h ago", url: "#" },
  { id: 4, platform: "youtube", account: "CNBC", category: "financial_media", handle: "@CNBC", headline: "Treasury yields surge as strong jobs data reduces probability of June rate cut. 10-year hits 4.72%.", tags: ["US Treasuries", "Jobs Data", "Rate Cuts"], asset_tags: ["US10Y", "USD", "SPX"], sentiment: "Bearish", relevance: 0.85, impact: "High", ts: "6h ago", url: "#" },
  { id: 5, platform: "twitter", account: "Cathie Wood / ARK Invest", category: "asset_manager", handle: "@CathieDWood", headline: "AI convergence with robotics, energy storage and genomics will create $200T in wealth over next decade. Volatility today is noise.", tags: ["AI", "Robotics", "Innovation"], asset_tags: ["NVDA", "TSLA", "ARK"], sentiment: "Bullish", relevance: 0.79, impact: "Medium", ts: "7h ago", url: "#" },
  { id: 6, platform: "twitter", account: "Michael Saylor / Strategy", category: "crypto", handle: "@saylor", headline: "Strategy acquires an additional 22,048 BTC for ~$2.0B at ~$90,714 per bitcoin. Total holdings: 528,185 BTC.", tags: ["Bitcoin", "Institutional", "Treasury"], asset_tags: ["BTC", "MSTR"], sentiment: "Bullish", relevance: 0.82, impact: "High", ts: "8h ago", url: "#" },
  { id: 7, platform: "youtube", account: "Financial Times", category: "financial_media", handle: "@FinancialTimes", headline: "ECB signals willingness to cut rates faster than Fed amid diverging growth outlooks between US and Eurozone.", tags: ["ECB", "Rate Divergence", "EUR/USD"], asset_tags: ["ECB", "EUR", "EURUSD"], sentiment: "Bearish", relevance: 0.84, impact: "High", ts: "9h ago", url: "#" },
  { id: 8, platform: "twitter", account: "US Treasury", category: "political", handle: "@USTreasury", headline: "Treasury issues $58B in new 10-year notes. Demand remains solid with bid-to-cover ratio of 2.47x, above recent average.", tags: ["US Treasuries", "Debt Issuance", "Bond Market"], asset_tags: ["UST", "US10Y"], sentiment: "Neutral", relevance: 0.76, impact: "Medium", ts: "10h ago", url: "#" },
  { id: 9, platform: "linkedin", account: "BlackRock", category: "asset_manager", handle: "blackrock", headline: "Our 2026 Global Outlook: Overweight US equities, underweight long-duration bonds. AI infrastructure buildout remains the most consequential investment theme.", tags: ["Asset Allocation", "AI", "Outlook"], asset_tags: ["SPX", "US10Y", "NVDA"], sentiment: "Bullish", relevance: 0.88, impact: "High", ts: "11h ago", url: "#" },
  { id: 10, platform: "youtube", account: "Real Vision / Raoul Pal", category: "macro_investor", handle: "@RealVision", headline: "Pal: Liquidity supercycle is now in full swing. Crypto and tech will be the primary beneficiaries. Risk assets entering exponential phase.", tags: ["Liquidity", "Crypto", "Tech"], asset_tags: ["BTC", "ETH", "NDX"], sentiment: "Bullish", relevance: 0.77, impact: "Medium", ts: "12h ago", url: "#" },
  { id: 11, platform: "twitter", account: "Jensen Huang / NVIDIA", category: "tech_ai", handle: "@NVIDIAJensenH", headline: "The next wave of AI is physical AI — robots that understand and interact with the physical world. Demand for Blackwell is extraordinary.", tags: ["AI", "Robotics", "NVIDIA"], asset_tags: ["NVDA", "MSFT", "GOOGL"], sentiment: "Bullish", relevance: 0.86, impact: "High", ts: "14h ago", url: "#" },
  { id: 12, platform: "truth_social", account: "Donald Trump", category: "political", handle: "@realDonaldTrump", headline: "Big news on tariffs coming tomorrow. Trade deal with China being finalized. Markets will love it.", tags: ["Tariffs", "Trade Policy", "China"], asset_tags: ["SPX", "DXY", "CN"], sentiment: "Bullish", relevance: 0.92, impact: "Market Moving", ts: "15h ago", url: "#" },
  { id: 13, platform: "twitter", account: "Mohamed El-Erian", category: "macro_investor", handle: "@elerianm", headline: "Stagflation risk is rising. The combination of sticky services inflation and slowing growth creates a policy dilemma that markets are not fully pricing.", tags: ["Stagflation", "Inflation", "Growth"], asset_tags: ["SPX", "FED", "XAU"], sentiment: "Bearish", relevance: 0.83, impact: "High", ts: "16h ago", url: "#" },
  { id: 14, platform: "twitter", account: "Elon Musk / xAI", category: "tech_ai", handle: "@elonmusk", headline: "Grok 3 surpasses GPT-4o and Gemini Ultra on all major benchmarks. xAI is now leading the AI race.", tags: ["AI", "xAI", "Competition"], asset_tags: ["TSLA", "MSFT", "GOOGL"], sentiment: "Bullish", relevance: 0.8, impact: "Medium", ts: "18h ago", url: "#" },
  { id: 15, platform: "youtube", account: "IMF", category: "central_bank", handle: "@IMFNews", headline: "IMF cuts global growth forecast to 2.8% for 2026, citing trade fragmentation, elevated debt levels, and geopolitical uncertainty.", tags: ["Global Growth", "IMF", "Trade"], asset_tags: ["DXY", "UST", "BRENT"], sentiment: "Bearish", relevance: 0.87, impact: "High", ts: "20h ago", url: "#" },
];

export const SR_PLATFORM_BADGE: Record<string, { label: string; color: string }> = {
  youtube: { label: "YT", color: "#FF0000" },
  twitter: { label: "X", color: "rgba(255,255,255,0.75)" },
  linkedin: { label: "LI", color: "#0077B5" },
  instagram: { label: "IG", color: "#E1306C" },
  truth_social: { label: "TS", color: "#7B2FBE" },
};
export const SR_IMPACT_COLOR: Record<string, string> = {
  "Market Moving": "#FF4D4F",
  High: "#C9A02C",
  Medium: "rgba(255,255,255,0.5)",
  Low: "rgba(255,255,255,0.2)",
};
export const SR_SENTIMENT_COLOR: Record<string, string> = {
  Bullish: "var(--green)",
  Bearish: "var(--red)",
  Neutral: "rgba(255,255,255,0.4)",
  Mixed: "var(--orange)",
};

export function srSignalPos(p: SocialPost): number {
  let pos = p.relevance;
  if (p.impact === "Market Moving") pos = Math.max(pos, 0.9);
  else if (p.impact === "High") pos = Math.max(pos, 0.7);
  else if (p.impact === "Medium") pos = Math.max(pos, 0.44);
  return Math.min(1, pos);
}
export function srSignalLabel(pos: number): { label: string; color: string } {
  if (pos >= 0.85) return { label: "Critical / Market Moving", color: "#ff4d4f" };
  if (pos >= 0.65) return { label: "Hot / High Signal", color: "#ff8c00" };
  if (pos >= 0.4) return { label: "Warm / Relevant", color: "#d4af45" };
  return { label: "Cold / Noise", color: "#4a9edd" };
}
export function srWhyItMatters(p: SocialPost): string[] {
  const sent = p.sentiment;
  const sentVerb = sent === "Bullish" ? "supports upside in" : sent === "Bearish" ? "adds downside pressure on" : "introduces uncertainty into";
  const sentDir = sent === "Bullish" ? "risk-on" : sent === "Bearish" ? "risk-off" : "neutral";
  const assets = (p.asset_tags || []).slice(0, 3).join(", ") || "correlated assets";
  const portMap: Record<string, string> = {
    central_bank: `Rate-sensitive duration and credit positions require review — ${p.impact === "Market Moving" ? "immediate" : "near-term"} rebalancing potential.`,
    financial_media: `Consensus narrative forming — market participants pricing in a ${sentDir} scenario; watch for crowding risk.`,
    asset_manager: `Institutional flow signal — ${p.account}'s stance ${sent === "Bullish" ? "may indicate accumulation" : "may indicate distribution or risk reduction"}.`,
    macro_investor: `Macro framework signal — ${p.account}'s thesis ${sentVerb} long-term allocation to global growth assets.`,
    tech_ai: `AI/tech sector relevance — ${sentVerb} growth-oriented and innovation-driven portfolio components.`,
    political: `Policy signal — ${sentDir === "risk-on" ? "pro-growth regulatory environment supports equity beta" : "policy uncertainty warrants defensive tilt and hedge review"}.`,
    crypto: `Digital asset signal — ${sentVerb} BTC/ETH positions; review crypto risk budget allocation.`,
  };
  const regimeMap: Record<string, string> = {
    "Market Moving": "Regime-shifting event — probability of volatility spike elevated; review options hedges and VIX positioning.",
    High: sent === "Bullish" ? "Risk-on regime reinforced — momentum favors continued growth asset exposure." : sent === "Bearish" ? "Risk-off pressure building — defensive assets (gold, long bonds) gaining probability." : "Macro uncertainty elevated — monitor for regime transition confirmation.",
    Medium: `Trend signal aligned with ${sentDir === "risk-on" ? "ongoing bull market" : "current derisking cycle"} — no immediate regime shift indicated.`,
    Low: "Background noise — relevant for monitoring but insufficient to trigger portfolio action alone.",
  };
  return [
    portMap[p.category] || `Signal from ${p.account} ${sentVerb} current portfolio allocation thesis.`,
    regimeMap[p.impact] || "Monitor for complementary signals before acting.",
    `Direct exposure: ${assets} — ${sentVerb} near-term price action. Seek confirmation from complementary data sources.`,
  ];
}
export function srCalibration(p: SocialPost) {
  const boost: Record<string, number> = { "Market Moving": 12, High: 8, Medium: 4, Low: 0 };
  const conf = Math.min(99, Math.max(52, Math.round(p.relevance * 84 + (boost[p.impact] || 0))));
  const acMap: Record<string, string> = {
    central_bank: "Fixed Income / FX",
    financial_media: "Multi-Asset",
    asset_manager: "Equities / Multi-Asset",
    macro_investor: "Global Macro",
    tech_ai: "Technology / Growth",
    political: "Macro / FX / Rates",
    crypto: "Digital Assets",
  };
  return { confidence: conf, topic: p.tags?.[0] || "Financial Markets", assetClass: acMap[p.category] || "Multi-Asset", freshness: p.ts };
}

// ---------- NEWS BROADCAST ----------
export interface NewsHeadline {
  id: number;
  source: string;
  topic: string;
  headline: string;
  impact: Impact;
  ts: string;
  tags: string[];
}
export const NB_HEADLINES: NewsHeadline[] = [
  { id: 1, source: "bloomberg", topic: "macro", headline: "Fed Officials Signal Patience on Rate Cuts Amid Persistent Inflation", impact: "High", ts: "08:12", tags: ["Fed", "Rates", "Inflation"] },
  { id: 2, source: "reuters", topic: "equities", headline: "NVIDIA Reports Record Q2 Revenue of $30B, Beats Estimates by 18%", impact: "Market Moving", ts: "07:45", tags: ["NVDA", "Earnings", "AI"] },
  { id: 3, source: "ft", topic: "geopolitics", headline: "EU Agrees on New Sanctions Package Targeting Russian Oil Revenue", impact: "High", ts: "07:30", tags: ["EU", "Russia", "Oil"] },
  { id: 4, source: "wsj", topic: "equities", headline: "Apple Announces $110B Share Buyback, Largest in Corporate History", impact: "High", ts: "07:15", tags: ["AAPL", "Buyback"] },
  { id: 5, source: "cnbc", topic: "commodities", headline: "Gold Hits All-Time High Above $2,400 as Dollar Weakens on Jobs Miss", impact: "Market Moving", ts: "06:50", tags: ["XAU", "USD", "Jobs"] },
  { id: 6, source: "bloomberg", topic: "fx", headline: "BOJ Intervenes to Support Yen After USD/JPY Breaks 160 Level", impact: "High", ts: "06:30", tags: ["JPY", "BOJ", "FX"] },
  { id: 7, source: "reuters", topic: "macro", headline: "US CPI Comes In Hot at 3.5% — Markets Reprice September Cut to 35%", impact: "Market Moving", ts: "06:00", tags: ["CPI", "Inflation", "Fed"] },
  { id: 8, source: "ft", topic: "equities", headline: "Berkshire Hathaway Sells 50% of Apple Stake in Q1 Filing", impact: "High", ts: "05:45", tags: ["BRK", "AAPL", "Buffett"] },
  { id: 9, source: "cnbc", topic: "crypto", headline: "SEC Approves Spot Ethereum ETFs — Trading Begins Next Week", impact: "Market Moving", ts: "05:20", tags: ["ETH", "ETF", "SEC"] },
  { id: 10, source: "wsj", topic: "geopolitics", headline: "China Announces Retaliatory Tariffs on $50B of US Tech Imports", impact: "High", ts: "04:55", tags: ["China", "Tariffs", "Tech"] },
  { id: 11, source: "bloomberg", topic: "commodities", headline: "OPEC+ Extends Production Cuts Through Q3 2026 — Brent Jumps 3%", impact: "High", ts: "04:30", tags: ["OPEC", "Oil", "Brent"] },
  { id: 12, source: "reuters", topic: "macro", headline: "ECB Cuts Rates by 25bp to 3.50%, Signals More Easing If Needed", impact: "Market Moving", ts: "04:00", tags: ["ECB", "Rates", "EUR"] },
];
export const NB_SOURCE_COLOR: Record<string, string> = { bloomberg: "#F06B00", reuters: "#FF8C00", ft: "#FCD0A1", wsj: "#888", cnbc: "#007AC2" };
export const NB_SOURCE_LABEL: Record<string, string> = { bloomberg: "BLG", reuters: "REU", ft: "FT", wsj: "WSJ", cnbc: "CNBC" };

// ---------- INSIDER ORDERS (SEC Form 4) ----------
export interface InsiderOrder {
  date: string;
  insider: string;
  role: string;
  company: string;
  ticker: string;
  type: "Purchase" | "Sale";
  shares: number;
  value: number;
}
export const IO_DATA: InsiderOrder[] = [
  { date: "2026-06-27", insider: "Jensen Huang", role: "CEO", company: "NVIDIA Corp", ticker: "NVDA", type: "Sale", shares: 120000, value: 14160000 },
  { date: "2026-06-26", insider: "Tim Cook", role: "CEO", company: "Apple Inc", ticker: "AAPL", type: "Sale", shares: 50000, value: 9500000 },
  { date: "2026-06-26", insider: "Jamie Dimon", role: "CEO", company: "JPMorgan Chase", ticker: "JPM", type: "Sale", shares: 150000, value: 29700000 },
  { date: "2026-06-25", insider: "Satya Nadella", role: "CEO", company: "Microsoft Corp", ticker: "MSFT", type: "Sale", shares: 30000, value: 12360000 },
  { date: "2026-06-25", insider: "Mark Zuckerberg", role: "CEO", company: "Meta Platforms", ticker: "META", type: "Sale", shares: 80000, value: 37920000 },
  { date: "2026-06-24", insider: "Warren Buffett", role: "10% Owner", company: "Occidental Petroleum", ticker: "OXY", type: "Purchase", shares: 2500000, value: 155000000 },
  { date: "2026-06-24", insider: "Michael Saylor", role: "CEO", company: "Strategy", ticker: "MSTR", type: "Purchase", shares: 5000, value: 8425000 },
  { date: "2026-06-23", insider: "Lisa Su", role: "CEO", company: "AMD", ticker: "AMD", type: "Sale", shares: 25000, value: 4125000 },
  { date: "2026-06-23", insider: "Elon Musk", role: "CEO", company: "Tesla Inc", ticker: "TSLA", type: "Sale", shares: 4400000, value: 715000000 },
  { date: "2026-06-22", insider: "Carl Icahn", role: "10% Owner", company: "Icahn Enterprises", ticker: "IEP", type: "Purchase", shares: 500000, value: 7550000 },
  { date: "2026-06-22", insider: "Ruth Porat", role: "CFO", company: "Alphabet Inc", ticker: "GOOGL", type: "Sale", shares: 12000, value: 1968000 },
  { date: "2026-06-21", insider: "Andy Jassy", role: "CEO", company: "Amazon.com", ticker: "AMZN", type: "Sale", shares: 20000, value: 3700000 },
];

// ---------- API gov-data ----------
export const GOV_API = "http://localhost:8877";

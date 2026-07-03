// ============================================================
// Notícias + Social REAIS — cliente dos endpoints /v1/news e /v1/social
// (backend agrega RSS financeiro grátis + StockTwits). Substitui os
// arrays mock NB_HEADLINES / SR_POSTS do lib/data.ts.
// ============================================================
import { apiGet } from "./api";

export interface NewsHeadline {
  id: string;
  source: string;
  source_label: string;
  headline: string;
  url: string;
  impact: "Market Moving" | "High" | "Normal";
  tags: string[];
  ts: string;
}

export interface NewsResp {
  headlines: NewsHeadline[];
  n: number;
  sources_live: string[];
  source_color: Record<string, string>;
  fetched_at: string;
  source: string;
}

export interface SocialPost {
  id: number;
  author: string;
  handle: string;
  avatar: string | null;
  followers: number;
  verified: boolean;
  body: string;
  symbols: string[];
  sentiment: "Bullish" | "Bearish" | "Neutral";
  impact: "High" | "Medium" | "Low";
  ts: string;
  url: string;
  platform: string;
}

export interface SocialResp {
  posts: SocialPost[];
  n: number;
  source: string;
  offline: boolean;
  fetched_at?: string;
}

export const fetchNews = () => apiGet<NewsResp>("/v1/news");
export const fetchNewsTicker = (sym: string) => apiGet<NewsResp>(`/v1/news/ticker/${sym}`);
export const fetchSocialTrending = () => apiGet<SocialResp>("/v1/social/trending");
export const fetchSocialSymbol = (sym: string) => apiGet<SocialResp>(`/v1/social/symbol/${sym}`);

// cor por rótulo de impacto (mantém a paleta do mock)
export const IMPACT_COLOR: Record<string, string> = {
  "Market Moving": "#E74C3C",
  High: "#F39C12",
  Medium: "#F39C12",
  Normal: "#4A90D9",
  Low: "#5b7a99",
};

export const SENTIMENT_COLOR: Record<string, string> = {
  Bullish: "#2ECC71",
  Bearish: "#E74C3C",
  Neutral: "#7d96b3",
};

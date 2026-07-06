"use client";
import { useEffect, useState } from "react";
import { fetchNews, fetchSocialTrending, type NewsHeadline, type SocialPost } from "@/lib/feeds";
import type { ScreenId } from "@/lib/nav";

interface TickerEntry {
  label: string;
  text: string;
  color: string;
  screen?: ScreenId;
  url?: string;
}

const IMPACT_COLORS: Record<string, string> = {
  "Market Moving": "#E74C3C",
  High: "#F39C12",
  Normal: "var(--tx2)",
};

const SENTIMENT_COLORS: Record<string, string> = {
  Bullish: "var(--green)",
  Bearish: "var(--red)",
  Neutral: "var(--tx2)",
};

const FED_CALENDAR: TickerEntry[] = [
  { label: "FOMC", text: "Próx. reunião 29-30 Jul", color: "var(--blue)", screen: "regime" },
  { label: "CPI", text: "10 Jul 08:30 ET", color: "var(--orange)", screen: "regime" },
  { label: "PAYROLL", text: "01 Ago 08:30 ET", color: "var(--orange)", screen: "regime" },
];

function buildEntries(news: NewsHeadline[], social: SocialPost[]): TickerEntry[] {
  const entries: TickerEntry[] = [];

  entries.push({ label: "NOTÍCIAS", text: "", color: "var(--gold)" });

  const topNews = news.slice(0, 12);
  for (const n of topNews) {
    entries.push({
      label: n.source_label || n.source,
      text: n.headline.length > 80 ? n.headline.slice(0, 77) + "…" : n.headline,
      color: IMPACT_COLORS[n.impact] || "var(--tx2)",
      url: n.url,
      screen: "noticias",
    });
  }

  entries.push({ label: "SOCIAL RADAR", text: "", color: "var(--gold)" });

  const topSocial = social
    .filter((s) => s.impact === "High" || s.sentiment !== "Neutral")
    .slice(0, 8);
  for (const s of topSocial) {
    const symbols = s.symbols.length > 0 ? ` ${s.symbols.map((t) => "$" + t).join(" ")}` : "";
    const body = s.body.length > 70 ? s.body.slice(0, 67) + "…" : s.body;
    entries.push({
      label: `@${s.handle}`,
      text: `${body}${symbols}`,
      color: SENTIMENT_COLORS[s.sentiment] || "var(--tx2)",
      url: s.url,
      screen: "social-radar",
    });
  }

  entries.push({ label: "CALENDÁRIO FED", text: "", color: "var(--gold)" });
  entries.push(...FED_CALENDAR);

  return entries;
}

function EntryView({ e, go }: { e: TickerEntry; go: (id: ScreenId) => void }) {
  if (!e.text) {
    return <div className="tkr-div">{e.label}</div>;
  }

  const content = (
    <>
      <span className="tkr-lbl">{e.label}</span>
      <span className="tkr-v" style={{ color: e.color }}>{e.text}</span>
    </>
  );

  if (e.url) {
    return (
      <a className="tkr-item tkr-link" href={e.url} target="_blank" rel="noopener noreferrer" title="Abrir">
        {content}
      </a>
    );
  }

  if (e.screen) {
    return (
      <div className="tkr-item tkr-link" onClick={() => go(e.screen!)}>
        {content}
      </div>
    );
  }

  return <div className="tkr-item">{content}</div>;
}

function TickerContent({ entries, go }: { entries: TickerEntry[]; go: (id: ScreenId) => void }) {
  return (
    <>
      {entries.map((e, i) => (
        <EntryView key={i} e={e} go={go} />
      ))}
    </>
  );
}

const REFRESH_MS = 3 * 60 * 1000;

export default function NewsTicker({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [entries, setEntries] = useState<TickerEntry[]>([...FED_CALENDAR]);

  useEffect(() => {
    const load = async () => {
      try {
        const [newsResp, socialResp] = await Promise.all([
          fetchNews().catch(() => null),
          fetchSocialTrending().catch(() => null),
        ]);
        const news = newsResp?.headlines || [];
        const social = socialResp?.posts || [];
        if (news.length > 0 || social.length > 0) {
          setEntries(buildEntries(news, social));
        }
      } catch {}
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tkr-wrap">
      <div className="tkr-track">
        <TickerContent entries={entries} go={go} />
        <TickerContent entries={entries} go={go} />
      </div>
    </div>
  );
}

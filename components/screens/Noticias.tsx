"use client";
import { useEffect, useState } from "react";
import { fetchNews, IMPACT_COLOR, type NewsHeadline } from "@/lib/feeds";
import { publishScreenData } from "@/lib/jim-data";
import type { ScreenId } from "@/lib/nav";

export default function Noticias({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [items, setItems] = useState<NewsHeadline[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let live = true;
    fetchNews()
      .then((d) => {
        if (!live) return;
        const filtered = d.headlines
          .filter((h) => h.impact === "Market Moving" || h.impact === "High")
          .slice(0, 10);
        setItems(filtered.length ? filtered : d.headlines.slice(0, 10));
        setColors(d.source_color || {});
        setConn("ok");
      })
      .catch(() => live && setConn("error"));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const byImpact: Record<string, number> = {};
    items.forEach((h) => { byImpact[h.impact] = (byImpact[h.impact] || 0) + 1; });
    const impactSummary = Object.entries(byImpact).map(([k, v]) => `${k}:${v}`).join(", ");
    publishScreenData("noticias", `${items.length} manchetes | ${impactSummary}`, items, {
      briefing: `${items.length} notícias filtradas por impacto. Distribuição: ${impactSummary}.`,
    });
  }, [items]);

  return (
    <div className="screen">
      <div className="crumb">Mercado › <b>Notícias</b></div>
      <div className="flex between wrap">
        <div><div className="h1">Notícias que importam</div><div className="sub" style={{ margin: 0 }}>Filtradas pelo impacto no fundo · fonte RSS ao vivo (CNBC · MarketWatch · Yahoo).</div></div>
        <button className="btn ghost" onClick={() => go("news-broadcast")}><i className="ti ti-broadcast" />News Broadcast completo</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {conn === "loading" && [0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 68, borderRadius: 6 }} />
        ))}
        {conn === "error" && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--tx3)", fontSize: 12 }}>
            Não foi possível carregar as notícias. Verifique se o backend (porta 8080) está no ar.
          </div>
        )}
        {conn === "ok" && items.map((h) => {
          const ic = IMPACT_COLOR[h.impact] || "rgba(255,255,255,0.3)";
          const scol = colors[h.source] || "#999";
          return (
            <a key={h.id} href={h.url || "#"} target="_blank" rel="noopener noreferrer"
               style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderLeft: `3px solid ${ic}`, borderRadius: 6, padding: "12px 15px", display: "flex", flexDirection: "column", gap: 6, textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, background: scol, color: "#fff", padding: "3px 7px", borderRadius: 3 }}>{h.source_label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: ic }}>{h.impact.toUpperCase()}</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)" }}>{h.ts}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tx)", lineHeight: 1.45 }}>{h.headline}</div>
              {h.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {h.tags.map((t) => <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 10, background: "rgba(201,160,44,0.08)", border: "1px solid rgba(201,160,44,0.15)", color: "var(--gold)", padding: "2px 6px", borderRadius: 3 }}>{t}</span>)}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

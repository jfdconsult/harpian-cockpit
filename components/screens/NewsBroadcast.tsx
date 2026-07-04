"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchNews, IMPACT_COLOR, type NewsHeadline } from "@/lib/feeds";

export default function NewsBroadcast() {
  const [all, setAll] = useState<NewsHeadline[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [sourcesLive, setSourcesLive] = useState<string[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [source, setSource] = useState("all");
  const [impact, setImpact] = useState("all");

  function load() {
    setConn("loading");
    fetchNews()
      .then((d) => {
        setAll(d.headlines);
        setColors(d.source_color || {});
        setSourcesLive(d.sources_live || []);
        setFetchedAt(d.fetched_at || "");
        setConn("ok");
      })
      .catch(() => setConn("error"));
  }
  useEffect(load, []);

  const items = useMemo(() => all.filter((h) => {
    if (source !== "all" && h.source !== source) return false;
    if (impact !== "all" && h.impact !== impact) return false;
    return true;
  }), [all, source, impact]);

  return (
    <div className="screen">
      <div className="crumb">Intelligence › <b>News Broadcast</b></div>
      <div className="h1">News Broadcast</div>
      <div className="sub">Feed consolidado ao vivo · RSS financeiro grátis (CNBC · MarketWatch · Yahoo).</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0", alignItems: "center" }}>
        <span className="flabel">Fonte:</span>
        <select className="fsel" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">Todas</option>
          <option value="cnbc">CNBC</option>
          <option value="marketwatch">MarketWatch</option>
          <option value="yahoo">Yahoo Finance</option>
        </select>
        <select className="fsel" value={impact} onChange={(e) => setImpact(e.target.value)}>
          <option value="all">Todos os impactos</option>
          <option value="Market Moving">Market Moving</option>
          <option value="High">High</option>
          <option value="Normal">Normal</option>
        </select>
        <button className="btn ghost" style={{ fontSize: 11 }} onClick={load}><i className="ti ti-refresh" />Atualizar</button>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)" }}>
          {conn === "ok" ? `${items.length} headlines · ${sourcesLive.length} fontes` : ""}{fetchedAt ? ` · ${fetchedAt.slice(11, 16)}Z` : ""}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, alignContent: "start" }}>
        {conn === "loading" && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 6 }} />)}
        {conn === "error" && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48, color: "var(--tx3)", fontSize: 12 }}>Backend offline — suba a API na porta 8080.</div>}
        {conn === "ok" && items.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48, color: "var(--tx3)", fontSize: 11 }}>Nenhuma manchete com esses filtros.</div>
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
                  {h.tags.map((t) => (
                    <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 10, background: "rgba(201,160,44,0.08)", border: "1px solid rgba(201,160,44,0.15)", color: "var(--gold)", padding: "2px 6px", borderRadius: 3 }}>{t}</span>
                  ))}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

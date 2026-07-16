"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchSocialTrending, IMPACT_COLOR, SENTIMENT_COLOR, type SocialPost } from "@/lib/feeds";
import { publishScreenData } from "@/lib/jim-data";

export default function SocialRadar() {
  const [all, setAll] = useState<SocialPost[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [offline, setOffline] = useState(false);
  const [impact, setImpact] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [activeId, setActiveId] = useState<number | null>(null);

  function load() {
    setConn("loading");
    fetchSocialTrending()
      .then((d) => {
        setAll(d.posts || []);
        setOffline(!!d.offline);
        setConn("ok");
      })
      .catch(() => setConn("error"));
  }
  useEffect(load, []);

  useEffect(() => {
    if (!all || all.length === 0) return;
    const bullish = all.filter((p) => p.sentiment === "Bullish").length;
    const bearish = all.filter((p) => p.sentiment === "Bearish").length;
    const neutral = all.filter((p) => p.sentiment === "Neutral").length;
    publishScreenData("social-radar", `${all.length} posts · bullish:${bullish} bearish:${bearish} neutral:${neutral}`, all, {
      briefing: `Social Radar with ${all.length} posts from StockTwits. Sentiment: ${bullish} bullish, ${bearish} bearish, ${neutral} neutral.`,
    });
  }, [all]);

  const posts = useMemo(() => all.filter((p) => {
    if (impact !== "all" && p.impact !== impact) return false;
    if (sentiment !== "all" && p.sentiment !== sentiment) return false;
    return true;
  }), [all, impact, sentiment]);

  const active = activeId != null ? all.find((p) => p.id === activeId) ?? null : null;

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column" }}>
      <div className="crumb">Intelligence › <b>Social Radar</b></div>
      <div className="h1">Social Media Radar</div>
      <div className="sub">StockTwits live · cashtags · sentiment as declared by the author.</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0", alignItems: "center" }}>
        <span className="flabel" style={{ marginRight: 4 }}>Filter:</span>
        <select className="fsel" value={impact} onChange={(e) => setImpact(e.target.value)}>
          <option value="all">All Reach</option>
          <option value="High">High (20k+ followers)</option>
          <option value="Medium">Medium (3k+)</option>
          <option value="Low">Low</option>
        </select>
        <select className="fsel" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="all">All Sentiment</option>
          <option value="Bullish">Bullish</option>
          <option value="Bearish">Bearish</option>
          <option value="Neutral">Neutral</option>
        </select>
        <button className="btn ghost" style={{ fontSize: 11 }} onClick={load}><i className="ti ti-refresh" />Refresh</button>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)" }}>
          {conn === "ok" ? `${posts.length} posts` : ""}
        </span>
      </div>

      {offline && (
        <div style={{ padding: "8px 12px", marginBottom: 8, fontSize: 11, color: "var(--orange)", background: "rgba(243,156,18,.08)", border: "1px solid rgba(243,156,18,.2)", borderRadius: 5 }}>
          StockTwits unavailable right now — empty feed (no fabricated data).
        </div>
      )}

      <div className="sr-body">
        <div className={`sr-feed-col${active ? " has-panel" : ""}`}>
          <div style={{ display: "grid", gridTemplateColumns: active ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 8, alignContent: "start" }}>
            {conn === "loading" && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 6 }} />)}
            {conn === "error" && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48, color: "var(--tx3)", fontSize: 11 }}>Backend offline — start the API on port 8080.</div>}
            {conn === "ok" && posts.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 48, color: "var(--tx3)", fontSize: 11 }}>No posts match these filters.</div>
            )}
            {conn === "ok" && posts.map((p) => (
              <SocialCard key={p.id} p={p} selected={activeId === p.id} onClick={() => setActiveId(p.id)} />
            ))}
          </div>
        </div>
        <div className={`sr-intel-panel${active ? " open" : ""}`}>
          {active && <IntelPanel p={active} onClose={() => setActiveId(null)} />}
        </div>
      </div>
    </div>
  );
}

function SocialCard({ p, selected, onClick }: { p: SocialPost; selected: boolean; onClick: () => void }) {
  const ic = IMPACT_COLOR[p.impact] || "rgba(255,255,255,0.3)";
  const sc = SENTIMENT_COLOR[p.sentiment] || "rgba(255,255,255,0.4)";
  const reach = Math.min(100, Math.round((p.followers / 50000) * 100));
  return (
    <div
      className={`sr-card${selected ? " selected" : ""}`}
      onClick={onClick}
      style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderLeft: `3px solid ${ic}`, borderRadius: 6, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 7 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, background: "#00A99D", color: "#000", padding: "3px 7px", borderRadius: 3, minWidth: 22, textAlign: "center" }}>ST</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--tx2)" }}>{p.author}</span>
        {p.verified && <i className="ti ti-rosette-discount-check-filled" style={{ color: "var(--blue)", fontSize: 13 }} />}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)" }}>{p.handle}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: ic }}>{p.impact.toUpperCase()}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: sc }}>{p.sentiment}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)" }}>{p.ts}</span>
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tx)", lineHeight: 1.45 }}>{p.body}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {(p.symbols || []).slice(0, 5).map((t) => (
          <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 11, background: "rgba(201,160,44,0.08)", border: "1px solid rgba(201,160,44,0.15)", color: "var(--gold)", padding: "2px 7px", borderRadius: 3 }}>${t}</span>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)" }}>REACH</span>
          <div style={{ width: 52, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${reach}%`, height: "100%", background: "var(--gold)", borderRadius: 2, opacity: 0.8 }} />
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)" }}>{(p.followers / 1000).toFixed(1)}k</span>
        </span>
      </div>
    </div>
  );
}

function IntelPanel({ p, onClose }: { p: SocialPost; onClose: () => void }) {
  const ic = IMPACT_COLOR[p.impact] || "rgba(255,255,255,0.3)";
  const sc = SENTIMENT_COLOR[p.sentiment] || "rgba(255,255,255,0.4)";

  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onClose} className="sr-action-secondary" style={{ width: "auto", padding: "5px 10px", fontSize: 9 }}>← Feed</button>
        <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: ".10em", color: "var(--tx3)" }}>INTELLIGENCE LAYER</span>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--tx3)", fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}><i className="ti ti-x" /></button>
      </div>

      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", color: "var(--tx3)", marginBottom: 6 }}>Source</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, background: "#00A99D", color: "#000", padding: "3px 8px", borderRadius: 3 }}>ST</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--tx)" }}>{p.author}</span>
          {p.verified && <i className="ti ti-rosette-discount-check-filled" style={{ color: "var(--blue)", fontSize: 15 }} />}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx3)", marginTop: 3 }}>{p.handle} · {(p.followers / 1000).toFixed(1)}k followers · {p.ts}</div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)", borderRadius: 5, padding: "10px 12px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", color: "var(--tx3)", marginBottom: 6 }}>Original post</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tx)", lineHeight: 1.5 }}>{p.body}</div>
      </div>

      {(p.symbols?.length ?? 0) > 0 && (
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase", color: "var(--tx3)", marginBottom: 6 }}>Assets mentioned</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {p.symbols.map((t) => (
              <span key={t} style={{ fontFamily: "var(--mono)", fontSize: 12, background: "rgba(201,160,44,0.08)", border: "1px solid rgba(201,160,44,0.15)", color: "var(--gold)", padding: "3px 9px", borderRadius: 3 }}>${t}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "rgba(201,160,44,0.04)", border: "1px solid rgba(201,160,44,0.12)", borderRadius: 5, padding: "10px 12px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 8 }}>HARPIAN Intelligence Calibration</div>
        <div className="sr-calib-row"><span className="sr-calib-k">Sentiment (author)</span><span className="sr-calib-v" style={{ color: sc }}>{p.sentiment}</span></div>
        <div className="sr-calib-row"><span className="sr-calib-k">Reach</span><span className="sr-calib-v" style={{ color: ic }}>{p.impact} · {(p.followers / 1000).toFixed(1)}k</span></div>
        <div className="sr-calib-row"><span className="sr-calib-k">Verified</span><span className="sr-calib-v">{p.verified ? "Yes" : "No"}</span></div>
        <div className="sr-calib-row"><span className="sr-calib-k">Platform</span><span className="sr-calib-v">StockTwits</span></div>
      </div>

      <a href={p.url} target="_blank" rel="noopener noreferrer" className="sr-action-secondary" style={{ textAlign: "center", textDecoration: "none", display: "block", padding: "8px" }}>
        View original post ↗
      </a>
    </div>
  );
}

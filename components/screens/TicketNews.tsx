"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { fetchNewsTicker, IMPACT_COLOR, type NewsHeadline } from "@/lib/feeds";
import { publishScreenData } from "@/lib/jim-data";
import type { ScreenId } from "@/lib/nav";

interface Ticket {
  ticker: string; side: "buy" | "sell"; tipo: string;
  portfolio_id: string; motivo: string; quantidade: number;
  valor_usd: number; status: string;
}

interface JimVerdict {
  impacto: string;
  resumo: string;
  loading: boolean;
}

interface TickerNewsBlock {
  ticker: string;
  tickets: Ticket[];
  headlines: NewsHeadline[];
  loading: boolean;
  error: boolean;
  jim?: JimVerdict;
}

const SIDE_LABEL: Record<string, string> = { buy: "BUY", sell: "SELL" };
const SIDE_CLS: Record<string, string> = { buy: "g", sell: "r" };
const TIPO_ICON: Record<string, string> = {
  ENTRADA: "ti-arrow-right",
  AUMENTO: "ti-arrow-up",
  REDUÇÃO: "ti-arrow-down",
  SAÍDA: "ti-arrow-bar-right",
  TROCA: "ti-switch-horizontal",
};

function timeAgo(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function TicketNews({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [blocks, setBlocks] = useState<TickerNewsBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const resp = await apiGet<{ tickets: Ticket[] }>("/v1/tickets");
        const tickets = resp.tickets || [];
        setTicketCount(tickets.length);

        const byTicker: Record<string, Ticket[]> = {};
        for (const t of tickets) {
          (byTicker[t.ticker] ||= []).push(t);
        }

        const tickers = Object.keys(byTicker);
        const initial: TickerNewsBlock[] = tickers.map((tk) => ({
          ticker: tk,
          tickets: byTicker[tk],
          headlines: [],
          loading: true,
          error: false,
          jim: { impacto: "", resumo: "", loading: true },
        }));
        setBlocks(initial);
        setLoading(false);

        for (const tk of tickers) {
          try {
            const news = await fetchNewsTicker(tk, 7);
            const headlines = news.headlines || [];
            setBlocks((prev) =>
              prev.map((b) =>
                b.ticker === tk ? { ...b, headlines, loading: false } : b
              )
            );

            if (headlines.length > 0) {
              const t0 = byTicker[tk][0];
              apiPost<{ impacto: string; resumo: string }>("/v1/jim/ticket-impact", {
                ticker: tk,
                action: t0.tipo,
                side: t0.side,
                headlines: headlines.map((h) => h.headline),
              })
                .then((r) =>
                  setBlocks((prev) =>
                    prev.map((b) =>
                      b.ticker === tk
                        ? { ...b, jim: { impacto: r.impacto, resumo: r.resumo, loading: false } }
                        : b
                    )
                  )
                )
                .catch(() =>
                  setBlocks((prev) =>
                    prev.map((b) =>
                      b.ticker === tk
                        ? { ...b, jim: { impacto: "", resumo: "", loading: false } }
                        : b
                    )
                  )
                );
            } else {
              setBlocks((prev) =>
                prev.map((b) =>
                  b.ticker === tk
                    ? { ...b, jim: { impacto: "NO RELEVANT INFLUENCE", resumo: "No recent news.", loading: false } }
                    : b
                )
              );
            }
          } catch {
            setBlocks((prev) =>
              prev.map((b) =>
                b.ticker === tk
                  ? { ...b, loading: false, error: true, jim: { impacto: "", resumo: "", loading: false } }
                  : b
              )
            );
          }
        }
      } catch {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading || blocks.length === 0) return;
    const totalHeadlines = blocks.reduce((s, b) => s + b.headlines.length, 0);
    const comImpacto = blocks.filter((b) => b.jim?.impacto === "PODE TER IMPACTO").length;
    publishScreenData(
      "ticket-news",
      `${blocks.length} assets, ${totalHeadlines} news items, ${comImpacto} with potential impact`,
      blocks.map((b) => ({
        ticker: b.ticker,
        action: b.tickets.map((t) => t.tipo).join(", "),
        n_headlines: b.headlines.length,
        jim_impacto: b.jim?.impacto,
        jim_resumo: b.jim?.resumo,
      })),
      {
        briefing: `Ticket News: ${blocks.length} assets in today's tickets. ${comImpacto > 0 ? `ATTENTION: ${comImpacto} asset(s) flagged as MAY HAVE IMPACT.` : "No relevant impact identified."} ${blocks.filter((b) => b.jim?.impacto).map((b) => `${b.ticker}: ${b.jim?.impacto} — ${b.jim?.resumo}`).join("; ")}`,
      }
    );
  }, [blocks, loading]);

  return (
    <div className="screen">
      <div className="flex between mb">
        <div>
          <div className="h1">Ticket News</div>
          <div className="sub">
            News from the last 7 days for each asset in the tickets. JIM analyzes impact per order.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="tag b" style={{ fontSize: 10 }}>
            {ticketCount} ticket{ticketCount !== 1 ? "s" : ""} · {blocks.length} asset{blocks.length !== 1 ? "s" : ""}
          </span>
          <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => go("ticket")}>
            <i className="ti ti-ticket" style={{ fontSize: 13 }} /> View tickets
          </button>
        </div>
      </div>

      {loading && (
        <div className="ph mb" style={{ textAlign: "center", padding: 40 }}>
          Loading today's tickets…
        </div>
      )}

      {!loading && blocks.length === 0 && (
        <div className="ph mb" style={{ textAlign: "center", padding: 40 }}>
          <b>No tickets today</b>
          <div style={{ fontSize: 12, color: "var(--tx3)", marginTop: 8 }}>
            When there are pending tickets, news for each asset will appear here automatically.
          </div>
        </div>
      )}

      {blocks.map((b) => (
        <div key={b.ticker} className="card mb" style={{ padding: 0, overflow: "hidden" }}>
          {/* ticker header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              background: "rgba(201,160,44,.04)",
            }}
          >
            <span
              className="tk-link"
              onClick={() => go("chart", b.ticker)}
              style={{ fontSize: 18, fontWeight: 800 }}
            >
              {b.ticker}
            </span>

            {b.tickets.map((t, i) => (
              <span
                key={i}
                className={`tag ${SIDE_CLS[t.side] || "b"}`}
                style={{ fontSize: 9, fontWeight: 700 }}
              >
                <i className={TIPO_ICON[t.tipo] || "ti-arrow-right"} style={{ fontSize: 11 }} />{" "}
                {t.tipo} · {SIDE_LABEL[t.side] || t.side} · ${t.valor_usd.toLocaleString("en-US")}
              </span>
            ))}

            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>
              {b.loading
                ? "searching for news…"
                : b.error
                  ? "search failed"
                  : `${b.headlines.length} headline${b.headlines.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* JIM verdict */}
          {!b.loading && !b.error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                background: b.jim?.loading
                  ? "rgba(201,160,44,.02)"
                  : b.jim?.impacto === "PODE TER IMPACTO"
                    ? "rgba(231,76,60,.06)"
                    : "rgba(46,204,113,.04)",
              }}
            >
              <i
                className="ti ti-robot"
                style={{
                  fontSize: 16,
                  color: b.jim?.impacto === "PODE TER IMPACTO" ? "var(--red-text)" : "var(--green)",
                }}
              />
              {b.jim?.loading ? (
                <span style={{ fontSize: 11, color: "var(--tx3)", fontStyle: "italic" }}>
                  JIM analyzing impact for {b.ticker}…
                </span>
              ) : b.jim?.impacto ? (
                <>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background:
                        b.jim?.impacto === "PODE TER IMPACTO"
                          ? "rgba(231,76,60,.12)"
                          : "rgba(46,204,113,.10)",
                      color:
                        b.jim?.impacto === "PODE TER IMPACTO" ? "#E74C3C" : "#2ECC71",
                      letterSpacing: 0.5,
                    }}
                  >
                    {b.jim?.impacto}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--tx2)", flex: 1 }}>
                    {b.jim?.resumo}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "var(--tx3)" }}>
                  Analysis unavailable
                </span>
              )}
            </div>
          )}

          {/* headlines */}
          <div style={{ padding: "8px 16px 12px" }}>
            {b.loading && (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--tx3)" }}>
                Fetching news for {b.ticker}…
              </div>
            )}

            {b.error && (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--red-text)" }}>
                Could not fetch news for {b.ticker}
              </div>
            )}

            {!b.loading && !b.error && b.headlines.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--tx3)" }}>
                No recent news found for {b.ticker}
              </div>
            )}

            {b.headlines.map((h) => (
              <a
                key={h.id}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 4px",
                  borderBottom: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: IMPACT_COLOR[h.impact] + "18",
                    color: IMPACT_COLOR[h.impact],
                    whiteSpace: "nowrap",
                    marginTop: 2,
                    minWidth: 50,
                    textAlign: "center",
                  }}
                >
                  {h.impact === "Market Moving" ? "MKT MOV" : h.impact.toUpperCase()}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: h.impact === "Market Moving" ? 700 : 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {h.headline}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 2 }}>
                    {h.source_label} · {timeAgo(h.ts)}
                    {h.tags.length > 0 && (
                      <span style={{ marginLeft: 8 }}>
                        {h.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              background: "var(--bg2)",
                              padding: "1px 5px",
                              borderRadius: 3,
                              fontSize: 9,
                              marginRight: 4,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className="foot">
        Ticket News · v2 · Yahoo Finance RSS (7 days) + JIM Haiku (impact analysis per order).
      </div>
    </div>
  );
}

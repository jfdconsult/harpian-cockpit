"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { HC_US_TOTAL_UNIVERSE } from "@/lib/universe";
import { publishScreenData } from "@/lib/jim-data";

interface EconEvent {
  date: string;
  time_et: string | null;
  country: string | null;
  event: string | null;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  description: string | null;
  source_url: string | null;
}

interface EarnRow {
  date: string;
  time: string | null;
  symbol: string;
  name: string | null;
  market_cap: string | null;
  fiscal_quarter_ending: string | null;
  eps_forecast: string | null;
  num_estimates: string | null;
  last_year_report_date: string | null;
  last_year_eps: string | null;
  // Merged in from Yahoo by the backend on /v1/calendar/earnings:
  eps_reported: string | number | null;
  surprise_pct: string | number | null;
  source_url: string | null;
}

function fmtSurprise(v: string | number | null): { text: string; color: string } {
  if (v == null || v === "") return { text: "—", color: "var(--tx3)" };
  const n = typeof v === "number" ? v : Number(String(v).replace(/[+%]/g, ""));
  if (Number.isNaN(n)) return { text: String(v), color: "var(--tx3)" };
  const sign = n > 0 ? "+" : "";
  const color = n > 0 ? "var(--green)" : n < 0 ? "var(--red)" : "var(--tx3)";
  return { text: `${sign}${n.toFixed(2)}%`, color };
}

type Tab = "economic" | "earnings";
type When = "upcoming" | "latest";

const TIME_LABEL: Record<string, string> = {
  "time-pre-market": "Pre-market",
  "time-after-hours": "After hours",
  "time-not-supplied": "TBD",
};

const HIGH_IMPACT_KEYWORDS = [
  "cpi", "consumer price", "nonfarm", "payroll", "fomc",
  "fed funds", "gdp", "ppi", "retail sales", "core pce", "pce price",
  "unemployment", "ism", "adp", "jobless claims", "michigan sentiment",
  "housing starts", "durable goods", "personal income", "personal spending",
];

function isHighImpactUS(country: string | null, event: string | null): boolean {
  const c = (country || "").toLowerCase();
  const n = (event || "").toLowerCase();
  if (!c.includes("united states") && c !== "us") return false;
  return HIGH_IMPACT_KEYWORDS.some((k) => n.includes(k));
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(t: string | null): string {
  return !t ? "—" : TIME_LABEL[t] || t;
}

function isoOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size) as T[]);
  return out;
}

function openSource(url: string | null) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function Calendar() {
  const [tab, setTab] = useState<Tab>("economic");
  const [when, setWhen] = useState<When>("upcoming");
  const [days, setDays] = useState<number>(7);

  // Economic
  const [econ, setEcon] = useState<EconEvent[]>([]);
  const [econLoading, setEconLoading] = useState(true);
  const [econError, setEconError] = useState<string | null>(null);

  // Earnings — universe-wide, filtered to HC-US TOTAL
  const [earn, setEarn] = useState<EarnRow[]>([]);
  const [earnLoading, setEarnLoading] = useState(true);
  const [earnError, setEarnError] = useState<string | null>(null);
  const [tickerFilter, setTickerFilter] = useState<string>("");

  // Load economic (upcoming iterates day-by-day; latest hits /economic/latest)
  useEffect(() => {
    if (tab !== "economic") return;
    setEconLoading(true);
    setEconError(null);

    if (when === "latest") {
      apiGet<{ ok: boolean; events?: EconEvent[]; error?: string }>(
        `/v1/calendar/economic/latest?days=${days}`
      )
        .then((d) => setEcon(d.ok ? d.events || [] : []))
        .catch((e) => setEconError(String(e)))
        .finally(() => setEconLoading(false));
      return;
    }

    const dates = Array.from({ length: days }, (_, i) => isoOffset(i));
    Promise.all(
      dates.map((iso) =>
        apiGet<{ ok: boolean; events?: EconEvent[] }>(`/v1/calendar/economic?date=${iso}`)
          .then((d) => (d.ok ? d.events || [] : []))
          .catch(() => [] as EconEvent[])
      )
    )
      .then((groups) => setEcon(groups.flat()))
      .catch((e) => setEconError(String(e)))
      .finally(() => setEconLoading(false));
  }, [tab, when, days]);

  // Load earnings for the whole HC-US TOTAL universe, chunked
  useEffect(() => {
    if (tab !== "earnings") return;
    setEarnLoading(true);
    setEarnError(null);
    const window = Math.max(days, 30);
    const chunks = chunk(HC_US_TOTAL_UNIVERSE, 100);
    const endpoint = when === "upcoming" ? "upcoming" : "recent";
    const payloadKey = when === "upcoming" ? "upcoming" : "recent";
    Promise.all(
      chunks.map((batch) =>
        apiGet<Record<string, unknown>>(
          `/v1/calendar/earnings/${endpoint}?days=${window}&tickers=${encodeURIComponent(batch.join(","))}`
        )
          .then((d) => (d.ok ? ((d[payloadKey] as EarnRow[]) || []) : []))
          .catch(() => [] as EarnRow[])
      )
    )
      .then((groups) => {
        const flat = groups.flat();
        flat.sort((a, b) =>
          when === "upcoming"
            ? a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol)
            : b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol)
        );
        setEarn(flat);
      })
      .catch((e) => setEarnError(String(e)))
      .finally(() => setEarnLoading(false));
  }, [tab, when, days]);

  const econFiltered = useMemo(
    () => econ.filter((e) => isHighImpactUS(e.country, e.event)),
    [econ]
  );

  const earnFiltered = useMemo(() => {
    const q = tickerFilter.trim().toUpperCase();
    if (!q) return earn;
    return earn.filter((r) => r.symbol.includes(q) || (r.name || "").toUpperCase().includes(q));
  }, [earn, tickerFilter]);

  useEffect(() => {
    const label = when === "upcoming" ? "Upcoming" : "Latest";
    const summary =
      tab === "economic"
        ? `Economic · ${label} · ${econFiltered.length} high-impact US events over the window (${days} days).`
        : `Earnings · ${label} · ${earnFiltered.length} of ${earn.length} from the HC-US TOTAL universe (${HC_US_TOTAL_UNIVERSE.length} tickers, ${Math.max(days, 30)}-day window).`;
    publishScreenData("calendar", summary,
      tab === "economic" ? econFiltered.slice(0, 30) : earnFiltered.slice(0, 30),
      {
        briefing: summary,
        suggestions: [
          "Highest-impact release in the coming week?",
          "Which universe names report earnings in the next 5 days?",
          "Which names just missed consensus by more than 10%?",
        ],
      });
  }, [tab, when, econFiltered, earnFiltered, earn.length, days]);

  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">Calendar</div>
          <div className="sub">
            High-impact US macro + earnings for the HC-US TOTAL universe ({HC_US_TOTAL_UNIVERSE.length} tickers). Click any row to open Nasdaq for the full write-up.
          </div>
        </div>
        <div className="flex" style={{ gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            When
            <select className="input" value={when} onChange={(e) => setWhen(e.target.value as When)}>
              <option value="upcoming">Upcoming</option>
              <option value="latest">Latest</option>
            </select>
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            Window
            <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={3}>{when === "upcoming" ? "Next 3 days" : "Last 3 days"}</option>
              <option value={7}>{when === "upcoming" ? "Next 7 days" : "Last 7 days"}</option>
              <option value={14}>{when === "upcoming" ? "Next 14 days" : "Last 14 days"}</option>
              <option value={30}>{when === "upcoming" ? "Next 30 days" : "Last 30 days"}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex" style={{ gap: 6, marginBottom: 12 }}>
        <button className={`btn ${tab === "economic" ? "" : "ghost"}`} onClick={() => setTab("economic")}>
          <i className="ti ti-calendar-event" /> Economic
        </button>
        <button className={`btn ${tab === "earnings" ? "" : "ghost"}`} onClick={() => setTab("earnings")}>
          <i className="ti ti-report-money" /> Earnings · universe
        </button>
      </div>

      {tab === "economic" && (
        <div className="card">
          <div className="flex between" style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              {when === "upcoming"
                ? "Upcoming CPI · NFP · FOMC · GDP · PCE · Retail Sales · Jobless Claims · ISM · ADP"
                : "Most recent US releases already published (with the actual print)"}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{econFiltered.length} events</div>
          </div>
          {econLoading ? (
            <div className="muted" style={{ padding: 24, textAlign: "center" }}>Loading…</div>
          ) : econError ? (
            <div className="ph"><b>Economic feed unavailable</b><div className="muted">{econError}</div></div>
          ) : econFiltered.length === 0 ? (
            <div className="ph"><b>No high-impact US events in this window</b><div className="muted">Try widening it.</div></div>
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Event</th><th className="num">Consensus</th><th className="num">Previous</th><th className="num">Actual</th><th></th></tr></thead>
              <tbody>
                {econFiltered.map((e, i) => (
                  <tr key={`${e.date}-${i}`} onClick={() => openSource(e.source_url)} style={{ cursor: e.source_url ? "pointer" : "default" }} title={e.source_url ? "Open on Nasdaq" : undefined}>
                    <td>{fmtDate(e.date)}</td>
                    <td>{e.time_et || "—"}</td>
                    <td>{e.event}</td>
                    <td className="num">{e.consensus || "—"}</td>
                    <td className="num muted">{e.previous || "—"}</td>
                    <td className="num" style={{ color: e.actual ? "var(--green)" : "var(--tx3)" }}>{e.actual || "—"}</td>
                    <td className="muted">{e.source_url && <i className="ti ti-external-link" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "earnings" && (
        <div className="card">
          <div className="flex between" style={{ marginBottom: 10 }}>
            <input
              className="input"
              placeholder="Filter by ticker or company…"
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              style={{ maxWidth: 260 }}
            />
            <div className="muted" style={{ fontSize: 11 }}>{earnFiltered.length} of {earn.length} {when === "upcoming" ? "scheduled" : "reported"}</div>
          </div>
          {earnLoading ? (
            <div className="muted" style={{ padding: 24, textAlign: "center" }}>Loading earnings for {HC_US_TOTAL_UNIVERSE.length} tickers…</div>
          ) : earnError ? (
            <div className="ph"><b>Earnings feed unavailable</b><div className="muted">{earnError}</div></div>
          ) : earnFiltered.length === 0 ? (
            <div className="ph"><b>No matches</b><div className="muted">No earnings {when === "upcoming" ? "scheduled" : "reported"} in this window for the current filter.</div></div>
          ) : (
            <table>
              <thead><tr>
                <th>Date</th><th>Time</th><th>Ticker</th><th>Company</th><th className="num">EPS consensus</th>
                {when === "latest" ? (<><th className="num">EPS reported</th><th className="num">Surprise</th></>) : (<><th>Fiscal quarter</th><th className="num">Last year EPS</th></>)}
                <th></th>
              </tr></thead>
              <tbody>
                {earnFiltered.map((r) => {
                  const surp = fmtSurprise(r.surprise_pct);
                  return (
                    <tr key={`${r.date}-${r.symbol}`} onClick={() => openSource(r.source_url)} style={{ cursor: r.source_url ? "pointer" : "default" }} title={r.source_url ? `Open ${r.symbol}` : undefined}>
                      <td style={{ color: "var(--gold)", fontWeight: 600 }}>{fmtDate(r.date)}</td>
                      <td>{fmtTime(r.time)}</td>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{r.symbol}</td>
                      <td className="muted">{r.name || "—"}</td>
                      <td className="num">{r.eps_forecast || "—"}</td>
                      {when === "latest" ? (
                        <>
                          <td className="num" style={{ color: r.eps_reported != null ? "var(--tx)" : "var(--tx3)" }}>{r.eps_reported ?? "—"}</td>
                          <td className="num" style={{ color: surp.color, fontWeight: 600 }}>{surp.text}</td>
                        </>
                      ) : (
                        <>
                          <td>{r.fiscal_quarter_ending || "—"}</td>
                          <td className="num muted">{r.last_year_eps || "—"}</td>
                        </>
                      )}
                      <td className="muted">{r.source_url && <i className="ti ti-external-link" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

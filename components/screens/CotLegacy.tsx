"use client";
import { useEffect, useState } from "react";
import { GOV_API, fmtN } from "@/lib/data";
import { publishScreenData } from "@/lib/jim-data";

interface CotRow {
  date?: string;
  market?: string;
  spec_long: number;
  spec_short: number;
  spec_net?: number;
  comm_long: number;
  comm_short: number;
  comm_net?: number;
  open_interest: number;
  spec_net_pct_oi?: number;
  comm_net_pct_oi?: number;
}

const SHORT_NAME: Record<string, string> = {
  "S&P 500 CONSOLIDATED": "S&P 500",
  "E-MINI S&P 500": "E-Mini S&P",
  "NASDAQ-100 CONSOLIDATED": "NASDAQ 100",
  "GOLD - COMMODITY EXCHANGE INC.": "Gold",
  "SILVER - COMMODITY EXCHANGE INC.": "Silver",
  "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE": "Crude Oil WTI",
  "NATURAL GAS - NEW YORK MERCANTILE EXCHANGE": "Natural Gas",
  "U.S. TREASURY BONDS - CHICAGO BOARD OF TRADE": "US T-Bonds",
  "10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE": "10Y Treasury",
  "2-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE": "2Y Treasury",
  "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE": "Yen (JPY)",
  "EURO FX - CHICAGO MERCANTILE EXCHANGE": "Euro (EUR)",
  "BITCOIN - CHICAGO MERCANTILE EXCHANGE": "Bitcoin",
  "VIX FUTURES - CBOE FUTURES EXCHANGE": "VIX",
  "COPPER-GRADE #1 - COMMODITY EXCHANGE INC.": "Copper",
};

function shortName(m: string): string {
  return SHORT_NAME[m] || m.split(" - ")[0].substring(0, 25);
}

const WEEKS_OPTIONS = [
  { k: 4, l: "4 semanas" },
  { k: 12, l: "12 semanas" },
  { k: 26, l: "6 meses" },
  { k: 52, l: "1 ano" },
];

const DEMO_ROWS: CotRow[] = [
  { date: "2026-06-24", market: "S&P 500 CONSOLIDATED", spec_long: 312000, spec_short: 170000, spec_net: 142000, comm_long: 180000, comm_short: 308000, comm_net: -128000, open_interest: 2800000, spec_net_pct_oi: 5.1, comm_net_pct_oi: -4.6 },
  { date: "2026-06-24", market: "GOLD - COMMODITY EXCHANGE INC.", spec_long: 298000, spec_short: 80000, spec_net: 218000, comm_long: 120000, comm_short: 365000, comm_net: -245000, open_interest: 520000, spec_net_pct_oi: 41.9, comm_net_pct_oi: -47.1 },
  { date: "2026-06-24", market: "10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE", spec_long: 680000, spec_short: 1100000, spec_net: -420000, comm_long: 890000, comm_short: 510000, comm_net: 380000, open_interest: 4200000, spec_net_pct_oi: -10.0, comm_net_pct_oi: 9.0 },
  { date: "2026-06-17", market: "S&P 500 CONSOLIDATED", spec_long: 295000, spec_short: 171200, spec_net: 123800, comm_long: 184000, comm_short: 306000, comm_net: -122000, open_interest: 2780000, spec_net_pct_oi: 4.5, comm_net_pct_oi: -4.4 },
  { date: "2026-06-17", market: "GOLD - COMMODITY EXCHANGE INC.", spec_long: 304000, spec_short: 77600, spec_net: 226400, comm_long: 118000, comm_short: 370000, comm_net: -252000, open_interest: 518000, spec_net_pct_oi: 43.7, comm_net_pct_oi: -48.6 },
  { date: "2026-06-17", market: "10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE", spec_long: 670000, spec_short: 1059000, spec_net: -389000, comm_long: 875000, comm_short: 520000, comm_net: 355000, open_interest: 4150000, spec_net_pct_oi: -9.4, comm_net_pct_oi: 8.6 },
];

export default function CotLegacy() {
  const [data, setData] = useState<CotRow[]>([]);
  const [offline, setOffline] = useState(false);
  const [weeks, setWeeks] = useState(12);
  const [marketFilter, setMarketFilter] = useState("");

  useEffect(() => {
    fetch(`${GOV_API}/api/cot/legacy?weeks=${weeks}`)
      .then((r) => r.json())
      .then((d: CotRow[]) => { setData(Array.isArray(d) ? d : DEMO_ROWS); setOffline(!Array.isArray(d)); })
      .catch(() => { setData(DEMO_ROWS); setOffline(true); });
  }, [weeks]);

  const markets = [...new Set(data.map((r) => r.market || ""))].filter(Boolean).sort();
  const filtered = marketFilter ? data.filter((r) => r.market === marketFilter) : data;

  useEffect(() => {
    if (filtered.length === 0) return;
    publishScreenData(
      "cot-legacy",
      `Dados brutos CFTC Legacy (janela ${weeks} semanas${marketFilter ? `, mercado ${shortName(marketFilter)}` : ", todos os mercados"}). Cada linha = data, mercado, Spec Net, Comm Net (e % do Open Interest), longs/shorts por grupo e Open Interest.`,
      filtered.slice(0, 60).map((x) => ({
        data: x.date, mercado: shortName(x.market || ""),
        specNet: x.spec_net ?? (x.spec_long - x.spec_short),
        commNet: x.comm_net ?? (x.comm_long - x.comm_short),
        openInterest: x.open_interest,
      })),
      {
        briefing:
          `Você está vendo os dados brutos CFTC de ${markets.length} mercados (${filtered.length} registros, janela ${weeks} semanas). ` +
          `Spec Net = posição líquida dos especuladores; Comm Net = dos hedgers.`,
        suggestions: [
          "Qual mercado mudou mais na semana?",
          "Como leio Spec Net vs Comm Net?",
          "O que o open interest indica aqui?",
        ],
      }
    );
  }, [filtered, weeks, marketFilter, markets.length]);

  return (
    <div className="screen">
      <div className="crumb">Intelligence › <b>COT Data Explorer</b></div>
      <div className="flex between wrap" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="h1">COT Data Explorer</div>
          <div className="sub">
            Dados brutos CFTC · posições Long/Short por grupo · Net e % do Open Interest.
            {offline && <span style={{ color: "var(--orange)", marginLeft: 8 }}> [demo — API offline]</span>}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex wrap mt" style={{ gap: 10, marginBottom: 10, alignItems: "center" }}>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}>
          <span className="flabel">Período:</span>
          <div className="seg" style={{ margin: 0 }}>
            {WEEKS_OPTIONS.map((w) => (
              <span key={w.k} className={weeks === w.k ? "on" : ""} onClick={() => setWeeks(w.k)}>{w.l}</span>
            ))}
          </div>
        </div>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}>
          <span className="flabel">Mercado:</span>
          <select className="fsel" value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", minWidth: 180 }}>
            <option value="">Todos os mercados ({markets.length})</option>
            {markets.map((m) => <option key={m} value={m}>{shortName(m)}</option>)}
          </select>
        </div>
        <span className="muted" style={{ fontSize: 10, marginLeft: "auto" }}>{filtered.length} registros</span>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ maxHeight: 600, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Mercado</th>
                <th className="num" style={{ color: "#4A90D9" }}>Spec Net</th>
                <th className="num" style={{ color: "#4A90D9", fontSize: 10 }}>% OI</th>
                <th className="num" style={{ color: "#C9A02C" }}>Comm Net</th>
                <th className="num" style={{ color: "#C9A02C", fontSize: 10 }}>% OI</th>
                <th className="num">Spec Long</th>
                <th className="num">Spec Short</th>
                <th className="num">Comm Long</th>
                <th className="num">Comm Short</th>
                <th className="num">Open Interest</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((x, i) => {
                const specNet = x.spec_net ?? (x.spec_long - x.spec_short);
                const commNet = x.comm_net ?? (x.comm_long - x.comm_short);
                const oi = x.open_interest || 1;
                const specPct = x.spec_net_pct_oi ?? Math.round((specNet / oi) * 1000) / 10;
                const commPct = x.comm_net_pct_oi ?? Math.round((commNet / oi) * 1000) / 10;

                return (
                  <tr key={i}>
                    <td style={{ color: "var(--tx3)", fontFamily: "var(--mono)", fontSize: 11 }}>{x.date || "—"}</td>
                    <td style={{ color: "var(--tx)", fontWeight: 600, fontSize: 12 }}>{shortName(x.market || "")}</td>
                    <td className="num" style={{ color: specNet >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{specNet >= 0 ? "+" : ""}{fmtN(specNet)}</td>
                    <td className="num" style={{ color: specNet >= 0 ? "var(--green)" : "var(--red)", fontSize: 10 }}>{specPct >= 0 ? "+" : ""}{specPct.toFixed(1)}%</td>
                    <td className="num" style={{ color: commNet >= 0 ? "#C9A02C" : "#E67E22", fontWeight: 600 }}>{commNet >= 0 ? "+" : ""}{fmtN(commNet)}</td>
                    <td className="num" style={{ color: commNet >= 0 ? "#C9A02C" : "#E67E22", fontSize: 10 }}>{commPct >= 0 ? "+" : ""}{commPct.toFixed(1)}%</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.spec_long)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.spec_short)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.comm_long)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.comm_short)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.open_interest)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="legend mt">
        <i><b style={{ background: "#4A90D9" }} />Especuladores (Non-Commercial)</i>
        <i><b style={{ background: "#C9A02C" }} />Comerciais (Commercial)</i>
        <span className="muted" style={{ marginLeft: "auto" }}>CFTC Legacy Futures · dados públicos</span>
      </div>
    </div>
  );
}

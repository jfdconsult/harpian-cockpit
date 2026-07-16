"use client";
import { useEffect, useMemo, useState } from "react";
import { GOV_API, fmtN, fmtUSD } from "@/lib/data";
import { publishScreenData } from "@/lib/jim-data";

interface InsiderOrder {
  issuer: string;
  ticker: string | null;
  owner: string;
  role: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  value_usd: number;
  date: string | null;
  accession: string;
}

export default function InsiderOrders() {
  const [orders, setOrders] = useState<InsiderOrder[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "offline">("loading");
  const [collectedAt, setCollectedAt] = useState<string>("");
  const [side, setSide] = useState("all");

  useEffect(() => {
    let live = true;
    fetch(`${GOV_API}/api/insider?limit=60`)
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((d: { orders: InsiderOrder[]; collected_at?: string }) => {
        if (!live) return;
        setOrders(d.orders || []);
        setCollectedAt(d.collected_at || "");
        setConn("ok");
      })
      .catch(() => live && setConn("offline"));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!orders.length) return;
    const buys = orders.filter((o) => o.side === "BUY").length;
    const sells = orders.filter((o) => o.side === "SELL").length;
    const dates = orders.map((o) => o.date).filter(Boolean).sort();
    const range = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "—";
    publishScreenData(
      "insider-orders",
      `${orders.length} orders · ${buys} buys · ${sells} sells · ${range}`,
      orders,
      { briefing: `SEC Form 4 with ${orders.length} insider orders. ${buys} buys and ${sells} sells in the period ${range}.` }
    );
  }, [orders]);

  const items = useMemo(
    () => orders.filter((o) => side === "all" || o.side === side),
    [orders, side]
  );

  return (
    <div className="screen">
      <div className="crumb">Intelligence › <b>Insider Orders</b></div>
      <div className="h1">Insider &amp; Executive Orders</div>
      <div className="sub">SEC Form 4 live · open-market buys/sells by executives and directors.</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0", alignItems: "center" }}>
        <span className="flabel">Type:</span>
        <select className="fsel" value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="all">All</option>
          <option value="BUY">Buys</option>
          <option value="SELL">Sells</option>
        </select>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)" }}>
          {conn === "ok" ? `${items.length} orders` : ""}{collectedAt ? ` · collected ${collectedAt.slice(0, 10)}` : ""}
        </span>
      </div>

      {conn === "offline" && (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--tx3)", fontSize: 12 }}>
          gov-data API offline (port 8877). Run <b style={{ color: "var(--gold)" }}>python run_pipeline.py --form4</b> and start the api_server.
        </div>
      )}

      {conn === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 34, borderRadius: 4 }} />)}
        </div>
      )}

      {conn === "ok" && (
        <div className="card">
          <div style={{ maxHeight: 600, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Insider</th><th>Role</th><th>Company</th><th>Ticker</th>
                  <th style={{ textAlign: "center" }}>Type</th><th className="num">Shares</th>
                  <th className="num">Price</th><th className="num">Value (USD)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--tx3)" }}>No orders match this filter.</td></tr>
                )}
                {items.map((x, i) => {
                  const tc = x.side === "BUY" ? "var(--green)" : "var(--red-text)";
                  return (
                    <tr key={x.accession + i}>
                      <td style={{ color: "var(--tx3)" }}>{x.date || "—"}</td>
                      <td style={{ fontWeight: 600, color: "var(--tx)" }}>{x.owner}</td>
                      <td style={{ color: "var(--tx2)" }}>{x.role}</td>
                      <td style={{ color: "var(--tx2)" }}>{x.issuer}</td>
                      <td style={{ fontWeight: 600, color: "var(--gold)" }}>{x.ticker || "—"}</td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: tc }}>{x.side === "BUY" ? "BUY" : "SELL"}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.shares)}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>${x.price?.toFixed(2) ?? "—"}</td>
                      <td className="num" style={{ color: tc, fontWeight: 600 }}>{fmtUSD(x.value_usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

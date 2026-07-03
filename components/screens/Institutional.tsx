"use client";
import { useEffect, useState } from "react";
import { GOV_API, fmtN, fmtUSD } from "@/lib/data";

interface Fund { short: string; name: string; style: string; cik?: string; }
interface Holding { issuer: string; title_of_class: string; cusip: string; value_x1000_usd: number; shares: number; put_call?: string; share_type?: string; }
interface FundData { num_holdings?: number; filing_date?: string; period?: string; all_holdings?: Holding[]; }

export default function Institutional() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<FundData | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch(`${GOV_API}/api/funds`)
      .then((r) => r.json())
      .then((d: Fund[]) => { setFunds(d); if (d.length) setSelected(d[0].short); })
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`${GOV_API}/api/fund/${selected}`)
      .then((r) => r.json())
      .then((d: FundData) => { setData(d); setOffline(false); })
      .catch(() => setOffline(true));
  }, [selected]);

  const holdings = data?.all_holdings || [];
  const totalVal = holdings.reduce((s, x) => s + (x.value_x1000_usd || 0), 0) * 1000;
  const fund = funds.find((f) => f.short === selected);
  const stats = [
    { v: fmtUSD(totalVal), l: "Total AUM (13F)" },
    { v: fmtN(data?.num_holdings || holdings.length), l: "Holdings" },
    { v: data?.filing_date || "—", l: "Filing Date" },
    { v: data?.period || "—", l: "Period" },
  ];

  return (
    <div className="screen">
      <div className="crumb">Intelligence › <b>13F Holdings</b></div>
      <div className="h1">Institutional Holdings</div>
      <div className="sub">SEC Form 13F · O que os maiores hedge funds estão comprando e vendendo.</div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "14px 0", flexWrap: "wrap" }}>
        <span className="flabel">Fundo:</span>
        <select className="fsel" style={{ fontSize: 12, padding: "6px 10px", minWidth: 240 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
          {offline && <option>API offline — rode: python api_server.py</option>}
          {funds.map((f) => (<option key={f.short} value={f.short}>{f.name} ({f.style})</option>))}
        </select>
        <span style={{ fontSize: 11, color: "var(--tx3)", marginLeft: "auto" }}>{fund ? `${fund.style}${fund.cik ? " · CIK " + fund.cik : ""}` : ""}</span>
      </div>

      {offline ? (
        <div className="placeholder">API gov-data offline. Rode <b>python api_server.py</b> (porta 8877) para ver os dados reais.</div>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            {stats.map((s, i) => (
              <div className="card" key={i} style={{ textAlign: "center", padding: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Top 10 Holdings</h3>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>#</th><th>Issuer</th><th>Class</th><th>CUSIP</th><th className="num">Value (USD)</th><th className="num">Shares</th><th style={{ textAlign: "center" }}>P/C</th></tr></thead>
                <tbody>
                  {holdings.slice(0, 10).map((x, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--tx3)" }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, color: "var(--tx)" }}>{x.issuer}</td>
                      <td style={{ color: "var(--tx2)" }}>{x.title_of_class}</td>
                      <td style={{ color: "var(--tx3)", fontSize: 10 }}>{x.cusip}</td>
                      <td className="num pos" style={{ fontWeight: 600 }}>{fmtUSD(x.value_x1000_usd * 1000)}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.shares)}</td>
                      <td style={{ textAlign: "center", color: x.put_call === "Put" ? "var(--red)" : x.put_call === "Call" ? "var(--green)" : "var(--tx3)" }}>{x.put_call || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>All Holdings ({holdings.length})</h3>
            <div style={{ maxHeight: 400, overflowY: "auto", overflowX: "auto" }}>
              <table>
                <thead><tr><th>#</th><th>Issuer</th><th>Class</th><th>CUSIP</th><th className="num">Value</th><th className="num">Shares</th><th style={{ textAlign: "center" }}>Type</th></tr></thead>
                <tbody>
                  {holdings.map((x, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--tx3)" }}>{i + 1}</td>
                      <td style={{ color: "var(--tx)" }}>{x.issuer}</td>
                      <td style={{ color: "var(--tx2)" }}>{x.title_of_class}</td>
                      <td style={{ color: "var(--tx3)", fontSize: 10 }}>{x.cusip}</td>
                      <td className="num pos">{fmtUSD(x.value_x1000_usd * 1000)}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{fmtN(x.shares)}</td>
                      <td style={{ textAlign: "center", color: "var(--tx3)" }}>{x.put_call || x.share_type || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

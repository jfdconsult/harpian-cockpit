"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import type { ScreenId } from "@/lib/nav";

interface Item {
  ticker: string; hqp_target: number; ibkr_fill: number; lynks_pos: number;
  delta: number; status: string; nota?: string;
}
interface Resumo { total: number; ok: number; parcial: number; pendente: number; total_delta: number }

function statusSem(s: string) { return s === "ok" ? "g" : s === "parcial" ? "a" : "r"; }
function statusLabel(s: string) { return s === "ok" ? "OK" : s === "parcial" ? "PARTIAL" : "PENDING"; }
function fmtNum(n: number | null | undefined) { return n == null ? "—" : Number(n).toLocaleString("en-US"); }

export default function Reconciliacao({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    apiGet<{ items: Item[]; resumo: Resumo }>("/v1/reconciliation/")
      .then((d) => { setItems(d.items || []); setResumo(d.resumo); setConn("ok"); })
      .catch(() => setConn("error"));
  }, []);

  useEffect(() => {
    if (!items.length && !resumo) return;
    const ok = resumo?.ok ?? 0;
    const parcial = resumo?.parcial ?? 0;
    const pendente = resumo?.pendente ?? 0;
    const totalDelta = resumo?.total_delta != null ? ` | total delta: ${resumo.total_delta}` : "";
    publishScreenData(
      "reconciliacao",
      `${items.length} positions | ${ok} OK, ${parcial} partial, ${pendente} pending${totalDelta}`,
      items,
      { briefing: `Reconciliation with ${items.length} positions: ${ok} OK, ${parcial} partial and ${pendente} pending action.` }
    );
  }, [items, resumo]);

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Reconciliation — HQP × IBKR × Lynks</div><div className="sub">Compares HQP target × IBKR execution × Lynks accounting</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "connecting…" : conn === "ok" ? "● API live" : "✕ API offline"}
        </div>
      </div>

      {conn === "error" ? (
        <div className="ph mb"><b>API did not respond</b>Start the API: <code>uvicorn app.main:app --port 8080</code></div>
      ) : resumo && (
        <div className="grid g4 mb">
          <div className="kpi"><div className="l">Total items</div><div className="v">{resumo.total}</div><div className="s">positions compared</div></div>
          <div className="kpi"><div className="l">OK</div><div className="v c-g">{resumo.ok}</div><div className="s">reconciled</div></div>
          <div className="kpi"><div className="l">Partial</div><div className="v c-a">{resumo.parcial}</div><div className="s">smaller difference</div></div>
          <div className="kpi"><div className="l">Pending</div><div className="v c-r">{resumo.pendente}</div><div className="s">action needed</div></div>
        </div>
      )}

      <div className="card mb">
        <h2><span>Positions</span><span className="tag b">{items.length} positions</span></h2>
        <table>
          <thead>
            <tr>
              <th>Ticker</th><th style={{ textAlign: "right" }}>HQP Target</th><th style={{ textAlign: "right" }}>IBKR Fill</th>
              <th style={{ textAlign: "right" }}>Lynks Position</th><th style={{ textAlign: "right" }}>Delta</th><th>Status</th><th>Note</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="c-mut2">No positions to reconcile</td></tr>
            ) : items.map((i) => (
              <tr key={i.ticker}>
                <td className="tk"><span className="tk-link" onClick={() => go("chart", i.ticker)}>{i.ticker}</span></td>
                <td style={{ textAlign: "right" }}>{fmtNum(i.hqp_target)}</td>
                <td style={{ textAlign: "right" }}>{fmtNum(i.ibkr_fill)}</td>
                <td style={{ textAlign: "right" }}>{fmtNum(i.lynks_pos)}</td>
                <td style={{ textAlign: "right" }} className={i.delta === 0 ? "c-g" : "c-r"}>{fmtNum(i.delta)}</td>
                <td><span className={`tag ${statusSem(i.status)}`}>{statusLabel(i.status)}</span></td>
                <td className="c-mut2" style={{ fontSize: 10 }}>{i.nota || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="foot">Compares HQP target × IBKR execution × Lynks accounting · Manager Cockpit · v1</div>
    </div>
  );
}

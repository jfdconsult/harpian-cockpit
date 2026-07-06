"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import type { ScreenId } from "@/lib/nav";

// Universos por classe de ativo — tickers Yahoo reais (mesma fonte dos motores).
const UNIVERSOS: Record<string, { label: string; icon: string; tickers: string[] }> = {
  acoes: {
    label: "Ações", icon: "ti-building-bank",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "JPM", "XOM", "UNH", "V", "MA", "COST", "HD", "LLY"],
  },
  etfs: {
    label: "ETFs", icon: "ti-layers-intersect",
    tickers: ["SPY", "QQQ", "IWM", "DIA", "GLD", "SLV", "XLK", "XLE", "XLF", "XLV", "XLI", "TLT", "HYG", "EEM", "EFA", "VNQ"],
  },
  commodities: {
    label: "Commodities", icon: "ti-flame",
    tickers: ["GC=F", "SI=F", "CL=F", "BZ=F", "NG=F", "HG=F", "PL=F", "ZC=F", "ZW=F", "ZS=F", "KC=F", "SB=F", "CC=F", "CT=F"],
  },
  cripto: {
    label: "Cripto", icon: "ti-currency-bitcoin",
    tickers: ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "BNB-USD", "ADA-USD", "DOGE-USD", "AVAX-USD", "LINK-USD", "DOT-USD"],
  },
  indices: {
    label: "Índices internacionais", icon: "ti-world",
    tickers: ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX", "^FTSE", "^GDAXI", "^FCHI", "^STOXX50E", "^N225", "^HSI", "^BVSP"],
  },
  forex: {
    label: "Forex (câmbio)", icon: "ti-arrows-exchange",
    tickers: ["EURUSD=X", "USDJPY=X", "GBPUSD=X", "USDCHF=X", "AUDUSD=X", "USDCAD=X", "NZDUSD=X", "USDBRL=X", "USDMXN=X", "USDCNY=X"],
  },
};
const ORDEM = ["acoes", "etfs", "commodities", "cripto", "indices", "forex"];

interface Quote {
  ticker: string; name?: string; last?: number; prev_close?: number; day_pct?: number;
  day_high?: number; day_low?: number; w52_high?: number; w52_low?: number;
  currency?: string; source?: string; ok?: boolean;
}

function fmtPrice(v?: number): string {
  if (v == null) return "—";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

export default function Cotacoes({ classe, go }: { classe?: string; go: (id: ScreenId, param?: string) => void }) {
  const [active, setActive] = useState<string>(classe && UNIVERSOS[classe] ? classe : "acoes");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  // se o menu mandar uma classe nova, troca a aba
  useEffect(() => { if (classe && UNIVERSOS[classe]) setActive(classe); }, [classe]);

  const uni = UNIVERSOS[active];

  function load() {
    setConn("loading");
    apiGet<{ quotes: Quote[] }>(`/v1/market/quotes?tickers=${encodeURIComponent(uni.tickers.join(","))}`)
      .then((d) => { setQuotes(d.quotes || []); setConn("ok"); })
      .catch(() => setConn("error"));
  }
  useEffect(load, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => quotes.filter((q) => q.ok !== false), [quotes]);

  useEffect(() => {
    if (!quotes || quotes.length === 0) return;
    publishScreenData("cotacoes", `${quotes.length} cotações · classe: ${uni.label}`, quotes, {
      briefing: `Tela de cotações mostrando ${quotes.length} ativos da classe ${uni.label}.`,
    });
  }, [quotes, active, uni.label]);

  return (
    <div className="screen">
      <div className="crumb">Mercado › <b>Cotações · {uni.label}</b></div>
      <div className="h1">Cotações</div>
      <div className="sub">Preços ao vivo (Yahoo · EOD/last) por classe de ativo. Clique num ativo para o gráfico DSPT.</div>

      {/* Abas de classe */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0", alignItems: "center" }}>
        {ORDEM.map((k) => (
          <button key={k} onClick={() => setActive(k)} style={{
            fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            fontFamily: "var(--mono)", letterSpacing: ".03em",
            border: `1px solid ${active === k ? "rgba(201,160,44,.4)" : "var(--line2)"}`,
            background: active === k ? "rgba(201,160,44,.15)" : "transparent",
            color: active === k ? "var(--gold)" : "var(--tx3)",
          }}>
            <i className={`ti ${UNIVERSOS[k].icon}`} style={{ fontSize: 13 }} />{UNIVERSOS[k].label}
          </button>
        ))}
        <button className="btn ghost" style={{ fontSize: 11, marginLeft: 4 }} onClick={load}><i className="ti ti-refresh" />Atualizar</button>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)" }}>
          {conn === "ok" ? `${rows.length} ativos · Yahoo` : ""}
        </span>
      </div>

      {conn === "error" && <div style={{ textAlign: "center", padding: 48, color: "var(--tx3)", fontSize: 12 }}>Backend offline — suba a API na porta 8080.</div>}
      {conn === "loading" && <div style={{ display: "grid", gap: 6 }}>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="skeleton" style={{ height: 34, borderRadius: 5 }} />)}</div>}

      {conn === "ok" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="mtable" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingLeft: 14 }}>Ticker</th>
                <th style={{ textAlign: "left" }}>Nome</th>
                <th style={{ textAlign: "right" }}>Último</th>
                <th style={{ textAlign: "right" }}>Dia %</th>
                <th style={{ textAlign: "right" }}>Máx dia</th>
                <th style={{ textAlign: "right" }}>Mín dia</th>
                <th style={{ textAlign: "right" }}>52s máx</th>
                <th style={{ textAlign: "right", paddingRight: 14 }}>52s mín</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const up = (q.day_pct ?? 0) >= 0;
                return (
                  <tr key={q.ticker} onClick={() => go("chart", q.ticker)} style={{ cursor: "pointer" }} className="cot-row">
                    <td style={{ paddingLeft: 14, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--gold)" }}>{q.ticker}</td>
                    <td style={{ color: "var(--tx2)", fontSize: 12 }}>{q.name || "—"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>{fmtPrice(q.last)}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: up ? "var(--green)" : "var(--red)" }}>{up ? "+" : ""}{(q.day_pct ?? 0).toFixed(2)}%</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx3)" }}>{fmtPrice(q.day_high)}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx3)" }}>{fmtPrice(q.day_low)}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx3)" }}>{fmtPrice(q.w52_high)}</td>
                    <td style={{ textAlign: "right", paddingRight: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--tx3)" }}>{fmtPrice(q.w52_low)}</td>
                    <td style={{ paddingRight: 10, color: "var(--tx3)" }}><i className="ti ti-chart-candle" style={{ fontSize: 14 }} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--tx3)", fontSize: 12 }}>Sem cotação disponível para esta classe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 10 }}>
        Fonte Yahoo Finance (pública) · a mesma Camada 1 que alimenta os motores. Gráfico do ativo com DSPT (DEMA/EMA/momentum) + toggle TradingView.
      </div>
    </div>
  );
}

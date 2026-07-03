"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import MomentumBar from "@/components/MomentumBar";
import AddBasketModal from "@/components/AddBasketModal";
import { deleteBasket, loadBaskets, type CustomBasket } from "@/lib/customBaskets";
import { useDialog } from "../ui/Dialog";
import type { ScreenId } from "@/lib/nav";

interface Candidate {
  ticker: string;
  is_leader: boolean;
  mom_j37: number | null;
  mom_d13: number | null;
  rs: string | null;
  last: number | null;
}

interface Strategy {
  num: number;
  name: string;
  label: string;
  setor: string;
  leader: string | null;
  last_trade_date: string | null;
  n_ativos: number;
  mom_j37_avg: number | null;
  mom_d13_avg: number | null;
  long_n: number;
  short_n: number;
  top5: { ticker: string; mom_j37: number | null; is_leader: boolean }[];
  candidates: Candidate[];
}

interface StrategiesResp {
  n_strategies: number;
  strategies: Strategy[];
  portfolio_ref: { name: string; portfolio_num: number };
  note: string;
}

interface CustomStrategyRow extends CustomBasket {
  mom_j37_avg: number | null;
  mom_d13_avg: number | null;
  long_n: number;
  short_n: number;
  top5: { ticker: string; mom_j37: number | null; is_leader: boolean }[];
  candidates: Candidate[];
  loading: boolean;
}

function rsCls(rs?: string | null) {
  return rs === "Long" ? "long" : rs === "Short" ? "short" : rs === "L-FVG" ? "lfvg" : rs === "S-FVG" ? "sfvg" : rs === "Buy" ? "buy" : rs === "Sell" ? "sell" : "";
}

export default function StrategiesStrength({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const dialog = useDialog();
  const [data, setData] = useState<StrategiesResp | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [customs, setCustoms] = useState<CustomStrategyRow[]>([]);

  const refreshCustoms = useCallback(async () => {
    const baskets = loadBaskets("strategy");
    const rows: CustomStrategyRow[] = baskets.map((b) => ({
      ...b, mom_j37_avg: null, mom_d13_avg: null,
      long_n: 0, short_n: 0, top5: [], candidates: [], loading: true,
    }));
    setCustoms(rows);
    for (const b of baskets) {
      try {
        const url = `/v1/alphadroid/custom-strength?tickers=${b.tickers.join(",")}&label=${encodeURIComponent(b.label)}`;
        const r = await apiGet<{
          mom_j37_avg: number | null; mom_d13_avg: number | null;
          long_n: number; short_n: number;
          top5: { ticker: string; mom_j37: number | null; is_leader: boolean }[];
          candidates: Candidate[];
        }>(url);
        setCustoms((prev) => prev.map((x) => x.id === b.id ? { ...x, ...r, loading: false } : x));
      } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    setConn("loading");
    apiGet<StrategiesResp>("/v1/alphadroid/strategy-strengths")
      .then((d) => { setData(d); setConn("ok"); })
      .catch(() => setConn("error"));
    refreshCustoms();
  }, [refreshCustoms]);

  return (
    <div className="screen">
      <div className="flex between wrap mb">
        <div>
          <div className="h1">Estratégias · Forças</div>
          <div className="sub">
            Força individual de cada estratégia · média momentum dos ativos da cesta ·
            portfolio alvo: <b style={{ color: "var(--gold)" }}>{data?.portfolio_ref.name}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => setModalOpen(true)}>
            + Adicionar estratégia
          </button>
          <span className="live">
            <span className="dot" />
            <span className={`tag ${conn === "ok" ? "g" : conn === "error" ? "r" : "b"}`}>
              {conn === "loading" ? "carregando…" : conn === "ok" ? "● alphadroid + yahoo" : "✕ offline"}
            </span>
          </span>
        </div>
      </div>

      <AddBasketModal
        kind="strategy"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => refreshCustoms()}
      />

      {data && (
        <div className="fbar mb">
          <div className="fcount">
            <b>{data.n_strategies + customs.length}</b> estratégias · {data.strategies.reduce((a, s) => a + s.n_ativos, 0) + customs.reduce((a, c) => a + c.tickers.length, 0)} ativos
          </div>
        </div>
      )}

      <div className="wrapx" style={{ maxHeight: "74vh" }}>
        <table className="atv">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th style={{ width: 50 }}>#</th>
              <th>Estratégia</th>
              <th>Setor</th>
              <th style={{ textAlign: "center" }}>Cesta</th>
              <th style={{ textAlign: "center" }}>Líder</th>
              <th style={{ textAlign: "center", minWidth: 200 }} className="momd">Force J37 (avg)</th>
              <th style={{ textAlign: "center", minWidth: 200 }} className="momd">Force D13 (avg)</th>
              <th style={{ textAlign: "left" }}>Top 5</th>
            </tr>
          </thead>
          <tbody>
            {conn === "error" ? (
              <tr><td colSpan={9} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>API offline</td></tr>
            ) : conn === "loading" || !data ? (
              <tr><td colSpan={9} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>calculando força de cada estratégia…</td></tr>
            ) : (
              <>
              {customs.map((c) => (
                <tr key={c.id} style={{ background: "rgba(201,160,44,.05)" }}>
                  <td className="c-mut2" style={{ fontSize: 11, textAlign: "center" }}>
                    <span
                      title="Remover"
                      style={{ cursor: "pointer", color: "var(--red)" }}
                      onClick={async (e) => { e.stopPropagation(); const ok = await dialog.confirm({ title: `Remover "${c.label}"?`, body: "A estratégia customizada sai da lista (só deste navegador).", danger: true, confirmLabel: "Remover" }); if (ok) { deleteBasket(c.id); refreshCustoms(); } }}
                    >×</span>
                  </td>
                  <td className="c-mut2" style={{ fontWeight: 700 }}>—</td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                      {c.label}
                      <span className="tag" style={{ marginLeft: 8, fontSize: 9, background: "rgba(201,160,44,.15)", color: "var(--gold)", border: "1px solid var(--gold)" }}>CUSTOM</span>
                    </div>
                    <div className="c-mut2" style={{ fontSize: 10 }}>estratégia customizada</div>
                  </td>
                  <td className="c-mut" style={{ fontSize: 11 }}>Custom</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{c.tickers.length}</td>
                  <td style={{ textAlign: "center", fontSize: 11, color: "var(--tx3)" }}>—</td>
                  <td className="momd" style={{ minWidth: 200 }}>
                    {c.loading ? <span className="c-mut2" style={{ fontSize: 11 }}>calculando…</span> : <MomentumBar value={c.mom_j37_avg} scale={20} suffix="" height={20} />}
                  </td>
                  <td className="momd" style={{ minWidth: 200 }}>
                    {c.loading ? "" : <MomentumBar value={c.mom_d13_avg} scale={20} suffix="" height={20} />}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {c.top5.map((t) => (
                      <span
                        key={t.ticker}
                        className="tk-link"
                        onClick={(e) => { e.stopPropagation(); go("chart", t.ticker); }}
                        style={{ marginRight: 6, fontWeight: 700, color: "var(--gold)" }}
                      >
                        {t.ticker}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              {data.strategies.map((s, i) => {
                const isExp = expanded === String(s.num);
                return (
                  <Fragment key={s.num}>
                    <tr
                      style={{ cursor: "pointer", background: i === 0 ? "rgba(46,204,113,.05)" : undefined }}
                      onClick={() => setExpanded(isExp ? null : String(s.num))}
                    >
                      <td className="c-mut2" style={{ fontSize: 11, textAlign: "center" }}>{isExp ? "▼" : "▶"}</td>
                      <td className="c-mut2" style={{ fontWeight: 700 }}>{s.num}</td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{s.name}</div>
                        <div className="c-mut2" style={{ fontSize: 10 }}>{s.label}</div>
                      </td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{s.setor}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{s.n_ativos}</td>
                      <td style={{ textAlign: "center" }}>
                        {s.leader && (
                          <span
                            className="tk-link"
                            onClick={(e) => { e.stopPropagation(); go("chart", s.leader!); }}
                            style={{ fontWeight: 700 }}
                          >
                            {s.leader}
                          </span>
                        )}
                      </td>
                      <td className="momd" style={{ minWidth: 200 }}>
                        <MomentumBar value={s.mom_j37_avg} scale={20} suffix="" height={20} />
                      </td>
                      <td className="momd" style={{ minWidth: 200 }}>
                        <MomentumBar value={s.mom_d13_avg} scale={20} suffix="" height={20} />
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {s.top5.map((t) => (
                          <span
                            key={t.ticker}
                            className="tk-link"
                            onClick={(e) => { e.stopPropagation(); go("chart", t.ticker); }}
                            style={{ marginRight: 6, fontWeight: 700, color: t.is_leader ? "var(--green)" : "var(--gold)" }}
                          >
                            {t.ticker}
                          </span>
                        ))}
                      </td>
                    </tr>
                    {isExp && (
                      <tr style={{ background: "rgba(255,255,255,.02)" }}>
                        <td></td>
                        <td colSpan={8} style={{ padding: "10px 14px" }}>
                          <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                            Todos os {s.n_ativos} candidatos ordenados por J37
                          </div>
                          <table style={{ width: "100%", fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left" }}>Ticker</th>
                                <th style={{ textAlign: "center" }}>Sinal</th>
                                <th style={{ textAlign: "right" }}>Preço</th>
                                <th style={{ textAlign: "center", minWidth: 180 }}>J37</th>
                                <th style={{ textAlign: "center", minWidth: 180 }}>D13</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...s.candidates].sort((a, b) => (b.mom_j37 ?? -1e9) - (a.mom_j37 ?? -1e9)).map((c) => (
                                <tr
                                  key={c.ticker}
                                  style={{ background: c.is_leader ? "rgba(46,204,113,.10)" : undefined, cursor: "pointer" }}
                                  onClick={() => go("chart", c.ticker)}
                                >
                                  <td>
                                    <span className="tk-link" style={{ fontWeight: 700 }}>{c.ticker}</span>
                                    {c.is_leader && <span className="tag g" style={{ marginLeft: 6, fontSize: 9 }}>ELEITO</span>}
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    {c.rs && <span className={`rs ${rsCls(c.rs)}`}>{c.rs}</span>}
                                  </td>
                                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                    {c.last != null ? `$${c.last.toFixed(2)}` : "—"}
                                  </td>
                                  <td style={{ minWidth: 180 }}><MomentumBar value={c.mom_j37} scale={30} suffix="" height={16} /></td>
                                  <td style={{ minWidth: 180 }}><MomentumBar value={c.mom_d13} scale={30} suffix="" height={16} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="foot">
        Estratégias · Forças · média momentum dos 12 candidatos por estratégia + suas cestas customizadas ·{" "}
        Portfolio ref: <b>{data?.portfolio_ref.name}</b>
      </div>
    </div>
  );
}

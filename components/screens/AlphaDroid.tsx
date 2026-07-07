"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
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

interface StrategyRef {
  num: number;
  name: string;
  leader: string | null;
}

interface Sector {
  code: string;
  label: string;
  order: number;
  is_gics: boolean;
  n_ativos: number;
  n_leaders: number;
  n_strategies: number;
  mom_j37_avg: number | null;
  mom_d13_avg: number | null;
  long_n: number;
  short_n: number;
  leaders: string[];
  top5: { ticker: string; mom_j37: number | null; is_leader: boolean }[];
  candidates: Candidate[];
  strategies: StrategyRef[];
}

interface SectorStrengthsResp {
  n_sectors: number;
  sectors: Sector[];
  portfolio_ref: { name: string; portfolio_num: number; note: string };
  note: string;
}

function rsCls(rs?: string | null) {
  return rs === "Long" ? "long" : rs === "Short" ? "short" : rs === "L-FVG" ? "lfvg" : rs === "S-FVG" ? "sfvg" : rs === "Buy" ? "buy" : rs === "Sell" ? "sell" : "";
}

interface CustomSectorRow extends CustomBasket {
  mom_j37_avg: number | null;
  mom_d13_avg: number | null;
  n_ativos: number;
  long_n: number;
  short_n: number;
  top5: { ticker: string; mom_j37: number | null; is_leader: boolean }[];
  candidates: Candidate[];
  loading: boolean;
}

export default function AlphaDroid({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const dialog = useDialog();
  const [data, setData] = useState<SectorStrengthsResp | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [customs, setCustoms] = useState<CustomSectorRow[]>([]);

  const refreshCustoms = useCallback(async () => {
    const baskets = loadBaskets("sector");
    const rows: CustomSectorRow[] = baskets.map((b) => ({
      ...b, mom_j37_avg: null, mom_d13_avg: null, n_ativos: b.tickers.length,
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
        setCustoms((prev) => prev.map((x) => x.id === b.id ? {
          ...x, ...r, loading: false,
        } : x));
      } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    setConn("loading");
    apiGet<SectorStrengthsResp>("/v1/alphadroid/sector-strengths")
      .then((d) => { setData(d); setConn("ok"); })
      .catch(() => setConn("error"));
    refreshCustoms();
  }, [refreshCustoms]);

  useEffect(() => {
    if (!data) return;
    publishScreenData(
      "alphadroid",
      `${data.n_sectors} setores, portfolio ref: ${data.portfolio_ref?.name ?? "?"}`,
      data.sectors,
      {
        briefing: `${data.n_sectors} setores monitorados com ${(data.sectors || []).reduce((a, s) => a + s.n_ativos, 0)} ativos. Portfolio referência: ${data.portfolio_ref?.name ?? "?"}.`,
      }
    );
  }, [data]);

  return (
    <div className="screen">
      <div className="flex between wrap mb">
        <div>
          <div className="h1">Setores · Forças</div>
          <div className="sub">
            Força dos setores · momentum agregado das cestas · GICS institucional + seus custom ·
            portfolio alvo: <b style={{ color: "var(--gold)" }}>{data?.portfolio_ref?.name}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => setModalOpen(true)}>
            + Adicionar setor
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
        kind="sector"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => refreshCustoms()}
      />

      {data && (
        <div className="fbar mb">
          <div className="fcount">
            <b>{data.n_sectors}</b> setores · {data.sectors.reduce((a, s) => a + s.n_ativos, 0)} ativos monitorados ·{" "}
            {data.sectors.reduce((a, s) => a + s.n_leaders, 0)} líderes eleitos
          </div>
        </div>
      )}

      <div className="wrapx" style={{ maxHeight: "74vh" }}>
        <table className="atv">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Sector</th>
              <th style={{ textAlign: "center" }}>Cesta</th>
              <th style={{ textAlign: "center" }}>Líderes</th>
              <th style={{ textAlign: "center", minWidth: 220 }} className="momd">Force J37 (avg cesta)</th>
              <th style={{ textAlign: "center", minWidth: 220 }} className="momd">Force D13 (avg cesta)</th>
              <th style={{ textAlign: "center" }}>Long / Short</th>
              <th style={{ textAlign: "left" }}>Top 5 do setor</th>
            </tr>
          </thead>
          <tbody>
            {conn === "error" ? (
              <tr><td colSpan={8} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>API offline</td></tr>
            ) : conn === "loading" || !data ? (
              <tr><td colSpan={8} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>calculando força de cada setor (Yahoo · DSPT)…</td></tr>
            ) : (
              <>
              {/* Custom setores primeiro (com highlight dourado) */}
              {customs.map((c) => (
                <tr key={c.id} style={{ background: "rgba(201,160,44,.05)" }}>
                  <td className="c-mut2" style={{ fontSize: 11, textAlign: "center" }}>
                    <span
                      title="Remover setor custom"
                      style={{ cursor: "pointer", color: "var(--red)" }}
                      onClick={async (e) => { e.stopPropagation(); const ok = await dialog.confirm({ title: `Remover setor "${c.label}"?`, body: "A cesta customizada sai da lista (só deste navegador).", danger: true, confirmLabel: "Remover" }); if (ok) { deleteBasket(c.id); refreshCustoms(); } }}
                    >×</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {c.label}
                      <span className="tag" style={{ marginLeft: 8, fontSize: 9, background: "rgba(201,160,44,.15)", color: "var(--gold)", border: "1px solid var(--gold)" }}>CUSTOM</span>
                    </div>
                    <div className="c-mut2" style={{ fontSize: 10 }}>seu setor · {c.tickers.length} tickers</div>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{c.n_ativos}</td>
                  <td style={{ textAlign: "center", fontSize: 11, color: "var(--tx3)" }}>—</td>
                  <td className="momd" style={{ minWidth: 220 }}>
                    {c.loading ? <span className="c-mut2" style={{ fontSize: 11 }}>calculando…</span> : <MomentumBar value={c.mom_j37_avg} scale={20} suffix="" height={22} />}
                  </td>
                  <td className="momd" style={{ minWidth: 220 }}>
                    {c.loading ? "" : <MomentumBar value={c.mom_d13_avg} scale={20} suffix="" height={22} />}
                  </td>
                  <td style={{ textAlign: "center", fontSize: 12 }}>
                    <span className="c-g">▲{c.long_n}</span>{" "}
                    <span className="c-r">▼{c.short_n}</span>
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
              {data.sectors.map((s, i) => {
              const isExp = expanded === s.code;
              return (
                <Fragment key={s.code}>
                  <tr
                    style={{ cursor: "pointer", background: i === 0 ? "rgba(46,204,113,.05)" : undefined }}
                    onClick={() => setExpanded(isExp ? null : s.code)}
                  >
                    <td className="c-mut2" style={{ fontSize: 11, textAlign: "center" }}>{isExp ? "▼" : "▶"}</td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {s.label}
                        {i === 0 && <span className="tag g" style={{ marginLeft: 8, fontSize: 9 }}>STRONGEST</span>}
                      </div>
                      <div className="c-mut2" style={{ fontSize: 10 }}>
                        {s.is_gics ? "GICS sector" : "Custom basket"} · {s.n_strategies} estratégia{s.n_strategies > 1 ? "s" : ""}
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{s.n_ativos}</td>
                    <td style={{ textAlign: "center", fontSize: 12 }}>
                      {s.leaders.map((tk) => (
                        <span
                          key={tk}
                          className="tk-link"
                          onClick={(e) => { e.stopPropagation(); go("chart", tk); }}
                          style={{ marginRight: 6, fontWeight: 700 }}
                        >
                          {tk}
                        </span>
                      ))}
                    </td>
                    <td className="momd" style={{ minWidth: 220 }}>
                      <MomentumBar value={s.mom_j37_avg} scale={20} suffix="" height={22} />
                    </td>
                    <td className="momd" style={{ minWidth: 220 }}>
                      <MomentumBar value={s.mom_d13_avg} scale={20} suffix="" height={22} />
                    </td>
                    <td style={{ textAlign: "center", fontSize: 12 }}>
                      <span className="c-g">▲{s.long_n}</span>{" "}
                      <span className="c-r">▼{s.short_n}</span>
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {s.top5.map((t) => (
                        <span
                          key={t.ticker}
                          className="tk-link"
                          onClick={(e) => { e.stopPropagation(); go("chart", t.ticker); }}
                          style={{
                            marginRight: 6,
                            fontWeight: 700,
                            color: t.is_leader ? "var(--green)" : "var(--gold)",
                          }}
                          title={`J37 ${t.mom_j37}`}
                        >
                          {t.ticker}
                        </span>
                      ))}
                    </td>
                  </tr>
                  {isExp && (
                    <tr style={{ background: "rgba(255,255,255,.02)" }}>
                      <td></td>
                      <td colSpan={7} style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                          Todos os {s.n_ativos} ativos da cesta · ordenados por J37
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
                            {[...s.candidates]
                              .sort((a, b) => (b.mom_j37 ?? -1e9) - (a.mom_j37 ?? -1e9))
                              .map((c) => (
                                <tr
                                  key={c.ticker}
                                  style={{
                                    background: c.is_leader ? "rgba(46,204,113,.10)" : undefined,
                                    cursor: "pointer",
                                  }}
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
                                  <td style={{ minWidth: 180 }}>
                                    <MomentumBar value={c.mom_j37} scale={30} suffix="" height={16} />
                                  </td>
                                  <td style={{ minWidth: 180 }}>
                                    <MomentumBar value={c.mom_d13} scale={30} suffix="" height={16} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: 12, fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                          Estratégias que compõem este setor
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {s.strategies.map((st) => (
                            <span
                              key={st.num}
                              style={{
                                background: "rgba(201,160,44,.08)",
                                border: "1px solid rgba(201,160,44,.25)",
                                borderRadius: 6,
                                padding: "3px 10px",
                                fontSize: 11,
                              }}
                            >
                              <span className="c-mut2">#{st.num}</span>{" "}
                              <span style={{ fontWeight: 700, color: "var(--gold)" }}>{st.name}</span>
                              {st.leader && (
                                <>
                                  {" → "}
                                  <span className="c-g">{st.leader}</span>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
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
        Sectors Strengths · momentum agregado (média J37/D13) dos ativos de cada cesta setorial ·{" "}
        Portfolio ref: <b>{data?.portfolio_ref?.name}</b> (#{data?.portfolio_ref.portfolio_num}) · Fonte: Yahoo EOD + DSPT
      </div>
    </div>
  );
}

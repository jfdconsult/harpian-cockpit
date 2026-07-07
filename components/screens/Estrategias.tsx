"use client";
import { Fragment, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import MomentumBar from "@/components/MomentumBar";
import { useDialog } from "../ui/Dialog";
import type { ScreenId } from "@/lib/nav";

interface Ativo { ticker: string; tipo: string; peso_pct: number }
interface Esteira { nome: string; peso_pct: number; ativos: Ativo[] }
interface Pilar { nome: string; peso_pct: number; esteiras: Esteira[] }
interface Portfolio {
  id: string; nome: string; descricao: string; isin?: string; motor: string; motor_version: string;
  regime: string; alocado_usd: number; exposicao_pct: number; dd_mes_pct: number; risk_number: number;
  cagr_pct?: number; sortino?: number; calmar?: number; max_dd_pct?: number; cota?: number; estado?: string;
  pilares?: Pilar[]; esteiras?: Esteira[];
}

function sem(regime: string) { return regime === "RISK-ON" ? "g" : regime === "WARNING" ? "a" : regime === "RISK-OFF" ? "r" : "b"; }
const PILAR_CLS = ["pilar-A", "pilar-B", "pilar-C", "pilar-D"];

function sparklinePoints() {
  const pts: string[] = [];
  for (let i = 0; i < 40; i++) {
    const y = 55 - (Math.sin(i * 0.18) * 15 + i * 0.9 + Math.random() * 5);
    pts.push(`${i * 7.5},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

interface AtivoMom { ticker: string; mom_j37: number | null; mom_d13: number | null; active_buy?: boolean }
interface EsteiraMom {
  nome: string; pilar: string | null; peso_pct: number;
  mom_j37: number | null; mom_d13: number | null;
  long_n: number; short_n: number; n_ativos: number; tickers: string[];
  ativos?: AtivoMom[];
}
interface MomentumResp {
  portfolio_id: string; nome: string; motor: string; regime: string;
  n_esteiras: number; esteiras: EsteiraMom[]; source: string; note: string;
}

export default function Estrategias({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentId, setCurrentId] = useState("HPC22");
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [openPilars, setOpenPilars] = useState<Record<string, boolean>>({});
  const [spark] = useState(sparklinePoints);
  const [view, setView] = useState<"composicao" | "momentum">("momentum");
  const [momData, setMomData] = useState<MomentumResp | null>(null);
  const [momLoading, setMomLoading] = useState(false);
  const [expEst, setExpEst] = useState<string | null>(null);
  const dialog = useDialog();

  function refreshData() {
    apiGet<{ portfolios: Portfolio[] }>("/v1/strategies/")
      .then((d) => { setPortfolios(d.portfolios); setConn("ok"); })
      .catch(() => setConn("error"));
  }
  useEffect(refreshData, []);

  useEffect(() => {
    if (view !== "momentum") return;
    setMomLoading(true);
    setMomData(null);
    apiGet<MomentumResp>(`/v1/strategies/${currentId}/momentum`)
      .then((d) => { setMomData(d); setMomLoading(false); })
      .catch(() => setMomLoading(false));
  }, [currentId, view]);

  useEffect(() => {
    if (!portfolios.length) return;
    const cur = portfolios.find((x) => x.id === currentId);
    publishScreenData(
      "estrategias",
      `${portfolios.length} portfólios, atual: ${cur?.nome || currentId}, CAGR ${(cur?.cagr_pct || 0).toFixed(1)}%, Sortino ${(cur?.sortino || 0).toFixed(2)}, Risk Number ${cur?.risk_number ?? "—"}`,
      portfolios,
      {
        briefing: `${portfolios.length} portfólios carregados. Portfólio selecionado: ${cur?.nome || currentId} com CAGR ${(cur?.cagr_pct || 0).toFixed(1)}% e Sortino ${(cur?.sortino || 0).toFixed(2)}.${momData ? ` Momentum: ${momData.n_esteiras} esteiras.` : ""}`,
      }
    );
  }, [portfolios, momData]);

  const p = portfolios.find((x) => x.id === currentId);

  function togglePilar(key: string) {
    setOpenPilars((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  }

  async function addAtivo(portId: string, esteiraNome: string) {
    const ticker = await dialog.prompt({ title: `Novo ativo · esteira ${esteiraNome}`, label: "Ticker (ex: AAPL)" });
    if (!ticker || !ticker.trim()) return;
    const peso = await dialog.prompt({ title: `Peso de ${ticker.toUpperCase().trim()}`, label: "Peso (%)", initial: "10", type: "number" });
    if (!peso) return;
    apiPost(`/v1/strategies/${portId}/esteira/${esteiraNome}/ativo`, { ticker: ticker.toUpperCase().trim(), tipo: "AÇÃO", peso_pct: parseFloat(peso) })
      .then(() => { refreshData(); dialog.notify(`${ticker.toUpperCase().trim()} adicionado à esteira ${esteiraNome}.`, "success"); })
      .catch((e) => dialog.notify("Erro: " + e.message, "error"));
  }
  async function removeAtivo(portId: string, esteiraNome: string, ticker: string) {
    const ok = await dialog.confirm({
      title: `Remover ${ticker}?`,
      body: `O ativo sai da esteira ${esteiraNome} deste portfolio.`,
      danger: true,
      confirmLabel: "Remover ativo",
    });
    if (!ok) return;
    fetch(`${process.env.NEXT_PUBLIC_HQP_API_URL || "http://localhost:8080"}/v1/strategies/${portId}/esteira/${esteiraNome}/ativo/${ticker}`, {
      method: "DELETE",
      headers: { "X-User-Role": "socio_gestor", "X-User-Name": "João Daniel" },
    })
      .then((r) => r.json())
      .then(() => refreshData())
      .catch((e) => dialog.notify("Erro: " + e.message, "error"));
  }

  function renderEsteira(port: Portfolio, est: Esteira, key: string) {
    return (
      <div key={key}>
        <div className="esteira-hdr"><span className="ename">{est.nome}</span><span className="ew">{est.peso_pct}%</span></div>
        <div className="esteira-bar"><div className="esteira-bar-fill" style={{ width: `${Math.min(100, est.peso_pct)}%` }} /></div>
        {(est.ativos || []).map((a) => {
          const tc = `atype-${a.tipo.replace("Ã", "A").replace("Ç", "C")}`;
          return (
            <div className="ativo-row" key={a.ticker}>
              <span className="tk-link" style={{ width: 60, display: "inline-block" }} onClick={() => go("chart", a.ticker)} title="Abrir gráfico">{a.ticker}</span>
              <span className={`atype ${tc}`}>{a.tipo}</span>
              <span className="aw">{a.peso_pct}%</span>
              <button
                className="btn ghost"
                style={{ fontSize: 11, padding: "4px 8px", color: "var(--red-text)", marginLeft: 4 }}
                onClick={() => removeAtivo(port.id, est.nome, a.ticker)}
                title="Remover ativo"
                aria-label={`Remover ${a.ticker}`}
              >
                <i className="ti ti-x" />
              </button>
            </div>
          );
        })}
        <button className="add-btn" onClick={() => addAtivo(port.id, est.nome)}>+ Adicionar ativo</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Estratégias / ETPs</div><div className="sub">Composição hierárquica dos portfólios. Pilar → Esteira → Ativo.</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => go("portfolio-studio", currentId)}>
            + Nova estratégia (esteira) no Studio
          </button>
          <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
            {conn === "loading" ? "conectando..." : conn === "ok" ? "● API ao vivo" : "✕ API offline"}
          </div>
        </div>
      </div>

      <div className="flex between wrap mb" style={{ gap: 16 }}>
        <div className="pills" style={{ margin: 0 }}>
          {portfolios.map((port) => (
            <div key={port.id} className={`pill${port.id === currentId ? " on" : ""}`} onClick={() => setCurrentId(port.id)}>{port.nome}</div>
          ))}
        </div>
        <div className="pills" style={{ margin: 0 }}>
          <div className={`pill${view === "momentum" ? " on" : ""}`} onClick={() => setView("momentum")}>Momentum (SectorSurfer)</div>
          <div className={`pill${view === "composicao" ? " on" : ""}`} onClick={() => setView("composicao")}>Composição</div>
        </div>
      </div>

      {!p && conn === "error" && (
        <div className="ph mb"><b>API não respondeu</b>Suba a API: <code>uvicorn app.main:app --port 8080</code></div>
      )}

      {p && (
        <>
          <div className="grid g4 mb">
            <div className="kpi"><div className="l">Cota</div><div className="v">US$ {(p.cota || 0).toFixed(2)}</div><div className="s">{p.descricao}</div></div>
            <div className="kpi"><div className="l">CAGR</div><div className="v c-g">{(p.cagr_pct || 0).toFixed(1)}%</div><div className="s">anualizado</div></div>
            <div className="kpi"><div className="l">Sortino / Max DD</div><div className="v">{(p.sortino || 0).toFixed(2)} / {(p.max_dd_pct || 0).toFixed(1)}%</div><div className="s">Calmar {(p.calmar || 0).toFixed(2)}</div></div>
            <div className="kpi"><div className="l">Risk Number</div><div className={`v c-${sem(p.regime)}`}>{p.risk_number ?? "—"}</div><div className="s">SPY = 27,6</div></div>
          </div>

          {view === "momentum" && (
            <div className="card mb">
              <h2>
                <span>Momentum de esteiras · SectorSurfer</span>
                <span className="tag b" style={{ marginLeft: "auto" }}>
                  {momData ? `${momData.n_esteiras} esteiras · ${momData.motor}` : "carregando…"}
                </span>
              </h2>
              <table className="atv">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Esteira</th>
                    <th>Pilar</th>
                    <th style={{ textAlign: "right" }}>Peso</th>
                    <th style={{ textAlign: "center" }}>N ativos</th>
                    <th style={{ textAlign: "center", minWidth: 200 }} className="momd">Momento J37 (Diogo)</th>
                    <th style={{ textAlign: "center", minWidth: 200 }} className="momd">Momento D13</th>
                    <th style={{ textAlign: "center" }}>Long / Short</th>
                  </tr>
                </thead>
                <tbody>
                  {momLoading || !momData ? (
                    <tr><td colSpan={8} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>calculando momentum das esteiras…</td></tr>
                  ) : momData.esteiras.length === 0 ? (
                    <tr><td colSpan={8} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>portfólio sem esteiras</td></tr>
                  ) : momData.esteiras.map((e, i) => {
                    const isExp = expEst === e.nome;
                    return (
                      <Fragment key={e.nome}>
                        <tr
                          style={{ cursor: "pointer", background: i === 0 ? "rgba(46,204,113,.05)" : undefined }}
                          onClick={() => setExpEst(isExp ? null : e.nome)}
                        >
                          <td className="c-mut2" style={{ fontSize: 11, textAlign: "center" }}>{isExp ? "▼" : "▶"}</td>
                          <td>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{e.nome}</span>
                            {i === 0 && <span className="tag g" style={{ marginLeft: 8, fontSize: 9 }}>LÍDER</span>}
                          </td>
                          <td className="c-mut" style={{ fontSize: 11 }}>{e.pilar || "—"}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>{e.peso_pct}%</td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{e.n_ativos}</td>
                          <td className="momd" style={{ minWidth: 200 }}>
                            <MomentumBar value={e.mom_j37} scale={30} suffix="" height={20} />
                          </td>
                          <td className="momd" style={{ minWidth: 200 }}>
                            <MomentumBar value={e.mom_d13} scale={30} suffix="" height={20} />
                          </td>
                          <td style={{ textAlign: "center", fontSize: 12 }}>
                            <span className="c-g">▲{e.long_n}</span>{" "}
                            <span className="c-r">▼{e.short_n}</span>
                          </td>
                        </tr>
                        {isExp && (
                          <tr style={{ background: "rgba(255,255,255,.02)" }}>
                            <td></td>
                            <td colSpan={7} style={{ padding: "8px 12px" }}>
                              <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                                Momentum por ativo
                              </div>
                              {e.ativos && e.ativos.length > 0 ? (
                                <table style={{ width: "100%", fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: "left", paddingLeft: 8 }}>Ativo</th>
                                      <th style={{ textAlign: "center", minWidth: 160 }}>J37</th>
                                      <th style={{ textAlign: "center", minWidth: 160 }}>D13</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {e.ativos.map((a) => (
                                      <tr key={a.ticker} style={a.active_buy ? { background: "rgba(74,144,217,0.08)" } : undefined}>
                                        <td style={{ paddingLeft: 8 }}>
                                          <span className="tk-link" onClick={(ev) => { ev.stopPropagation(); go("chart", a.ticker); }} style={{ fontWeight: 700 }}>{a.ticker}</span>
                                          {a.active_buy && <span className="tag g" style={{ fontSize: 8, marginLeft: 6, fontWeight: 700 }}>ACTIVE BUY</span>}
                                        </td>
                                        <td style={{ minWidth: 160 }}><MomentumBar value={a.mom_j37} scale={20} suffix="" height={14} /></td>
                                        <td style={{ minWidth: 160 }}><MomentumBar value={a.mom_d13} scale={30} suffix="" height={14} /></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {e.tickers.map((tk) => (
                                    <span
                                      key={tk}
                                      className="tk-link"
                                      onClick={(ev) => { ev.stopPropagation(); go("chart", tk); }}
                                      style={{
                                        background: "rgba(201,160,44,.08)",
                                        border: "1px solid rgba(201,160,44,.25)",
                                        borderRadius: 6,
                                        padding: "3px 10px",
                                        fontSize: 12,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {tk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 8 }}>
                {momData?.note} · Fonte: {momData?.source}
              </div>
            </div>
          )}

          {view === "composicao" && (
          <div className="strat-layout">
            <div className="tree-card">
              <h2>Composição</h2>
              {(p.pilares && p.pilares.length > 0) || (p.esteiras && p.esteiras.length > 0) ? (
                <>
                  {(p.pilares || []).map((pil, pi) => {
                    const key = `${p.id}_${pi}`;
                    const isOpen = openPilars[key] !== false;
                    return (
                      <div key={key}>
                        <div className={`pilar-hdr ${PILAR_CLS[pi % 4]}`} onClick={() => togglePilar(key)}>
                          <span className={`arrow${isOpen ? " open" : ""}`}>▶</span>
                          <span className="name">{pil.nome}</span>
                          <span className="weight">{pil.peso_pct}%</span>
                        </div>
                        {isOpen && <div className="pilar-body">{(pil.esteiras || []).map((est, ei) => renderEsteira(p, est, `${key}_${ei}`))}</div>}
                      </div>
                    );
                  })}
                  {(p.esteiras || []).map((est, ei) => renderEsteira(p, est, `direct_${ei}`))}
                </>
              ) : (
                <div className="ph"><b>Sem composição definida</b>Este portfólio ainda não tem esteiras configuradas.</div>
              )}
            </div>

            <div className="info-card">
              <h2>Estratégia</h2>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{p.motor}</div>
                <div style={{ fontSize: 11, color: "var(--tx2)" }}>Versão {p.motor_version}</div>
              </div>
              <div className="kv"><span className="c-mut">Estado</span><span className="v"><span className={`estado-chip estado-${p.estado || "lab"}`}>{(p.estado || "—").toUpperCase()}</span></span></div>
              <div className="kv"><span className="c-mut">Regime hoje</span><span className="v"><span className={`statechip ${sem(p.regime)}`}>{p.regime}</span></span></div>
              <div className="kv"><span className="c-mut">ISIN</span><span className="v" style={{ fontSize: 11 }}>{p.isin || "n/a"}</span></div>
              <div className="kv"><span className="c-mut">Alocado</span><span className="v">US$ {(p.alocado_usd / 1e6).toFixed(1)}M</span></div>
              <div className="kv"><span className="c-mut">Exposição</span><span className="v">{p.exposicao_pct}%</span></div>
              <div className="kv"><span className="c-mut">DD do mês</span><span className="v c-r">{p.dd_mes_pct.toFixed(1)}%</span></div>
              <svg className="sparkline" viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C9A02C" stopOpacity={0.3} /><stop offset="100%" stopColor="#C9A02C" stopOpacity={0} /></linearGradient></defs>
                <polyline points={spark} fill="none" stroke="#C9A02C" strokeWidth={1.5} />
                <polygon points={`0,60 ${spark} 297,60`} fill="url(#sg)" />
              </svg>
              <div style={{ fontSize: 11, color: "var(--tx2)", marginBottom: 10 }}>{p.descricao}</div>
              <div className="action-btns">
                <button className="btn" onClick={() => go("portfolio-studio", p.id)}>
                  <i className="ti ti-layout-grid" style={{ fontSize: 13 }} />Editar no Studio
                </button>
                <button className="btn ghost" onClick={() => go("backtest")}>
                  <i className="ti ti-history" style={{ fontSize: 13 }} />Testar no Backtest
                </button>
                <button className="btn ghost" onClick={() => go("protecao")}>
                  <i className="ti ti-shield-check" style={{ fontSize: 13 }} />Risco &amp; Proteção
                </button>
              </div>
            </div>
          </div>
          )}
        </>
      )}
      <div className="foot">Estratégias · v1 · Composição editável. Pesos sincronizam com a API (/v1/strategies).</div>
    </div>
  );
}

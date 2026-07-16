"use client";
import { useEffect, useState, useCallback } from "react";
import { apiGet, fmtUSD, semColor } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import MomentumBar from "@/components/MomentumBar";
import type { ScreenId } from "@/lib/nav";

/* ── types ── */
interface Ativo { ticker: string; tipo?: string; peso_pct: number }
interface Esteira { nome: string; peso_pct: number; ativos: Ativo[]; arena?: Record<string, unknown> }
interface Pilar { nome: string; peso_pct: number; peso_modo?: string; esteiras: Esteira[] }
interface Motor {
  id: string; ref_motor_id?: string; nome: string; versao?: string;
  tipo: string; status?: string;
  peso: { modo: string; regra_id?: string | null; valor?: number | null };
  estrutura?: {
    pilares?: Pilar[];
    regras_internas?: Record<string, unknown>;
    buckets_n?: number; etfs_n?: number; config?: string; signal?: string;
    formulas?: { id: string; peso: number; descricao: string }[];
  };
}
interface Regra { id: string; tipo: string; nome: string; fonte_sinal?: string; alvos?: string[]; response_type?: string; threshold?: number; descricao?: string }
interface Perfil { id: string; nome: string; w_min: number; w_max: number; ativo?: boolean; cagr_10y?: number; sharpe?: number; calmar?: number; max_dd?: number }
interface Composicao { motores: Motor[]; regras: Regra[]; perfis: Perfil[]; adr_travas?: string[]; perfil_ativo?: Perfil | null }
interface Portfolio {
  id: string; nome: string; descricao: string; isin?: string | null;
  motor: string; motor_version: string;
  mode?: "active" | "model"; owner?: string;
  capital_type?: "real" | "simbolico"; capital_usd?: number;
  ibkr_account_id?: string | null; etp_listed?: boolean;
  regime: string; alocado_usd: number; exposicao_pct: number; dd_mes_pct: number; risk_number: number;
  cagr_pct?: number; sortino?: number; calmar?: number; max_dd_pct?: number; cota?: number; estado?: string;
  pilares?: Pilar[]; esteiras?: Esteira[];
  composicao?: { motores: Motor[]; regras: Regra[]; perfis: Perfil[]; adr_travas?: string[] };
}
interface Ticket {
  id: string; ticker: string; nome?: string; side: "buy" | "sell"; tipo: string;
  portfolio_id: string; valor_usd: number; status: string; mom_126d?: number; motivo?: string;
}

/* ── expand state ── */
type Expanded = Record<string, boolean>;

function toggle(exp: Expanded, key: string): Expanded {
  return { ...exp, [key]: !exp[key] };
}

/* ── tree icons ── */
const I = {
  maestro: "ti-arrows-shuffle",
  motor_attack: "ti-sword",
  motor_defense: "ti-shield",
  motor_detector: "ti-radar-2",
  pilar: "ti-columns",
  esteira: "ti-list-tree",
  ativo: "ti-chart-candle",
  perfil: "ti-user-cog",
  regra: "ti-settings-automation",
} as const;

function motorIcon(tipo: string) {
  if (tipo.startsWith("attack")) return I.motor_attack;
  if (tipo === "detector") return I.motor_detector;
  return I.motor_defense;
}

function motorColor(tipo: string) {
  if (tipo.startsWith("attack")) return "var(--green)";
  if (tipo === "detector") return "var(--amber)";
  return "var(--blue)";
}

function statusTag(s?: string) {
  if (!s) return null;
  const c = s === "prod" ? "g" : s === "candidate" ? "a" : "b";
  return <span className={`tag ${c}`} style={{ fontSize: 8, marginLeft: 6 }}>{s.toUpperCase()}</span>;
}

/* ── tree styles ── */
const treeRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
  cursor: "pointer", userSelect: "none",
};
const treeIndent = (level: number): React.CSSProperties => ({
  paddingLeft: level * 24,
});
const chevron = (open: boolean): React.CSSProperties => ({
  fontSize: 11, transition: "transform .15s", transform: open ? "rotate(90deg)" : "rotate(0)",
  color: "var(--tx3)", minWidth: 14, textAlign: "center",
});

/* ── momentum types ── */
interface AtivoMom { ticker: string; mom_j37: number | null; mom_d13: number | null; active_buy?: boolean }
interface EsteiraMom { nome: string; pilar: string | null; mom_j37: number | null; mom_d13: number | null; ativos?: AtivoMom[] }
interface MomentumData { esteiras: EsteiraMom[] }

/* ── component ── */
export default function PortfolioScreen({ portfolioId, go }: { portfolioId: string; go: (id: ScreenId, param?: string) => void }) {
  const [p, setP] = useState<Portfolio | null>(null);
  const [comp, setComp] = useState<Composicao | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [exp, setExp] = useState<Expanded>({});
  const [momData, setMomData] = useState<MomentumData | null>(null);
  const [momLoading, setMomLoading] = useState(false);

  useEffect(() => {
    apiGet<Portfolio>(`/v1/strategies/${portfolioId}`)
      .then((d) => { setP(d); setConn("ok"); })
      .catch(() => setConn("error"));
    apiGet<Composicao>(`/v1/strategies/${portfolioId}/composicao`)
      .then(setComp)
      .catch(() => {});
    apiGet<{ tickets: Ticket[] }>(`/v1/tickets?portfolio_id=${portfolioId}`)
      .then((d) => setTickets(d.tickets || []))
      .catch(() => {});
    setMomLoading(true);
    apiGet<MomentumData>(`/v1/strategies/${portfolioId}/momentum`)
      .then(setMomData)
      .catch(() => {})
      .finally(() => setMomLoading(false));
  }, [portfolioId]);

  const expandAll = useCallback(() => {
    if (!comp) return;
    const all: Expanded = { maestro: true };
    for (const m of comp.motores) {
      all[`m:${m.id}`] = true;
      for (const pil of m.estrutura?.pilares || []) {
        all[`p:${m.id}:${pil.nome}`] = true;
        for (const est of pil.esteiras || []) {
          all[`e:${m.id}:${est.nome}`] = true;
        }
      }
    }
    setExp(all);
  }, [comp]);

  const collapseAll = useCallback(() => setExp({}), []);

  useEffect(() => {
    if (!p) return;
    publishScreenData("portfolio",
      `${p.nome}, $${p.alocado_usd.toLocaleString("en-US")} allocated, regime ${p.regime}, Risk Number ${p.risk_number}`,
      { portfolio: p, composicao: comp, tickets },
      { briefing: `Portfolio ${p.nome} with $${p.alocado_usd.toLocaleString("en-US")} allocated in regime ${p.regime}. Exposure ${p.exposicao_pct}%, monthly DD ${p.dd_mes_pct.toFixed(1)}%. ${comp ? `${comp.motores.length} engine(s)` : ""}` },
    );
  }, [p, comp, tickets]);

  const momByTicker = (() => {
    if (!momData) return {} as Record<string, AtivoMom>;
    const map: Record<string, AtivoMom> = {};
    for (const est of momData.esteiras || []) {
      for (const a of est.ativos || []) {
        map[a.ticker] = a;
      }
    }
    return map;
  })();

  const isModel = p?.mode === "model";
  const hasComposicao = comp && comp.motores.length > 0;
  const regras = comp?.regras || [];
  const perfis = comp?.perfis || [];
  const perfilAtivo = perfis.find(x => x.ativo);

  /* legacy fallback: pillars/sleeves at top level */
  const legacyPilares = p?.pilares || [];
  const legacyEsteiras = p?.esteiras || [];
  const useLegacy = !hasComposicao && (legacyPilares.length > 0 || legacyEsteiras.length > 0);

  return (
    <div className="screen">
      {/* header */}
      <div className="flex between wrap mb">
        <div>
          <div style={{ fontSize: 11, color: "var(--tx2)" }}>
            <span className="tk-link" onClick={() => go("mission-control")}>← Mission Control</span>
          </div>
          <div className="h1">
            {p?.nome || portfolioId}
            {p && (
              <span className="tag" style={{ marginLeft: 12, background: isModel ? "rgba(125,150,179,0.12)" : "rgba(74,144,217,0.18)", color: isModel ? "var(--tx3)" : "var(--blue)", border: `1px solid ${isModel ? "rgba(125,150,179,0.35)" : "var(--blue)"}`, fontSize: 10, letterSpacing: 1, verticalAlign: "middle" }}>
                {isModel ? "MODEL · DEMO" : "ACTIVE · ETP"}
              </span>
            )}
          </div>
          <div className="sub">{p?.descricao} · Engine {p?.motor} {p?.motor_version}</div>
        </div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "loading…" : conn === "ok" ? "● API live" : "✕ offline"}
        </div>
      </div>

      {p && (
        <>
          {/* KPIs */}
          <div className="grid g4 mb">
            <div className="kpi">
              <div className="l">{isModel ? "Symbolic capital" : "Allocated (real)"}</div>
              <div className="v">{fmtUSD(p.alocado_usd)}</div>
              <div className="s">{isModel ? "model portfolio" : `IBKR ${p.ibkr_account_id || "—"}`}</div>
            </div>
            <div className="kpi">
              <div className="l">Regime</div>
              <div className={`v c-${semColor(p.regime)}`}>{p.regime}</div>
              <div className="s">Risk Number {p.risk_number}</div>
            </div>
            <div className="kpi">
              <div className="l">Performance</div>
              <div className="v">{p.cagr_pct ? `${p.cagr_pct.toFixed(1)}%` : "—"}</div>
              <div className="s">CAGR · Sortino {p.sortino?.toFixed(2) || "—"}</div>
            </div>
            <div className="kpi">
              <div className="l">Max drawdown</div>
              <div className="v" style={{ color: "var(--red)" }}>{p.max_dd_pct ? `${p.max_dd_pct.toFixed(1)}%` : "—"}</div>
              <div className="s">Monthly DD {p.dd_mes_pct.toFixed(1)}%</div>
            </div>
          </div>

          {/* ══════════ TREE: hierarchical composition ══════════ */}
          <div className="card mb">
            <div className="flex between" style={{ alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>
                <i className={`ti ${I.maestro}`} style={{ marginRight: 6 }} />
                Portfolio Architecture
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {momLoading && <span style={{ fontSize: 10, color: "var(--tx3)" }}>computing momentum…</span>}
                {momData && !momLoading && <span style={{ fontSize: 10, color: "var(--green)" }}>momentum live</span>}
                <button className="btn-sm" onClick={expandAll}>Expand all</button>
                <button className="btn-sm" onClick={collapseAll}>Collapse</button>
              </div>
            </div>

            {hasComposicao ? (
              <div style={{ marginTop: 12, borderLeft: "2px solid rgba(201,160,44,0.18)", paddingLeft: 8 }}>

                {/* ── MAESTRO (regras + perfis) ── */}
                {regras.length > 0 && (
                  <>
                    <div style={{ ...treeRow, ...treeIndent(0) }} onClick={() => setExp(toggle(exp, "maestro"))}>
                      <i className="ti ti-chevron-right" style={chevron(!!exp.maestro)} />
                      <i className={`ti ${I.maestro}`} style={{ color: "var(--gold)", fontSize: 15 }} />
                      <b style={{ color: "var(--gold)" }}>MAESTRO · Dynamic Balancing</b>
                      <span className="tag a" style={{ fontSize: 8 }}>GRADUAL</span>
                    </div>
                    {exp.maestro && (
                      <div style={treeIndent(1)}>
                        {regras.map(r => (
                          <div key={r.id} style={{ ...treeRow, ...treeIndent(1) }}>
                            <i className={`ti ${I.regra}`} style={{ color: "var(--tx3)", fontSize: 13 }} />
                            <span style={{ fontSize: 12 }}><b>{r.nome}</b> — {r.descricao || r.tipo}</span>
                            {r.threshold != null && <span className="tag b" style={{ fontSize: 8 }}>threshold {r.threshold}</span>}
                          </div>
                        ))}
                        {perfis.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 10, color: "var(--tx3)", paddingLeft: 32, marginBottom: 4 }}>LOAD PROFILES</div>
                            {perfis.map(pf => (
                              <div key={pf.id} style={{ ...treeRow, ...treeIndent(1), opacity: pf.ativo ? 1 : 0.6 }}>
                                <i className={`ti ${I.perfil}`} style={{ color: pf.ativo ? "var(--gold)" : "var(--tx3)", fontSize: 13 }} />
                                <span style={{ fontSize: 12 }}>
                                  <b>{pf.nome}</b> — w<sub>min</sub> {(pf.w_min * 100).toFixed(1)}% · w<sub>max</sub> {(pf.w_max * 100).toFixed(1)}%
                                </span>
                                {pf.ativo && <span className="tag g" style={{ fontSize: 8 }}>ACTIVE</span>}
                                {pf.cagr_10y != null && <span style={{ fontSize: 10, color: "var(--tx3)" }}>CAGR {pf.cagr_10y}% · Calmar {pf.calmar}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── ENGINES ── */}
                {comp!.motores.map(m => {
                  const mKey = `m:${m.id}`;
                  const mOpen = !!exp[mKey];
                  const pilares = m.estrutura?.pilares || [];
                  const formulas = m.estrutura?.formulas || [];
                  const nAtivos = pilares.reduce((sum, pil) => sum + pil.esteiras.reduce((s, e) => s + (e.ativos?.length || 0), 0), 0);
                  const nEsteiras = pilares.reduce((sum, pil) => sum + pil.esteiras.length, 0);
                  const pesoLabel = m.peso.modo === "dinamico"
                    ? `dynamic (${perfilAtivo ? `${(perfilAtivo.w_min * 100).toFixed(0)}–${(perfilAtivo.w_max * 100).toFixed(0)}%` : "rule"})`
                    : m.peso.valor != null ? `${(m.peso.valor * 100).toFixed(0)}%` : m.peso.modo;

                  return (
                    <div key={m.id}>
                      {/* engine row */}
                      <div style={{ ...treeRow, ...treeIndent(0) }} onClick={() => setExp(toggle(exp, mKey))}>
                        <i className="ti ti-chevron-right" style={chevron(mOpen)} />
                        <i className={`ti ${motorIcon(m.tipo)}`} style={{ color: motorColor(m.tipo), fontSize: 16 }} />
                        <b style={{ fontSize: 13 }}>Engine {m.id}: {m.nome}</b>
                        <span style={{ fontSize: 10, color: "var(--tx3)" }}>{m.versao}</span>
                        {statusTag(m.status)}
                        <span className="tag b" style={{ fontSize: 8, marginLeft: "auto" }}>{pesoLabel}</span>
                      </div>

                      {mOpen && (
                        <div style={treeIndent(1)}>
                          {/* engine meta */}
                          {m.tipo.startsWith("attack") && (
                            <div style={{ fontSize: 10, color: "var(--tx3)", padding: "2px 0 6px 32px" }}>
                              {pilares.length} pillar(s) · {nEsteiras} strategy(ies) · {nAtivos} assets
                            </div>
                          )}
                          {m.estrutura?.buckets_n && (
                            <div style={{ fontSize: 10, color: "var(--tx3)", padding: "2px 0 6px 32px" }}>
                              {m.estrutura.buckets_n} buckets · {m.estrutura.etfs_n} ETFs · {m.estrutura.signal || ""}
                            </div>
                          )}

                          {/* formulas (detector) */}
                          {formulas.map(f => (
                            <div key={f.id} style={{ ...treeRow, ...treeIndent(1) }}>
                              <i className="ti ti-math-function" style={{ color: "var(--tx3)", fontSize: 12 }} />
                              <span style={{ fontSize: 11 }}>{f.descricao}</span>
                              <span className="tag b" style={{ fontSize: 8 }}>weight {f.peso}</span>
                            </div>
                          ))}

                          {/* pilares */}
                          {pilares.map(pil => {
                            const pKey = `p:${m.id}:${pil.nome}`;
                            const pOpen = !!exp[pKey];
                            return (
                              <div key={pil.nome}>
                                <div style={{ ...treeRow, ...treeIndent(1) }} onClick={() => setExp(toggle(exp, pKey))}>
                                  <i className="ti ti-chevron-right" style={chevron(pOpen)} />
                                  <i className={`ti ${I.pilar}`} style={{ color: "var(--blue)", fontSize: 14 }} />
                                  <b style={{ fontSize: 12.5 }}>{pil.nome}</b>
                                  <span className="tag b" style={{ fontSize: 8 }}>{pil.peso_pct}%</span>
                                  {pil.peso_modo && <span style={{ fontSize: 9, color: "var(--tx3)" }}>{pil.peso_modo}</span>}
                                  <span style={{ fontSize: 10, color: "var(--tx3)", marginLeft: "auto" }}>{pil.esteiras.length} strategy(ies)</span>
                                </div>

                                {pOpen && pil.esteiras.map(est => {
                                  const eKey = `e:${m.id}:${est.nome}`;
                                  const eOpen = !!exp[eKey];
                                  return (
                                    <div key={est.nome}>
                                      <div style={{ ...treeRow, ...treeIndent(2) }} onClick={() => setExp(toggle(exp, eKey))}>
                                        <i className="ti ti-chevron-right" style={chevron(eOpen)} />
                                        <i className={`ti ${I.esteira}`} style={{ color: "var(--tx2)", fontSize: 13 }} />
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>{est.nome}</span>
                                        <span className="tag b" style={{ fontSize: 8 }}>{est.peso_pct}%</span>
                                        <span style={{ fontSize: 10, color: "var(--tx3)" }}>{est.ativos?.length || 0} assets</span>
                                      </div>

                                      {eOpen && est.ativos && est.ativos.length > 0 && (
                                        <div style={treeIndent(3)}>
                                          <table style={{ width: "100%", fontSize: 11.5 }}>
                                            <thead>
                                              <tr>
                                                <th style={{ textAlign: "left", paddingLeft: 32 }}>Asset</th>
                                                <th>Type</th>
                                                <th style={{ textAlign: "right" }}>Weight</th>
                                                <th style={{ textAlign: "center", minWidth: 120 }}>Momentum</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {est.ativos.map(a => {
                                                const am = momByTicker[a.ticker];
                                                const isLeader = am?.active_buy;
                                                return (
                                                <tr key={a.ticker} style={isLeader ? { background: "rgba(74,144,217,0.08)" } : undefined}>
                                                  <td style={{ paddingLeft: 32 }}>
                                                    <span className="tk-link" onClick={() => go("chart", a.ticker)} style={{ fontWeight: 700 }}>{a.ticker}</span>
                                                    {isLeader && <span className="tag g" style={{ fontSize: 8, marginLeft: 6, fontWeight: 700 }}>ACTIVE BUY</span>}
                                                  </td>
                                                  <td><span className={`atype atype-${(a.tipo || "").replace(/[ÃÇ]/g, "")}`} style={{ fontSize: 9 }}>{a.tipo || "—"}</span></td>
                                                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>{a.peso_pct}%</td>
                                                  <td style={{ minWidth: 120 }}>
                                                    <MomentumBar value={am?.mom_j37 ?? null} scale={20} suffix="" height={14} />
                                                  </td>
                                                </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : useLegacy ? (
              /* legacy: pillars/sleeves at portfolio top-level */
              <div style={{ marginTop: 12, borderLeft: "2px solid rgba(201,160,44,0.18)", paddingLeft: 8 }}>
                {legacyPilares.map(pil => {
                  const pKey = `lp:${pil.nome}`;
                  const pOpen = !!exp[pKey];
                  return (
                    <div key={pil.nome}>
                      <div style={{ ...treeRow, ...treeIndent(0) }} onClick={() => setExp(toggle(exp, pKey))}>
                        <i className="ti ti-chevron-right" style={chevron(pOpen)} />
                        <i className={`ti ${I.pilar}`} style={{ color: "var(--blue)", fontSize: 14 }} />
                        <b style={{ fontSize: 12.5 }}>{pil.nome}</b>
                        <span className="tag b" style={{ fontSize: 8 }}>{pil.peso_pct}%</span>
                        <span style={{ fontSize: 10, color: "var(--tx3)", marginLeft: "auto" }}>{pil.esteiras.length} strategy(ies)</span>
                      </div>
                      {pOpen && pil.esteiras.map(est => {
                        const eKey = `le:${est.nome}`;
                        const eOpen = !!exp[eKey];
                        return (
                          <div key={est.nome}>
                            <div style={{ ...treeRow, ...treeIndent(1) }} onClick={() => setExp(toggle(exp, eKey))}>
                              <i className="ti ti-chevron-right" style={chevron(eOpen)} />
                              <i className={`ti ${I.esteira}`} style={{ color: "var(--tx2)", fontSize: 13 }} />
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{est.nome}</span>
                              <span className="tag b" style={{ fontSize: 8 }}>{est.peso_pct}%</span>
                              <span style={{ fontSize: 10, color: "var(--tx3)" }}>{est.ativos?.length || 0} assets</span>
                            </div>
                            {eOpen && est.ativos && est.ativos.length > 0 && (
                              <div style={treeIndent(2)}>
                                <table style={{ width: "100%", fontSize: 11.5 }}>
                                  <thead><tr><th style={{ textAlign: "left", paddingLeft: 32 }}>Asset</th><th>Type</th><th style={{ textAlign: "right" }}>Weight</th></tr></thead>
                                  <tbody>
                                    {est.ativos.map(a => (
                                      <tr key={a.ticker}>
                                        <td style={{ paddingLeft: 32 }}><span className="tk-link" onClick={() => go("chart", a.ticker)} style={{ fontWeight: 700 }}>{a.ticker}</span></td>
                                        <td><span className={`atype atype-${(a.tipo || "").replace(/[ÃÇ]/g, "")}`} style={{ fontSize: 9 }}>{a.tipo || "—"}</span></td>
                                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>{a.peso_pct}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {legacyEsteiras.map(est => (
                  <div key={est.nome} style={{ ...treeRow, ...treeIndent(0) }}>
                    <i className={`ti ${I.esteira}`} style={{ color: "var(--tx2)", fontSize: 13 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{est.nome}</span>
                    <span className="tag b" style={{ fontSize: 8 }}>{est.peso_pct}%</span>
                    <span style={{ fontSize: 10, color: "var(--tx3)" }}>{est.ativos?.length || 0} assets</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="c-mut2" style={{ padding: 24, textAlign: "center", fontSize: 12 }}>
                Portfolio has no composition defined — add engines in Portfolio Studio.
              </div>
            )}
          </div>

          {/* ══════════ Pending tickets ══════════ */}
          <div className="card mb">
            <h2>
              <span>Pending tickets</span>
              <span className={`tag ${isModel ? "b" : "a"}`} style={{ marginLeft: "auto" }}>
                {tickets.length} · {isModel ? "SIMULATION" : "EXECUTES IBKR"}
              </span>
            </h2>
            {tickets.length === 0 ? (
              <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>no pending tickets</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Asset</th><th>Type</th><th>Side</th><th style={{ textAlign: "right" }}>Value</th><th>Reason</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} style={{ opacity: isModel ? 0.75 : 1 }}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", t.ticker)}>{t.ticker}</span></td>
                      <td><span className={`type-badge type-${t.tipo}`}>{t.tipo}</span></td>
                      <td><span className={`side ${t.side}`}>{t.side === "buy" ? "BUY" : "SELL"}</span></td>
                      <td style={{ textAlign: "right" }}>${(t.valor_usd / 1000).toFixed(0)}k</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{t.motivo || "—"}</td>
                      <td><span className={`tag ${t.status === "enviado" ? "g" : "a"}`}>{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="foot">
        Portfolio {p?.nome} · {isModel ? "model (no IBKR)" : `IBKR ${p?.ibkr_account_id}`} · Owner {p?.owner || "—"}
      </div>
    </div>
  );
}

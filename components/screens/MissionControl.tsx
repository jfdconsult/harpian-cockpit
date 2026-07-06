"use client";
import { useEffect, useState } from "react";
import { apiGet, fmtUSD, semColor } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import ExecuteOrderModal from "@/components/ExecuteOrderModal";
import type { ScreenId } from "@/lib/nav";

interface Portfolio {
  id: string;
  nome: string;
  descricao: string;
  regime: string;
  alocado_usd: number;
  exposicao_pct: number;
  dd_mes_pct: number;
  risk_number: number;
  mudancas_entradas: number;
  mudancas_saidas: number;
  mode?: "active" | "model";
  owner?: string;
  capital_type?: "real" | "simbolico";
  capital_usd?: number;
  ibkr_account_id?: string | null;
  etp_listed?: boolean;
  isin?: string | null;
}

interface Ticket {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  portfolio_id: string;
  valor_usd: number;
  status: string;
}

interface DashboardData {
  portfolios: Portfolio[];
  resumo: {
    total_alocado_usd: number;
    mudancas_hoje: number;
    tickets_pendentes: number;
    regime_global: string;
  };
  tickets: Ticket[];
}

interface Quote {
  ticker: string;
  name?: string;
  last?: number;
  day_pct?: number;
  ok: boolean;
}

const PORT_LABEL: Record<string, string> = { HPC11: "HPC11", HPC22: "HPC22", HCUST: "HC-US TOTAL" };

export default function MissionControl({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [ticketFilter, setTicketFilter] = useState<string>("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [connStatus, setConnStatus] = useState<"connecting" | "ok" | "error">("connecting");
  const [mktStatus, setMktStatus] = useState<"ok" | "error">("ok");
  const [connError, setConnError] = useState("");
  const [execTicketId, setExecTicketId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<DashboardData>("/v1/dashboard")
      .then((d) => {
        setDash(d);
        setConnStatus("ok");
      })
      .catch((e) => {
        setConnStatus("error");
        setConnError(e.message);
      });

    apiGet<{ quotes: Quote[] }>("/v1/market/quotes")
      .then((d) => setQuotes(d.quotes))
      .catch(() => setMktStatus("error"));
  }, []);

  useEffect(() => {
    if (!dash) return;
    publishScreenData(
      "mission-control",
      `US$ ${dash.resumo.total_alocado_usd.toLocaleString("pt-BR")} alocado, ${dash.resumo.mudancas_hoje} mudanças, ${dash.resumo.tickets_pendentes} tickets, regime ${dash.resumo.regime_global}`,
      dash.portfolios,
      {
        briefing: `${dash.portfolios.length} portfólios com US$ ${dash.resumo.total_alocado_usd.toLocaleString("pt-BR")} alocados. Regime global ${dash.resumo.regime_global}, ${dash.resumo.mudancas_hoje} mudanças e ${dash.resumo.tickets_pendentes} tickets pendentes.`,
      }
    );
  }, [dash]);

  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">Mission Control</div>
          <div className="sub">Estado ao vivo dos portfólios, mudanças do dia e tickets — direto da API /v1.</div>
        </div>
        <div className={`tag ${connStatus === "ok" ? "b" : connStatus === "error" ? "r" : "b"}`}>
          {connStatus === "connecting" ? "conectando…" : connStatus === "ok" ? "API ao vivo" : `API offline (${connError})`}
        </div>
      </div>

      {!dash && connStatus === "connecting" && (
        <>
          <div className="grid g4 mb">
            {[0, 1, 2, 3].map((i) => (
              <div className="kpi" key={i}>
                <div className="skeleton" style={{ width: "60%", height: 10, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: "40%", height: 24 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div className="card" key={i} style={{ minWidth: 320, height: 210 }}>
                <div className="skeleton" style={{ width: "50%", height: 12, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: "80%", height: 10, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "70%", height: 10, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "75%", height: 10 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {!dash && connStatus === "error" && (
        <div className="ph mb">
          <b>API não respondeu</b>
          Suba a API: <code>uvicorn app.main:app --port 8080</code>
        </div>
      )}

      {dash && (
        <>
          <div className="grid g4 mb">
            <div className="kpi">
              <div className="l">Total alocado</div>
              <div className="v">{fmtUSD(dash.resumo.total_alocado_usd)}</div>
              <div className="s">{dash.portfolios.length} portfólios</div>
            </div>
            <div className="kpi">
              <div className="l">Mudanças hoje</div>
              <div className="v c-a">{dash.resumo.mudancas_hoje}</div>
            </div>
            <div className="kpi">
              <div className="l">Tickets pendentes</div>
              <div className="v c-b">{dash.resumo.tickets_pendentes}</div>
            </div>
            <div className="kpi">
              <div className="l">Regime global</div>
              <div className="v c-g">{dash.resumo.regime_global}</div>
            </div>
          </div>

          <div className="flex between" style={{ margin: "4px 0 10px", alignItems: "baseline" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--gold)" }}>
              Portfólios · {dash.portfolios.filter((p) => p.mode === "active").length} ativo{dash.portfolios.filter((p) => p.mode === "active").length !== 1 ? "s" : ""} ·{" "}
              {dash.portfolios.filter((p) => p.mode !== "active").length} modelo{dash.portfolios.filter((p) => p.mode !== "active").length !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: 10, color: "var(--tx3)", display: "flex", alignItems: "center", gap: 4 }}><i className="ti ti-arrows-horizontal" style={{ fontSize: 12 }} />role para ver mais portfolios</div>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
            {dash.portfolios.map((p) => {
              const isModel = p.mode === "model";
              return (
              <div
                className="card clickable"
                key={p.id}
                onClick={() => go("portfolio", p.id)}
                style={{
                  minWidth: 320,
                  flex: "0 0 320px",
                  opacity: isModel ? 0.72 : 1,
                  filter: isModel ? "grayscale(0.35)" : "none",
                  borderColor: isModel ? "var(--line)" : "var(--blue)",
                  borderWidth: isModel ? 1 : 1.5,
                }}
              >
                <div className="flex between" style={{ marginBottom: 4 }}>
                  <span
                    className="tag"
                    style={{
                      background: isModel ? "rgba(125,150,179,0.12)" : "rgba(74,144,217,0.18)",
                      color: isModel ? "var(--tx3)" : "var(--blue)",
                      border: `1px solid ${isModel ? "rgba(125,150,179,0.35)" : "var(--blue)"}`,
                      fontSize: 9,
                      letterSpacing: 1,
                    }}
                  >
                    {isModel ? "MODELO · DEMO" : "ATIVO · ETP"}
                  </span>
                  <span className={`statechip ${semColor(p.regime)}`}>{p.regime}</span>
                </div>
                <div className="flex between" style={{ marginBottom: 6 }}>
                  <div>
                    <b style={{ fontSize: 18, color: isModel ? "var(--tx2)" : "var(--tx)" }}>{p.nome}</b>
                    <div className="c-mut" style={{ fontSize: 11 }}>{p.descricao}</div>
                  </div>
                </div>
                <div className="kv" style={{ fontSize: 11 }}>
                  <span className="c-mut">Owner</span>
                  <span className="v">{p.owner || "—"}</span>
                </div>
                {p.mode === "active" ? (
                  <>
                    <div className="kv"><span className="c-mut">ISIN</span><span className="v" style={{ fontSize: 11 }}>{p.isin || "—"}</span></div>
                    <div className="kv"><span className="c-mut">IBKR account</span><span className="v" style={{ fontSize: 11, color: "var(--blue)" }}>{p.ibkr_account_id || "—"}</span></div>
                  </>
                ) : (
                  <div className="kv"><span className="c-mut">Capital simbólico</span><span className="v" style={{ color: "var(--tx3)" }}>{fmtUSD(p.capital_usd || 0)}</span></div>
                )}
                <div className="kv"><span className="c-mut">Alocado</span><span className="v">{fmtUSD(p.alocado_usd)}</span></div>
                <div className="kv">
                  <span className="c-mut">Mudanças hoje</span>
                  <span className="v"><span className="c-g"><i className="ti ti-caret-up-filled" style={{ fontSize: 10 }} />{p.mudancas_entradas}</span> <span className="c-r"><i className="ti ti-caret-down-filled" style={{ fontSize: 10 }} />{p.mudancas_saidas}</span></span>
                </div>
                <div className="kv"><span className="c-mut">Exposição</span><span className="v">{p.exposicao_pct}%</span></div>
                <div className="kv"><span className="c-mut">DD do mês</span><span className="v c-r">{p.dd_mes_pct.toFixed(1).replace(".", ",")}%</span></div>
                <div className="kv"><span className="c-mut">Risk Number</span><span className={`v c-${semColor(p.regime)}`}>{p.risk_number}</span></div>
                <div style={{ marginTop: 8, fontSize: 10, color: isModel ? "var(--tx3)" : "var(--blue)", textTransform: "uppercase", letterSpacing: .8 }}>
                  {isModel ? "Ordens não executam · simulação" : "Ordens executam via IBKR"}
                </div>
              </div>
              );
            })}
          </div>

          <div className="grid g2 mb">
            <div className="card">
              <h2>
                <span>Tickets do dia · a executar</span>
                <select
                  className="input"
                  value={ticketFilter}
                  onChange={(e) => setTicketFilter(e.target.value)}
                  style={{ marginLeft: "auto", fontSize: 11, padding: "4px 8px", minWidth: 160 }}
                >
                  <option value="">Todos os portfólios</option>
                  {dash.portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.mode === "active" ? "· ATIVO" : "· MODELO"}
                    </option>
                  ))}
                </select>
              </h2>
              <table>
                <thead><tr><th>Ativo</th><th>Lado</th><th>Portfólio</th><th style={{ textAlign: "right" }}>Valor</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {dash.tickets.filter((t) => !ticketFilter || t.portfolio_id === ticketFilter).map((t) => {
                    const port = dash.portfolios.find((p) => p.id === t.portfolio_id);
                    const isModel = port?.mode === "model";
                    return (
                    <tr key={t.id} style={{ opacity: isModel ? 0.72 : 1 }}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", t.ticker)}>{t.ticker}</span></td>
                      <td><span className={`side ${t.side}`}>{t.side === "buy" ? "COMPRAR" : "VENDER"}</span></td>
                      <td style={{ fontSize: 11 }}>
                        {PORT_LABEL[t.portfolio_id] || t.portfolio_id}
                        <span
                          style={{
                            marginLeft: 5,
                            fontSize: 8,
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: isModel ? "rgba(125,150,179,0.12)" : "rgba(74,144,217,0.18)",
                            color: isModel ? "var(--tx3)" : "var(--blue)",
                            letterSpacing: .5,
                          }}
                        >
                          {isModel ? "MODELO" : "ATIVO"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>US$ {(t.valor_usd / 1000).toFixed(0)}k</td>
                      <td><span className={`tag ${t.status === "pendente" ? "a" : t.status === "rejeitado" ? "r" : "b"}`}>{t.status}</span></td>
                      <td style={{ textAlign: "right" }}>
                        {t.status === "pendente" ? (
                          <button className="btn ghost" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setExecTicketId(t.id)}>
                            <i className="ti ti-send" />Executar
                          </button>
                        ) : (
                          <span className="c-mut" style={{ fontSize: 10 }}>—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2>
                <span>Mercado · ao vivo</span>
                <span className={`tag ${mktStatus === "ok" ? "b" : "r"}`}>{mktStatus === "ok" ? "Yahoo · EOD/last" : "mercado offline"}</span>
              </h2>
              <table>
                <thead><tr><th>Ticker</th><th>Nome</th><th style={{ textAlign: "right" }}>Último</th><th style={{ textAlign: "right" }}>Dia</th></tr></thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.ticker}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", q.ticker)}>{q.ticker}</span></td>
                      {q.ok ? (
                        <>
                          <td className="c-mut" style={{ fontSize: 11 }}>{(q.name || "").slice(0, 20)}</td>
                          <td style={{ textAlign: "right" }}>{q.last != null ? q.last.toLocaleString("pt-BR") : "—"}</td>
                          <td style={{ textAlign: "right" }} className={q.day_pct != null && q.day_pct >= 0 ? "c-g" : "c-r"}>
                            {q.day_pct != null ? `${q.day_pct >= 0 ? "+" : ""}${q.day_pct.toFixed(2).replace(".", ",")}%` : "—"}
                          </td>
                        </>
                      ) : (
                        <td className="c-mut2" colSpan={3}>indisponível</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="foot">Cockpit Gestor · v1 · consome a HQP API (/v1). Design system compartilhado (harpian-ds). Dados via mock adapters até plugar os motores.</div>

      {execTicketId && (
        <ExecuteOrderModal
          ticketId={execTicketId}
          onClose={() => setExecTicketId(null)}
          onExecuted={(updated) => {
            setDash((prev) => prev ? {
              ...prev,
              tickets: prev.tickets.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t)),
              resumo: { ...prev.resumo, tickets_pendentes: Math.max(0, prev.resumo.tickets_pendentes - 1) },
            } : prev);
          }}
        />
      )}
    </div>
  );
}

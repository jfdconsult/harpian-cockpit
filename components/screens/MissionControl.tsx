"use client";
import { useEffect, useState } from "react";
import { apiGet, fmtUSD, semColor } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import ExecuteOrderModal from "@/components/ExecuteOrderModal";
import type { ScreenId } from "@/lib/nav";

// t.status stays in Portuguese (matched against the live /v1 API); this is
// only for what's rendered on screen.
const TICKET_STATUS_TXT: Record<string, string> = {
  pendente: "PENDING",
  aprovado: "APPROVED",
  enviado: "SENT",
  rejeitado: "REJECTED",
};

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

const PORT_LABEL: Record<string, string> = { HPC11: "HPC11", HPC22: "HPC22", LCORE22: "Lynk Core22 HPC", HCUST: "HC-US TOTAL" };

export default function MissionControl({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [ticketFilter, setTicketFilter] = useState<string>("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [connStatus, setConnStatus] = useState<"connecting" | "ok" | "error">("connecting");
  const [mktStatus, setMktStatus] = useState<"ok" | "error">("ok");
  const [connError, setConnError] = useState("");
  const [execTicketId, setExecTicketId] = useState<string | null>(null);
  const [hideInactive, setHideInactive] = useState(false);

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
      .then((d) => setQuotes(d.quotes || []))
      .catch(() => setMktStatus("error"));
  }, []);

  useEffect(() => {
    if (!dash) return;
    publishScreenData(
      "mission-control",
      `$${dash.resumo.total_alocado_usd.toLocaleString("en-US")} allocated, ${dash.resumo.mudancas_hoje} changes, ${dash.resumo.tickets_pendentes} tickets, regime ${dash.resumo.regime_global}`,
      dash.portfolios,
      {
        briefing: `${dash.portfolios.length} portfolios with $${dash.resumo.total_alocado_usd.toLocaleString("en-US")} allocated. Global regime ${dash.resumo.regime_global}, ${dash.resumo.mudancas_hoje} changes and ${dash.resumo.tickets_pendentes} pending tickets.`,
      }
    );
  }, [dash]);

  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">Mission Control</div>
          <div className="sub">Live status of portfolios, today&apos;s changes and tickets — straight from the /v1 API.</div>
        </div>
        <div className={`tag ${connStatus === "ok" ? "b" : connStatus === "error" ? "r" : "b"}`}>
          {connStatus === "connecting" ? "connecting…" : connStatus === "ok" ? "API live" : `API offline (${connError})`}
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
          <b>API did not respond</b>
          Start the API: <code>uvicorn app.main:app --port 8080</code>
        </div>
      )}

      {dash && (
        <>
          <div className="grid g4 mb">
            <div className="kpi kpi-compact clickable" onClick={() => go("portfolio", dash.portfolios.find(p => p.mode === "active")?.id || dash.portfolios[0]?.id)}>
              <div className="kpi-row"><span className="l">Total allocated</span><span className="v">{fmtUSD(dash.resumo.total_alocado_usd)}</span></div>
              <div className="s">{dash.portfolios.length} portfolios</div>
            </div>
            <div className="kpi kpi-compact clickable" onClick={() => go("ticket")}>
              <div className="kpi-row"><span className="l">Changes today</span><span className="v c-a">{dash.resumo.mudancas_hoje}</span></div>
            </div>
            <div className="kpi kpi-compact clickable" onClick={() => go("ticket")}>
              <div className="kpi-row"><span className="l">Pending tickets</span><span className="v c-b">{dash.resumo.tickets_pendentes}</span></div>
            </div>
            <div className="kpi kpi-compact clickable" onClick={() => go("regime")}>
              <div className="kpi-row"><span className="l">Global regime</span><span className={`v c-${semColor(dash.resumo.regime_global)}`}>{dash.resumo.regime_global}</span></div>
            </div>
          </div>

          <div className="flex between" style={{ margin: "4px 0 10px", alignItems: "baseline" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--gold)" }}>
              Portfolios · {dash.portfolios.filter((p) => p.mode === "active").length} active{dash.portfolios.filter((p) => p.mode === "active").length !== 1 ? "s" : ""} ·{" "}
              {dash.portfolios.filter((p) => p.mode !== "active").length} model{dash.portfolios.filter((p) => p.mode !== "active").length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => setHideInactive(!hideInactive)}>
                <i className={`ti ${hideInactive ? "ti-eye-off" : "ti-eye"}`} style={{ fontSize: 11 }} />
                {hideInactive ? "Show inactive" : "Hide inactive"}
              </button>
              <span style={{ fontSize: 10, color: "var(--tx3)", display: "flex", alignItems: "center", gap: 4 }}><i className="ti ti-arrows-horizontal" style={{ fontSize: 12 }} />scroll to see more</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
            {[...dash.portfolios].sort((a, b) => (a.mode === "active" ? 0 : 1) - (b.mode === "active" ? 0 : 1)).filter((p) => !hideInactive || p.mode === "active").map((p) => {
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
                    {isModel ? "MODEL · DEMO" : "ACTIVE · ETP"}
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
                  <div className="kv"><span className="c-mut">Symbolic capital</span><span className="v" style={{ color: "var(--tx3)" }}>{fmtUSD(p.capital_usd || 0)}</span></div>
                )}
                <div className="kv"><span className="c-mut">Allocated</span><span className="v">{fmtUSD(p.alocado_usd)}</span></div>
                <div className="kv">
                  <span className="c-mut">Changes today</span>
                  <span className="v"><span className="c-g"><i className="ti ti-caret-up-filled" style={{ fontSize: 10 }} />{p.mudancas_entradas}</span> <span className="c-r"><i className="ti ti-caret-down-filled" style={{ fontSize: 10 }} />{p.mudancas_saidas}</span></span>
                </div>
                <div className="kv"><span className="c-mut">Exposure</span><span className="v">{p.exposicao_pct}%</span></div>
                <div className="kv"><span className="c-mut">Monthly DD</span><span className="v c-r">{p.dd_mes_pct.toFixed(1)}%</span></div>
                <div className="kv"><span className="c-mut">Risk Number</span><span className={`v c-${semColor(p.regime)}`}>{p.risk_number}</span></div>
                <div style={{ marginTop: 8, fontSize: 10, color: isModel ? "var(--tx3)" : "var(--blue)", textTransform: "uppercase", letterSpacing: .8 }}>
                  {isModel ? "Orders do not execute · simulation" : "Orders execute via IBKR"}
                </div>
              </div>
              );
            })}
          </div>

          <div className="grid g2 mb">
            <div className="card">
              <h2>
                <span>Today&apos;s tickets · to execute</span>
                <select
                  className="input"
                  value={ticketFilter}
                  onChange={(e) => setTicketFilter(e.target.value)}
                  style={{ marginLeft: "auto", fontSize: 11, padding: "4px 8px", minWidth: 160 }}
                >
                  <option value="">All portfolios</option>
                  {dash.portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.mode === "active" ? "· ACTIVE" : "· MODEL"}
                    </option>
                  ))}
                </select>
              </h2>
              <table>
                <thead><tr><th>Asset</th><th>Side</th><th>Portfolio</th><th style={{ textAlign: "right" }}>Value</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {dash.tickets.filter((t) => !ticketFilter || t.portfolio_id === ticketFilter).map((t) => {
                    const port = dash.portfolios.find((p) => p.id === t.portfolio_id);
                    const isModel = port?.mode === "model";
                    return (
                    <tr key={t.id} style={{ opacity: isModel ? 0.72 : 1 }}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", t.ticker)}>{t.ticker}</span></td>
                      <td><span className={`side ${t.side}`}>{t.side === "buy" ? "BUY" : "SELL"}</span></td>
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
                          {isModel ? "MODEL" : "ACTIVE"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>${(t.valor_usd / 1000).toFixed(0)}k</td>
                      <td><span className={`tag ${t.status === "pendente" ? "a" : t.status === "rejeitado" ? "r" : "b"}`}>{TICKET_STATUS_TXT[t.status] || t.status}</span></td>
                      <td style={{ textAlign: "right" }}>
                        {t.status === "pendente" ? (
                          <button className="btn ghost" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setExecTicketId(t.id)}>
                            <i className="ti ti-send" />Execute
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
                <span>Market · live</span>
                <span className={`tag ${mktStatus === "ok" ? "b" : "r"}`}>{mktStatus === "ok" ? "Yahoo · EOD/last" : "market offline"}</span>
              </h2>
              <table>
                <thead><tr><th>Ticker</th><th>Name</th><th style={{ textAlign: "right" }}>Last</th><th style={{ textAlign: "right" }}>Day</th></tr></thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.ticker}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", q.ticker)}>{q.ticker}</span></td>
                      {q.ok ? (
                        <>
                          <td className="c-mut" style={{ fontSize: 11 }}>{(q.name || "").slice(0, 20)}</td>
                          <td style={{ textAlign: "right" }}>{q.last != null ? q.last.toLocaleString("en-US") : "—"}</td>
                          <td style={{ textAlign: "right" }} className={q.day_pct != null && q.day_pct >= 0 ? "c-g" : "c-r"}>
                            {q.day_pct != null ? `${q.day_pct >= 0 ? "+" : ""}${q.day_pct.toFixed(2)}%` : "—"}
                          </td>
                        </>
                      ) : (
                        <td className="c-mut2" colSpan={3}>unavailable</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="foot">Manager Cockpit · v1 · consumes the HQP API (/v1). Shared design system (harpian-ds). Data via mock adapters until the engines are plugged in.</div>

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

"use client";
import { Fragment, useEffect, useState } from "react";
import { apiGet, fmtUSD, semColor } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import MomentumBar from "@/components/MomentumBar";
import type { ScreenId } from "@/lib/nav";

interface Ativo { ticker: string; tipo: string; peso_pct: number }
interface Esteira { nome: string; peso_pct: number; ativos: Ativo[] }
interface Pilar { nome: string; peso_pct: number; esteiras: Esteira[] }
interface Portfolio {
  id: string; nome: string; descricao: string; isin?: string | null;
  motor: string; motor_version: string;
  mode?: "active" | "model"; owner?: string;
  capital_type?: "real" | "simbolico"; capital_usd?: number;
  ibkr_account_id?: string | null; etp_listed?: boolean;
  regime: string; alocado_usd: number; exposicao_pct: number; dd_mes_pct: number; risk_number: number;
  cagr_pct?: number; sortino?: number; calmar?: number; max_dd_pct?: number; cota?: number; estado?: string;
  pilares?: Pilar[]; esteiras?: Esteira[];
}
interface Ticket {
  id: string; ticker: string; nome?: string; side: "buy" | "sell"; tipo: string;
  portfolio_id: string; valor_usd: number; status: string; mom_126d?: number; motivo?: string;
}
interface EsteiraMom {
  nome: string; pilar: string | null; peso_pct: number;
  mom_j37: number | null; mom_d13: number | null;
  long_n: number; short_n: number; n_ativos: number; tickers: string[];
}
interface MomentumResp {
  portfolio_id: string; nome: string; motor: string; regime: string;
  n_esteiras: number; esteiras: EsteiraMom[];
}

export default function PortfolioScreen({ portfolioId, go }: { portfolioId: string; go: (id: ScreenId, param?: string) => void }) {
  const [p, setP] = useState<Portfolio | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mom, setMom] = useState<MomentumResp | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    apiGet<Portfolio>(`/v1/strategies/${portfolioId}`)
      .then((d) => { setP(d); setConn("ok"); })
      .catch(() => setConn("error"));
    apiGet<{ tickets: Ticket[] }>(`/v1/tickets?portfolio_id=${portfolioId}`)
      .then((d) => setTickets(d.tickets || []))
      .catch(() => {});
    apiGet<MomentumResp>(`/v1/strategies/${portfolioId}/momentum`)
      .then(setMom)
      .catch(() => {});
  }, [portfolioId]);

  const isModel = p?.mode === "model";
  const flatAtivos: (Ativo & { esteira: string })[] = [];
  if (p) {
    for (const pil of p.pilares || []) {
      for (const est of pil.esteiras || []) {
        for (const a of est.ativos || []) flatAtivos.push({ ...a, esteira: est.nome });
      }
    }
    for (const est of p.esteiras || []) {
      for (const a of est.ativos || []) flatAtivos.push({ ...a, esteira: est.nome });
    }
  }

  useEffect(() => {
    if (!p) return;
    publishScreenData(
      "portfolio",
      `${p.nome}, US$ ${p.alocado_usd.toLocaleString("pt-BR")} alocado, regime ${p.regime}, Risk Number ${p.risk_number}, ${tickets.length} tickets`,
      { portfolio: p, tickets, momentum: mom },
      {
        briefing: `Portfólio ${p.nome} com US$ ${p.alocado_usd.toLocaleString("pt-BR")} alocados em regime ${p.regime}. Exposição ${p.exposicao_pct}%, DD mês ${p.dd_mes_pct.toFixed(1)}%, ${tickets.length} tickets pendentes.`,
      }
    );
  }, [p, tickets, mom]);

  const ganhadores = (mom?.esteiras || []).filter((e) => (e.mom_j37 ?? 0) > 0).sort((a, b) => (b.mom_j37 ?? 0) - (a.mom_j37 ?? 0));
  const perdedores = (mom?.esteiras || []).filter((e) => (e.mom_j37 ?? 0) <= 0).sort((a, b) => (a.mom_j37 ?? 0) - (b.mom_j37 ?? 0));

  return (
    <div className="screen">
      <div className="flex between wrap mb">
        <div>
          <div style={{ fontSize: 11, color: "var(--tx2)" }}>
            <span className="tk-link" onClick={() => go("mission-control")}>← Mission Control</span>
          </div>
          <div className="h1">
            {p?.nome || portfolioId}
            {p && (
              <span
                className="tag"
                style={{
                  marginLeft: 12,
                  background: isModel ? "rgba(125,150,179,0.12)" : "rgba(74,144,217,0.18)",
                  color: isModel ? "var(--tx3)" : "var(--blue)",
                  border: `1px solid ${isModel ? "rgba(125,150,179,0.35)" : "var(--blue)"}`,
                  fontSize: 10,
                  letterSpacing: 1,
                  verticalAlign: "middle",
                }}
              >
                {isModel ? "MODELO · DEMO" : "ATIVO · ETP"}
              </span>
            )}
          </div>
          <div className="sub">{p?.descricao} · Motor {p?.motor} {p?.motor_version}</div>
        </div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "carregando…" : conn === "ok" ? "● API ao vivo" : "✕ offline"}
        </div>
      </div>

      {p && (
        <>
          <div className="grid g4 mb">
            <div className="kpi">
              <div className="l">{isModel ? "Capital simbólico" : "Alocado (real)"}</div>
              <div className="v">{fmtUSD(p.alocado_usd)}</div>
              <div className="s">{isModel ? "portfolio modelo" : `IBKR ${p.ibkr_account_id || "—"}`}</div>
            </div>
            <div className="kpi">
              <div className="l">Regime</div>
              <div className={`v c-${semColor(p.regime)}`}>{p.regime}</div>
              <div className="s">Risk Number {p.risk_number}</div>
            </div>
            <div className="kpi">
              <div className="l">Exposição</div>
              <div className="v">{p.exposicao_pct}%</div>
              <div className="s">DD mês {p.dd_mes_pct.toFixed(1).replace(".", ",")}%</div>
            </div>
            <div className="kpi">
              <div className="l">Cota</div>
              <div className="v">US$ {(p.cota || 0).toFixed(2)}</div>
              <div className="s">Owner {p.owner || "—"}</div>
            </div>
          </div>

          <div className="grid g2 mb" style={{ gap: 14 }}>
            <div className="card">
              <h2>
                <span>Momentum · ganhou hoje</span>
                <span className="tag g" style={{ marginLeft: "auto" }}>{ganhadores.length} esteira{ganhadores.length !== 1 ? "s" : ""}</span>
              </h2>
              {ganhadores.length === 0 ? (
                <div className="c-mut2" style={{ padding: 12, fontSize: 11 }}>calculando…</div>
              ) : (
                <table>
                  <thead><tr><th>Esteira</th><th style={{ textAlign: "right" }}>Peso</th><th style={{ textAlign: "center", minWidth: 140 }}>J37</th></tr></thead>
                  <tbody>
                    {ganhadores.map((e, i) => (
                      <tr key={e.nome}>
                        <td>
                          <b style={{ fontSize: 12.5 }}>{e.nome}</b>
                          {i === 0 && <span className="tag g" style={{ marginLeft: 6, fontSize: 8 }}>LÍDER</span>}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>{e.peso_pct}%</td>
                        <td style={{ minWidth: 140 }}><MomentumBar value={e.mom_j37} scale={20} suffix="" height={16} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h2>
                <span>Momentum · perdeu hoje</span>
                <span className="tag r" style={{ marginLeft: "auto" }}>{perdedores.length} esteira{perdedores.length !== 1 ? "s" : ""}</span>
              </h2>
              {perdedores.length === 0 ? (
                <div className="c-mut2" style={{ padding: 12, fontSize: 11 }}>—</div>
              ) : (
                <table>
                  <thead><tr><th>Esteira</th><th style={{ textAlign: "right" }}>Peso</th><th style={{ textAlign: "center", minWidth: 140 }}>J37</th></tr></thead>
                  <tbody>
                    {perdedores.map((e) => (
                      <tr key={e.nome}>
                        <td><b style={{ fontSize: 12.5 }}>{e.nome}</b></td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>{e.peso_pct}%</td>
                        <td style={{ minWidth: 140 }}><MomentumBar value={e.mom_j37} scale={20} suffix="" height={16} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card mb">
            <h2>
              <span>Tickets pendentes do portfolio</span>
              <span className={`tag ${isModel ? "b" : "a"}`} style={{ marginLeft: "auto" }}>
                {tickets.length} · {isModel ? "SIMULAÇÃO" : "EXECUTA IBKR"}
              </span>
            </h2>
            {tickets.length === 0 ? (
              <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>nenhum ticket pendente</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Ativo</th><th>Tipo</th><th>Lado</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor</th><th>Motivo</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} style={{ opacity: isModel ? 0.75 : 1 }}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", t.ticker)}>{t.ticker}</span></td>
                      <td><span className={`type-badge type-${t.tipo}`}>{t.tipo}</span></td>
                      <td><span className={`side ${t.side}`}>{t.side === "buy" ? "COMPRAR" : "VENDER"}</span></td>
                      <td style={{ textAlign: "right" }}>{(t as unknown as { quantidade?: number }).quantidade?.toLocaleString("pt-BR") || "—"}</td>
                      <td style={{ textAlign: "right" }}>US$ {(t.valor_usd / 1000).toFixed(0)}k</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{t.motivo || "—"}</td>
                      <td><span className={`tag ${t.status === "enviado" ? "g" : "a"}`}>{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card mb">
            <h2>
              <span>Composição atual · {flatAtivos.length} ativos</span>
              <span className="tag b" style={{ marginLeft: "auto" }}>{(p.esteiras || []).length + (p.pilares || []).reduce((a, pil) => a + (pil.esteiras || []).length, 0)} esteiras</span>
            </h2>
            {flatAtivos.length === 0 ? (
              <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>portfólio sem composição definida</div>
            ) : (
              <table>
                <thead><tr><th>Ativo</th><th>Tipo</th><th>Esteira</th><th style={{ textAlign: "right" }}>Peso</th></tr></thead>
                <tbody>
                  {flatAtivos.map((a) => (
                    <tr key={`${a.esteira}-${a.ticker}`}>
                      <td className="tk"><span className="tk-link" onClick={() => go("chart", a.ticker)}>{a.ticker}</span></td>
                      <td><span className={`atype atype-${a.tipo.replace("Ã", "A").replace("Ç", "C")}`}>{a.tipo}</span></td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{a.esteira}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{a.peso_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="foot">
        Manejo do portfolio {p?.nome} · {isModel ? "portfolio modelo (sem IBKR)" : `IBKR ${p?.ibkr_account_id}`} · Owner {p?.owner || "—"}
      </div>
    </div>
  );
}

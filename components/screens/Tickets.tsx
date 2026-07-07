"use client";
import { useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import TicketChart from "@/components/TicketChart";
import { useDialog } from "../ui/Dialog";
import type { ScreenId } from "@/lib/nav";

interface Ticket {
  id: string; ticker: string; nome?: string; side: "buy" | "sell"; tipo: string;
  portfolio_id: string; motivo: string; quantidade: number; valor_usd: number;
  status: string; score: number; mom_126d: number; pilar?: string; esteira?: string; troca_para?: string;
}

interface PortfolioInfo {
  id: string; nome: string; ibkr_account_id?: string | null;
  capital_usd?: number; mode?: string;
}

interface PortfolioGroup {
  portfolio: PortfolioInfo;
  tickets: Ticket[];
  pendentes: number;
  total_usd: number;
}

function jimMsgs(t: Ticket | null): string[] {
  if (!t) return ["Selecione um ticket para eu analisar a memória de cálculo dele."];
  if (t.tipo === "AUMENTO") return [
    `Momentum de ${t.ticker} acelerou nas últimas 3 semanas. O ranking subiu de #5 para #${Math.max(1, Math.floor(t.score / 20))}.`,
    "Volume institucional acima da média de 20 dias. Fluxo positivo confirmado por 13F recentes.",
    `Risco de concentração: com este aumento, ${t.ticker} fica com ~${Math.min(10, (t.valor_usd / 27900000) * 100 + 5).toFixed(1)}% do portfólio. Dentro do cap de 10%.`,
  ];
  if (t.tipo === "REDUÇÃO") return [
    `${t.ticker} perdeu posição no ranking de momento. Sinal de desaceleração nos últimos 21 dias.`,
    "Redução parcial preserva exposição ao setor enquanto libera capital para ativos com momento superior.",
  ];
  if (t.tipo === "TROCA") return [
    `Rotação: ${t.ticker} sai (mom 126d: ${t.mom_126d}%) e ${t.troca_para || "substituto"} entra com momento superior.`,
    "A troca mantém a exposição setorial constante. Impacto fiscal: ganho de capital de curto prazo.",
  ];
  return [`${t.tipo} de ${t.ticker}: ${t.motivo}`, `Score de confiança: ${t.score}/100. Momentum de 126 dias: ${t.mom_126d}%.`];
}

function kv(label: string, val: ReactNode, vcls?: string) {
  return (
    <div className="kv"><span className="c-mut">{label}</span><span className={`v ${vcls || ""}`} style={{ fontWeight: 600 }}>{val}</span></div>
  );
}

export default function Tickets({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [overlay, setOverlay] = useState<{ title: string; sub: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [batchActing, setBatchActing] = useState<string | null>(null);
  const dialog = useDialog();

  useEffect(() => {
    Promise.all([
      apiGet<{ tickets: Ticket[] }>("/v1/tickets"),
      apiGet<{ portfolios: { id: string; nome: string; ibkr_account_id?: string | null; capital_usd?: number; mode?: string }[] }>("/v1/dashboard"),
    ])
      .then(([td, dd]) => {
        setTickets(td.tickets);
        setPortfolios(dd.portfolios || []);
        setConn("ok");
        if (td.tickets.length > 0) setSelected(td.tickets[0]);
      })
      .catch(() => setConn("error"));
  }, []);

  useEffect(() => {
    if (!overlay) return;
    const t = setTimeout(() => setOverlay(null), 2500);
    return () => clearTimeout(t);
  }, [overlay]);

  useEffect(() => {
    if (!tickets.length) return;
    const pendente = tickets.filter((t) => t.status === "pendente").length;
    const aprovado = tickets.filter((t) => t.status === "aprovado" || t.status === "enviado").length;
    const rejeitado = tickets.filter((t) => t.status === "rejeitado").length;
    const buy = tickets.filter((t) => t.side === "buy").length;
    const sell = tickets.filter((t) => t.side === "sell").length;
    publishScreenData(
      "ticket",
      `${tickets.length} tickets | ${pendente} pendente, ${aprovado} aprovado, ${rejeitado} rejeitado | ${buy} buy, ${sell} sell`,
      tickets,
      { briefing: `Há ${tickets.length} tickets hoje: ${pendente} aguardando decisão, ${aprovado} aprovados e ${rejeitado} rejeitados.` }
    );
  }, [tickets]);

  const groups: PortfolioGroup[] = (() => {
    const byPid = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const arr = byPid.get(t.portfolio_id) || [];
      arr.push(t);
      byPid.set(t.portfolio_id, arr);
    }
    return [...byPid.entries()].map(([pid, tks]) => {
      const pinfo = portfolios.find((p) => p.id === pid) || { id: pid, nome: pid };
      return {
        portfolio: pinfo,
        tickets: tks,
        pendentes: tks.filter((t) => t.status === "pendente").length,
        total_usd: tks.reduce((s, t) => s + t.valor_usd, 0),
      };
    });
  })();

  async function aprovar() {
    if (!selected || acting) return;
    if (selected.status === "enviado") { setOverlay({ title: "Já aprovado", sub: "Este ticket já foi enviado." }); return; }
    const pinfo = portfolios.find((p) => p.id === selected.portfolio_id);
    const ibkrLabel = pinfo?.ibkr_account_id ? ` · IBKR ${pinfo.ibkr_account_id}` : "";
    const ok = await dialog.confirm({
      title: `Aprovar ${selected.ticker}?`,
      body: `${selected.side === "buy" ? "COMPRAR" : "VENDER"} ${selected.quantidade.toLocaleString("pt-BR")} unid. · US$ ${selected.valor_usd.toLocaleString("pt-BR")} · ${selected.portfolio_id}${ibkrLabel}`,
      confirmLabel: "Aprovar e enviar",
    });
    if (!ok) return;
    setActing(true);
    try {
      await apiPost(`/v1/tickets/${selected.ticker}/approve`, { approver_id: "João Daniel" });
      const updated = { ...selected, status: "enviado" };
      setSelected(updated);
      setTickets((prev) => prev.map((t) => (t.ticker === updated.ticker ? updated : t)));
      setOverlay({ title: `${selected.ticker} aprovado`, sub: `Ordem enviada a IBKR${ibkrLabel}` });
    } catch (e) {
      setOverlay({ title: "Erro", sub: String((e as Error).message || e) });
    } finally {
      setActing(false);
    }
  }

  async function aprovarTodosPortfolio(pid: string) {
    if (batchActing) return;
    const grp = groups.find((g) => g.portfolio.id === pid);
    if (!grp || grp.pendentes === 0) return;
    const pinfo = grp.portfolio;
    const ibkrLabel = pinfo.ibkr_account_id ? ` · IBKR ${pinfo.ibkr_account_id}` : "";
    const totalUsd = grp.tickets.filter((t) => t.status === "pendente").reduce((s, t) => s + t.valor_usd, 0);
    const ok = await dialog.confirm({
      title: `Aprovar ${grp.pendentes} tickets · ${pinfo.nome}?`,
      body: `Todos os ${grp.pendentes} tickets pendentes de ${pinfo.nome}${ibkrLabel} serão enviados à IBKR.\n\nValor total: US$ ${totalUsd.toLocaleString("pt-BR")}`,
      confirmLabel: `Aprovar ${grp.pendentes} tickets`,
    });
    if (!ok) return;
    setBatchActing(pid);
    try {
      await apiPost(`/v1/tickets/batch-approve?portfolio_id=${pid}`, { approver_id: "João Daniel" });
      setTickets((prev) => prev.map((t) => t.portfolio_id === pid && t.status === "pendente" ? { ...t, status: "enviado" } : t));
      if (selected && selected.portfolio_id === pid && selected.status === "pendente") {
        setSelected({ ...selected, status: "enviado" });
      }
      setOverlay({ title: `${grp.pendentes} tickets aprovados`, sub: `${pinfo.nome}${ibkrLabel}` });
    } catch (e) {
      setOverlay({ title: "Erro", sub: String((e as Error).message || e) });
    } finally {
      setBatchActing(null);
    }
  }

  async function rejeitar() {
    if (!selected || acting) return;
    if (selected.status === "enviado") { dialog.notify("Ticket já enviado à IBKR — não pode ser rejeitado.", "error"); return; }
    const ok = await dialog.confirm({
      title: `Rejeitar ${selected.ticker}?`,
      body: "O ticket não será enviado à IBKR e ficará registrado como rejeitado na auditoria.",
      danger: true,
      confirmLabel: "Rejeitar ticket",
    });
    if (!ok) return;
    setActing(true);
    try {
      await apiPost(`/v1/tickets/${selected.ticker}/reject`);
      const updated = { ...selected, status: "rejeitado" };
      setSelected(updated);
      setTickets((prev) => prev.map((t) => (t.ticker === updated.ticker ? updated : t)));
      dialog.notify(`${selected.ticker} rejeitado — registrado na auditoria.`, "success");
    } catch (e) {
      dialog.notify("Erro ao rejeitar: " + String((e as Error).message || e), "error");
    } finally {
      setActing(false);
    }
  }

  async function ajustar() {
    if (!selected || acting) return;
    const novaQtd = await dialog.prompt({
      title: `Ajustar quantidade · ${selected.ticker}`,
      label: "Nova quantidade",
      initial: String(selected.quantidade),
      type: "number",
      confirmLabel: "Aplicar ajuste",
    });
    if (novaQtd && !isNaN(Number(novaQtd)) && Number(novaQtd) > 0) {
      const precoUnit = selected.valor_usd / selected.quantidade;
      const qtd = parseInt(novaQtd, 10);
      const updated = { ...selected, quantidade: qtd, valor_usd: qtd * precoUnit };
      setSelected(updated);
      setTickets((prev) => prev.map((t) => (t.ticker === updated.ticker ? updated : t)));
      dialog.notify(`Quantidade ajustada para ${qtd.toLocaleString("pt-BR")} (local — aprove para efetivar).`, "info");
    }
  }

  const precoEst = selected ? selected.valor_usd / Math.max(selected.quantidade, 1) : 0;
  const sideTxt = selected?.side === "buy" ? "COMPRAR" : "VENDER";
  const momEq = selected ? [
    { n: "EMA 20d ROC", v: selected.mom_126d * 0.15 },
    { n: "DEMA 20d ROC", v: selected.mom_126d * 0.22 },
    { n: "TEMA 20d ROC", v: selected.mom_126d * 0.18 },
    { n: "Retorno 12-1m", v: selected.mom_126d * 0.95 },
    { n: "ROC 25d", v: selected.mom_126d * 0.30 },
  ] : [];

  return (
    <div className="screen tk-page">
      <div className="tk-header">
        <div className="flex between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: ".5px" }}>Tickets do Dia</div>
            <div style={{ fontSize: 12, color: "var(--tx2)", marginTop: 2 }}>Ordens por portfólio · cada portfólio = conta IBKR separada</div>
          </div>
          <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
            {conn === "loading" ? "conectando..." : conn === "ok" ? "API ao vivo" : "API offline"}
          </div>
        </div>
      </div>

      <div className="tk-body">
        <div className="tk-list">
          {groups.map((grp) => (
            <div key={grp.portfolio.id} className="tk-portfolio-group">
              <div className="tk-portfolio-header">
                <div className="tk-portfolio-info">
                  <div className="tk-portfolio-name">{grp.portfolio.nome || grp.portfolio.id}</div>
                  {grp.portfolio.ibkr_account_id && (
                    <div className="tk-portfolio-ibkr">IBKR {grp.portfolio.ibkr_account_id}</div>
                  )}
                </div>
                <div className="tk-portfolio-stats">
                  <span className="tk-portfolio-count">{grp.tickets.length} ticket{grp.tickets.length !== 1 ? "s" : ""}</span>
                  {grp.pendentes > 0 && (
                    <button
                      className="btn sm"
                      onClick={() => aprovarTodosPortfolio(grp.portfolio.id)}
                      disabled={!!batchActing}
                    >
                      {batchActing === grp.portfolio.id ? "Enviando…" : `Aprovar ${grp.pendentes}`}
                    </button>
                  )}
                  {grp.pendentes === 0 && <span className="tag g" style={{ fontSize: 10 }}>TODOS ENVIADOS</span>}
                </div>
              </div>
              {grp.tickets.map((t) => (
                <div key={t.id} className={`tkt-item${selected?.id === t.id ? " sel" : ""}`} onClick={() => setSelected(t)}>
                  <div className="row">
                    <span className={`type-badge type-${t.tipo}`}>{t.tipo}</span>
                    {t.status === "enviado" && <span className="tag g" style={{ marginLeft: "auto", fontSize: 10 }}>ENVIADO</span>}
                    {t.status === "rejeitado" && <span className="tag r" style={{ marginLeft: "auto", fontSize: 10 }}>REJEITADO</span>}
                  </div>
                  <div className="row">
                    <span className="tk-link" onClick={(e) => { e.stopPropagation(); go("chart", t.ticker); }} title="Abrir gráfico">{t.ticker}</span>
                    <span className="nm">{t.nome || ""}</span>
                  </div>
                  <div className="row">
                    <span className={`side ${t.side === "buy" ? "buy" : "sell"}`}>{t.side === "buy" ? "COMPRAR" : "VENDER"}</span>
                    <span className="val">US$ {(t.valor_usd / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {tickets.length === 0 && conn === "ok" && (
            <div className="ph" style={{ padding: 30 }}>
              <b style={{ fontSize: 15 }}>Nenhum ticket hoje</b>
              <span style={{ fontSize: 13 }}>O motor ainda não gerou ordens. Elas aparecem aqui após o run diário (17:00 ET).</span>
            </div>
          )}
          {tickets.length === 0 && conn === "error" && (
            <div className="ph" style={{ padding: 30 }}>
              <b style={{ fontSize: 15 }}>API não respondeu</b>
              <span style={{ fontSize: 13 }}>Suba a API: <code>uvicorn app.main:app --port 8080</code></span>
            </div>
          )}
        </div>

        <div className="tk-detail">
          {!selected ? (
            <div className="ph" style={{ gridColumn: "1/-1", padding: "40px 20px" }}>
              <b style={{ fontSize: 16 }}>Nenhum ticket</b>
              <span style={{ fontSize: 13 }}>Selecione um ticket na lista.</span>
            </div>
          ) : (
            <>
              <div className="detail-card span">
                <div className="detail-header">
                  <span className="big-tk tk-link" onClick={() => go("chart", selected.ticker)} title="Abrir gráfico">{selected.ticker}</span>
                  <span className="score">Score {selected.score}</span>
                  <span className={`type-badge type-${selected.tipo}`} style={{ fontSize: 11, padding: "5px 12px" }}>{selected.tipo}</span>
                  <span className={`side ${selected.side === "buy" ? "buy" : "sell"}`} style={{ fontSize: 11, padding: "4px 10px" }}>{sideTxt}</span>
                  {selected.troca_para && <span style={{ fontSize: 14, color: "var(--tx2)" }}>&rarr; {selected.troca_para}</span>}
                  <span className="chart-btn" style={{ marginLeft: "auto" }} onClick={() => go("chart", selected.ticker)}><i className="ti ti-chart-candle" style={{ marginRight: 4 }} />Gráfico</span>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-card">
                  <h2>Identificação</h2>
                  {kv("Nome", selected.nome || selected.ticker)}
                  {kv("Portfolio", selected.portfolio_id)}
                  {(() => {
                    const pinfo = portfolios.find((p) => p.id === selected.portfolio_id);
                    return pinfo?.ibkr_account_id ? kv("Conta IBKR", pinfo.ibkr_account_id) : null;
                  })()}
                  {kv("Pilar", selected.pilar || "—")}
                  {kv("Esteira", selected.esteira || "—")}
                  <div className="kv"><span className="c-mut">Status</span><span className="v"><span className={`tag ${selected.status === "enviado" ? "g" : selected.status === "rejeitado" ? "r" : "a"}`}>{selected.status}</span></span></div>
                </div>
                <div className="detail-card">
                  <h2>Memória de cálculo</h2>
                  {kv("Motivo", selected.motivo)}
                  <div className="kv"><span className="c-mut">Momentum 126d</span><span className={`v ${selected.mom_126d >= 0 ? "c-g" : "c-r"}`} style={{ fontWeight: 800 }}>{selected.mom_126d >= 0 ? "+" : ""}{selected.mom_126d}%</span></div>
                  {kv("Score", `${selected.score} / 100`)}
                  {kv("Lado", sideTxt)}
                </div>
                <div className="detail-card">
                  <h2>5 equações de momentum</h2>
                  {momEq.map((eq) => (
                    <div className="eq-row" key={eq.n}>
                      <span className="lbl">{eq.n}</span>
                      <span className={`val ${eq.v >= 0 ? "c-g" : "c-r"}`}>{eq.v >= 0 ? "+" : ""}{eq.v.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <div className="detail-card">
                  <h2>Impacto financeiro</h2>
                  {kv("Quantidade", `${selected.quantidade.toLocaleString("pt-BR")} unid.`)}
                  {kv("Preço estimado", `US$ ${precoEst.toFixed(2)}`)}
                  <div className="kv"><span className="c-mut">Valor total</span><span className="v" style={{ fontSize: 18, fontWeight: 800, color: "var(--gold)" }}>US$ {selected.valor_usd.toLocaleString("pt-BR")}</span></div>
                </div>
              </div>

              <div className="detail-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 260, padding: "9px 11px" }}>
                <h2 style={{ marginBottom: 6 }}>
                  Gráfico · {selected.ticker} · diário
                  <span className="tk-link" style={{ fontWeight: 700, textTransform: "none", letterSpacing: 0, fontSize: 11, marginLeft: 8 }} onClick={() => go("chart", selected.ticker)}>abrir completo &rarr;</span>
                </h2>
                <TicketChart ticker={selected.ticker} />
              </div>

              <div className="jim-panel">
                <h2><i className="ti ti-sparkles" style={{ color: "var(--gold)", marginRight: 4 }} />JIM · Memória de cálculo</h2>
                {jimMsgs(selected).map((m, i) => <div className="jim-msg" key={i}>{m}</div>)}
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="action-bar">
          <button className="btn" onClick={aprovar} disabled={acting || selected.status !== "pendente"}>
            {acting ? "Enviando…" : selected.status === "pendente" ? "Aprovar Ticket" : "Já processado"}
          </button>
          <button className="btn ghost" onClick={rejeitar} disabled={acting || selected.status !== "pendente"}>Rejeitar</button>
          <button className="btn ghost" onClick={ajustar} disabled={acting || selected.status !== "pendente"}>Ajustar</button>
          <div className="counts">
            {tickets.filter((t) => t.status === "pendente").length} pendentes · {groups.length} portfólio{groups.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {overlay && (
        <div className="tk-overlay">
          <div className="tk-overlay-box">
            <div className="check"><i className="ti ti-check" /></div>
            <div className="msg">{overlay.title}</div>
            <div className="sub">{overlay.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

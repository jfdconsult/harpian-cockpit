"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { useDialog } from "./ui/Dialog";

interface Ticket {
  id: string; ticker: string; nome?: string; side: "buy" | "sell"; tipo: string;
  portfolio_id: string; motivo: string; quantidade: number; valor_usd: number;
  status: string; troca_para?: string;
}

const PORT_LABEL: Record<string, string> = { HPC11: "HPC11", HPC22: "HPC22", LCORE22: "Lynk Core22 HPC", HCUST: "HC-US TOTAL" };

// Popup de execução individual — usado tanto pelo botão "Executar" do Mission Control
// quanto pelo badge de ação (AUMENTAR/REDUZIR/...) do gráfico do ativo. Mostra o
// portfólio, o tamanho da ordem e deixa escolher mercado vs preço definido antes de
// confirmar — só então vira ticket enviado à IBKR (Air Gap: humano sempre aprova).
export default function ExecuteOrderModal({ ticketId, onClose, onExecuted }: {
  ticketId: string;
  onClose: () => void;
  onExecuted: (ticket: Ticket) => void;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState<"mercado" | "limite">("mercado");
  const [limitPrice, setLimitPrice] = useState("");
  const [sending, setSending] = useState(false);
  const dialog = useDialog();

  useEffect(() => {
    let alive = true;
    apiGet<{ tickets: Ticket[] }>("/v1/tickets")
      .then((d) => {
        if (!alive) return;
        const t = d.tickets.find((x) => x.id === ticketId) || null;
        setTicket(t);
        if (t) setLimitPrice((t.valor_usd / Math.max(t.quantidade, 1)).toFixed(2));
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [ticketId]);

  async function confirmar() {
    if (!ticket || sending) return;
    if (orderType === "limite" && (!limitPrice || isNaN(Number(limitPrice)) || Number(limitPrice) <= 0)) {
      dialog.notify("Informe um preço limite válido.", "error");
      return;
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = { approver_id: "João Daniel", order_type: orderType };
      if (orderType === "limite") body.limit_price = Number(limitPrice);
      const res = await apiPost<{ ticket_status: string }>(`/v1/tickets/${ticket.ticker}/approve`, body);
      const updated = { ...ticket, status: res.ticket_status || "enviado" };
      dialog.notify(
        `${ticket.ticker} enviado à IBKR — ${orderType === "mercado" ? "a mercado" : `limite US$ ${limitPrice}`}.`,
        "success"
      );
      onExecuted(updated);
      onClose();
    } catch (e) {
      dialog.notify("Erro ao executar: " + String((e as Error).message || e), "error");
    } finally {
      setSending(false);
    }
  }

  const precoEst = ticket ? ticket.valor_usd / Math.max(ticket.quantidade, 1) : 0;
  const jaExecutado = ticket ? ticket.status !== "pendente" : false;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,10,20,.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 440, maxWidth: "92vw", padding: 20 }}>
        {loading ? (
          <div className="ph" style={{ padding: 24 }}>Carregando ticket…</div>
        ) : !ticket ? (
          <div className="ph" style={{ padding: 24 }}><b>Ticket não encontrado</b></div>
        ) : (
          <>
            <div className="flex between" style={{ marginBottom: 4, alignItems: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Executar {ticket.ticker}</div>
              <span className={`side ${ticket.side}`}>{ticket.side === "buy" ? "COMPRAR" : "VENDER"}</span>
            </div>
            <div className="c-mut" style={{ fontSize: 12, marginBottom: 14 }}>{ticket.nome || ticket.ticker} · {ticket.motivo}</div>

            <div className="kv"><span className="c-mut">Portfólio</span><span className="v">{PORT_LABEL[ticket.portfolio_id] || ticket.portfolio_id}</span></div>
            <div className="kv"><span className="c-mut">Quantidade</span><span className="v">{ticket.quantidade.toLocaleString("pt-BR")} unid.</span></div>
            <div className="kv"><span className="c-mut">Preço estimado</span><span className="v">US$ {precoEst.toFixed(2)}</span></div>
            <div className="kv"><span className="c-mut">Valor total</span><span className="v" style={{ color: "var(--gold)", fontWeight: 700 }}>US$ {ticket.valor_usd.toLocaleString("pt-BR")}</span></div>
            {ticket.troca_para && <div className="kv"><span className="c-mut">Troca para</span><span className="v">{ticket.troca_para}</span></div>}
            {jaExecutado && (
              <div className="kv"><span className="c-mut">Status</span><span className="v"><span className="tag g">{ticket.status}</span></span></div>
            )}

            {!jaExecutado && (
              <>
                <div style={{ marginTop: 16, marginBottom: 6, fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8 }}>Tipo de ordem</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className={orderType === "mercado" ? "btn" : "btn ghost"}
                    style={{ flex: 1, justifyContent: "center", padding: "7px 10px", fontSize: 12 }}
                    onClick={() => setOrderType("mercado")}
                  >A mercado</button>
                  <button
                    className={orderType === "limite" ? "btn" : "btn ghost"}
                    style={{ flex: 1, justifyContent: "center", padding: "7px 10px", fontSize: 12 }}
                    onClick={() => setOrderType("limite")}
                  >Preço definido</button>
                </div>
                {orderType === "limite" && (
                  <input
                    className="input" type="number" step="0.01" style={{ width: "100%", marginTop: 8 }}
                    value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder="Preço limite (US$)"
                  />
                )}
              </>
            )}

            <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={onClose} disabled={sending}>Cancelar</button>
              {!jaExecutado && (
                <button className="btn" onClick={confirmar} disabled={sending}>
                  {sending ? "Enviando…" : "Confirmar e enviar à IBKR"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import type { ScreenId } from "@/lib/nav";

interface AuditEvent { ts: string; actor: string; role: string; tenant_id?: string; action: string; ref: string; detail: string }

function typeOf(action: string) { return action.split(".")[0] || "—"; }
function rowColor(type: string) {
  if (type === "pipeline" || type === "motor") return "rgba(74,144,217,0.06)";
  if (type === "ticket" || type === "order") return "rgba(201,160,44,0.06)";
  if (type === "kill_switch") return "rgba(231,76,60,0.08)";
  if (type === "version") return "rgba(155,89,182,0.06)";
  return "transparent";
}
function typeSem(type: string) {
  if (type === "pipeline" || type === "motor") return "b";
  if (type === "ticket" || type === "order") return "a";
  if (type === "kill_switch") return "r";
  if (type === "version") return "b";
  return "b";
}
function fmtTS(ts: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
}
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

export default function Auditoria({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [fType, setFType] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fActor, setFActor] = useState("");

  useEffect(() => {
    apiGet<{ events: AuditEvent[] }>("/v1/audit")
      .then((d) => { setEvents(d.events || []); setConn("ok"); })
      .catch(() => setConn("error"));
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const type = typeOf(e.action);
      if (fType && type !== fType) return false;
      if (fFrom && e.ts && e.ts.slice(0, 10) < fFrom) return false;
      if (fTo && e.ts && e.ts.slice(0, 10) > fTo) return false;
      if (fActor && !(e.actor || "").toLowerCase().includes(fActor.toLowerCase())) return false;
      return true;
    });
  }, [events, fType, fFrom, fTo, fActor]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    events.forEach((e) => { const t = typeOf(e.action); c[t] = (c[t] || 0) + 1; });
    return c;
  }, [events]);

  function clearFilters() { setFType(""); setFFrom(""); setFTo(""); setFActor(""); }

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Auditoria — Trilha Imutável</div><div className="sub">Append-only · cada decisão, aprovação, ordem e execução registrada</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "conectando…" : conn === "ok" ? "● API ao vivo" : "✕ API offline"}
        </div>
      </div>

      <div className="card mb">
        <h2><span>Filtros</span></h2>
        <div className="flex wrap" style={{ gap: 10 }}>
          <select className="input" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="pipeline">pipeline</option><option value="motor">motor</option>
            <option value="ticket">ticket</option><option value="order">order</option>
            <option value="kill_switch">kill_switch</option><option value="version">version</option>
          </select>
          <input type="date" className="input" value={fFrom} onChange={(e) => setFFrom(e.target.value)} title="Data início" />
          <input type="date" className="input" value={fTo} onChange={(e) => setFTo(e.target.value)} title="Data fim" />
          <input type="text" className="input" placeholder="Filtrar ator…" value={fActor} onChange={(e) => setFActor(e.target.value)} />
          <button className="btn ghost" onClick={clearFilters}>Limpar</button>
        </div>
      </div>

      {conn === "error" ? (
        <div className="ph mb"><b>API não respondeu</b>Suba a API: <code>uvicorn app.main:app --port 8080</code></div>
      ) : (
        <div className="grid g4 mb">
          <div className="kpi"><div className="l">Total eventos</div><div className="v">{events.length}</div><div className="s">trilha completa</div></div>
          <div className="kpi"><div className="l">Pipeline/Motor</div><div className="v c-b">{(counts.pipeline || 0) + (counts.motor || 0)}</div></div>
          <div className="kpi"><div className="l">Tickets/Ordens</div><div className="v c-a">{(counts.ticket || 0) + (counts.order || 0)}</div></div>
          <div className="kpi"><div className="l">Kill Switch</div><div className="v c-r">{counts.kill_switch || 0}</div></div>
        </div>
      )}

      <div className="card mb">
        <h2><span>Timeline de eventos</span><span className="tag b">{filtered.length} eventos</span></h2>
        <table>
          <thead><tr><th>Timestamp</th><th>Ator</th><th>Papel</th><th>Ação</th><th>Ref</th><th>Detalhe</th></tr></thead>
          <tbody>
            {filtered.map((e, i) => {
              const type = typeOf(e.action);
              const isTicker = TICKER_RE.test(e.ref);
              return (
                <tr key={i} style={{ background: rowColor(type) }}>
                  <td style={{ fontSize: 10, whiteSpace: "nowrap" }}>{fmtTS(e.ts)}</td>
                  <td><b>{e.actor || "—"}</b></td>
                  <td className="c-mut" style={{ fontSize: 11 }}>{e.role || "—"}</td>
                  <td><span className={`tag ${typeSem(type)}`}>{e.action}</span></td>
                  <td className="tk">{isTicker ? <span className="tk-link" onClick={() => go("chart", e.ref)}>{e.ref}</span> : (e.ref || "—")}</td>
                  <td className="c-mut" style={{ fontSize: 11 }}>{e.detail || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="foot">Trilha imutável · append-only · correções são novos eventos</div>
    </div>
  );
}

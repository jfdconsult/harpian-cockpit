"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";

interface ScorecardEntry { acertos: number; erros: number; acuracia_pct: number }
interface Alerta { tipo: string; pilar: string | null; desc: string; sev: string; ts: string }
interface Hipotese { id: string; desc: string; status: string; ts: string }
interface ObservadorData { scorecard: Record<string, ScorecardEntry>; alertas: Alerta[]; hipoteses: Hipotese[] }

function accColor(pct: number) { return pct >= 80 ? "var(--green)" : pct >= 60 ? "var(--orange)" : "var(--red)"; }
function sevSem(s: string) { return s === "red" ? "r" : s === "amber" ? "a" : s === "green" ? "g" : "a"; }
function hypSem(s: string) {
  if (s === "testando") return "a";
  if (s === "validado" || s === "validada") return "g";
  if (s === "rejeitado" || s === "rejeitada") return "r";
  return "b";
}
function fmtTS(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("pt-BR");
}
function pilarLabel(key: string) { return key.replace("pilar_", "Pilar "); }

export default function Observador() {
  const [d, setD] = useState<ObservadorData | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    apiGet<ObservadorData>("/v1/observador/")
      .then((data) => { setD(data); setConn("ok"); })
      .catch(() => setConn("error"));
  }, []);

  useEffect(() => {
    if (!d) return;
    const pilares = Object.entries(d.scorecard);
    const avgAccuracy = pilares.length > 0
      ? (pilares.reduce((sum, [, p]) => sum + p.acuracia_pct, 0) / pilares.length).toFixed(1)
      : "N/A";
    publishScreenData(
      "observador",
      `Acurácia média ${avgAccuracy}% | ${d.alertas.length} alertas | ${d.hipoteses.length} hipóteses`,
      d,
      { briefing: `Observador com acurácia média de ${avgAccuracy}% nos pilares, ${d.alertas.length} alertas ativos e ${d.hipoteses.length} hipóteses registradas.` }
    );
  }, [d]);

  const pilares = d ? Object.entries(d.scorecard) : [];
  const alerts = d?.alertas || [];
  const hyps = d?.hipoteses || [];

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Observador (IA) — Scorecard & Discovery</div><div className="sub">Acurácia por pilar, alertas e hipóteses</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "conectando…" : conn === "ok" ? "● API ao vivo" : "✕ API offline"}
        </div>
      </div>

      {conn === "error" ? (
        <div className="ph mb"><b>API não respondeu</b>Suba a API: <code>uvicorn app.main:app --port 8080</code></div>
      ) : (
        <div className="grid g4 mb">
          {pilares.length === 0 ? (
            <div className="ph" style={{ gridColumn: "1/-1" }}>Nenhum pilar configurado</div>
          ) : pilares.map(([key, p]) => {
            const col = accColor(p.acuracia_pct);
            return (
              <div className="card" style={{ textAlign: "center" }} key={key}>
                <h2><span>{pilarLabel(key)}</span></h2>
                <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: col }}>{p.acuracia_pct.toFixed(1)}%</div>
                <div className="c-mut" style={{ fontSize: 11, marginTop: 4 }}>{p.acertos} acertos · {p.erros} erros</div>
                <div style={{ height: 8, borderRadius: 4, background: "#08182c", overflow: "hidden", marginTop: 6 }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${p.acuracia_pct}%`, background: col }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid g2 mb">
        <div className="card">
          <h2><span>Alertas</span><span className="tag a">{alerts.length}</span></h2>
          {alerts.length === 0 ? (
            <div className="c-mut2" style={{ padding: 12, textAlign: "center", fontSize: 11 }}>Nenhum alerta ativo</div>
          ) : alerts.map((a, i) => (
            <div className="li" key={i}>
              <div className="dot" style={{ background: a.sev === "red" ? "var(--red)" : a.sev === "green" ? "var(--green)" : "var(--orange)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11 }}><b>{a.tipo}</b> {a.pilar && <> · <span className="c-mut">Pilar {a.pilar}</span></>}</div>
                <div className="c-mut" style={{ fontSize: 11 }}>{a.desc}</div>
              </div>
              <span className={`tag ${sevSem(a.sev)}`}>{a.sev}</span>
              <span className="t">{fmtTS(a.ts)}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h2><span>Hipóteses</span><span className="tag b">{hyps.length}</span></h2>
          {hyps.length === 0 ? (
            <div className="c-mut2" style={{ padding: 12, textAlign: "center", fontSize: 11 }}>Nenhuma hipótese registrada</div>
          ) : hyps.map((h) => (
            <div className="li" key={h.id}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11 }}><b className="c-gold">{h.id}</b> {h.desc}</div>
              </div>
              <span className={`tag ${hypSem(h.status)}`}>{h.status}</span>
              <span className="t">{fmtTS(h.ts)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="foot">Observador (IA) · Scorecard & Discovery · Cockpit Gestor · v1</div>
    </div>
  );
}

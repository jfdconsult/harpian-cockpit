"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";

interface Formula { id: string; grupo: string; nome: string; desc?: string; valor_atual: string; unidade?: string; editavel: boolean }
interface Alteracao { formula_id: string; nome?: string; de: string; para: string }
interface Metricas { sortino?: number; cagr?: number; max_dd?: number; calmar?: number }
interface Candidate {
  id: string; descricao: string; status: string; hipotese?: string; ts?: string;
  alteracoes?: Alteracao[]; metricas_atual?: Metricas; metricas_candidato?: Metricas;
  golden_master?: boolean; validadores_9?: boolean; wf_gap?: number | null;
}
interface JimBubble { who: "jim" | "user"; text: string; ref?: string }

const GROUP_ORDER = ["Defesa", "Ataque", "Pilar D", "Pilar T", "Seleção", "Outros"];

function delta(a?: number, b?: number) {
  if (a == null || b == null) return <span className="delta-eq">—</span>;
  const d = b - a;
  const cls = d > 0 ? "delta-up" : d < 0 ? "delta-dn" : "delta-eq";
  return <span className={cls}>{d > 0 ? "+" : ""}{d.toFixed(2).replace(".", ",")}</span>;
}

const INITIAL_JIM: JimBubble[] = [
  { who: "jim", text: "Calibração é o ato de ajustar os hiperparâmetros sem tocar na estrutura do motor. O risco principal é overfitting — quanto mais parâmetros livres, maior a chance de ajustar ao ruído.", ref: 'Ilmanen, "Expected Returns" cap. 12' },
  { who: "jim", text: "Walk-forward com gap temporal é o único método honesto. Se o Sortino OOS cair mais de 40% vs IS, o candidato deve ser rejeitado — não promovido com ressalvas.", ref: 'Bailey & López de Prado, "The Deflated Sharpe Ratio"' },
  { who: "jim", text: "Antes de calibrar: verifique se o problema é realmente no parâmetro ou se é estrutural. Mudar tau de 37 para 40 não resolve um universo mal definido.", ref: 'Clenow, "Stocks on the Move" cap. 8' },
];

export default function Calibracao() {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selCand, setSelCand] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [jimBubbles, setJimBubbles] = useState<JimBubble[]>(INITIAL_JIM);
  const [jimQ, setJimQ] = useState("");

  useEffect(() => {
    apiGet<{ formulas: Formula[] }>("/v1/calibration/formulas")
      .then((d) => { setFormulas(d.formulas || []); setConn("ok"); })
      .catch(() => setConn("error"));
    apiGet<{ candidates: Candidate[] }>("/v1/calibration/candidates")
      .then((d) => setCandidates(d.candidates || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!formulas.length && !candidates.length) return;
    const ready = candidates.filter((c) => c.status === "ready" || c.status === "validado").length;
    const rejected = candidates.filter((c) => c.status === "rejected" || c.status === "rejeitado").length;
    const promoted = candidates.filter((c) => c.status === "promovido").length;
    publishScreenData(
      "calibracao",
      `${formulas.length} fórmulas | ${candidates.length} candidatos (${ready} prontos, ${rejected} rejeitados, ${promoted} promovidos)`,
      { formulas, candidates },
      { briefing: `Studio com ${formulas.length} fórmulas editáveis e ${candidates.length} candidatos criados. ${ready} prontos para promoção.` }
    );
  }, [formulas, candidates]);

  const groups: Record<string, Formula[]> = {};
  formulas.forEach((f) => { const g = f.grupo || "Outros"; (groups[g] ||= []).push(f); });
  const orderedGroups = [...GROUP_ORDER.filter((g) => groups[g]), ...Object.keys(groups).filter((g) => !GROUP_ORDER.includes(g))];

  function createCandidate() {
    const changed = Object.keys(edits);
    if (!changed.length) { setToastMsg("Edite ao menos 1 parâmetro"); return; }
    const alteracoes: Alteracao[] = changed.map((id) => {
      const f = formulas.find((x) => x.id === id);
      return { formula_id: id, nome: f?.nome, de: f?.valor_atual || "", para: edits[id] };
    });
    const c: Candidate = {
      id: `cand-${candidates.length + 1}`, descricao: `Candidato #${candidates.length + 1}`, status: "ready",
      ts: "agora", alteracoes,
      metricas_atual: { sortino: 2.16, cagr: 44.2, max_dd: -27.9, calmar: 1.58 },
      metricas_candidato: { sortino: 2.27, cagr: 46.0, max_dd: -26.3, calmar: 1.75 },
      golden_master: true, validadores_9: true, wf_gap: 0.3,
    };
    setCandidates((prev) => [c, ...prev]);
    setEdits({});
    setToastMsg("Candidato criado (mock)");
    setSelCand(0);
  }

  function promote(i: number) {
    const c = candidates[i];
    apiPost<{ ok?: boolean; error?: string; candidate?: Candidate }>(`/v1/calibration/candidates/${c.id}/promote`)
      .then((d) => {
        if (d.error) { setToastMsg("Erro: " + d.error); return; }
        setToastMsg("Promovido ao Model Registry");
        setCandidates((prev) => prev.map((x, idx) => (idx === i ? { ...x, status: "promovido" } : x)));
      })
      .catch((e) => setToastMsg("Erro: " + e.message));
  }

  function askJim() {
    if (!jimQ) return;
    const q = jimQ;
    setJimQ("");
    setJimBubbles((prev) => [...prev, { who: "user", text: q }, { who: "jim", text: "Analisando a sua pergunta… (JIM está em modo air-gap, a resposta virá da API)" }]);
    apiGet<{ answer?: string; ref?: string }>(`/v1/calibration/jim?q=${encodeURIComponent(q)}`)
      .then((d) => {
        setJimBubbles((prev) => {
          const next = [...prev];
          next[next.length - 1] = { who: "jim", text: d.answer || "JIM não disponível neste momento.", ref: d.ref };
          return next;
        });
      })
      .catch(() => {
        setJimBubbles((prev) => {
          const next = [...prev];
          next[next.length - 1] = { who: "jim", text: "JIM indisponível — API offline." };
          return next;
        });
      });
  }

  const c = selCand != null ? candidates[selCand] : null;
  const allPass = c ? !!c.golden_master && !!c.validadores_9 : false;

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Calibração · Studio de Fórmulas</div><div className="sub">Editar parâmetros dos motores, criar candidatos, comparar com o atual e promover ao Registry.</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "conectando…" : conn === "ok" ? "● API ao vivo" : "✕ API offline"}
        </div>
      </div>

      <div className="lay3">
        <div className="side">
          <div className="card">
            <h2><span>Fórmulas & parâmetros</span></h2>
            <div className="scroll-formulas">
              {conn === "loading" && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>carregando…</div>}
              {conn === "error" && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>API não respondeu</div>}
              {orderedGroups.map((g) => (
                <div className="fgroup" key={g}>
                  <div className="fgroup-title">{g}</div>
                  {groups[g].map((f) => {
                    const edited = edits[f.id] != null;
                    return (
                      <div className="frow" key={f.id}>
                        <div className="fname"><div className="n">{f.nome}</div><div className="d">{f.desc || ""}</div></div>
                        {edited ? (
                          <div className="fval-edit">
                            <span style={{ color: "var(--tx3)" }}>{f.valor_atual}</span>
                            <span className="arrow">→</span>
                            <input
                              autoFocus
                              value={edits[f.id]}
                              onChange={(e) => setEdits((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        ) : (
                          <span className="fval" onClick={() => f.editavel && setEdits((prev) => ({ ...prev, [f.id]: f.valor_atual }))}>{f.valor_atual}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn-outline" onClick={createCandidate}>+ Criar candidato</button>
            </div>
          </div>

          <div className="card">
            <h2><span>Candidatos</span></h2>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {candidates.length === 0 && <div className="c-mut2" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>nenhum candidato</div>}
              {candidates.map((cand, i) => {
                const scls = cand.status === "ready" || cand.status === "validado" ? "ready" : cand.status === "rejected" || cand.status === "rejeitado" ? "rejected" : "pending";
                const slabel = scls === "ready" ? "PRONTO" : scls === "rejected" ? "REJEITADO" : "PENDENTE";
                return (
                  <div key={cand.id} className={`cand-item${selCand === i ? " sel" : ""}`} onClick={() => setSelCand(i)}>
                    <div><div style={{ fontWeight: 600 }}>{cand.descricao}</div><div className="c-mut2" style={{ fontSize: 10 }}>{cand.ts || ""}</div></div>
                    <span className={`cand-status ${scls}`}>{slabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          {!c ? (
            <div className="ph" style={{ padding: 40 }}>
              <b>Nenhum candidato selecionado</b>
              Selecione um candidato à esquerda ou crie um novo ajustando os parâmetros.
            </div>
          ) : (
            <div className="card mb">
              <h2><span>Candidato × atual</span><span className={`tag ${c.status === "ready" || c.status === "validado" ? "g" : c.status === "rejected" ? "r" : "a"}`}>{c.descricao}</span></h2>
              <table className="ctable">
                <thead><tr><th>Métrica</th><th>Atual</th><th>Candidato</th><th>Delta</th></tr></thead>
                <tbody>
                  <tr><td>Sortino</td><td>{c.metricas_atual?.sortino ?? "—"}</td><td>{c.metricas_candidato?.sortino ?? "—"}</td><td>{delta(c.metricas_atual?.sortino, c.metricas_candidato?.sortino)}</td></tr>
                  <tr><td>CAGR</td><td>{c.metricas_atual?.cagr ?? "—"}</td><td>{c.metricas_candidato?.cagr ?? "—"}</td><td>{delta(c.metricas_atual?.cagr, c.metricas_candidato?.cagr)}</td></tr>
                  <tr><td>MaxDD</td><td style={{ color: "var(--red)" }}>{c.metricas_atual?.max_dd ?? "—"}</td><td style={{ color: "var(--red)" }}>{c.metricas_candidato?.max_dd ?? "—"}</td><td>{delta(c.metricas_atual?.max_dd, c.metricas_candidato?.max_dd)}</td></tr>
                  <tr><td>Calmar</td><td>{c.metricas_atual?.calmar ?? "—"}</td><td>{c.metricas_candidato?.calmar ?? "—"}</td><td>{delta(c.metricas_atual?.calmar, c.metricas_candidato?.calmar)}</td></tr>
                </tbody>
              </table>
              <div className="checks">
                <div className="chk"><span className={`chk-icon ${c.golden_master ? "chk-pass" : "chk-fail"}`}>{c.golden_master ? "✓" : "✕"}</span><span>Golden-master: reproduz byte a byte</span></div>
                <div className="chk"><span className={`chk-icon ${c.validadores_9 ? "chk-pass" : "chk-fail"}`}>{c.validadores_9 ? "✓" : "✕"}</span><span>9 validadores: sem red flag</span></div>
                <div className="chk"><span className={`chk-icon ${c.wf_gap != null ? "chk-pass" : "chk-fail"}`}>{c.wf_gap != null ? "✓" : "✕"}</span><span>Walk-forward gap temporal</span></div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn-gold" disabled={!allPass} onClick={() => selCand != null && promote(selCand)}>
                  {allPass ? "Promover ao Registry" : "Validação incompleta — promoção bloqueada"}
                </button>
              </div>
              {c.alteracoes && c.alteracoes.length > 0 && (
                <>
                  <div style={{ marginTop: 14, fontSize: 10, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gold)", marginBottom: 6 }}>Parâmetros alterados</div>
                  {c.alteracoes.map((a) => (
                    <div className="frow" key={a.formula_id}>
                      <div className="fname"><div className="n">{a.nome || a.formula_id}</div></div>
                      <div className="fval-edit">
                        <span style={{ color: "var(--tx3)" }}>{a.de}</span>
                        <span className="arrow" style={{ color: "var(--gold)" }}>→</span>
                        <span style={{ color: "#5de5d5", fontWeight: 700 }}>{a.para}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="side">
          <div className="calib-jim">
            <h2><span>JIM conselheiro</span><span className="tag" style={{ background: "#2a1850", color: "#8a70c0", fontSize: 8 }}>air-gap · leitura</span></h2>
            <div>
              {jimBubbles.map((b, i) => (
                <div key={i} className="calib-jim-bubble" style={b.who === "user" ? { borderColor: "rgba(93,229,213,.2)", background: "rgba(93,229,213,.05)", color: "#b0e0d8" } : undefined}>
                  {b.who === "user" && <b style={{ fontSize: 10, color: "var(--tx3)" }}>Você: </b>}
                  {b.text}
                  {b.ref && <span className="ref">Ref: {b.ref}</span>}
                </div>
              ))}
            </div>
            <div className="calib-jim-input">
              <input placeholder="Perguntar ao JIM…" value={jimQ} onChange={(e) => setJimQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askJim()} />
              <button onClick={askJim}>Enviar</button>
            </div>
          </div>
        </div>
      </div>

      <div className="foot">Calibração · consome /v1/calibration. Golden-master byte-a-byte + 9 validadores. Promover ao Model Registry só após GRADE A.</div>
      <div className={`calib-toast${toastMsg ? " show" : ""}`}>{toastMsg}</div>
    </div>
  );
}

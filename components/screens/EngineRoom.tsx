"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import RegimeGauge, { Bullet } from "@/components/RegimeGauge";

interface Pilar {
  nome: string; proxy: string; temp: number; lim: number;
  delta_24h: number; delta_5d: number | null;
  turb: number; trend_break: number; jerk: number;
  folga: number; status: string;
}
interface Indicador {
  nome: string; valor?: number; valor_fmt?: string; desc?: string;
  needle_pct?: number; cor?: string;
  delta_24h?: number; delta_5d?: number; delta_5d_dir?: "up" | "dn";
  tipo?: "chips" | "standalone";
  chips?: { label: string; ok: boolean }[];
  desc_right?: string;
}
interface Perfil { nome: string; cor: string; a_pct: number; b_pct: number }
interface Orientacao { perfil: string; cor: string; delta: string; dir: "up" | "dn" | "fl"; tag: string; texto: string }
interface PilarD {
  lane_vencedora: string; carga: string;
  holdings: { ticker: string; peso_pct: number }[];
  rocs: { lane: string; roc: string; winner?: boolean }[];
  nota: string;
}
interface EngineRoomData {
  as_of: string; gerado: string; data_source: string; mode: string;
  regime: { estado: string; crs: number; watch: number; defesa: number; exposicao_ataque_pct: number };
  pilares: Pilar[];
  pilares_resumo: { max: number; media: number; em_defesa: string };
  indicadores: Indicador[];
  carga: { perfis: Perfil[] };
  orientacao: Orientacao[];
  pilar_d: PilarD;
}

function f2(n: number | null | undefined) { return n != null ? Number(n).toFixed(2).replace(".", ",") : "—"; }
function f3(n: number | null | undefined) { return n != null ? Number(n).toFixed(3).replace(".", ",") : "—"; }
function sign(n: number) { return n >= 0 ? "+" : ""; }

export default function EngineRoom() {
  const [d, setD] = useState<EngineRoomData | null>(null);
  const [status, setStatus] = useState<"connecting" | "ok" | "error">("connecting");
  const [err, setErr] = useState("");

  useEffect(() => {
    apiGet<EngineRoomData>("/v1/engine-room/")
      .then((data) => { setD(data); setStatus("ok"); })
      .catch((e) => { setStatus("error"); setErr(e.message); });
  }, []);

  useEffect(() => {
    if (!d) return;
    const emDefesa = d.pilares.filter((p) => p.status === "GATILHO").length;
    publishScreenData(
      "engine-room",
      `Regime ${d.regime.estado}, ${emDefesa} pilar${emDefesa !== 1 ? "es" : ""} em defesa, exposição ataque ${d.regime.exposicao_ataque_pct}%, orientação: ${d.orientacao.map((o) => `${o.perfil} ${o.tag}`).join(", ")}`,
      d,
      {
        briefing: `Motor em regime ${d.regime.estado} com CRS ${d.regime.crs.toFixed(3)}. ${emDefesa} pilar${emDefesa !== 1 ? "es" : ""} em defesa, exposição de ataque ${d.regime.exposicao_ataque_pct}%.`,
      }
    );
  }, [d]);

  return (
    <div className="screen">
      <div className="metabar">
        <div>
          {d && <>Dados: <b style={{ color: "var(--tx2)" }}>{d.data_source}</b> · as-of {d.as_of} · gerado {d.gerado} <span className="pill-mode">{d.mode}</span></>}
        </div>
        <div className={`tag ${status === "ok" ? "g" : status === "error" ? "r" : "b"}`}>
          {status === "connecting" ? "conectando…" : status === "ok" ? "● ao vivo" : `✕ offline (${err})`}
        </div>
      </div>

      {!d && status === "error" && (
        <div className="ph"><b>API não respondeu</b><br /><code>uvicorn app.main:app --port 8080</code></div>
      )}

      {d && (
        <>
          <div className="g12">
            <div className="card s4 gz">
              <h2>Regime de Mercado · 4 estados</h2>
              <RegimeGauge state={d.regime.estado} sub={`exposição de ataque: ${d.regime.exposicao_ataque_pct}%`} />
              <div className="gsub">CRS <b style={{ color: "#fff" }}>{f3(d.regime.crs)}</b> · WATCH {f2(d.regime.watch)} · DEFESA {f3(d.regime.defesa)}</div>
              <div className="glegend"><span style={{ color: "var(--red)" }}>◀ defesa</span><span style={{ color: "var(--green)" }}>ataque ▶</span></div>
            </div>

            <div className="card s4">
              <h2>Temperatura por Pilar · distância ao gatilho</h2>
              {d.pilares.map((p) => {
                const np = (1 - p.temp) * 100;
                const dc = p.status === "GATILHO" ? "var(--orange)" : "var(--green)";
                const dt = p.status === "GATILHO" ? `GATILHO +${f3(Math.abs(p.folga))}` : `folga ${f3(p.folga)}`;
                return (
                  <div className="prow" key={p.nome}>
                    <div className="phead">
                      <span>{p.nome} <small>{p.proxy} · {f3(p.temp)}/{f2(p.lim)}</small>
                        <small style={{ color: "var(--tx2)" }}> 24h {sign(p.delta_24h)}{f3(p.delta_24h)}</small>
                        {p.delta_5d != null && <small style={{ color: "var(--red)" }}> 5d {sign(p.delta_5d)}{f3(p.delta_5d)}</small>}
                      </span>
                      <span className="dist" style={{ color: dc }}>{dt}</span>
                    </div>
                    <Bullet pct={np} />
                    <div className="psub"><span>turb {f2(p.turb)}</span><span>trend-break {f2(p.trend_break)}</span><span>jerk {f2(p.jerk)}</span></div>
                  </div>
                );
              })}
              <div className="legend">agulha = temperatura · esquerda = quente/defesa · direita = frio/seguro</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--tx2)", marginTop: 4 }}>
                <span>máx <b style={{ color: "#fff" }}>{f3(d.pilares_resumo.max)}</b></span>
                <span>média <b style={{ color: "#fff" }}>{f3(d.pilares_resumo.media)}</b></span>
                <span>em defesa <b style={{ color: "#fff" }}>{d.pilares_resumo.em_defesa}</b></span>
              </div>
            </div>

            <div className="card s4">
              <h2>Indicadores Sistêmicos · distância ao gatilho</h2>
              {d.indicadores.map((ind) => (
                <div className="irow" key={ind.nome}>
                  <div className="ilab">{ind.nome}</div>
                  {ind.tipo === "chips" ? (
                    <>
                      <div style={{ flex: 1, display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {ind.chips?.map((c) => (
                          <span key={c.label} className={`chip ${c.ok ? "on" : "off"}`}>{c.label}{c.ok ? " ✓" : " ✗"}</span>
                        ))}
                      </div>
                      <div className="ival">{ind.desc_right}</div>
                    </>
                  ) : ind.tipo === "standalone" ? (
                    <>
                      <div style={{ flex: 1 }}><span className="chip na">{ind.desc}</span></div>
                      <div className="ival"></div>
                    </>
                  ) : (
                    <>
                      <div className="ibarwrap"><Bullet pct={ind.needle_pct || 0} /></div>
                      <div className="ival">
                        <b style={{ color: ind.cor }}>{ind.valor_fmt || f3(ind.valor)}</b> {ind.desc}
                        {ind.delta_24h != null && (
                          <>
                            <span style={{ fontSize: 10, color: "var(--tx2)" }}> 24h {sign(ind.delta_24h)}{f3(ind.delta_24h)}</span>
                            {ind.delta_5d != null && (
                              <span style={{ fontSize: 10, color: ind.delta_5d_dir === "dn" ? "var(--green)" : "var(--red)" }}> 5d {sign(ind.delta_5d)}{f3(ind.delta_5d)}</span>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="g12">
            <div className="card s7">
              <h2>Distribuição de Carga · A · B por perfil</h2>
              {d.carga.perfis.map((p) => (
                <div className="lrow" key={p.nome}>
                  <div className="lname"><span className="sw" style={{ background: p.cor }} />{p.nome}</div>
                  <div className="lbar">
                    <div className="la" style={{ width: `${p.a_pct}%` }}>A {p.a_pct}%</div>
                    <div className="lb" style={{ width: `${p.b_pct}%` }}>{p.b_pct}% B</div>
                  </div>
                </div>
              ))}
              <div className="lnote"><span style={{ color: "var(--blue)" }}>●</span> A = ações HC-US 3.1 · <span style={{ color: "var(--gold2)" }}>●</span> B = ETFs HC-US 11. Range homologado: CONS 31,9→3,5% · BAL 52,7→8,4% · ADV 70→17%.</div>
            </div>

            <div className="card s5">
              <h2>Orientação do dia · ontem → hoje</h2>
              {d.orientacao.map((o) => (
                <div className="orow" key={o.perfil}>
                  <div className="olabel"><span className="sw" style={{ background: o.cor }} />{o.perfil}</div>
                  <div className={`odelta ${o.dir}`}>{o.delta}</div>
                  <span className={`otag ${o.tag}`}>{o.tag}</span>
                  <div className="otxt">{o.texto}</div>
                </div>
              ))}

              <div className="pdbox">
                <div className="pdhead">
                  <h3>▲ PILAR D · DEFESA · {d.pilar_d.lane_vencedora}</h3>
                  <div className="sub">Carga: {d.pilar_d.carga}</div>
                </div>
                <div className="pdwinner">Lane vencedora (WTA ROC 6m): <b>{d.pilar_d.lane_vencedora}</b></div>
                <div className="pdholdings">
                  {d.pilar_d.holdings.map((h) => (
                    <span className="pdh" key={h.ticker}><b>{h.ticker}</b>{h.peso_pct}%</span>
                  ))}
                </div>
                <div className="pdrocs">
                  {d.pilar_d.rocs.map((r) => (
                    <span key={r.lane} style={r.winner ? { color: "var(--red-text)", fontWeight: 800 } : undefined}>
                      {r.lane} ROC <b>{r.roc}</b>
                    </span>
                  ))}
                </div>
                <div className="pdwarn">{d.pilar_d.nota}</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="foot">
        <b>SOMENTE LEITURA</b> — zero ordens, zero movimentação. Regime/indicadores conforme OS_4_INDICADORES.md · 4 estados conforme CAP_P_ORQUESTRADOR_REGIME.md.
      </div>
    </div>
  );
}

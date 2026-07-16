"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import MomentumBar from "@/components/MomentumBar";
import type { ScreenId } from "@/lib/nav";

interface Basket { id: string; nome: string; setor: string; n: number }
interface Movimento { mov: string; motivo?: string }
interface Flag { acao: string; motivo?: string }
interface AssetRow {
  ok: boolean; ticker: string; name?: string; setor?: string; subsetor?: string; estrategia?: string;
  rs?: string; last?: number; net_pct?: number;
  mom_d13?: number; mom_j37?: number; mom_ema?: number; mom_dema?: number; mom_tema?: number;
  ret_12_1?: number; roc_25?: number; pos_day?: number; pos_52w?: number; ytd_pct?: number; ma_dev?: number;
  consec_up?: number; consec_dn?: number; score?: number;
  classificacao?: string[]; movimento?: Movimento; flag?: Flag; rank?: number;
}
interface Resumo { n_revisao?: number; mov_count?: Record<string, number>; precisam_revisao?: string[] }
interface ScanResp { basket: string; nome: string; rows: AssetRow[]; resumo: Resumo; source: string; rs_note: string }

const SIN_COLOR: Record<string, string> = { Acelerando: "g", Freando: "a", Sobrecomprado: "r", "Reversão?": "r", Esticado: "a", "Fundo 52s": "b" };
const MOV_CLS: Record<string, string> = { ENTRADA: "entrada", SAÍDA: "saida", AUMENTO: "aumento", REDUÇÃO: "reducao", MANTÉM: "mantem" };
const MOV_ARROW: Record<string, string> = { ENTRADA: "▲ ", SAÍDA: "▼ ", AUMENTO: "＋ ", REDUÇÃO: "－ ", MANTÉM: "" };
const MOV_RANK: Record<string, number> = { SAÍDA: 0, ENTRADA: 1, REDUÇÃO: 2, AUMENTO: 3, MANTÉM: 9 };

function tint(v: number | null | undefined, scale: number) {
  if (v == null || isNaN(v)) return {};
  const a = Math.min(0.5, Math.abs(v) / scale);
  const c = v >= 0 ? "46,204,113" : "231,76,60";
  return { background: `rgba(${c},${a.toFixed(2)})` };
}
function tintPos(p: number | null | undefined) {
  if (p == null) return {};
  const g = p >= 50;
  const a = Math.min(0.5, (Math.abs(p - 50) / 50) * 0.45 + 0.08);
  const c = g ? "46,204,113" : "243,156,18";
  return { background: `rgba(${c},${a.toFixed(2)})` };
}
function scoreTint(s: number | null | undefined) {
  if (s == null) return {};
  return { background: `rgba(46,204,113,${((s / 100) * 0.45).toFixed(2)})` };
}
function num(v: number | null | undefined, suf = "") {
  return v == null ? "—" : v.toLocaleString("en-US") + suf;
}
function rsCls(rs?: string) {
  return rs === "Long" ? "long" : rs === "Short" ? "short" : rs === "L-FVG" ? "lfvg" : rs === "S-FVG" ? "sfvg" : rs === "Buy" ? "buy" : rs === "Sell" ? "sell" : "";
}

const SORTERS: Record<string, (a: AssetRow, b: AssetRow) => number> = {
  revisao: (a, b) => {
    const ra = MOV_RANK[a.movimento?.mov || ""] ?? 9, rb = MOV_RANK[b.movimento?.mov || ""] ?? 9;
    return ra !== rb ? ra - rb : (b.score || 0) - (a.score || 0);
  },
  score: (a, b) => (b.score || 0) - (a.score || 0),
  score_asc: (a, b) => (a.score || 0) - (b.score || 0),
  mom: (a, b) => (b.mom_j37 ?? -1e9) - (a.mom_j37 ?? -1e9),
  mom_asc: (a, b) => (a.mom_j37 ?? 1e9) - (b.mom_j37 ?? 1e9),
  ytd: (a, b) => (b.ytd_pct ?? -1e9) - (a.ytd_pct ?? -1e9),
  roc: (a, b) => (b.roc_25 ?? -1e9) - (a.roc_25 ?? -1e9),
  net: (a, b) => (b.net_pct ?? -1e9) - (a.net_pct ?? -1e9),
  net_asc: (a, b) => (a.net_pct ?? 1e9) - (b.net_pct ?? 1e9),
  pos52: (a, b) => (b.pos_52w ?? -1) - (a.pos_52w ?? -1),
};

export default function Ativos({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [basket, setBasket] = useState("");
  const [data, setData] = useState<ScanResp | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  const [estf, setEstf] = useState(""); const [setf, setSetf] = useState(""); const [subf, setSubf] = useState("");
  const [movf, setMovf] = useState(""); const [rsf, setRsf] = useState(""); const [acf, setAcf] = useState("");
  const [q, setQ] = useState(""); const [sortf, setSortf] = useState("revisao");

  useEffect(() => {
    apiGet<{ baskets: Basket[] }>("/v1/assets/baskets")
      .then((d) => { const b = d.baskets || []; setBaskets(b); if (b[0]) setBasket(b[0].id); })
      .catch(() => setConn("error"));
  }, []);

  useEffect(() => {
    if (!basket) return;
    setConn("loading");
    apiGet<ScanResp>(`/v1/assets/scan?basket=${basket}`)
      .then((d) => { setData(d); setConn("ok"); })
      .catch(() => setConn("error"));
    const iv = setInterval(() => {
      if (document.hidden) return;
      apiGet<ScanResp>(`/v1/assets/scan?basket=${basket}`).then(setData).catch(() => {});
    }, 45000);
    return () => clearInterval(iv);
  }, [basket]);

  const okRows = useMemo(() => (data?.rows || []).filter((r) => r.ok), [data]);
  const estOptions = useMemo(() => Array.from(new Set(okRows.map((r) => r.estrategia).filter((v): v is string => !!v && v !== "—"))).sort(), [okRows]);
  const setOptions = useMemo(() => Array.from(new Set(okRows.map((r) => r.setor).filter((v): v is string => !!v))).sort(), [okRows]);
  const subOptions = useMemo(() => Array.from(new Set(okRows.map((r) => r.subsetor).filter((v): v is string => !!v && v !== "—"))).sort(), [okRows]);

  const filtered = useMemo(() => {
    let rows = okRows.filter((r) => {
      if (estf && r.estrategia !== estf) return false;
      if (setf && r.setor !== setf) return false;
      if (subf && r.subsetor !== subf) return false;
      const mv = r.movimento?.mov;
      if (movf === "REVISAO" && (mv === "MANTÉM" || !mv)) return false;
      if (movf && movf !== "REVISAO" && mv !== movf) return false;
      if (rsf && (r.rs || "") !== rsf) return false;
      if (q && !r.ticker.toUpperCase().includes(q.toUpperCase())) return false;
      if (acf === "AUDITAR" && r.flag?.acao !== "AUDITAR") return false;
      if (acf === "OBSERVAR" && r.flag?.acao === "OK") return false;
      return true;
    });
    if (SORTERS[sortf]) rows = [...rows].sort(SORTERS[sortf]);
    return rows;
  }, [okRows, estf, setf, subf, movf, rsf, acf, q, sortf]);

  useEffect(() => {
    if (!data) return;
    const nRev = data.resumo?.n_revisao || 0;
    const mc = data.resumo?.mov_count || {};
    const entradas = mc["ENTRADA"] || 0;
    const saidas = mc["SAÍDA"] || 0;
    publishScreenData(
      "ativos",
      `${okRows.length} assets, ${nRev} need review, ${entradas} entries, ${saidas} exits`,
      data.rows?.filter((r) => r.ok),
      {
        briefing: `Scanner with ${okRows.length} active assets. ${nRev} need review (${entradas} entries, ${saidas} exits). Universe: ${data.nome}.`,
      }
    );
  }, [data]);

  const resumo = data?.resumo || {};
  const nRevisao = resumo.n_revisao || 0;

  function clearFilters() {
    setEstf(""); setSetf(""); setSubf(""); setMovf(""); setRsf(""); setAcf(""); setQ(""); setSortf("revisao");
  }

  return (
    <div className="screen">
      <div className="flex between wrap mb">
        <div>
          <div className="h1">Assets · scanner</div>
          <div className="sub">The whole universe — RS signal, momentum (DEMA/TEMA), ROC 25d, day/52w position, consecutive moves. Real data (Yahoo).</div>
        </div>
        <span className="live"><span className="dot" /><span className={`tag ${conn === "ok" ? "g" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "loading…" : conn === "ok" ? `● ${data?.source}` : "✕ offline"}
        </span></span>
      </div>

      <div className={`auditbar${nRevisao > 0 ? " hot" : ""}`} onClick={() => nRevisao > 0 && setMovf("REVISAO")}>
        <span className="big2">{nRevisao}</span>
        <div>
          <div style={{ fontWeight: 700 }}>
            {nRevisao > 0
              ? `${nRevisao}${nRevisao === 1 ? " asset needs review" : " assets need review"}${
                  resumo.mov_count ? "  ·  " + ["ENTRADA", "SAÍDA", "AUMENTO", "REDUÇÃO"].filter((k) => resumo.mov_count?.[k]).map((k) => `${resumo.mov_count?.[k]} ${k.toLowerCase()}${(resumo.mov_count?.[k] || 0) > 1 ? "s" : ""}`).join(" · ") : ""
                }`
              : "No changes today"}
          </div>
          <div className="c-mut2" style={{ fontSize: 11 }}>
            {nRevisao > 0 ? (
              <><b>{(resumo.precisam_revisao || []).join(", ")}</b> · click to see only these · compare with AlphaDroid before acting</>
            ) : "the universe is stable — no asset changed status or intensity"}
          </div>
        </div>
      </div>

      <div className="fbar mb">
        <div className="fgrp"><label>Universe</label>
          <select className="input" value={basket} onChange={(e) => setBasket(e.target.value)}>
            {baskets.map((b) => <option key={b.id} value={b.id}>{b.nome} ({b.n})</option>)}
          </select>
        </div>
        <div className="fgrp"><label>Strategy</label>
          <select className="input" value={estf} onChange={(e) => setEstf(e.target.value)}>
            <option value="">All</option>{estOptions.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="fgrp"><label>Sector</label>
          <select className="input" value={setf} onChange={(e) => setSetf(e.target.value)}>
            <option value="">All sectors</option>{setOptions.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="fgrp"><label>Subsector</label>
          <select className="input" value={subf} onChange={(e) => setSubf(e.target.value)}>
            <option value="">All</option>{subOptions.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="fgrp"><label>Movement</label>
          <select className="input" value={movf} onChange={(e) => setMovf(e.target.value)}>
            <option value="">All</option><option value="REVISAO">Review only (changed)</option>
            <option value="ENTRADA">Entries</option><option value="SAÍDA">Exits</option>
            <option value="AUMENTO">Increases</option><option value="REDUÇÃO">Reductions</option>
          </select>
        </div>
        <div className="fgrp"><label>RS Signal</label>
          <select className="input" value={rsf} onChange={(e) => setRsf(e.target.value)}>
            <option value="">All</option><option>Long</option><option>Short</option><option>L-FVG</option><option>S-FVG</option>
          </select>
        </div>
        <div className="fgrp"><label>Action</label>
          <select className="input" value={acf} onChange={(e) => setAcf(e.target.value)}>
            <option value="">All</option><option value="AUDITAR">Audit only</option><option value="OBSERVAR">Observe+</option>
          </select>
        </div>
        <div className="fgrp"><label>Sort by</label>
          <select className="input" value={sortf} onChange={(e) => setSortf(e.target.value)}>
            <option value="revisao">Review (changes first)</option>
            <option value="score">Score (highest strength)</option>
            <option value="score_asc">Score (lowest)</option>
            <option value="mom">Highest momentum (DEMA)</option>
            <option value="mom_asc">Lowest momentum</option>
            <option value="ytd">Highest gain YTD</option>
            <option value="roc">Highest ROC 25d</option>
            <option value="net">Highest gain on day</option>
            <option value="net_asc">Biggest drop on day</option>
            <option value="pos52">52w position (top)</option>
          </select>
        </div>
        <div className="fgrp"><label>Ticker</label>
          <input className="input" style={{ width: 120 }} placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="fgrp" style={{ justifyContent: "flex-end" }}><label>&nbsp;</label>
          <button className="btn ghost" onClick={clearFilters}>Clear</button>
        </div>
        <div className="fcount"><b>{filtered.length}</b> of {okRows.length} assets</div>
      </div>

      <div className="wrapx">
        <table className="atv">
          <thead>
            <tr>
              <th>#</th><th>Symbol</th><th>Desc</th><th>Movement</th><th>Action</th><th>RS</th><th>Score</th><th>Last</th><th>Net%</th>
              <th>Mom EMA</th><th>Mom DEMA</th><th>Mom TEMA</th><th className="momd">D13</th><th className="momd">J37</th><th>12-1</th><th>ROC25</th>
              <th>YTD%</th><th>52w%</th><th>Day%</th><th>MA dev</th><th>Consec</th><th>Signals</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={21} className="c-mut2" style={{ textAlign: "center", padding: 20 }}>no asset matches the filter</td></tr>
            ) : filtered.map((r) => {
              const f = r.flag;
              const cons = r.consec_up ? <span className="c-g">▲{r.consec_up}</span> : r.consec_dn ? <span className="c-r">▼{r.consec_dn}</span> : "0";
              const m = r.movimento;
              return (
                <tr key={r.ticker} className={f?.acao === "AUDITAR" ? "auditar" : undefined}>
                  <td className="c-mut2">{r.rank || ""}</td>
                  <td className="tk"><span className="tk-link" onClick={() => go("chart", r.ticker)} title={`Open chart ${r.ticker}`}>{r.ticker}</span></td>
                  <td className="c-mut" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || ""}</td>
                  <td style={{ textAlign: "center" }}>
                    {!m ? <span className="mov mantem">—</span> : (
                      <span className={`mov ${MOV_CLS[m.mov] || "mantem"}`} title={m.motivo || ""}>{MOV_ARROW[m.mov] || ""}{m.mov}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {!f ? <span className="acao g">—</span> : f.acao === "AUDITAR" ? (
                      <span className="acao r" title={f.motivo}><span className="d" />AUDITAR</span>
                    ) : f.acao === "OBSERVAR" ? (
                      <span className="acao a" title={f.motivo}>OBSERVAR</span>
                    ) : <span className="acao g" title="no action">OK</span>}
                  </td>
                  <td style={{ textAlign: "center" }}><span className={`rs ${rsCls(r.rs)}`}>{r.rs}</span></td>
                  <td style={{ textAlign: "center", fontWeight: 800, ...scoreTint(r.score) }}>{r.score ?? "—"}</td>
                  <td>{num(r.last)}</td>
                  <td style={{ minWidth: 90 }}><MomentumBar value={r.net_pct} scale={6} decimals={2} /></td>
                  <td style={{ minWidth: 100 }}><MomentumBar value={r.mom_ema} scale={60} /></td>
                  <td style={{ minWidth: 100 }}><MomentumBar value={r.mom_dema} scale={60} /></td>
                  <td style={{ minWidth: 100 }}><MomentumBar value={r.mom_tema} scale={60} /></td>
                  <td className="momd" style={{ minWidth: 100 }}><MomentumBar value={r.mom_d13} scale={40} suffix="" /></td>
                  <td className="momd" style={{ minWidth: 100 }}><MomentumBar value={r.mom_j37} scale={40} suffix="" /></td>
                  <td style={{ minWidth: 100 }}><MomentumBar value={r.ret_12_1} scale={120} /></td>
                  <td style={{ minWidth: 100 }}><MomentumBar value={r.roc_25} scale={40} decimals={2} /></td>
                  <td style={{ minWidth: 100 }}><MomentumBar value={r.ytd_pct} scale={120} /></td>
                  <td style={tintPos(r.pos_52w)}>{num(r.pos_52w, "%")}</td>
                  <td style={tintPos(r.pos_day)}>{num(r.pos_day, "%")}</td>
                  <td style={tint(r.ma_dev, 8)}>{num(r.ma_dev, "%")}</td>
                  <td style={{ textAlign: "center" }}>{cons}</td>
                  <td style={{ textAlign: "left" }}>
                    {(r.classificacao || []).length
                      ? r.classificacao!.map((s) => <span key={s} className={`tag ${SIN_COLOR[s] || "b"}`} style={{ margin: 1 }}>{s}</span>)
                      : <span className="c-mut2">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="foot">{data ? `${data.nome} · ${okRows.length} assets · ${data.rs_note}` : "—"}</div>
    </div>
  );
}

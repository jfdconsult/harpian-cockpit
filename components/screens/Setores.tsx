"use client";
import { Fragment, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import MomentumBar from "@/components/MomentumBar";
import type { ScreenId } from "@/lib/nav";

interface Sector {
  setor: string;
  n: number;
  mom_j37: number | null;
  mom_d13: number | null;
  mom_dema: number | null;
  ret_12_1: number | null;
  score: number | null;
  long_n: number;
  short_n: number;
  top_ticker: string;
  top_score: number;
  tickers: string[];
}

interface SectorsResp {
  basket: string;
  nome: string;
  n_ativos: number;
  sectors: Sector[];
  source: string;
  note: string;
}

interface Basket { id: string; nome: string; setor: string; n: number }

export default function Setores({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [basket, setBasket] = useState("ALL");
  const [data, setData] = useState<SectorsResp | null>(null);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ baskets: Basket[] }>("/v1/assets/baskets")
      .then((d) => setBaskets(d.baskets || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setConn("loading");
    apiGet<SectorsResp>(`/v1/assets/sectors?basket=${basket}`)
      .then((d) => { setData(d); setConn("ok"); })
      .catch(() => setConn("error"));
  }, [basket]);

  useEffect(() => {
    if (!data) return;
    const leader = data.sectors[0]?.setor || "—";
    publishScreenData(
      "setores",
      `${data.sectors.length} sectors, ${data.n_ativos} assets, leader: ${leader}`,
      data.sectors,
      {
        briefing: `${data.sectors.length} sectors with ${data.n_ativos} assets monitored. Leading sector: ${leader}.`,
      }
    );
  }, [data]);

  return (
    <div className="screen">
      <div className="flex between wrap mb">
        <div>
          <div className="h1">Sectors · SectorSurfer</div>
          <div className="sub">Aggregate momentum by sector. AlphaDroid pattern — rotating leadership, green = up, red = down.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn ghost" style={{ fontSize: 11 }} onClick={() => go("alphadroid")}>
            + Add custom sector
          </button>
          <span className="live">
            <span className="dot" />
            <span className={`tag ${conn === "ok" ? "g" : conn === "error" ? "r" : "b"}`}>
              {conn === "loading" ? "loading…" : conn === "ok" ? `● ${data?.source}` : "✕ offline"}
            </span>
          </span>
        </div>
      </div>

      <div className="fbar mb">
        <div className="fgrp">
          <label>Universe</label>
          <select className="input" value={basket} onChange={(e) => setBasket(e.target.value)}>
            <option value="ALL">★ Entire base (all)</option>
            {baskets.map((b) => (
              <option key={b.id} value={b.id}>{b.nome} ({b.n})</option>
            ))}
          </select>
        </div>
        {data && (
          <div className="fcount">
            <b>{data.sectors.length}</b> sectors · {data.n_ativos} assets
          </div>
        )}
      </div>

      <div className="wrapx" style={{ maxHeight: "70vh" }}>
        <table className="atv">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Sector</th>
              <th style={{ textAlign: "center" }}>N</th>
              <th style={{ textAlign: "center", minWidth: 180 }} className="momd">Momentum J37 (Diogo)</th>
              <th style={{ textAlign: "center", minWidth: 180 }} className="momd">Momentum D13</th>
              <th style={{ textAlign: "center", minWidth: 180 }}>Mom DEMA</th>
              <th style={{ textAlign: "center" }}>Average score</th>
              <th style={{ textAlign: "center" }}>Long / Short</th>
              <th style={{ textAlign: "left" }}>Top asset</th>
            </tr>
          </thead>
          <tbody>
            {conn === "error" ? (
              <tr><td colSpan={9} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>API did not respond</td></tr>
            ) : conn === "loading" ? (
              <tr><td colSpan={9} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>calculating momentum by sector…</td></tr>
            ) : (data?.sectors || []).length === 0 ? (
              <tr><td colSpan={9} className="c-mut2" style={{ textAlign: "center", padding: 30 }}>no sector found</td></tr>
            ) : (data?.sectors || []).map((s, i) => {
              const isExp = expanded === s.setor;
              return (
                <Fragment key={s.setor}>
                  <tr
                    style={{ cursor: "pointer", background: i === 0 ? "rgba(46,204,113,.05)" : undefined }}
                    onClick={() => setExpanded(isExp ? null : s.setor)}
                  >
                    <td className="c-mut2" style={{ fontSize: 11, textAlign: "center" }}>{isExp ? "▼" : "▶"}</td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{s.setor}</span>
                      {i === 0 && (
                        <span className="tag g" style={{ marginLeft: 8, fontSize: 9 }}>LEADER</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{s.n}</td>
                    <td className="momd" style={{ minWidth: 180 }}>
                      <MomentumBar value={s.mom_j37} scale={30} suffix="" height={20} />
                    </td>
                    <td className="momd" style={{ minWidth: 180 }}>
                      <MomentumBar value={s.mom_d13} scale={30} suffix="" height={20} />
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <MomentumBar value={s.mom_dema} scale={60} height={20} />
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{s.score?.toFixed(0) ?? "—"}</td>
                    <td style={{ textAlign: "center", fontSize: 12 }}>
                      <span className="c-g">▲{s.long_n}</span>{" "}
                      <span className="c-r">▼{s.short_n}</span>
                    </td>
                    <td>
                      <span
                        className="tk-link"
                        onClick={(e) => { e.stopPropagation(); go("chart", s.top_ticker); }}
                        title={`Open chart ${s.top_ticker}`}
                      >
                        {s.top_ticker}
                      </span>
                      <span className="c-mut2" style={{ fontSize: 10, marginLeft: 6 }}>
                        {s.top_score}
                      </span>
                    </td>
                  </tr>
                  {isExp && (
                    <tr style={{ background: "rgba(255,255,255,.02)" }}>
                      <td></td>
                      <td colSpan={8} style={{ padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                          Sector assets
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {s.tickers.map((tk) => (
                            <span
                              key={tk}
                              className="tk-link"
                              onClick={(e) => { e.stopPropagation(); go("chart", tk); }}
                              style={{
                                background: "rgba(201,160,44,.08)",
                                border: "1px solid rgba(201,160,44,.25)",
                                borderRadius: 6,
                                padding: "3px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {tk}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="foot">
        {data ? `${data.nome} · ${data.n_ativos} ativos em ${data.sectors.length} setores · ${data.note}` : "—"}
      </div>
    </div>
  );
}

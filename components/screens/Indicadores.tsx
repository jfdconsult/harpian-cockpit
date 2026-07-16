"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import { Bullet } from "@/components/RegimeGauge";

interface IndicatorsState {
  temperatura: { valor: number; limiar: number; status: string; desc?: string };
  cross_correlation: { valor: number; limiar_low: number; limiar_high: number; g: number; status: string; desc?: string };
  ema20: { valor: string; dist_pct: number | null; status: string; desc?: string };
  mac_score?: { valor: number; limiar: number; status: string; desc?: string; f13?: number; cot?: number; fed?: number } | null;
}

const DEFAULTS: IndicatorsState = {
  temperatura: { valor: 0.42, limiar: 0.6, status: "normal" },
  cross_correlation: { valor: 0.62, limiar_low: 0.55, limiar_high: 0.75, g: 0.35, status: "elevado" },
  ema20: { valor: "acima", dist_pct: 2.3, status: "ok" },
  mac_score: { valor: 68, limiar: 50, status: "positivo" },
};

function f2(n: number) { return Number(n).toFixed(2); }
function pct01(v: number) { return Math.max(0, Math.min(100, v * 100)); }
function tempColor(v: number) { return v >= 0.8 ? "#E74C3C" : v >= 0.6 ? "#E67E22" : v >= 0.4 ? "#E5B800" : v >= 0.2 ? "#2ECC71" : "#1A8FE3"; }
function ccColor(v: number) { return v >= 0.75 ? "#E74C3C" : v >= 0.55 ? "#F39C12" : "#2ECC71"; }
function statusLabel(type: "temp" | "cc" | "mac", v: number): [string, string] {
  if (type === "temp") return v >= 0.6 ? ["defense", "r"] : v >= 0.4 ? ["alert", "a"] : ["normal", "g"];
  if (type === "cc") return v >= 0.75 ? ["critical", "r"] : v >= 0.55 ? ["elevated", "a"] : ["normal", "g"];
  return v >= 50 ? ["positive", "g"] : v >= 30 ? ["neutral", "a"] : ["negative", "r"];
}

export default function Indicadores() {
  const [d, setD] = useState<IndicatorsState>(DEFAULTS);
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    apiGet<{ indicators: IndicatorsState }>("/v1/protection/indicators")
      .then((data) => { setD(data.indicators); setConn("ok"); })
      .catch(() => { setD(DEFAULTS); setConn("error"); });
  }, []);

  useEffect(() => {
    const tempStatus = d.temperatura.valor >= 0.6 ? "defense" : d.temperatura.valor >= 0.4 ? "alert" : "normal";
    const ccStatus = d.cross_correlation.valor >= 0.75 ? "critical" : d.cross_correlation.valor >= 0.55 ? "elevated" : "normal";
    const macVal = d.mac_score ? d.mac_score.valor : null;
    publishScreenData(
      "indicadores",
      `Temperature ${d.temperatura.valor.toFixed(2)} (${tempStatus}) | CC ${ccStatus} | MAC Score ${macVal ?? "N/A"}`,
      d,
      { briefing: `Temperature at ${d.temperatura.valor.toFixed(2)} (${tempStatus}), cross-correlation ${ccStatus} and MAC Score at ${macVal ?? "not available"}.` }
    );
  }, [d]);

  const t = d.temperatura, cc = d.cross_correlation, ema = d.ema20, mac = d.mac_score;
  const tSt = statusLabel("temp", t.valor);
  const ccRange = cc.limiar_high - cc.limiar_low;
  const gFactor = ccRange ? Math.max(0, Math.min(1, (cc.valor - cc.limiar_low) / ccRange)) : 0;
  const ccSt = statusLabel("cc", cc.valor);
  const emaAbove = ema.valor === "acima";
  const macSt = mac ? statusLabel("mac", mac.valor) : ["not available", "b"] as [string, string];
  const emaPos = 50 + Math.max(-50, Math.min(50, (ema.dist_pct ?? 0) * 5));

  return (
    <div className="screen">
      <div className="flex between mb">
        <div><div className="h1">Indicators</div><div className="sub">4 defense sensors — temperature, cross-correlation, EMA 20 and MAC Score.</div></div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "connecting…" : conn === "ok" ? "● API live" : "✕ API offline"}
        </div>
      </div>

      <div className="grid g2 mb">
        <div className="card">
          <h2><span>Temperature</span><span className={`tag ${tSt[1]}`}>{tSt[0]}</span></h2>
          <div className="ind-big" style={{ color: tempColor(t.valor) }}>{f2(t.valor)}</div>
          <div className="ind-limiar">Threshold: {f2(t.limiar)}</div>
          <div className="phead"><span>Temperature <small>0 → 1</small></span><span className="dist" style={{ color: tempColor(t.valor) }}>{f2(t.valor)}</span></div>
          <Bullet pct={pct01(t.valor)} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--tx3)", marginTop: -6 }}>
            <span>0 (safe)</span><span style={{ color: "var(--orange)" }}>threshold {f2(t.limiar)}</span><span>1 (defense)</span>
          </div>
          <div className="ind-desc">Aggregate temperature of the attack pillars. Combines turbulence (40%), trend break (35%) and jerk (25%). When it crosses the threshold, it activates defense in the corresponding pillar.</div>
        </div>

        <div className="card">
          <h2><span>Cross-Correlation</span><span className={`tag ${ccSt[1]}`}>{ccSt[0]}</span></h2>
          <div className="ind-big" style={{ color: ccColor(cc.valor) }}>{f2(cc.valor)}</div>
          <div className="ind-limiar">Bands: {f2(cc.limiar_low)} → {f2(cc.limiar_high)}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "6px 0" }}>
            <span className="ind-label">g factor</span>
            <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{f2(gFactor)}</span>
          </div>
          <div className="phead"><span>Cross-Correlation <small>{f2(cc.limiar_low)} → {f2(cc.limiar_high)}</small></span><span className="dist" style={{ color: ccColor(cc.valor) }}>{f2(gFactor)}</span></div>
          <Bullet pct={pct01(cc.valor)} />
          <div className="formula" style={{ marginTop: 4 }}>g = clip((cc − {f2(cc.limiar_low)}) / ({f2(cc.limiar_high)} − {f2(cc.limiar_low)}), 0, 1)</div>
          <div className="ind-desc">Cross-correlation between portfolio assets. High values indicate systemic risk — the gate reduces exposure proportionally to factor g.</div>
        </div>

        <div className="card">
          <h2><span>EMA 20</span><span className={`tag ${emaAbove ? "g" : "r"}`}>{emaAbove ? "above" : "below"}</span></h2>
          <div className="ind-big" style={{ color: emaAbove ? "#2ECC71" : "#E74C3C" }}>{emaAbove ? "ABOVE" : "BELOW"}</div>
          <div className="ind-limiar">Distance: {ema.dist_pct != null ? `${ema.dist_pct >= 0 ? "+" : ""}${ema.dist_pct.toFixed(1)}%` : "—"}</div>
          <div className="ema-visual">
            <div style={{ width: "100%" }}>
              <div className="ema-bar">
                <div className="ema-half below" />
                <div className="ema-half above" />
                <div className="ema-needle" style={{ left: `calc(${emaPos.toFixed(1)}% - 1px)` }} />
              </div>
              <div className="ema-labels"><span>below EMA</span><span>EMA 20</span><span>above EMA</span></div>
            </div>
          </div>
          <div className="ind-desc">Price position relative to the 20-period EMA. Above = uptrend intact, allows re-entry. Below = trend broken, defense maintained.</div>
        </div>

        <div className="card">
          <h2><span>MAC Score</span><span className={`tag ${macSt[1]}`}>{macSt[0]}</span></h2>
          {mac ? (
            <>
              <div className="ind-big" style={{ color: mac.valor >= 50 ? "#2ECC71" : mac.valor >= 30 ? "#F39C12" : "#E74C3C" }}>
                {mac.valor}<span style={{ fontSize: 18, color: "var(--tx2)", fontWeight: 400 }}>/100</span>
              </div>
              <div className="ind-limiar">Threshold: {mac.limiar}</div>
              <div className="phead"><span>MAC Score <small>0 → 100</small></span><span className="dist">{mac.valor}/100</span></div>
              <Bullet pct={mac.valor} />
              <div className="mac-comp">
                <span>13F: {mac.f13 ?? "—"}</span>
                <span>COT: {mac.cot ?? "—"}</span>
                <span>Fed: {mac.fed ?? "—"}</span>
              </div>
            </>
          ) : (
            <div className="ind-limiar" style={{ padding: "12px 0" }}>Not issued in this reading — standalone, not yet integrated into the trigger.</div>
          )}
          <div className="ind-desc">Macro Aggregate Composite — combines institutional positioning (13F), futures market (COT) and monetary policy (Fed) into a 0-to-100 score.</div>
        </div>
      </div>

      <div className="foot">Portfolio Manager Cockpit · Indicators · consumes /v1/protection/indicators. Shared design system (harpian-ds).</div>
    </div>
  );
}

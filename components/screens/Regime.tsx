"use client";
import { useEffect } from "react";
import { publishScreenData } from "@/lib/jim-data";

// Order: Risk-Off → Caution → Neutral → Risk-On (defensive on the left, exposed on the right).
const STATES = [
  { key: "BEAR", label: "Risk-Off", color: "#E74C3C" },
  { key: "CAUTELA", label: "Caution", color: "#F39C12" },
  { key: "NEUTRO", label: "Neutral", color: "#4A90D9" },
  { key: "BULL", label: "Risk-On", color: "#2ECC71" },
];
const CURRENT = "BULL";

// High-level reading (client-safe: WHAT it means, not HOW it's detected).
const MEANING: Record<string, string> = {
  BULL: "Risk-favorable environment. The funds operate with full equity exposure; the defense layer stays on standby, ready to reduce risk if the regime turns.",
  NEUTRO: "No dominant trend. Moderate exposure and close monitoring — the stance can shift quickly in either direction.",
  CAUTELA: "Signs of deterioration. The funds begin reducing risk and reinforcing protection.",
  BEAR: "Adverse environment. Active defense: more cash and defensive assets, with reduced equity exposure.",
};

// Posture by regime — outcome (what the fund does), without revealing the engine.
const POSTURE = [
  { r: "Risk-On", eq: "Full", def: "Standing by", tone: "g" },
  { r: "Neutral", eq: "Moderate", def: "Standing by", tone: "b" },
  { r: "Caution", eq: "Reduced", def: "Activating", tone: "o" },
  { r: "Risk-Off", eq: "Low", def: "Active", tone: "r" },
];

export default function Regime() {
  const cur = STATES.find((s) => s.key === CURRENT)!;

  useEffect(() => {
    publishScreenData("regime", `Current regime: ${cur.label} (${CURRENT})`, { current: CURRENT, label: cur.label, states: STATES, posture: POSTURE }, {
      briefing: `Current market regime is ${cur.label}. ${MEANING[CURRENT]}`,
    });
  }, []);

  return (
    <div className="screen">
      <div className="crumb">Market › <b>Market regime</b></div>
      <div className="h1">Market regime</div>
      <div className="sub">The regime reading that guides the funds' defense posture. (The detection method is proprietary.)</div>

      <div className="grid g2 mb">
        <div className="card">
          <h3><i className="ti ti-gauge" />Current regime</h3>
          <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
            <div className="big" style={{ fontSize: 30, color: cur.color }}>{cur.label.toUpperCase()}</div>
            <div className="muted mt">defense disarmed · full exposure</div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {STATES.map((s) => {
              const on = s.key === CURRENT;
              return (
                <div key={s.key} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 8, border: `1px solid ${on ? s.color : "var(--line2)"}`, background: on ? `${s.color}1f` : "transparent" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, margin: "0 auto 6px", opacity: on ? 1 : 0.4 }} />
                  <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: on ? s.color : "var(--tx3)", fontWeight: on ? 700 : 400 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
          <div className="muted mt" style={{ textAlign: "center", fontSize: 11 }}>In Risk-On since 02/05/2026.</div>
        </div>

        <div className="card">
          <h3><i className="ti ti-info-circle" />What this means for your portfolio</h3>
          <div style={{ fontSize: 14, color: "var(--tx)", lineHeight: 1.6 }}>{MEANING[CURRENT]}</div>
          <div className="pills mt">
            <span className="pill g"><span className="pd" />Full exposure</span>
            <span className="pill g"><span className="pd" />Defense on standby</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3><i className="ti ti-shield-half" />Fund posture by regime</h3>
        <table>
          <thead><tr><th>Regime</th><th>Equity exposure</th><th>Defense layer</th></tr></thead>
          <tbody>
            {POSTURE.map((p) => (
              <tr key={p.r} style={{ background: p.r === "Risk-On" ? "rgba(46,204,113,.05)" : undefined }}>
                <td><span className={`tag ${p.tone}`}>{p.r}</span></td>
                <td style={{ color: "var(--tx)" }}>{p.eq}</td>
                <td style={{ color: "var(--tx2)" }}>{p.def}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted mt" style={{ fontSize: 11 }}>Shows the posture each regime triggers in the funds — not the internal signals that define the regime.</div>
      </div>
    </div>
  );
}

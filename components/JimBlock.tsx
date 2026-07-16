"use client";
import type { AnalysisBlock, Driver } from "@/lib/jim-cockpit-analysis";

// Twin of the Terminal's JimBlock, but powered by the INTERNAL engine
// (lib/jim-cockpit-analysis.ts): here JIM talks about Temperature, CC, gates,
// MAC, turbulence, absorption ratio and overlay — which is forbidden on the client.

const TONE_COLOR: Record<string, string> = { pos: "#2ECC71", neg: "#E74C3C", neu: "#4A90D9" };
const TONE_ICON: Record<string, string> = { pos: "ti-circle-check", neg: "ti-alert-circle", neu: "ti-info-circle" };

export function DriverRow({ d }: { d: Driver }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 9, alignItems: "flex-start" }}>
      <i className={`ti ${TONE_ICON[d.tone]}`} style={{ fontSize: 13, color: TONE_COLOR[d.tone], marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx)", marginBottom: 1 }}>{d.label}</div>
        <div style={{ fontSize: 12.5, color: "var(--tx2)", lineHeight: 1.6 }}>{d.detail}</div>
      </div>
    </div>
  );
}

export default function JimBlock({ block, cols = 2 }: { block: AnalysisBlock; cols?: 1 | 2 }) {
  return (
    <div className="card" style={{ padding: "14px 18px", borderColor: "rgba(201,160,44,.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: "linear-gradient(135deg, #C9A02C 0%, #E6B800 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ti ti-brain" style={{ fontSize: 16, color: "#0a1628" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: ".05em" }}>
            JIM — WHY IT IS LIKE THIS
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)" }}>Internal reading · mechanism, not just outcome</div>
        </div>
        <span style={{
          marginLeft: "auto", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
          padding: "3px 9px", borderRadius: 4,
          background: `${block.badge.color}18`, color: block.badge.color,
        }}>{block.badge.label}</span>
      </div>

      <div style={{
        fontSize: 13, fontWeight: 600, lineHeight: 1.55, color: "var(--tx)",
        padding: "8px 12px", marginBottom: 10, borderRadius: 6,
        background: `${block.badge.color}0E`, borderLeft: `3px solid ${block.badge.color}`,
      }}>{block.leitura}</div>

      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", fontFamily: "var(--mono)", letterSpacing: ".06em", marginBottom: 7 }}>
        WHAT IS INFLUENCING IT
      </div>
      <div style={{ display: "grid", gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr", gap: "0 22px" }}>
        {block.porque.map((d, i) => <DriverRow key={i} d={d} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr", gap: 14, marginTop: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", fontFamily: "var(--mono)", letterSpacing: ".06em", marginBottom: 4 }}>
            <i className="ti ti-trending-up" style={{ fontSize: 11, marginRight: 4 }} />TREND
          </div>
          <div style={{ fontSize: 12.5, color: "var(--tx2)", lineHeight: 1.6 }}>{block.tendencia}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--mono)", letterSpacing: ".06em", marginBottom: 4 }}>
            <i className="ti ti-target-arrow" style={{ fontSize: 11, marginRight: 4 }} />WHAT THIS CHANGES
          </div>
          <div style={{ fontSize: 12.5, color: "var(--tx2)", lineHeight: 1.6 }}>{block.impacto}</div>
        </div>
      </div>
    </div>
  );
}

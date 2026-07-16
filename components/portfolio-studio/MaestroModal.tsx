"use client";
import { useEffect } from "react";
import type { Regra, MotorNoPortfolio } from "@/lib/portfolioComposicao";
import MaestroPanel from "./MaestroPanel";

interface Props {
  regra: Regra;
  motoresAlvo: MotorNoPortfolio[];
  motorSensor: MotorNoPortfolio | null;
  onClose: () => void;
}

export default function MaestroModal({ regra, motoresAlvo, motorSensor, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.65)",
        zIndex: "var(--z-modal)" as never, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 560, maxHeight: "85vh", overflow: "auto", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase" }}>The Maestro · load balancing</div>
          <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: 18 }}>
          <MaestroPanel regra={regra} motoresAlvo={motoresAlvo} motorSensor={motorSensor} />
        </div>
      </div>
    </div>
  );
}

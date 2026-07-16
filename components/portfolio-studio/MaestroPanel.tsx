"use client";
import { useMemo, useState } from "react";
import type { Regra, MotorNoPortfolio } from "@/lib/portfolioComposicao";

// ============================================================
// THE MAESTRO — the conductor that balances the load across engines.
// Today the rule (dynamic_mix) is a decorative diamond on the canvas,
// without showing HOW it reacts to the sensor. This panel makes the
// response curve tangible: drag the sensor, watch the engines move.
//
// ⚠️ The curve below is an ILLUSTRATIVE SIMULATION of the step/linear
// shape configured here — it is not the production engine's calculation
// (that one is proprietary and runs on the real system, not in this mock).
// ============================================================

interface Props {
  regra: Regra;
  motoresAlvo: MotorNoPortfolio[];
  motorSensor: MotorNoPortfolio | null;
}

const MOTOR_COLOR = "#37c98a"; // attack
const DEF_COLOR = "#4a90d9"; // defense (1 - attack fraction)

function clip(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// fraction in attack (0..1) given the sensor value (0..1) — see the honesty note above.
function attackFraction(sensor: number, regra: Regra): number {
  const thr = regra.threshold ?? 0.5;
  if (regra.response_type === "linear") {
    const largura = 0.2;
    return clip(1 - (sensor - (thr - largura / 2)) / largura, 0, 1);
  }
  const k = regra.k_steep ?? 8;
  return clip(1 / (1 + Math.exp(k * (sensor - thr))), 0, 1);
}

function Fader({ label, pct, color, sub }: { label: string; pct: number; color: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 74 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color }}>{pct.toFixed(0)}%</div>
      <div style={{ width: 14, height: 140, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 7, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: `${pct}%`,
            background: `linear-gradient(180deg, ${color}, ${color}99)`,
            transition: "height .15s ease-out",
          }}
        />
        <div
          style={{
            position: "absolute", left: -3, right: -3, height: 9, borderRadius: 3,
            background: "var(--tx)", boxShadow: "0 2px 6px rgba(0,0,0,.5)",
            bottom: `calc(${pct}% - 4px)`, transition: "bottom .15s ease-out",
          }}
        />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--tx)" }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: "var(--tx3)" }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function MaestroPanel({ regra, motoresAlvo, motorSensor }: Props) {
  const [sensor, setSensor] = useState(0.3);
  const thr = regra.threshold ?? 0.5;

  const atkFrac = useMemo(() => attackFraction(sensor, regra), [sensor, regra]);
  const defFrac = 1 - atkFrac;

  // distributes the attack budget among the target engines: proportional to the
  // configured fixed weight, or equally among them if all are dynamic.
  const pesos = useMemo(() => {
    const fixos = motoresAlvo.filter((m) => m.peso.modo === "fixo" && m.peso.valor != null);
    if (fixos.length === motoresAlvo.length && motoresAlvo.length > 0) {
      const total = fixos.reduce((s, m) => s + (m.peso.valor || 0), 0) || 1;
      return motoresAlvo.map((m) => (m.peso.valor || 0) / total);
    }
    return motoresAlvo.map(() => 1 / Math.max(1, motoresAlvo.length));
  }, [motoresAlvo]);

  // sampled response curve, for the mini SVG chart
  const pontos = useMemo(() => {
    const N = 60;
    return Array.from({ length: N + 1 }, (_, i) => {
      const s = i / N;
      return { s, a: attackFraction(s, regra) };
    });
  }, [regra]);

  const W = 280, H = 90, PAD = 6;
  const xOf = (s: number) => PAD + s * (W - 2 * PAD);
  const yOf = (a: number) => PAD + (1 - a) * (H - 2 * PAD);
  const path = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.s).toFixed(1)} ${yOf(p.a).toFixed(1)}`).join(" ");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>🎼</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>{regra.nome}</div>
          <div style={{ fontSize: 11, color: "var(--tx3)" }}>
            {regra.tipo} · response {regra.response_type || "step"} · sensor:{" "}
            <b style={{ color: "var(--tx2)" }}>{motorSensor ? `${motorSensor.nome} [${motorSensor.id}]` : "not connected"}</b>
          </div>
        </div>
      </div>

      {regra.descricao && <div style={{ fontSize: 11.5, color: "var(--tx2)", lineHeight: 1.5 }}>{regra.descricao}</div>}

      {/* response curve */}
      <div>
        <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 6 }}>
          Response curve · % in attack vs. sensor reading
        </div>
        <svg width={W} height={H} style={{ display: "block", background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 6 }}>
          {/* threshold line */}
          <line x1={xOf(thr)} y1={PAD} x2={xOf(thr)} y2={H - PAD} stroke="var(--red-text)" strokeDasharray="3,3" strokeWidth={1} />
          <text x={xOf(thr) + 3} y={12} fontSize={8} fill="var(--red-text)" fontFamily="var(--mono)">trigger {thr}</text>
          {/* curve */}
          <path d={path} fill="none" stroke={MOTOR_COLOR} strokeWidth={1.6} />
          {/* current slider position */}
          <circle cx={xOf(sensor)} cy={yOf(atkFrac)} r={4} fill="var(--gold)" stroke="#000" strokeWidth={0.5} />
          <line x1={xOf(sensor)} y1={yOf(atkFrac)} x2={xOf(sensor)} y2={H - PAD} stroke="var(--gold)" strokeWidth={1} strokeDasharray="2,2" />
        </svg>
        <input
          type="range" min={0} max={1} step={0.01} value={sensor}
          onChange={(e) => setSensor(Number(e.target.value))}
          style={{ width: W, marginTop: 6, accentColor: "var(--gold)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--tx3)", fontFamily: "var(--mono)", width: W }}>
          <span>sensor 0.00 (cold)</span>
          <span style={{ color: "var(--gold)" }}>simulating: {sensor.toFixed(2)}</span>
          <span>1.00 (hot)</span>
        </div>
      </div>

      {/* faders */}
      <div>
        <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 10 }}>
          How the engines respond to this reading
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          {motoresAlvo.map((m, i) => (
            <Fader key={m.id} label={m.nome} sub={`⚔️ [${m.id}]`} color={MOTOR_COLOR} pct={atkFrac * pesos[i] * 100} />
          ))}
          <Fader label="Defense" sub="🛡️ implicit" color={DEF_COLOR} pct={defFrac * 100} />
          {motoresAlvo.length === 0 && (
            <div className="c-mut" style={{ fontSize: 11, padding: 8 }}>This rule doesn't have target engines yet (drag an attack engine onto the canvas and connect the rule to it).</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--tx3)", lineHeight: 1.5, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        ⚠️ Illustrative simulation of the curve shape ({regra.response_type || "step"}, trigger {thr}
        {regra.k_steep != null && `, k=${regra.k_steep}`}) — not the production engine's calculation, which is proprietary.
        Drag the slider to see the shape; today's real reading comes from the sensor <b>{motorSensor?.nome || "—"}</b> in the Engine Room.
      </div>
    </div>
  );
}

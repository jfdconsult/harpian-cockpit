"use client";
import { useMemo, useState } from "react";
import type { Regra, MotorNoPortfolio } from "@/lib/portfolioComposicao";

// ============================================================
// O MAESTRO — o regente que balanceia a carga entre os motores.
// Hoje a regra (dynamic_mix) é um losango decorativo no canvas, sem
// mostrar COMO ela reage ao sensor. Este painel torna a curva de
// resposta tangível: arraste o sensor, veja os motores se movendo.
//
// ⚠️ A curva abaixo é uma SIMULAÇÃO ILUSTRATIVA da forma step/linear
// configurada aqui — não é o cálculo do motor de produção (esse é
// proprietário e roda no sistema real, não neste mock).
// ============================================================

interface Props {
  regra: Regra;
  motoresAlvo: MotorNoPortfolio[];
  motorSensor: MotorNoPortfolio | null;
}

const MOTOR_COLOR = "#37c98a"; // ataque
const DEF_COLOR = "#4a90d9"; // defesa (fração 1 - ataque)

function clip(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// fração em ataque (0..1) dado o valor do sensor (0..1) — ver nota de honestidade acima.
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
      <div style={{ width: 14, height: 140, background: "#0c1c30", border: "1px solid var(--line)", borderRadius: 7, position: "relative", overflow: "hidden" }}>
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

  // distribui o orçamento de ataque entre os motores-alvo: proporcional ao peso
  // fixo configurado, ou igual entre eles se todos forem dinâmicos.
  const pesos = useMemo(() => {
    const fixos = motoresAlvo.filter((m) => m.peso.modo === "fixo" && m.peso.valor != null);
    if (fixos.length === motoresAlvo.length && motoresAlvo.length > 0) {
      const total = fixos.reduce((s, m) => s + (m.peso.valor || 0), 0) || 1;
      return motoresAlvo.map((m) => (m.peso.valor || 0) / total);
    }
    return motoresAlvo.map(() => 1 / Math.max(1, motoresAlvo.length));
  }, [motoresAlvo]);

  // curva de resposta amostrada, para o mini gráfico SVG
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
            {regra.tipo} · resposta {regra.response_type || "step"} · sensor:{" "}
            <b style={{ color: "var(--tx2)" }}>{motorSensor ? `${motorSensor.nome} [${motorSensor.id}]` : "não ligado"}</b>
          </div>
        </div>
      </div>

      {regra.descricao && <div style={{ fontSize: 11.5, color: "var(--tx2)", lineHeight: 1.5 }}>{regra.descricao}</div>}

      {/* curva de resposta */}
      <div>
        <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 6 }}>
          Curva de resposta · % em ataque vs. leitura do sensor
        </div>
        <svg width={W} height={H} style={{ display: "block", background: "#0c1c30", border: "1px solid var(--line)", borderRadius: 6 }}>
          {/* linha do threshold */}
          <line x1={xOf(thr)} y1={PAD} x2={xOf(thr)} y2={H - PAD} stroke="var(--red-text)" strokeDasharray="3,3" strokeWidth={1} />
          <text x={xOf(thr) + 3} y={12} fontSize={8} fill="var(--red-text)" fontFamily="var(--mono)">gatilho {thr}</text>
          {/* curva */}
          <path d={path} fill="none" stroke={MOTOR_COLOR} strokeWidth={1.6} />
          {/* posição atual do slider */}
          <circle cx={xOf(sensor)} cy={yOf(atkFrac)} r={4} fill="var(--gold)" stroke="#000" strokeWidth={0.5} />
          <line x1={xOf(sensor)} y1={yOf(atkFrac)} x2={xOf(sensor)} y2={H - PAD} stroke="var(--gold)" strokeWidth={1} strokeDasharray="2,2" />
        </svg>
        <input
          type="range" min={0} max={1} step={0.01} value={sensor}
          onChange={(e) => setSensor(Number(e.target.value))}
          style={{ width: W, marginTop: 6, accentColor: "var(--gold)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--tx3)", fontFamily: "var(--mono)", width: W }}>
          <span>sensor 0.00 (frio)</span>
          <span style={{ color: "var(--gold)" }}>simulando: {sensor.toFixed(2)}</span>
          <span>1.00 (quente)</span>
        </div>
      </div>

      {/* faders */}
      <div>
        <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 10 }}>
          Como os motores respondem a essa leitura
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          {motoresAlvo.map((m, i) => (
            <Fader key={m.id} label={m.nome} sub={`⚔️ [${m.id}]`} color={MOTOR_COLOR} pct={atkFrac * pesos[i] * 100} />
          ))}
          <Fader label="Defesa" sub="🛡️ implícita" color={DEF_COLOR} pct={defFrac * 100} />
          {motoresAlvo.length === 0 && (
            <div className="c-mut" style={{ fontSize: 11, padding: 8 }}>Essa regra ainda não tem motores-alvo (arraste um motor de ataque no canvas e ligue a regra a ele).</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--tx3)", lineHeight: 1.5, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        ⚠️ Simulação ilustrativa da forma da curva ({regra.response_type || "step"}, gatilho {thr}
        {regra.k_steep != null && `, k=${regra.k_steep}`}) — não é o cálculo do motor de produção, que é proprietário.
        Arraste o slider para ver a forma; a leitura real do dia vem do sensor <b>{motorSensor?.nome || "—"}</b> no Engine Room.
      </div>
    </div>
  );
}

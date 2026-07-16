const STATE_MAP: Record<string, [number, string]> = {
  "RISK-OFF": [0.13, "#E74C3C"],
  WARNING: [0.38, "#F39C12"],
  "RISK-ON": [0.62, "#2ECC71"],
  "CÉU ABERTO": [0.88, "#4A90D9"],
};

export default function RegimeGauge({ state, sub }: { state: string; sub?: string }) {
  const [frac, col] = STATE_MAP[state] || STATE_MAP["RISK-ON"];
  const ang = ((180 - frac * 180) * Math.PI) / 180;
  const L = 118;
  const nx = 200 + L * Math.cos(ang);
  const ny = 200 - L * Math.sin(ang);

  return (
    <svg viewBox="0 0 400 232" width="100%" style={{ display: "block", maxHeight: 200 }}>
      <path d="M40,200 A160,160 0 0,1 86.9,86.9" fill="none" stroke="#E74C3C" strokeWidth={24} strokeLinecap="round" opacity={0.9} />
      <path d="M86.9,86.9 A160,160 0 0,1 200,40" fill="none" stroke="#F39C12" strokeWidth={24} opacity={0.9} />
      <path d="M200,40 A160,160 0 0,1 313.1,86.9" fill="none" stroke="#2ECC71" strokeWidth={24} opacity={0.9} />
      <path d="M313.1,86.9 A160,160 0 0,1 360,200" fill="none" stroke="#4A90D9" strokeWidth={24} strokeLinecap="round" opacity={0.9} />
      <text x={50} y={222} fill="#E74C3C" fontSize={11} fontWeight={700} textAnchor="middle">RISK-OFF</text>
      <text x={128} y={58} fill="#F39C12" fontSize={9.5} fontWeight={700} textAnchor="middle">WARNING</text>
      <text x={300} y={66} fill="#2ECC71" fontSize={11} fontWeight={700} textAnchor="middle">RISK-ON</text>
      <text x={350} y={222} fill="#4A90D9" fontSize={9.5} fontWeight={700} textAnchor="middle">CLEAR SKIES</text>
      <line x1={200} y1={200} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      <circle cx={200} cy={200} r={9} fill="#fff" />
      <circle cx={200} cy={200} r={4} fill="var(--bg)" />
      <text x={200} y={150} fill={col} fontSize={27} fontWeight={800} textAnchor="middle">{state}</text>
      {sub && <text x={200} y={174} fill="#7d96b3" fontSize={11} textAnchor="middle">{sub}</text>}
    </svg>
  );
}

export function Bullet({ pct }: { pct: number }) {
  return (
    <div className="bullet">
      <div className="bz" style={{ left: "0%", width: "25%", background: "#E74C3C" }} />
      <div className="bz" style={{ left: "25%", width: "25%", background: "#F39C12" }} />
      <div className="bz" style={{ left: "50%", width: "25%", background: "#2ECC71" }} />
      <div className="bz" style={{ left: "75%", width: "25%", background: "#4A90D9" }} />
      <div className="bneedle" style={{ left: `calc(${pct}% - 1px)` }} />
    </div>
  );
}

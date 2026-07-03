"use client";

// Ordem: Risk-Off → Cautela → Neutro → Risk-On (defensivo à esquerda, exposto à direita).
const STATES = [
  { key: "BEAR", label: "Risk-Off", color: "#E74C3C" },
  { key: "CAUTELA", label: "Cautela", color: "#F39C12" },
  { key: "NEUTRO", label: "Neutro", color: "#4A90D9" },
  { key: "BULL", label: "Risk-On", color: "#2ECC71" },
];
const CURRENT = "BULL";

// Leitura de alto nível (cliente-safe: o QUE significa, não COMO é detectado).
const MEANING: Record<string, string> = {
  BULL: "Ambiente favorável ao risco. Os fundos operam com exposição plena a ações; a camada de defesa fica em prontidão, pronta para reduzir risco se o regime virar.",
  NEUTRO: "Sem tendência dominante. Exposição moderada e monitoramento próximo — a postura pode mudar rápido nos dois sentidos.",
  CAUTELA: "Sinais de deterioração. Os fundos começam a reduzir risco e a reforçar a proteção.",
  BEAR: "Ambiente adverso. Defesa ativa: mais caixa e ativos defensivos, com exposição a ações reduzida.",
};

// Postura por regime — resultado (o que o fundo faz), sem revelar o motor.
const POSTURE = [
  { r: "Risk-On", eq: "Plena", def: "Em prontidão", tone: "g" },
  { r: "Neutro", eq: "Moderada", def: "Em prontidão", tone: "b" },
  { r: "Cautela", eq: "Reduzida", def: "Ativando", tone: "o" },
  { r: "Risk-Off", eq: "Baixa", def: "Ativa", tone: "r" },
];

export default function Regime() {
  const cur = STATES.find((s) => s.key === CURRENT)!;
  return (
    <div className="screen">
      <div className="crumb">Mercado › <b>Regime de mercado</b></div>
      <div className="h1">Regime de mercado</div>
      <div className="sub">A leitura de regime que orienta a postura de defesa dos fundos. (O método de detecção é proprietário.)</div>

      <div className="grid g2 mb">
        <div className="card">
          <h3><i className="ti ti-gauge" />Regime atual</h3>
          <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
            <div className="big" style={{ fontSize: 30, color: cur.color }}>{cur.label.toUpperCase()}</div>
            <div className="muted mt">defesa desarmada · exposição plena</div>
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
          <div className="muted mt" style={{ textAlign: "center", fontSize: 11 }}>Em Risk-On desde 02/05/2026.</div>
        </div>

        <div className="card">
          <h3><i className="ti ti-info-circle" />O que isso significa para a sua carteira</h3>
          <div style={{ fontSize: 14, color: "var(--tx)", lineHeight: 1.6 }}>{MEANING[CURRENT]}</div>
          <div className="pills mt">
            <span className="pill g"><span className="pd" />Exposição plena</span>
            <span className="pill g"><span className="pd" />Defesa em prontidão</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3><i className="ti ti-shield-half" />Postura dos fundos por regime</h3>
        <table>
          <thead><tr><th>Regime</th><th>Exposição a ações</th><th>Camada de defesa</th></tr></thead>
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
        <div className="muted mt" style={{ fontSize: 11 }}>Mostra a postura que cada regime dispara nos fundos — não os sinais internos que definem o regime.</div>
      </div>
    </div>
  );
}

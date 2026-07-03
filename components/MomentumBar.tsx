// ============================================================
// MOMENTUM BAR (padrão AlphaDroid / SectorSurfer)
// Vértice fixo no centro. Direita = verde (positivo), esquerda = vermelho (negativo).
// Rótulo numérico dentro da barra (à direita, se sobra; senão fora).
// ============================================================
interface MomentumBarProps {
  value: number | null | undefined;
  /** Valor absoluto que representa 100% (barra encostando na borda). Default 50 (%). */
  scale?: number;
  /** Sufixo do rótulo (ex: "%"). */
  suffix?: string;
  /** Casas decimais do rótulo. */
  decimals?: number;
  /** Altura da barra em px. Default 16. */
  height?: number;
  /** Se true, mostra o número dentro da barra; se false, só a barra. Default true. */
  showLabel?: boolean;
}

export default function MomentumBar({
  value,
  scale = 50,
  suffix = "%",
  decimals = 1,
  height = 16,
  showLabel = true,
}: MomentumBarProps) {
  if (value == null || isNaN(value)) {
    return <span className="c-mut2" style={{ fontSize: 11 }}>—</span>;
  }

  // Clamp de -1 a +1 para % da metade
  const clamped = Math.max(-1, Math.min(1, value / scale));
  const halfPct = Math.abs(clamped) * 50; // % que a barra ocupa a partir do centro
  const isPositive = value >= 0;
  const color = isPositive ? "#2ECC71" : "#E74C3C";
  const bgColor = isPositive ? "rgba(46,204,113,0.10)" : "rgba(231,76,60,0.10)";

  const labelText = value.toFixed(decimals).replace(".", ",") + suffix;
  const labelInside = halfPct > 22; // se a barra é gorda o suficiente, texto vai dentro

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        background: bgColor,
        borderRadius: 3,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Linha central */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(255,255,255,0.28)",
          transform: "translateX(-0.5px)",
          zIndex: 1,
        }}
      />
      {/* Barra */}
      <div
        style={{
          position: "absolute",
          top: 2,
          bottom: 2,
          [isPositive ? "left" : "right"]: "50%",
          width: `${halfPct}%`,
          background: color,
          borderRadius: isPositive ? "0 3px 3px 0" : "3px 0 0 3px",
          transition: "width .18s",
        }}
      />
      {/* Label */}
      {showLabel && (
        <span
          style={{
            position: "absolute",
            [isPositive ? "left" : "right"]: labelInside
              ? `calc(50% + ${halfPct - 22}%)`
              : `calc(50% + ${halfPct}% + 4px)`,
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: "var(--mono)",
            color: labelInside ? "#0A1A30" : color,
            zIndex: 2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {labelText}
        </span>
      )}
    </div>
  );
}

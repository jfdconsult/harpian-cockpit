// ============================================================
// MOMENTUM BAR (AlphaDroid / SectorSurfer pattern)
// Fixed vertex at center. Right = green (positive), left = red (negative).
// Numeric label inside the bar (on the right, if it fits; otherwise outside).
// ============================================================
interface MomentumBarProps {
  value: number | null | undefined;
  /** Absolute value that represents 100% (bar touching the edge). Default 50 (%). */
  scale?: number;
  /** Label suffix (e.g. "%"). */
  suffix?: string;
  /** Decimal places for the label. */
  decimals?: number;
  /** Bar height in px. Default 16. */
  height?: number;
  /** If true, shows the number inside the bar; if false, just the bar. Default true. */
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

  // Clamp from -1 to +1 for % of the half
  const clamped = Math.max(-1, Math.min(1, value / scale));
  const halfPct = Math.abs(clamped) * 50; // % that the bar occupies from the center
  const isPositive = value >= 0;
  const color = isPositive ? "#2ECC71" : "#E74C3C";
  const bgColor = isPositive ? "rgba(46,204,113,0.10)" : "rgba(231,76,60,0.10)";

  const labelText = value.toFixed(decimals) + suffix;
  const labelInside = halfPct > 22; // if the bar is fat enough, text goes inside

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
      {/* Center line */}
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
      {/* Bar */}
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
            color: labelInside ? "var(--bg)" : color,
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

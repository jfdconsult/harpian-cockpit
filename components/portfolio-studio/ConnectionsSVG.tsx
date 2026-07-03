"use client";
import type { Regra } from "@/lib/portfolioComposicao";

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  regras: Regra[];
  motorLayout: Map<string, LayoutBox>;
  regraLayout: Map<string, LayoutBox>;
  width: number;
  height: number;
}

function center(box: LayoutBox): [number, number] {
  return [box.x + box.w / 2, box.y + box.h / 2];
}

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

export default function ConnectionsSVG({ regras, motorLayout, regraLayout, width, height }: Props) {
  const paths: { d: string; key: string }[] = [];

  for (const regra of regras) {
    const rbox = regraLayout.get(regra.id);
    if (!rbox) continue;
    const [rx, ry] = center(rbox);

    if (regra.fonte_sinal) {
      const mbox = motorLayout.get(regra.fonte_sinal);
      if (mbox) {
        const [mx, my] = center(mbox);
        paths.push({ key: `src-${regra.id}-${regra.fonte_sinal}`, d: cubicPath(mx, my, rx, ry) });
      }
    }
    for (const alvo of regra.alvos) {
      const mbox = motorLayout.get(alvo);
      if (mbox) {
        const [mx, my] = center(mbox);
        paths.push({ key: `tgt-${regra.id}-${alvo}`, d: cubicPath(rx, ry, mx, my) });
      }
    }
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 0 }}
    >
      <defs>
        <marker id="arrow-gold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--gold)" opacity={0.7} />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke="var(--gold)"
          strokeOpacity={0.55}
          strokeWidth={2}
          markerEnd="url(#arrow-gold)"
        />
      ))}
    </svg>
  );
}

"use client";
import type { Regra } from "@/lib/portfolioComposicao";
import { useDialog } from "../ui/Dialog";

interface Props {
  regra: Regra;
  x: number;
  y: number;
  onRemove: (regraId: string) => void;
  onOpen?: (regraId: string) => void;
  registerRef?: (regraId: string, el: HTMLDivElement | null) => void;
}

export default function RegraNode({ regra, x, y, onRemove, onOpen, registerRef }: Props) {
  const dialog = useDialog();
  return (
    <div
      ref={(el) => registerRef?.(regra.id, el)}
      data-regra-id={regra.id}
      onClick={() => onOpen?.(regra.id)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 160,
        height: 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onOpen ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 110,
          height: 110,
          transform: "rotate(45deg)",
          background: "linear-gradient(180deg,var(--panel),var(--panel2))",
          border: "1px solid var(--gold)",
          borderRadius: 8,
          boxShadow: "0 4px 14px rgba(0,0,0,.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          textAlign: "center",
          padding: 8,
          width: 140,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 9, color: "var(--tx3)", textTransform: "uppercase" }}>🎼 {regra.tipo}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gold)", marginTop: 2 }}>{regra.nome}</div>
        {regra.threshold != null && (
          <div style={{ fontSize: 9, color: "var(--tx2)", marginTop: 2 }}>
            {regra.response_type} · thr {regra.threshold} · k={regra.k_steep}
          </div>
        )}
        <div style={{ fontSize: 8, color: "var(--tx3)", marginTop: 4 }}>click to open the Maestro</div>
      </div>
      <button
        className="btn ghost"
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          fontSize: 12,
          padding: "6px 9px",
          color: "var(--red-text)",
          pointerEvents: "auto",
        }}
        title="remove rule"
        onClick={async (e) => {
          e.stopPropagation();
          const ok = await dialog.confirm({
            title: `Remove rule ${regra.nome}?`,
            body: "Engines that depend on it will have an orphaned dynamic weight until you connect another rule.",
            danger: true,
            confirmLabel: "Remove rule",
          });
          if (ok) onRemove(regra.id);
        }}
      >
        <i className="ti ti-x" />
      </button>
    </div>
  );
}

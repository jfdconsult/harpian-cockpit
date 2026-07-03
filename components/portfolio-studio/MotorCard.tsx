"use client";
import type { MotorNoPortfolio } from "@/lib/portfolioComposicao";
import { useDialog } from "../ui/Dialog";

interface Props {
  motor: MotorNoPortfolio;
  x: number;
  y: number;
  onDrillDown: (motorId: string) => void;
  onRemove: (motorId: string) => void;
  onOpenRegra?: (regraId: string) => void;
  registerRef?: (motorId: string, el: HTMLDivElement | null) => void;
  draggableProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const TIPO_ICON: Record<string, string> = {
  attack_stocks: "ti-chart-candle",
  attack_etfs: "ti-building-bank",
  detector: "ti-radar-2",
  defense: "ti-shield-check",
  custom: "ti-adjustments",
};

const TIPO_LABEL: Record<string, string> = {
  attack_stocks: "Ataque · Ações",
  attack_etfs: "Ataque · ETFs",
  detector: "Detector",
  defense: "Defesa",
  custom: "Custom",
};

export default function MotorCard({
  motor,
  x,
  y,
  onDrillDown,
  onRemove,
  onOpenRegra,
  registerRef,
  draggableProps,
  isDragging,
}: Props) {
  const dialog = useDialog();
  const statusColor =
    motor.status === "prod" ? "var(--green)" : motor.status === "lab" ? "var(--gold)" : "var(--blue)";
  const statusLabel = motor.status === "prod" ? "PROD" : motor.status === "lab" ? "LAB" : "CANDIDATO";

  return (
    <div
      ref={(el) => registerRef?.(motor.id, el)}
      data-motor-id={motor.id}
      className="card"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 220,
        minHeight: 140,
        padding: 12,
        cursor: "grab",
        opacity: isDragging ? 0.5 : 1,
        borderColor: motor.status === "prod" ? "var(--green)" : "var(--gold)",
        boxShadow: "0 4px 14px rgba(0,0,0,.35)",
        userSelect: "none",
      }}
      onDoubleClick={() => onDrillDown(motor.id)}
      {...(draggableProps || {})}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <i className={`ti ${TIPO_ICON[motor.tipo] || "ti-cpu"}`} style={{ color: "var(--gold)" }} />
        <span style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          [{motor.id}]
        </span>
        <span
          className="tag"
          style={{
            marginLeft: "auto",
            background: motor.status === "prod" ? "var(--green-bg)" : "var(--gold-bg)",
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--tx)", marginBottom: 2 }}>{motor.nome}</div>
      <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 8 }}>
        v{motor.versao} · {TIPO_LABEL[motor.tipo] || motor.tipo}
      </div>

      <div
        style={{
          padding: "6px 8px",
          background: "rgba(0,0,0,.2)",
          borderRadius: 4,
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: motor.peso.regra_id ? "pointer" : "default",
        }}
        onClick={(e) => {
          if (motor.peso.regra_id) {
            e.stopPropagation();
            onOpenRegra?.(motor.peso.regra_id);
          }
        }}
      >
        {motor.peso.modo === "dinamico" ? (
          <>
            <i className="ti ti-link" style={{ color: "var(--gold)" }} />
            <span style={{ color: "var(--gold)" }}>
              dinâmico{motor.peso.regra_id ? ` · ${motor.peso.regra_id}` : ""}
            </span>
          </>
        ) : motor.peso.modo === "fixo" ? (
          <span>
            peso fixo: <b style={{ color: "var(--gold)" }}>{motor.peso.valor ?? "—"}</b>
          </span>
        ) : (
          <span style={{ color: "var(--tx3)" }}>sem peso (detector)</span>
        )}
      </div>

      {motor.registry?.grade && (
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--tx3)" }}>
          Grade backtest: <b style={{ color: "var(--green)" }}>{motor.registry.grade}</b>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button
          className="btn ghost"
          style={{ flex: 1, fontSize: 11, padding: "4px 8px" }}
          onClick={(e) => {
            e.stopPropagation();
            onDrillDown(motor.id);
          }}
        >
          abrir <i className="ti ti-chevron-right" style={{ fontSize: 11 }} />
        </button>
        <button
          className="btn ghost"
          style={{ fontSize: 12, padding: "6px 10px", color: "var(--red-text)" }}
          title="remover do portfolio"
          aria-label={`Remover motor ${motor.id} do portfolio`}
          onClick={async (e) => {
            e.stopPropagation();
            const ok = await dialog.confirm({
              title: `Remover motor ${motor.id}?`,
              body: `${motor.nome} sai da composição deste portfolio. Regras ligadas a ele também são removidas.`,
              danger: true,
              confirmLabel: "Remover motor",
            });
            if (ok) onRemove(motor.id);
          }}
        >
          <i className="ti ti-x" />
        </button>
      </div>
    </div>
  );
}

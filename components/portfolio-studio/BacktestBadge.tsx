"use client";
import { useState } from "react";
import type { Composicao, BacktestPreviewResult } from "@/lib/portfolioComposicao";
import { backtestPreview } from "@/lib/portfolioComposicao";

interface Props {
  draft: Composicao;
  portfolioId: string;
}

export default function BacktestBadge({ draft, portfolioId }: Props) {
  const [state, setState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [result, setResult] = useState<BacktestPreviewResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const motorPrimario = draft.motores.find((m) => m.tipo.startsWith("attack_"));

  async function run() {
    if (!motorPrimario) {
      setErr("Nenhum motor de ataque no portfolio — impossível rodar backtest.");
      setState("error");
      return;
    }
    setState("running");
    setErr(null);
    try {
      const r = await backtestPreview(motorPrimario.ref_motor_id, portfolioId);
      setResult(r);
      setState("success");
    } catch (e) {
      setErr(String(e));
      setState("error");
    }
  }

  const gradeColor =
    result?.grade === "A" ? "var(--green)" : result?.grade === "B" ? "var(--gold)" : "var(--red)";

  return (
    <div className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 14 }}>
      <button
        className="btn"
        onClick={run}
        disabled={state === "running"}
        style={{ minWidth: 160 }}
      >
        {state === "running" ? (
          <>
            <i className="ti ti-loader-2 spin" style={{ marginRight: 6 }} />
            Rodando…
          </>
        ) : (
          <><i className="ti ti-player-play" style={{ marginRight: 5 }} />Rodar backtest</>
        )}
      </button>

      {state === "success" && result && (
        <div className="num" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              padding: "2px 12px",
              borderRadius: 6,
              border: `1px solid ${gradeColor}`,
              color: gradeColor,
            }}
          >
            {result.grade}
          </div>
          <div>
            CAGR OOS <b style={{ color: "var(--gold)" }}>{result.metricas_oos.cagr}%</b>
          </div>
          <div>
            Sortino <b>{result.metricas_oos.sortino}</b>
          </div>
          <div>
            DD <b style={{ color: "var(--red)" }}>{result.metricas_oos.max_dd}%</b>
          </div>
          {result.red_flags.length > 0 && (
            <div style={{ color: "var(--red-text)" }}><i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />{result.red_flags.join(" · ")}</div>
          )}
          <div style={{ color: "var(--tx3)", fontFamily: "monospace", fontSize: 10 }}>{result.run_id}</div>
        </div>
      )}

      {state === "error" && <div style={{ color: "var(--red-text)", fontSize: 12 }}>Erro: {err}</div>}

      {state === "idle" && (
        <div style={{ color: "var(--tx3)", fontSize: 11 }}>
          {motorPrimario
            ? `Motor principal: ${motorPrimario.nome}`
            : "Adicione um motor de ataque para habilitar o backtest."}
        </div>
      )}
    </div>
  );
}

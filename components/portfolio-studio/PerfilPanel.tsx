"use client";
import { useState } from "react";
import type { Perfil } from "@/lib/portfolioComposicao";

interface Props {
  perfis: Perfil[];
  adrTravas: string[];
  onActivate: (perfilId: string) => void;
  onPatch: (perfilId: string, patch: Partial<Pick<Perfil, "w_min" | "w_max">>) => void;
}

export default function PerfilPanel({ perfis, adrTravas, onActivate, onPatch }: Props) {
  const [editing, setEditing] = useState<Record<string, { w_min: string; w_max: string }>>({});

  function localValue(p: Perfil, field: "w_min" | "w_max"): string {
    return editing[p.id]?.[field] ?? String(p[field]);
  }

  function setLocal(pid: string, field: "w_min" | "w_max", value: string) {
    setEditing((prev) => ({
      ...prev,
      [pid]: { w_min: prev[pid]?.w_min ?? "", w_max: prev[pid]?.w_max ?? "", [field]: value },
    }));
  }

  function commit(p: Perfil, field: "w_min" | "w_max") {
    const raw = editing[p.id]?.[field];
    if (raw === undefined) return;
    const num = parseFloat(raw);
    if (!isNaN(num) && num !== p[field]) {
      onPatch(p.id, { [field]: num });
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <h2 style={{ marginBottom: 8 }}>
        <span>Perfis institucionais</span>
      </h2>

      <div style={{ display: "grid", gap: 8 }}>
        {perfis.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 10,
              border: `1px solid ${p.ativo ? "var(--gold)" : "var(--line)"}`,
              borderRadius: 6,
              background: p.ativo ? "rgba(201,160,44,.08)" : "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input
                type="radio"
                name="perfil-ativo"
                checked={p.ativo}
                onChange={() => onActivate(p.id)}
                style={{ cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</span>
              <span style={{ fontSize: 10, color: "var(--tx3)" }}>[{p.id}]</span>
              {p.ativo && (
                <span className="tag g" style={{ marginLeft: "auto" }}>
                  ATIVO
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <label style={{ fontSize: 10, color: "var(--tx3)" }}>
                w_min
                <input
                  className="input"
                  type="number"
                  step={0.001}
                  min={0}
                  max={1}
                  value={localValue(p, "w_min")}
                  onChange={(e) => setLocal(p.id, "w_min", e.target.value)}
                  onBlur={() => commit(p, "w_min")}
                  style={{ marginTop: 2, fontSize: 12, padding: "4px 6px" }}
                />
              </label>
              <label style={{ fontSize: 10, color: "var(--tx3)" }}>
                w_max
                <input
                  className="input"
                  type="number"
                  step={0.001}
                  min={0}
                  max={1}
                  value={localValue(p, "w_max")}
                  onChange={(e) => setLocal(p.id, "w_max", e.target.value)}
                  onBlur={() => commit(p, "w_max")}
                  style={{ marginTop: 2, fontSize: 12, padding: "4px 6px" }}
                />
              </label>
            </div>

            {(p.cagr_10y != null || p.sharpe != null) && (
              <div className="num" style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 10, color: "var(--tx2)" }}>
                {p.cagr_10y != null && <span>CAGR10y {p.cagr_10y}%</span>}
                {p.sharpe != null && <span>Sharpe {p.sharpe}</span>}
                {p.calmar != null && <span>Calmar {p.calmar}</span>}
                {p.max_dd != null && <span>DD {p.max_dd}%</span>}
              </div>
            )}
          </div>
        ))}
        {perfis.length === 0 && (
          <div className="c-mut" style={{ fontSize: 12, padding: 8 }}>
            Nenhum perfil neste portfolio.
          </div>
        )}
      </div>

      {adrTravas.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>
            ADR travas
          </div>
          {adrTravas.map((adr, i) => (
            <div key={i} style={{ fontSize: 10, color: "var(--tx2)", marginBottom: 2 }}>
              <i className="ti ti-lock" style={{ fontSize: 10, marginRight: 4 }} />{adr}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

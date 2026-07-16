"use client";
import { useState } from "react";
import type { Diff } from "@/lib/portfolioComposicao";
import { isEmptyDiff } from "@/lib/portfolioComposicao";

interface Props {
  diff: Diff;
}

function countChanges(diff: Diff): number {
  return (
    diff.motoresAdded.length +
    diff.motoresRemoved.length +
    diff.motoresChanged.length +
    diff.regrasAdded.length +
    diff.regrasRemoved.length +
    diff.perfisChanged.length +
    (diff.perfilAtivoChanged ? 1 : 0)
  );
}

export default function DiffPanel({ diff }: Props) {
  const [open, setOpen] = useState(true);
  const empty = isEmptyDiff(diff);
  const n = countChanges(diff);

  return (
    <div className="card" style={{ padding: 10 }}>
      <div
        style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 8 }}
        onClick={() => setOpen(!open)}
      >
        <i className={`ti ${open ? "ti-chevron-down" : "ti-chevron-right"}`} style={{ fontSize: 13 }} />
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          Changes vs original: <span style={{ color: empty ? "var(--tx3)" : "var(--gold)" }}>{n}</span>
        </span>
      </div>

      {open && !empty && (
        <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 11 }}>
          {diff.motoresAdded.map((m) => (
            <div key={`ma-${m.id}`} style={{ color: "var(--green)" }}>
              + engine {m.id} added ({m.nome})
            </div>
          ))}
          {diff.motoresRemoved.map((m) => (
            <div key={`mr-${m.id}`} style={{ color: "var(--red)" }}>
              − engine {m.id} removed ({m.nome})
            </div>
          ))}
          {diff.motoresChanged.map((c) => (
            <div key={`mc-${c.id}`} style={{ color: "var(--orange)" }}>
              ~ engine {c.id} ({c.nome}) changed: {c.changes.join(", ")}
            </div>
          ))}
          {diff.regrasAdded.map((r) => (
            <div key={`ra-${r.id}`} style={{ color: "var(--green)" }}>
              + rule {r.id} added ({r.nome})
            </div>
          ))}
          {diff.regrasRemoved.map((r) => (
            <div key={`rr-${r.id}`} style={{ color: "var(--red)" }}>
              − rule {r.id} removed ({r.nome})
            </div>
          ))}
          {diff.perfisChanged.map((p) => (
            <div key={`pc-${p.id}`} style={{ color: "var(--orange)" }}>
              ~ profile {p.nome} changed:{" "}
              {Object.entries(p.to)
                .map(([k, v]) => `${k} ${(p.from as Record<string, unknown>)[k]}→${v}`)
                .join(", ")}
            </div>
          ))}
          {diff.perfilAtivoChanged && (
            <div style={{ color: "var(--orange)" }}>
              ~ active profile changed: {diff.perfilAtivoChanged.from ?? "—"} → {diff.perfilAtivoChanged.to ?? "—"}
            </div>
          )}
        </div>
      )}

      {open && empty && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--tx3)" }}>No pending changes.</div>
      )}
    </div>
  );
}

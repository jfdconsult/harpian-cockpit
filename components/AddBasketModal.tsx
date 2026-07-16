"use client";
import { useEffect, useState } from "react";
import { saveBasket, type CustomBasket } from "@/lib/customBaskets";
import { useDialog } from "./ui/Dialog";

interface Props {
  kind: "sector" | "strategy";
  open: boolean;
  onClose: () => void;
  onSaved: (b: CustomBasket) => void;
}

export default function AddBasketModal({ kind, open, onClose, onSaved }: Props) {
  const dialog = useDialog();
  const [label, setLabel] = useState("");
  const [tickers, setTickers] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const labelKind = kind === "sector" ? "sector" : "strategy";

  function submit() {
    const tks = tickers
      .toUpperCase()
      .split(/[,\s;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!label.trim()) { dialog.notify("Give the " + labelKind + " a name before saving.", "error"); return; }
    if (tks.length < 2) { dialog.notify("Add at least 2 tickers separated by commas.", "error"); return; }
    const nb = saveBasket({ kind, label: label.trim(), tickers: tks });
    dialog.notify(`${labelKind === "sector" ? "Sector" : "Strategy"} "${label.trim()}" created (saved in this browser).`, "success");
    onSaved(nb);
    setLabel(""); setTickers("");
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: "var(--z-modal)" as never,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: 12,
          padding: 22, minWidth: 420, maxWidth: 560, boxShadow: "0 18px 50px rgba(0,0,0,.55)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          + Add {labelKind}
        </div>
        <div style={{ fontSize: 12, color: "var(--tx2)", marginBottom: 16 }}>
          Create a custom basket of assets to monitor its momentum strength
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--gold)" }}>Name</label>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === "sector" ? "e.g., My AI leaders" : "e.g., Custom growth"}
            style={{ width: "100%", marginTop: 4 }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--gold)" }}>
            Tickers (separated by comma, space, or line break)
          </label>
          <textarea
            className="input"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            placeholder="NVDA, AVGO, AMD, MU, TSM..."
            rows={4}
            style={{ width: "100%", marginTop: 4, resize: "vertical", fontFamily: "var(--mono)" }}
          />
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
            Yahoo tickers · minimum 2 · practical maximum 20
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={submit}>Add {labelKind}</button>
        </div>
      </div>
    </div>
  );
}

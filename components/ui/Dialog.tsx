"use client";
// ============================================================
// HARPIAN COCKPIT — sistema de diálogo próprio (substitui
// prompt()/confirm()/alert() nativos do browser).
//   const dialog = useDialog();
//   await dialog.confirm({ title, body, danger?, typeToConfirm? })
//   await dialog.prompt({ title, label, initial?, type? })
//   dialog.notify(msg, tone?)          // toast auto-dismiss
// ESC fecha (= cancelar). Foco vai pro botão primário / input.
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** exige digitar esta palavra pra habilitar o botão (kill-switch etc) */
  typeToConfirm?: string;
}

interface PromptOpts {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  type?: "text" | "number";
  confirmLabel?: string;
}

interface Toast {
  id: number;
  msg: string;
  tone: "info" | "success" | "error";
}

interface DialogAPI {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string | null>;
  notify: (msg: string, tone?: Toast["tone"]) => void;
}

const DialogCtx = createContext<DialogAPI | null>(null);

export function useDialog(): DialogAPI {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog fora do DialogProvider");
  return ctx;
}

type Pending =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void };

let toastSeq = 1;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const [promptValue, setPromptValue] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setTyped("");
      setPending({ kind: "confirm", opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOpts) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(opts.initial ?? "");
      setPending({ kind: "prompt", opts, resolve });
    });
  }, []);

  const notify = useCallback((msg: string, tone: Toast["tone"] = "info") => {
    const id = toastSeq++;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  function close(result: boolean) {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(result);
    else pending.resolve(result ? promptValue : null);
    setPending(null);
  }

  // ESC = cancelar · Enter no prompt = confirmar · foco inicial
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter" && pending.kind === "prompt") close(true);
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      if (pending.kind === "prompt") inputRef.current?.focus();
      else primaryRef.current?.focus();
    }, 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, promptValue]);

  const needType = pending?.kind === "confirm" ? pending.opts.typeToConfirm : undefined;
  const confirmEnabled = !needType || typed.trim().toUpperCase() === needType.toUpperCase();

  return (
    <DialogCtx.Provider value={{ confirm, prompt, notify }}>
      {children}

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4,10,20,.62)",
            zIndex: "var(--z-dialog)" as never,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(440px,100%)", padding: 18 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {pending.kind === "confirm" && pending.opts.danger && (
                <i className="ti ti-alert-triangle" style={{ color: "var(--red-text)", fontSize: 16 }} />
              )}
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>
                {pending.opts.title}
              </div>
            </div>

            {pending.kind === "confirm" && pending.opts.body && (
              <div style={{ fontSize: 12, color: "var(--tx2)", lineHeight: 1.55, marginBottom: 12 }}>
                {pending.opts.body}
              </div>
            )}

            {pending.kind === "confirm" && needType && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Digite {needType} para confirmar
                  <input
                    className="input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    style={{ marginTop: 4, width: "100%" }}
                    autoFocus
                  />
                </label>
              </div>
            )}

            {pending.kind === "prompt" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {pending.opts.label}
                  <input
                    ref={inputRef}
                    className="input"
                    type={pending.opts.type ?? "text"}
                    value={promptValue}
                    placeholder={pending.opts.placeholder}
                    onChange={(e) => setPromptValue(e.target.value)}
                    style={{ marginTop: 4, width: "100%" }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn ghost" onClick={() => close(false)}>
                {(pending.kind === "confirm" && pending.opts.cancelLabel) || "Cancelar"}
              </button>
              <button
                ref={primaryRef}
                className="btn"
                disabled={pending.kind === "confirm" && !confirmEnabled}
                onClick={() => close(true)}
                style={
                  pending.kind === "confirm" && pending.opts.danger
                    ? { background: "var(--red)", color: "#fff", opacity: confirmEnabled ? 1 : 0.4 }
                    : { opacity: confirmEnabled ? 1 : 0.4 }
                }
              >
                {(pending.kind === "confirm" ? pending.opts.confirmLabel : pending.opts.confirmLabel) || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toasts — canto inferior direito, não roubam foco */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: "var(--z-toast)" as never,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 380,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card"
            style={{
              padding: "10px 14px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderLeft: `3px solid ${
                t.tone === "success" ? "var(--green)" : t.tone === "error" ? "var(--red)" : "var(--gold)"
              }`,
            }}
          >
            <i
              className={`ti ${
                t.tone === "success" ? "ti-check" : t.tone === "error" ? "ti-alert-triangle" : "ti-info-circle"
              }`}
              style={{
                color: t.tone === "success" ? "var(--green)" : t.tone === "error" ? "var(--red-text)" : "var(--gold)",
              }}
            />
            <span style={{ color: "var(--tx)" }}>{t.msg}</span>
          </div>
        ))}
      </div>
    </DialogCtx.Provider>
  );
}

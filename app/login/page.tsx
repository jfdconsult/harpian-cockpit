"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Login gate do Harpian Cockpit.
 *
 * Server-side auth via /api/access/login.
 * Whitelist de emails + senha compartilhada bcrypt.
 * Redirect para ?next=... apos sucesso.
 */
function CockpitLoginForm() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = document.getElementById("cockpit-email");
    if (el) el.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        window.location.href = nextUrl;
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Email ou senha inválidos.");
      } else {
        setError(data?.error || "Erro ao autenticar. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Verifique sua rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(ellipse at top,#14315a 0%,#0A1A30 60%,#060F1F 100%)",
        color: "#E8ECF1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "rgba(15,39,71,0.55)",
          border: "1px solid rgba(201,160,44,0.28)",
          borderRadius: 12,
          padding: "44px 42px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, transparent, #C9A02C, transparent)",
            borderRadius: "12px 12px 0 0",
          }}
        />

        <img
          src="/harpian-logo-white.svg"
          alt="Harpian"
          style={{ height: 26, width: "auto", display: "block", marginBottom: 24 }}
        />

        <div
          style={{
            fontFamily: "'Cascadia Code','Consolas',monospace",
            fontSize: 11,
            letterSpacing: "0.24em",
            color: "#e0c160",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Acesso restrito
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15, marginBottom: 8, color: "#E8ECF1" }}>
          Harpian Cockpit
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(232,236,241,0.6)", marginBottom: 28 }}>
          Acesso restrito à equipe de gestão Harpian.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="cockpit-email"
            style={{
              display: "block",
              fontFamily: "'Cascadia Code','Consolas',monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(232,236,241,0.55)",
              marginBottom: 8,
            }}
          >
            Email
          </label>
          <input
            id="cockpit-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "13px 16px",
              background: "rgba(10,26,48,0.6)",
              border: "1px solid rgba(201,160,44,0.32)",
              borderRadius: 6,
              color: "#E8ECF1",
              fontFamily: "'Cascadia Code','Consolas',monospace",
              fontSize: 15,
              marginBottom: 18,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <label
            htmlFor="cockpit-password"
            style={{
              display: "block",
              fontFamily: "'Cascadia Code','Consolas',monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(232,236,241,0.55)",
              marginBottom: 8,
            }}
          >
            Senha
          </label>
          <input
            id="cockpit-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "13px 16px",
              background: "rgba(10,26,48,0.6)",
              border: "1px solid rgba(201,160,44,0.32)",
              borderRadius: 6,
              color: "#E8ECF1",
              fontFamily: "'Cascadia Code','Consolas',monospace",
              fontSize: 15,
              marginBottom: 8,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {error ? (
            <div
              role="alert"
              style={{
                marginTop: 14,
                marginBottom: 4,
                padding: "10px 14px",
                background: "rgba(194,74,64,0.14)",
                border: "1px solid rgba(194,74,64,0.42)",
                borderRadius: 6,
                fontSize: 13,
                color: "#F0A090",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px 20px",
              marginTop: 26,
              background: loading
                ? "rgba(201,160,44,0.4)"
                : "linear-gradient(180deg,#e0c160 0%,#C9A02C 50%,#a8850f 100%)",
              color: "#0A1422",
              border: "none",
              borderRadius: 6,
              fontFamily: "'Cascadia Code','Consolas',monospace",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 8px 30px rgba(201,160,44,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            {loading ? "Autenticando..." : "Entrar →"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function CockpitLoginPage() {
  return (
    <Suspense fallback={null}>
      <CockpitLoginForm />
    </Suspense>
  );
}

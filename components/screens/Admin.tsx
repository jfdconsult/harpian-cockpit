"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import NewEtpWizard from "../wizards/NewEtpWizard";
import { forkPortfolio } from "@/lib/portfolioComposicao";
import { useDialog } from "../ui/Dialog";
import ArvoreViva, { SeloBadge } from "../portfolio-studio/ArvoreViva";
import { seloMotorCatalogo, seloPortfolio, seloEtp } from "@/lib/homologacao";
import type { ScreenId } from "@/lib/nav";

// ==================== ADMIN — CONTROL CENTER ====================
// Tabs: Structure · People · Integrations · Security
// Structure: ETPs, Portfolios, Engines, Formulas
// People:    Managers, CRM (Terminal MFO access)
// Integr.:   IBKR, Lynks, Yahoo, FRED, Claude API, Nitrogen
// Security:  Kill switch, paper/live mode, EOD schedule

type Tab = "estrutura" | "pessoas" | "integracoes" | "seguranca";
type SubEstrutura = "arvore" | "etps" | "portfolios" | "motores" | "formulas";
type SubPessoas = "gestores" | "clientes";

// ==================== TYPES ====================
interface Etp {
  id: string; nome: string; isin: string | null; ticker_listing: string | null; custodia: string;
  portfolio_ids: string[]; motor: string; motor_version: string;
  status: "listed" | "candidate"; estado_op: string; aum_usd: number;
  data_listagem: string | null; ibkr_account_id: string | null;
}
interface Motor {
  id: string; nome: string; versao: string; status: string; descricao: string;
  pilares: string[]; formulas: string[]; usado_em: string[];
  metricas_homologacao: { cagr?: number | null; sortino?: number | null; calmar?: number | null; max_dd?: number | null; grade?: string | null };
}
interface Formula {
  id: string; nome: string; categoria: string; versao: string; status: string;
  autor: string; descricao: string; usado_em: string[];
}
interface Gestor {
  id: string; nome: string; role: string; email: string; responsabilidade: string; ativo: boolean;
  alcadas: { aprovar_ordem_ate_usd: number | null; aprovar_kill_switch: boolean; config_admin: boolean; criar_etp: boolean; promover_motor: boolean };
}
interface Cliente {
  id: string; nome: string; empresa: string; tier: string; email_admin: string;
  cadastrado_em: string; ultimo_login: string; mfa: boolean;
  portfolios_acesso: string[]; n_usuarios_ativos: number; status: string;
}
interface PortfolioSummary {
  id: string; nome: string; descricao?: string; motor: string; motor_version: string;
  mode: string; capital_type: string; capital_usd: number; estado: string;
  cagr_pct?: number; sortino?: number; max_dd_pct?: number;
}
interface User { id: string; nome: string; role: string; perms: string[] }
interface Integration { nome: string; status: string; scope?: string; last_sync: string | null }
interface AdminConfig { users: User[]; integrations: Integration[]; kill_switch: boolean; mode: string; eod_schedule: string }

// ==================== UTILITIES ====================
function fmtUSD(n: number | null | undefined) { if (n == null) return "—"; return "$" + (n / 1e6).toFixed(1) + "M"; }
function fmtTS(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("en-US") + " " + d.toLocaleTimeString("en-US");
}
function statusSem(s: string) { return s === "conectado" || s === "ativo" || s === "listed" || s === "homologada" || s === "homologado" ? "g" : s === "pendente" || s === "candidate" || s === "onboarding" || s === "lab" ? "a" : "r"; }

// ==================== COMPONENT ====================
export default function Admin({ go }: { go?: (id: ScreenId, param?: string) => void } = {}) {
  const [tab, setTab] = useState<Tab>("estrutura");
  const [subEstr, setSubEstr] = useState<SubEstrutura>("arvore");
  const [subPess, setSubPess] = useState<SubPessoas>("gestores");

  // Datasets
  const [etps, setEtps] = useState<Etp[] | null>(null);
  const [motores, setMotores] = useState<Motor[] | null>(null);
  const [formulas, setFormulas] = useState<Formula[] | null>(null);
  const [gestores, setGestores] = useState<Gestor[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioSummary[] | null>(null);
  const [cfg, setCfg] = useState<AdminConfig | null>(null);
  const [killActive, setKillActive] = useState(false);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const dialog = useDialog();

  function refreshEtps() {
    apiGet<{ etps: Etp[] }>("/v1/registry/etps").then((d) => setEtps(d.etps)).catch(() => {});
  }

  function refreshPortfolios() {
    apiGet<{ portfolios: PortfolioSummary[] }>("/v1/strategies/")
      .then((d) => setPortfolios(d.portfolios))
      .catch(() => {});
  }

  async function handleOpenStudio(p: { id: string; mode: string }) {
    if (p.mode === "active") {
      setForkingId(p.id);
      try {
        const res = await forkPortfolio(p.id);
        go?.("portfolio-studio", res.portfolio.id);
      } catch (e) {
        dialog.notify("Error creating fork: " + String(e), "error");
      } finally {
        setForkingId(null);
      }
    } else {
      go?.("portfolio-studio", p.id);
    }
  }

  useEffect(() => {
    Promise.all([
      apiGet<{ etps: Etp[] }>("/v1/registry/etps"),
      apiGet<{ motores: Motor[] }>("/v1/registry/motores"),
      apiGet<{ formulas: Formula[] }>("/v1/registry/formulas"),
      apiGet<{ gestores: Gestor[] }>("/v1/registry/gestores"),
      apiGet<{ clientes: Cliente[] }>("/v1/registry/clientes"),
      apiGet<AdminConfig>("/v1/admin/config"),
    ])
      .then(([a, b, c, d, e, f]) => {
        setEtps(a.etps); setMotores(b.motores); setFormulas(c.formulas);
        setGestores(d.gestores); setClientes(e.clientes);
        setCfg(f); setKillActive(!!f.kill_switch); setMode(f.mode === "live" ? "live" : "paper");
        setConn("ok");
      })
      .catch(() => setConn("error"));
    refreshPortfolios();
  }, []);

  useEffect(() => {
    if (!etps?.length && !motores?.length) return;
    const killStatus = killActive ? "ACTIVE" : "normal";
    publishScreenData(
      "admin",
      `${etps?.length || 0} ETPs · ${motores?.length || 0} engines · ${formulas?.length || 0} formulas · ${gestores?.length || 0} managers · kill switch ${killStatus}`,
      { etps, motores, formulas, gestores, clientes, config: cfg },
      { briefing: `Control Center with ${etps?.length || 0} ETPs, ${motores?.length || 0} engines and ${formulas?.length || 0} formulas. Kill switch ${killStatus}.` }
    );
  }, [etps, motores, formulas, gestores, clientes]);

  // High-risk actions: require explicit confirmation (kill switch: typed).
  async function toggleKill() {
    const next = !killActive;
    const ok = await dialog.confirm({
      title: next ? "Activate KILL SWITCH?" : "Deactivate kill switch?",
      body: next
        ? "This PAUSES all firm order execution immediately. Queued orders stay pending until you reactivate."
        : "Order execution returns to normal and schedules resume.",
      danger: next,
      typeToConfirm: next ? "PAUSE" : undefined,
      confirmLabel: next ? "Activate kill switch" : "Resume execution",
    });
    if (!ok) return;
    setKillActive(next);
    try {
      await apiPost("/v1/admin/kill-switch", { active: next });
      dialog.notify(next ? "Kill switch ACTIVE — execution paused." : "Kill switch deactivated — execution resumed.", next ? "error" : "success");
    } catch {
      setKillActive(!next);
      dialog.notify("Failed to change the kill switch — state reverted.", "error");
    }
  }

  async function toggleMode() {
    const next = mode === "paper" ? "live" : "paper";
    const ok = await dialog.confirm({
      title: next === "live" ? "Switch to LIVE mode?" : "Go back to PAPER mode?",
      body: next === "live"
        ? "In LIVE, approved orders are actually sent to IBKR with real capital."
        : "In PAPER, orders are only simulated — nothing reaches the broker.",
      danger: next === "live",
      confirmLabel: next === "live" ? "Go to LIVE" : "Go to PAPER",
    });
    if (!ok) return;
    setMode(next);
    try {
      await apiPost("/v1/admin/mode", { mode: next });
      dialog.notify(`Execution mode: ${next.toUpperCase()}.`, "success");
    } catch {
      setMode(mode);
      dialog.notify("Failed to change the mode — state reverted.", "error");
    }
  }

  return (
    <div className="screen">
      <div className="flex between mb">
        <div>
          <div className="h1">Admin · Control Center</div>
          <div className="sub">Platform structure · people · integrations · security</div>
        </div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "loading…" : conn === "ok" ? <><i className="ti ti-circle-filled" style={{ fontSize: 8, marginRight: 4 }} />API live</> : <><i className="ti ti-plug-x" style={{ fontSize: 12, marginRight: 4 }} />API offline</>}
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="pills mb" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {([
          ["estrutura", "ti-building", "Structure"],
          ["pessoas", "ti-users", "People"],
          ["integracoes", "ti-plug", "Integrations"],
          ["seguranca", "ti-shield-half", "Security"],
        ] as [Tab, string, string][]).map(([id, icon, label]) => (
          <div
            key={id}
            className={`pill${tab === id ? " on" : ""}`}
            role="tab"
            tabIndex={0}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            onKeyDown={(e) => e.key === "Enter" && setTab(id)}
            style={{ borderRadius: "8px 8px 0 0", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 14 }} />{label}
          </div>
        ))}
      </div>

      {/* ===== STRUCTURE ===== */}
      {tab === "estrutura" && (
        <>
          <div className="pills mb" style={{ opacity: 0.9 }}>
            {([
              ["arvore", "🗺️ The Living Tree"],
              ["etps", `ETPs${etps ? ` (${etps.length})` : ""}`],
              ["portfolios", "Portfolios"],
              ["motores", `Engines${motores ? ` (${motores.length})` : ""}`],
              ["formulas", `Formulas${formulas ? ` (${formulas.length})` : ""}`],
            ] as [SubEstrutura, string][]).map(([id, label]) => (
              <div key={id} className={`pill${subEstr === id ? " on" : ""}`} onClick={() => setSubEstr(id)}>{label}</div>
            ))}
          </div>

          {subEstr === "arvore" && (
            <ArvoreViva go={go} onOpenPortfolio={handleOpenStudio} />
          )}

          {subEstr === "etps" && (
            <div className="card mb">
              <h2>
                <span>ETPs · listed products</span>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setWizardOpen(true)}>+ New ETP</button>
              </h2>
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>ISIN</th><th>Portfolio</th><th>Engine</th><th style={{ textAlign: "right" }}>AUM</th><th>IBKR</th><th>Status</th></tr></thead>
                <tbody>
                  {(etps || []).map((e) => (
                    <tr key={e.id}>
                      <td className="tk"><b style={{ color: "var(--gold)" }}>{e.id}</b></td>
                      <td>{e.nome}</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{e.isin || "—"}</td>
                      <td>{e.portfolio_ids.join(" + ")}</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{e.motor} <span className="c-mut2">{e.motor_version}</span></td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(e.aum_usd)}</td>
                      <td className="c-mut" style={{ fontSize: 11, color: e.ibkr_account_id ? "var(--blue)" : undefined }}>{e.ibkr_account_id || "—"}</td>
                      <td><SeloBadge selo={seloEtp(e.status)} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>
                <b>New ETP</b> wizard: identification → portfolio → engine → strategy + formulas → validation (2-window backtest) → promote.
              </div>
            </div>
          )}

          {subEstr === "portfolios" && (
            <div className="card mb">
              <h2>
                <span>Portfolios (models & active)</span>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={() => go?.("construtor")}>
                  <i className="ti ti-plus" style={{ fontSize: 13 }} /> New Strategy
                </button>
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>Engine</th><th>Mode</th><th>State</th>
                    <th style={{ textAlign: "right" }}>Capital</th>
                    <th style={{ textAlign: "right" }}>CAGR</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(portfolios || []).map((p) => (
                    <tr key={p.id}>
                      <td className="tk"><b style={{ color: "var(--gold)" }}>{p.id}</b></td>
                      <td>{p.nome}<div className="c-mut2" style={{ fontSize: 10 }}>{p.descricao}</div></td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{p.motor} <span className="c-mut2">{p.motor_version}</span></td>
                      <td><span className={`tag ${p.mode === "active" ? "g" : "b"}`}>{p.mode === "active" ? "ACTIVE" : "MODEL"}</span></td>
                      <td><SeloBadge selo={seloPortfolio(p.estado)} size="sm" /></td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(p.capital_usd)}</td>
                      <td style={{ textAlign: "right", color: (p.cagr_pct ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                        {p.cagr_pct != null ? `${p.cagr_pct}%` : "—"}
                      </td>
                      <td>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          disabled={forkingId === p.id}
                          onClick={() => handleOpenStudio(p)}
                          title={p.mode === "active" ? "Creates a fork to edit without affecting production" : "Edit composition in the Studio"}
                        >
                          {forkingId === p.id ? "Creating fork…" : p.mode === "active" ? <><i className="ti ti-git-fork" style={{ fontSize: 13, marginRight: 4 }} />Fork to edit</> : "Edit in Studio"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!portfolios || portfolios.length === 0) && (
                    <tr><td colSpan={8} className="c-mut" style={{ padding: 12 }}>No portfolios found.</td></tr>
                  )}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>
                <b>Portfolio Studio</b>: 3-level composition canvas — typed engines (attack/detector) → pillars/sleeves → assets.
                ACTIVE portfolios (with a listed ETP) are immutable; editing creates a fork in the Lab.
              </div>
            </div>
          )}

          {subEstr === "motores" && (
            <div className="card mb">
              <h2>
                <span>Engines · versioned algorithms</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>new engines are born in the Portfolio Studio (fork of a PROD engine)</span>
              </h2>
              <table>
                <thead><tr><th>Engine</th><th>Version</th><th>Status</th><th>Formulas</th><th>Used in</th><th>CAGR</th><th>Sortino</th><th>Max DD</th><th>Grade</th></tr></thead>
                <tbody>
                  {(motores || []).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{m.nome}</div>
                        <div className="c-mut2" style={{ fontSize: 10 }}>{m.descricao}</div>
                      </td>
                      <td className="c-mut">{m.versao}</td>
                      <td><SeloBadge selo={seloMotorCatalogo(m.status)} size="sm" /></td>
                      <td style={{ fontSize: 11 }}>{m.formulas.length} · <span className="c-mut2">{m.formulas.slice(0, 3).join(", ")}{m.formulas.length > 3 ? "…" : ""}</span></td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{m.usado_em.length ? m.usado_em.join(", ") : "—"}</td>
                      <td className="c-g" style={{ fontVariantNumeric: "tabular-nums" }}>{m.metricas_homologacao.cagr != null ? m.metricas_homologacao.cagr + "%" : "—"}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{m.metricas_homologacao.sortino ?? "—"}</td>
                      <td className="c-r" style={{ fontVariantNumeric: "tabular-nums" }}>{m.metricas_homologacao.max_dd != null ? m.metricas_homologacao.max_dd + "%" : "—"}</td>
                      <td><span className={`grade ${m.metricas_homologacao.grade === "A" || m.metricas_homologacao.grade === "B" ? m.metricas_homologacao.grade : "rodando"}`}>{m.metricas_homologacao.grade || "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>
                An engine is made up of N formulas from the library. <b>Custom</b> engine: pick formulas from each category (Ranker + Defense + Selection + Macro) → validate via backtest → promote.
              </div>
            </div>
          )}

          {subEstr === "formulas" && (
            <div className="card mb">
              <h2>
                <span>Formula Library</span>
                <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => go?.("calibracao")}>
                  <i className="ti ti-adjustments" style={{ fontSize: 13 }} />Create in Calibration
                </button>
              </h2>
              {formulas && (() => {
                const grouped: Record<string, Formula[]> = {};
                for (const f of formulas) (grouped[f.categoria] ||= []).push(f);
                const cats = Object.keys(grouped).sort();
                return (
                  <>
                    {cats.map((cat) => (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--gold)", fontWeight: 700, marginBottom: 6, borderBottom: "1px solid var(--line)", paddingBottom: 4 }}>
                          {cat} · {grouped[cat].length}
                        </div>
                        <table>
                          <thead><tr><th>Formula</th><th>Version</th><th>Status</th><th>Author</th><th>Used in</th></tr></thead>
                          <tbody>
                            {grouped[cat].map((f) => (
                              <tr key={f.id}>
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{f.nome}</div>
                                  <div className="c-mut2" style={{ fontSize: 10 }}>{f.descricao}</div>
                                </td>
                                <td className="c-mut">{f.versao}</td>
                                <td><span className={`tag ${statusSem(f.status)}`}>{f.status}</span></td>
                                <td className="c-mut" style={{ fontSize: 11 }}>{f.autor}</td>
                                <td className="c-mut" style={{ fontSize: 11 }}>{f.usado_em.length ? f.usado_em.join(", ") : <span className="c-mut2">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>
                      Formulas are validated via Claude Code + /calibration + 2-window backtest. When creating a custom engine, you plug in formulas from this library.
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* ===== PEOPLE ===== */}
      {tab === "pessoas" && (
        <>
          <div className="pills mb">
            {([
              ["gestores", `Internal managers${gestores ? ` (${gestores.length})` : ""}`],
              ["clientes", `CRM · Terminal Access${clientes ? ` (${clientes.length})` : ""}`],
            ] as [SubPessoas, string][]).map(([id, label]) => (
              <div key={id} className={`pill${subPess === id ? " on" : ""}`} onClick={() => setSubPess(id)}>{label}</div>
            ))}
          </div>

          {subPess === "gestores" && (
            <div className="card mb">
              <h2>
                <span>Internal managers · authority levels + RBAC</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>manager registration via backoffice (roadmap)</span>
              </h2>
              <table>
                <thead><tr><th>Name</th><th>Role</th><th>Responsibility</th><th style={{ textAlign: "right" }}>Order authority</th><th>Kill</th><th>Admin</th><th>ETP</th><th>Promote</th></tr></thead>
                <tbody>
                  {(gestores || []).map((g) => (
                    <tr key={g.id}>
                      <td><b>{g.nome}</b><div className="c-mut2" style={{ fontSize: 10 }}>{g.email}</div></td>
                      <td className="c-mut">{g.role}</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{g.responsabilidade}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--gold)" }}>{g.alcadas.aprovar_ordem_ate_usd == null ? "∞" : `$${g.alcadas.aprovar_ordem_ate_usd.toLocaleString("en-US")}`}</td>
                      <td>{g.alcadas.aprovar_kill_switch ? <i className="ti ti-check c-g" aria-label="yes" /> : <span className="c-mut2">—</span>}</td>
                      <td>{g.alcadas.config_admin ? <i className="ti ti-check c-g" aria-label="yes" /> : <span className="c-mut2">—</span>}</td>
                      <td>{g.alcadas.criar_etp ? <i className="ti ti-check c-g" aria-label="yes" /> : <span className="c-mut2">—</span>}</td>
                      <td>{g.alcadas.promover_motor ? <i className="ti ti-check c-g" aria-label="yes" /> : <span className="c-mut2">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subPess === "clientes" && (
            <div className="card mb">
              <h2>
                <span>CRM · who has access to the Terminal MFO</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>MFO client onboarding via backoffice (roadmap)</span>
              </h2>
              <table>
                <thead><tr><th>Client</th><th>Company</th><th>Tier</th><th style={{ textAlign: "center" }}>MFA</th><th>Portfolios</th><th style={{ textAlign: "center" }}>Users</th><th>Last login</th><th>Status</th></tr></thead>
                <tbody>
                  {(clientes || []).map((c) => (
                    <tr key={c.id}>
                      <td><b>{c.nome}</b><div className="c-mut2" style={{ fontSize: 10 }}>{c.email_admin}</div></td>
                      <td className="c-mut">{c.empresa}</td>
                      <td><span className="tag b">{c.tier}</span></td>
                      <td style={{ textAlign: "center" }}>{c.mfa ? <i className="ti ti-check c-g" aria-label="yes" /> : <i className="ti ti-x c-r" aria-label="no" />}</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{c.portfolios_acesso.join(", ")}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{c.n_usuarios_ativos}</td>
                      <td className="c-mut2" style={{ fontSize: 10 }}>{fmtTS(c.ultimo_login)}</td>
                      <td><span className={`tag ${statusSem(c.status)}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== INTEGRATIONS ===== */}
      {tab === "integracoes" && (
        <div className="card mb">
          <h2><span>External integrations</span></h2>
          <table>
            <thead><tr><th>Name</th><th>Status</th><th>Scope</th><th>Last sync</th></tr></thead>
            <tbody>
              {(cfg?.integrations || []).map((i) => (
                <tr key={i.nome}>
                  <td><b>{i.nome}</b></td>
                  <td><span className={`tag ${statusSem(i.status)}`}>{i.status}</span></td>
                  <td className="c-mut">{i.scope || "—"}</td>
                  <td className="c-mut2" style={{ fontSize: 10 }}>{fmtTS(i.last_sync)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== SECURITY ===== */}
      {tab === "seguranca" && (
        <div className="grid g3 mb">
          <div className="card">
            <h2><span>Kill Switch</span></h2>
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <button className={`kill-btn ${killActive ? "active" : "normal"}`} onClick={toggleKill}>
                {killActive ? "KILL SWITCH ACTIVE" : "Normal operation"}
              </button>
              <div className="c-mut" style={{ fontSize: 10, marginTop: 8 }}>Click to toggle · pauses all execution</div>
            </div>
          </div>
          <div className="card">
            <h2><span>Operating Mode</span></h2>
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <span className={`mode-chip ${mode}`} onClick={toggleMode}>{mode.toUpperCase()}</span>
              <div className="c-mut" style={{ fontSize: 10, marginTop: 8 }}>Toggles paper/live</div>
            </div>
          </div>
          <div className="card">
            <h2><span>EOD Schedule</span></h2>
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)" }}>{cfg?.eod_schedule || "17:00 ET"}</div>
              <div className="c-mut" style={{ fontSize: 11, marginTop: 6 }}>Daily close · ticket generation</div>
            </div>
          </div>
        </div>
      )}

      <div className="foot">Admin · platform control center · v2</div>

      <NewEtpWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={refreshEtps} />
    </div>
  );
}

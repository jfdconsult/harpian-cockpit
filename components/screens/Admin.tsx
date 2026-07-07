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

// ==================== ADMIN — CENTRO DE CONTROLE ====================
// Abas: Estrutura · Pessoas · Integrações · Segurança
// Estrutura: ETPs, Portfolios, Motores, Fórmulas
// Pessoas:   Gestores, CRM (acessos ao Terminal MFO)
// Integr.:   IBKR, Lynks, Yahoo, FRED, Claude API, Nitrogen
// Segurança: Kill switch, modo paper/live, EOD schedule

type Tab = "estrutura" | "pessoas" | "integracoes" | "seguranca";
type SubEstrutura = "arvore" | "etps" | "portfolios" | "motores" | "formulas";
type SubPessoas = "gestores" | "clientes";

// ==================== TIPOS ====================
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

// ==================== UTIL ====================
function fmtUSD(n: number | null | undefined) { if (n == null) return "—"; return "US$ " + (n / 1e6).toFixed(1).replace(".", ",") + "M"; }
function fmtTS(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
}
function statusSem(s: string) { return s === "conectado" || s === "ativo" || s === "listed" || s === "homologada" || s === "homologado" ? "g" : s === "pendente" || s === "candidate" || s === "onboarding" || s === "lab" ? "a" : "r"; }

// ==================== COMPONENTE ====================
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
        dialog.notify("Erro ao criar fork: " + String(e), "error");
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
    const killStatus = killActive ? "ATIVO" : "normal";
    publishScreenData(
      "admin",
      `${etps?.length || 0} ETPs · ${motores?.length || 0} motores · ${formulas?.length || 0} fórmulas · ${gestores?.length || 0} gestores · kill switch ${killStatus}`,
      { etps, motores, formulas, gestores, clientes, config: cfg },
      { briefing: `Centro de Controle com ${etps?.length || 0} ETPs, ${motores?.length || 0} motores e ${formulas?.length || 0} fórmulas. Kill switch ${killStatus}.` }
    );
  }, [etps, motores, formulas, gestores, clientes]);

  // Ações de alto risco: exigem confirmação explícita (kill-switch: digitada).
  async function toggleKill() {
    const next = !killActive;
    const ok = await dialog.confirm({
      title: next ? "Ativar KILL SWITCH?" : "Desativar kill switch?",
      body: next
        ? "Isso PAUSA toda a execução de ordens da casa imediatamente. Ordens em fila ficam pendentes até você reativar."
        : "A execução de ordens volta ao normal e os agendamentos são retomados.",
      danger: next,
      typeToConfirm: next ? "PAUSAR" : undefined,
      confirmLabel: next ? "Ativar kill switch" : "Reativar execução",
    });
    if (!ok) return;
    setKillActive(next);
    try {
      await apiPost("/v1/admin/kill-switch", { active: next });
      dialog.notify(next ? "Kill switch ATIVO — execução pausada." : "Kill switch desativado — execução retomada.", next ? "error" : "success");
    } catch {
      setKillActive(!next);
      dialog.notify("Falha ao alterar o kill switch — estado revertido.", "error");
    }
  }

  async function toggleMode() {
    const next = mode === "paper" ? "live" : "paper";
    const ok = await dialog.confirm({
      title: next === "live" ? "Mudar para modo LIVE?" : "Voltar para modo PAPER?",
      body: next === "live"
        ? "Em LIVE, ordens aprovadas são enviadas de verdade à IBKR com capital real."
        : "Em PAPER, ordens são apenas simuladas — nada vai à corretora.",
      danger: next === "live",
      confirmLabel: next === "live" ? "Ir para LIVE" : "Ir para PAPER",
    });
    if (!ok) return;
    setMode(next);
    try {
      await apiPost("/v1/admin/mode", { mode: next });
      dialog.notify(`Modo de execução: ${next.toUpperCase()}.`, "success");
    } catch {
      setMode(mode);
      dialog.notify("Falha ao alterar o modo — estado revertido.", "error");
    }
  }

  return (
    <div className="screen">
      <div className="flex between mb">
        <div>
          <div className="h1">Admin · Centro de Controle</div>
          <div className="sub">Estrutura da plataforma · pessoas · integrações · segurança</div>
        </div>
        <div className={`tag ${conn === "ok" ? "b" : conn === "error" ? "r" : "b"}`}>
          {conn === "loading" ? "carregando…" : conn === "ok" ? <><i className="ti ti-circle-filled" style={{ fontSize: 8, marginRight: 4 }} />API ao vivo</> : <><i className="ti ti-plug-x" style={{ fontSize: 12, marginRight: 4 }} />API offline</>}
        </div>
      </div>

      {/* ABAS PRINCIPAIS */}
      <div className="pills mb" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {([
          ["estrutura", "ti-building", "Estrutura"],
          ["pessoas", "ti-users", "Pessoas"],
          ["integracoes", "ti-plug", "Integrações"],
          ["seguranca", "ti-shield-half", "Segurança"],
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

      {/* ===== ESTRUTURA ===== */}
      {tab === "estrutura" && (
        <>
          <div className="pills mb" style={{ opacity: 0.9 }}>
            {([
              ["arvore", "🗺️ A Árvore Viva"],
              ["etps", `ETPs${etps ? ` (${etps.length})` : ""}`],
              ["portfolios", "Portfolios"],
              ["motores", `Motores${motores ? ` (${motores.length})` : ""}`],
              ["formulas", `Fórmulas${formulas ? ` (${formulas.length})` : ""}`],
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
                <span>ETPs · produtos listados</span>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setWizardOpen(true)}>+ Novo ETP</button>
              </h2>
              <table>
                <thead><tr><th>ID</th><th>Nome</th><th>ISIN</th><th>Portfolio</th><th>Motor</th><th style={{ textAlign: "right" }}>AUM</th><th>IBKR</th><th>Status</th></tr></thead>
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
                Wizard <b>Novo ETP</b>: identificação → portfolio → motor → estratégia + fórmulas → homologação (backtest 2 janelas) → promover.
              </div>
            </div>
          )}

          {subEstr === "portfolios" && (
            <div className="card mb">
              <h2>
                <span>Portfolios (modelos e ativos)</span>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={() => go?.("construtor")}>
                  <i className="ti ti-plus" style={{ fontSize: 13 }} /> Nova Estratégia
                </button>
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Nome</th><th>Motor</th><th>Modo</th><th>Estado</th>
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
                      <td><span className={`tag ${p.mode === "active" ? "g" : "b"}`}>{p.mode === "active" ? "ATIVO" : "MODELO"}</span></td>
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
                          title={p.mode === "active" ? "Cria um fork para editar sem afetar produção" : "Editar composição no Studio"}
                        >
                          {forkingId === p.id ? "Criando fork…" : p.mode === "active" ? <><i className="ti ti-git-fork" style={{ fontSize: 13, marginRight: 4 }} />Fork p/ editar</> : "Editar no Studio"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!portfolios || portfolios.length === 0) && (
                    <tr><td colSpan={8} className="c-mut" style={{ padding: 12 }}>Nenhum portfolio encontrado.</td></tr>
                  )}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>
                <b>Portfolio Studio</b>: canvas de composição em 3 níveis — motores tipados (ataque/detector) → pilares/esteiras → ativos.
                Portfolios ATIVOS (com ETP listado) são imutáveis; editar cria um fork no Laboratório.
              </div>
            </div>
          )}

          {subEstr === "motores" && (
            <div className="card mb">
              <h2>
                <span>Motores · algoritmos versionados</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>motores novos nascem no Portfolio Studio (fork de motor PROD)</span>
              </h2>
              <table>
                <thead><tr><th>Motor</th><th>Versão</th><th>Status</th><th>Fórmulas</th><th>Usado em</th><th>CAGR</th><th>Sortino</th><th>Max DD</th><th>Grade</th></tr></thead>
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
                Um motor é composto por N fórmulas da biblioteca. Motor <b>custom</b>: escolha fórmulas de cada categoria (Ranker + Defesa + Seleção + Macro) → homologue via backtest → promova.
              </div>
            </div>
          )}

          {subEstr === "formulas" && (
            <div className="card mb">
              <h2>
                <span>Biblioteca de Fórmulas</span>
                <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => go?.("calibracao")}>
                  <i className="ti ti-adjustments" style={{ fontSize: 13 }} />Criar na Calibração
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
                          <thead><tr><th>Fórmula</th><th>Versão</th><th>Status</th><th>Autor</th><th>Usado em</th></tr></thead>
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
                      Fórmulas homologadas via Claude Code + /calibração + backtest de 2 janelas. Ao criar motor custom, você pluga fórmulas dessa biblioteca.
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* ===== PESSOAS ===== */}
      {tab === "pessoas" && (
        <>
          <div className="pills mb">
            {([
              ["gestores", `Gestores internos${gestores ? ` (${gestores.length})` : ""}`],
              ["clientes", `CRM · Acessos Terminal${clientes ? ` (${clientes.length})` : ""}`],
            ] as [SubPessoas, string][]).map(([id, label]) => (
              <div key={id} className={`pill${subPess === id ? " on" : ""}`} onClick={() => setSubPess(id)}>{label}</div>
            ))}
          </div>

          {subPess === "gestores" && (
            <div className="card mb">
              <h2>
                <span>Gestores internos · alçadas + RBAC</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>cadastro de gestor via backoffice (roadmap)</span>
              </h2>
              <table>
                <thead><tr><th>Nome</th><th>Papel</th><th>Responsabilidade</th><th style={{ textAlign: "right" }}>Alçada ordem</th><th>Kill</th><th>Admin</th><th>ETP</th><th>Promover</th></tr></thead>
                <tbody>
                  {(gestores || []).map((g) => (
                    <tr key={g.id}>
                      <td><b>{g.nome}</b><div className="c-mut2" style={{ fontSize: 10 }}>{g.email}</div></td>
                      <td className="c-mut">{g.role}</td>
                      <td className="c-mut" style={{ fontSize: 11 }}>{g.responsabilidade}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--gold)" }}>{g.alcadas.aprovar_ordem_ate_usd == null ? "∞" : `US$ ${g.alcadas.aprovar_ordem_ate_usd.toLocaleString("pt-BR")}`}</td>
                      <td>{g.alcadas.aprovar_kill_switch ? <i className="ti ti-check c-g" aria-label="sim" /> : <span className="c-mut2">—</span>}</td>
                      <td>{g.alcadas.config_admin ? <i className="ti ti-check c-g" aria-label="sim" /> : <span className="c-mut2">—</span>}</td>
                      <td>{g.alcadas.criar_etp ? <i className="ti ti-check c-g" aria-label="sim" /> : <span className="c-mut2">—</span>}</td>
                      <td>{g.alcadas.promover_motor ? <i className="ti ti-check c-g" aria-label="sim" /> : <span className="c-mut2">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subPess === "clientes" && (
            <div className="card mb">
              <h2>
                <span>CRM · quem tem acesso ao Terminal MFO</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx3)" }}>onboarding de cliente MFO via backoffice (roadmap)</span>
              </h2>
              <table>
                <thead><tr><th>Cliente</th><th>Empresa</th><th>Tier</th><th style={{ textAlign: "center" }}>MFA</th><th>Portfolios</th><th style={{ textAlign: "center" }}>Users</th><th>Último login</th><th>Status</th></tr></thead>
                <tbody>
                  {(clientes || []).map((c) => (
                    <tr key={c.id}>
                      <td><b>{c.nome}</b><div className="c-mut2" style={{ fontSize: 10 }}>{c.email_admin}</div></td>
                      <td className="c-mut">{c.empresa}</td>
                      <td><span className="tag b">{c.tier}</span></td>
                      <td style={{ textAlign: "center" }}>{c.mfa ? <i className="ti ti-check c-g" aria-label="sim" /> : <i className="ti ti-x c-r" aria-label="não" />}</td>
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

      {/* ===== INTEGRAÇÕES ===== */}
      {tab === "integracoes" && (
        <div className="card mb">
          <h2><span>Integrações externas</span></h2>
          <table>
            <thead><tr><th>Nome</th><th>Status</th><th>Escopo</th><th>Último sync</th></tr></thead>
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

      {/* ===== SEGURANÇA ===== */}
      {tab === "seguranca" && (
        <div className="grid g3 mb">
          <div className="card">
            <h2><span>Kill Switch</span></h2>
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <button className={`kill-btn ${killActive ? "active" : "normal"}`} onClick={toggleKill}>
                {killActive ? "KILL SWITCH ATIVO" : "Operação normal"}
              </button>
              <div className="c-mut" style={{ fontSize: 10, marginTop: 8 }}>Clique para alternar · pausa toda execução</div>
            </div>
          </div>
          <div className="card">
            <h2><span>Modo de Operação</span></h2>
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <span className={`mode-chip ${mode}`} onClick={toggleMode}>{mode.toUpperCase()}</span>
              <div className="c-mut" style={{ fontSize: 10, marginTop: 8 }}>Alterna paper/live</div>
            </div>
          </div>
          <div className="card">
            <h2><span>EOD Schedule</span></h2>
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)" }}>{cfg?.eod_schedule || "17:00 ET"}</div>
              <div className="c-mut" style={{ fontSize: 11, marginTop: 6 }}>Fechamento diário · geração de tickets</div>
            </div>
          </div>
        </div>
      )}

      <div className="foot">Admin · centro de controle da plataforma · v2</div>

      <NewEtpWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={refreshEtps} />
    </div>
  );
}

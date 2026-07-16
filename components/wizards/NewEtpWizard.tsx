"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useDialog } from "../ui/Dialog";
import { SeloBadge } from "../portfolio-studio/ArvoreViva";
import { seloPortfolio } from "@/lib/homologacao";

// --- lightweight types with only what the wizard needs ---
type Motor = {
  id: string;
  nome: string;
  versao: string;
  status: string;
  descricao: string;
  metricas_homologacao?: {
    cagr?: number; sortino?: number; calmar?: number; max_dd?: number; grade?: string;
  };
};

type Portfolio = {
  id: string;
  nome: string;
  estado?: string;
  mode?: string;
  capital_type?: string;
  is_etp?: boolean;
};

type Metrica = { cagr?: number; sortino?: number; calmar?: number; max_dd?: number };
type BacktestResult = {
  run_id: string | null;
  grade: "A" | "B" | "F";
  red_flags: string[];
  metricas_oos: Metrica;
  metricas_full: Metrica;
  validadores: Record<string, boolean>;
  // real fields from the Arena (backend arena_client.backtest_preview) — may be missing in older responses
  fonte?: string | null;
  arena_verdict?: "ACCEPTED" | "REPROVADO" | null;
  arena_run_name?: string | null;
  oos_split?: string | null;
  homologacao_producao?: (Metrica & { grade?: string; nota?: string }) | null;
  note?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type EsteiraDraft = { nome: string; peso_pct: number; pilar?: string };

const EMPTY = {
  nome_comercial: "",
  ticker_listing: "",
  isin_provisorio: "",
  custodia: "BNY Mellon (via Lynks)",
  jurisdicao: "Vienna Stock Exchange · EU",
  portfolio_origem: "existente" as "existente" | "novo",
  portfolio_ids: [] as string[], // 1 or 2 existing portfolios (per João's answer)
  novo_portfolio: {
    id: "",
    nome: "",
    descricao: "",
    esteiras: [] as EsteiraDraft[],
  },
  motor_id: "",
};

export default function NewEtpWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY });
  const [motores, setMotores] = useState<Motor[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [bt, setBt] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dialog = useDialog();

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm({ ...EMPTY });
    setBt(null);
    setErr(null);
    apiGet<{ motores: Motor[] }>("/v1/registry/motores")
      .then((d) => setMotores(d.motores || []))
      .catch(() => setMotores([]));
    apiGet<{ portfolios: Portfolio[] }>("/v1/strategies")
      .then((d) => setPortfolios(d.portfolios || []))
      .catch(() => setPortfolios([]));
  }, [open]);

  // any unsaved work? (any field filled beyond the default)
  const dirty =
    !!form.nome_comercial.trim() || !!form.ticker_listing.trim() || !!form.isin_provisorio.trim() ||
    form.portfolio_ids.length > 0 || !!form.motor_id || form.novo_portfolio.esteiras.length > 0 || !!bt;

  async function requestClose() {
    if (saving) return;
    if (dirty) {
      const ok = await dialog.confirm({
        title: "Discard the wizard?",
        body: "You have data filled in this wizard. Closing now discards everything.",
        danger: true,
        confirmLabel: "Discard",
        cancelLabel: "Continue editing",
      });
      if (!ok) return;
    }
    onClose();
  }

  // ESC closes (with the same guard)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty, saving]);

  if (!open) return null;

  const motorSel = motores.find((m) => m.id === form.motor_id) || null;
  const portsSel = form.portfolio_ids.map((id) => portfolios.find((p) => p.id === id)).filter((p): p is Portfolio => !!p);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v });
  }

  function portfolioElegivel(p: Portfolio): boolean {
    return p.estado === "homologado" || p.estado === "live";
  }

  function togglePortfolio(id: string) {
    const has = form.portfolio_ids.includes(id);
    if (has) {
      set("portfolio_ids", form.portfolio_ids.filter((x) => x !== id));
    } else if (form.portfolio_ids.length < 2) {
      set("portfolio_ids", [...form.portfolio_ids, id]);
    }
  }

  function canAdvance(): boolean {
    if (step === 1) return !!form.nome_comercial.trim() && !!form.ticker_listing.trim();
    if (step === 2) {
      if (form.portfolio_origem === "existente") {
        return form.portfolio_ids.length >= 1 && form.portfolio_ids.length <= 2 &&
          portsSel.length === form.portfolio_ids.length && portsSel.every(portfolioElegivel);
      }
      const np = form.novo_portfolio;
      return !!np.id.trim() && !!np.nome.trim() && np.esteiras.length >= 1 &&
        np.esteiras.every((e) => !!e.nome.trim());
    }
    if (step === 3) return !!form.motor_id;
    if (step === 4) return bt?.grade === "A" || bt?.grade === "B";
    return true;
  }

  function addEsteira() {
    setForm({ ...form, novo_portfolio: {
      ...form.novo_portfolio,
      esteiras: [...form.novo_portfolio.esteiras, { nome: "", peso_pct: 10 }],
    }});
  }

  function updateEsteira(idx: number, patch: Partial<EsteiraDraft>) {
    const arr = form.novo_portfolio.esteiras.map((e, i) => i === idx ? { ...e, ...patch } : e);
    setForm({ ...form, novo_portfolio: { ...form.novo_portfolio, esteiras: arr } });
  }

  function removeEsteira(idx: number) {
    setForm({ ...form, novo_portfolio: {
      ...form.novo_portfolio,
      esteiras: form.novo_portfolio.esteiras.filter((_, i) => i !== idx),
    }});
  }

  function effectivePortfolioIds(): string[] {
    return form.portfolio_origem === "novo" ? [form.novo_portfolio.id] : form.portfolio_ids;
  }

  function effectivePortfolioLabel(): string {
    if (form.portfolio_origem === "novo") {
      const np = form.novo_portfolio;
      return `${np.id} · ${np.nome} · ${np.esteiras.length} sleeve(s) · NEW`;
    }
    return portsSel.map((p) => `${p.id} · ${p.nome}`).join("  +  ");
  }

  async function runBacktest() {
    if (!form.motor_id) return;
    setRunning(true);
    setErr(null);
    try {
      const r = await apiPost<BacktestResult>("/v1/registry/etps/backtest-preview", {
        motor_id: form.motor_id,
        portfolio_id: form.portfolio_ids[0] || undefined,
      });
      setBt(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    setSaving(true);
    setErr(null);
    // rollback: if we created the new portfolio and something fails afterward, remove the orphan
    let createdPortfolioId: string | null = null;
    try {
      const motorObj = motores.find((m) => m.id === form.motor_id);
      const pids = effectivePortfolioIds();

      // If new portfolio: create the portfolio first (model mode) + sleeves
      if (form.portfolio_origem === "novo") {
        const np = form.novo_portfolio;
        await apiPost("/v1/strategies/", {
          id: np.id,
          nome: np.nome,
          descricao: np.descricao,
          motor: motorObj?.nome || "",
          motor_version: motorObj?.versao || "",
          mode: "model",
          owner: "Harpian",
          capital_usd: 1_000_000,
        });
        createdPortfolioId = np.id;
        for (const est of np.esteiras) {
          await apiPost(`/v1/strategies/${np.id}/esteira`, {
            nome: est.nome,
            peso_pct: est.peso_pct,
            pilar: est.pilar || null,
          });
        }
      }

      await apiPost("/v1/registry/etps", {
        nome_comercial: form.nome_comercial,
        ticker_listing: form.ticker_listing.toUpperCase(),
        isin_provisorio: form.isin_provisorio || null,
        custodia: form.custodia,
        jurisdicao: form.jurisdicao,
        portfolio_ids: pids,
        motor_id: form.motor_id,
        backtest_run_id: bt?.run_id,
        backtest_grade: bt?.grade,
      });
      dialog.notify(`ETP ${form.ticker_listing.toUpperCase()} created successfully.`, "success");
      onCreated();
      onClose();
    } catch (e) {
      if (createdPortfolioId) {
        try {
          await apiDelete(`/v1/strategies/${createdPortfolioId}`);
          setErr(`${String(e)} — portfolio ${createdPortfolioId} created during the process was removed (rollback).`);
        } catch {
          setErr(`${String(e)} — WARNING: portfolio ${createdPortfolioId} was left half-created; remove it in Admin › Portfolios.`);
        }
      } else {
        setErr(String(e));
      }
    } finally {
      setSaving(false);
    }
  }

  const STEPS = ["Identification", "Portfolio", "Engine", "Validation", "Promote"];

  return (
    <div
      onClick={requestClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: "var(--z-modal)" as never,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: 40, overflow: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(880px, 100%)", padding: 0, maxHeight: "calc(100vh - 80px)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          background: "var(--panel)", border: "1px solid var(--line)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--tx3)", letterSpacing: 1 }}>ADMIN · STRATEGIES</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gold)" }}>New ETP · wizard</div>
          </div>
          <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={requestClose}>Close</button>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", padding: "10px 20px", gap: 6, borderBottom: "1px solid var(--line)" }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={label} style={{ flex: 1, textAlign: "center", padding: "6px 4px", fontSize: 11,
                borderBottom: `2px solid ${active ? "var(--gold)" : done ? "var(--green)" : "var(--line)"}`,
                color: active ? "var(--gold)" : done ? "var(--green)" : "var(--tx3)",
                fontWeight: active ? 600 : 400,
              }}>
                {n}. {label}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
          {step === 1 && (
            <div style={{ display: "grid", gap: 12 }}>
              <FieldRow label="Commercial name *">
                <input className="input" value={form.nome_comercial} onChange={(e) => set("nome_comercial", e.target.value)} placeholder="e.g. HPC33 · HC-US IG Advance" style={INPUT_STYLE} />
              </FieldRow>
              <FieldRow label="Listing ticker *">
                <input className="input" value={form.ticker_listing} onChange={(e) => set("ticker_listing", e.target.value.toUpperCase())} placeholder="e.g. HPC33" style={INPUT_STYLE} maxLength={12} />
              </FieldRow>
              <FieldRow label="Provisional ISIN">
                <input className="input" value={form.isin_provisorio} onChange={(e) => set("isin_provisorio", e.target.value)} placeholder="XS...  (leave blank if not yet issued)" style={INPUT_STYLE} />
              </FieldRow>
              <FieldRow label="Custody">
                <input className="input" value={form.custodia} onChange={(e) => set("custodia", e.target.value)} style={INPUT_STYLE} />
              </FieldRow>
              <FieldRow label="Jurisdiction">
                <input className="input" value={form.jurisdicao} onChange={(e) => set("jurisdicao", e.target.value)} style={INPUT_STYLE} />
              </FieldRow>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: 10 }}>
              {/* toggle existing | new */}
              <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 4 }}>
                {(["existente", "novo"] as const).map((v) => {
                  const active = form.portfolio_origem === v;
                  return (
                    <button key={v} className="btn"
                      onClick={() => set("portfolio_origem", v)}
                      style={{
                        flex: 1, padding: "8px 12px",
                        background: active ? "var(--gold)" : "transparent",
                        color: active ? "#000" : "var(--tx2)",
                        border: "none", fontWeight: active ? 600 : 400,
                      }}>
                      {v === "existente" ? "Existing portfolio" : "Create new portfolio"}
                    </button>
                  );
                })}
              </div>

              {form.portfolio_origem === "existente" && (
                <>
                  <div style={{ fontSize: 12, color: "var(--tx3)" }}>
                    Choose 1 or <b>up to 2 portfolios</b> that will be materialized by the ETP. <b>Only validated portfolios</b>{" "}
                    can become an ETP — this is the Lab's gate: nothing raw hits the road.
                    {form.portfolio_ids.length > 0 && (
                      <span style={{ color: "var(--gold)" }}> · {form.portfolio_ids.length}/2 selected</span>
                    )}
                  </div>
                  {portfolios.length === 0 && <div className="c-mut" style={{ fontSize: 12 }}>No portfolio available from the API.</div>}
                  {portfolios.map((p) => {
                    const elegivel = portfolioElegivel(p);
                    const selecionado = form.portfolio_ids.includes(p.id);
                    const bloqueadoPorLimite = !selecionado && form.portfolio_ids.length >= 2;
                    const disabled = !elegivel || bloqueadoPorLimite;
                    return (
                      <div
                        key={p.id}
                        onClick={() => !disabled && togglePortfolio(p.id)}
                        title={
                          !elegivel
                            ? "🔒 this portfolio hasn't been tested/validated — run validation in the Lab first"
                            : bloqueadoPorLimite
                            ? "maximum of 2 portfolios per ETP — uncheck one to swap"
                            : undefined
                        }
                        style={pickCard(selecionado, disabled)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--gold)" }}>{p.id}</div>
                          <div style={{ fontSize: 12 }}>{p.nome}</div>
                          {!elegivel && (
                            <div style={{ fontSize: 10.5, color: "var(--red-text)", marginTop: 2 }}>
                              🔒 not tested — needs validation in the Lab first
                            </div>
                          )}
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <SeloBadge selo={seloPortfolio(p.estado)} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {form.portfolio_origem === "novo" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--tx3)" }}>
                    The portfolio is born as a <b>model</b> ($1M symbolic capital). It's promoted to ACTIVE together with the ETP in the final step.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                    <FieldRow label="ID *">
                      <input className="input" value={form.novo_portfolio.id}
                        onChange={(e) => setForm({ ...form, novo_portfolio: { ...form.novo_portfolio, id: e.target.value.toUpperCase() } })}
                        placeholder="HPC33" maxLength={12} style={INPUT_STYLE} />
                    </FieldRow>
                    <FieldRow label="Name *">
                      <input className="input" value={form.novo_portfolio.nome}
                        onChange={(e) => setForm({ ...form, novo_portfolio: { ...form.novo_portfolio, nome: e.target.value } })}
                        placeholder="HC-US IG Advance" style={INPUT_STYLE} />
                    </FieldRow>
                  </div>
                  <FieldRow label="Description">
                    <input className="input" value={form.novo_portfolio.descricao}
                      onChange={(e) => setForm({ ...form, novo_portfolio: { ...form.novo_portfolio, descricao: e.target.value } })}
                      placeholder="e.g. ETF · Investment Grade" style={INPUT_STYLE} />
                  </FieldRow>

                  {/* Dynamic sleeves */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Sleeves (pillar → basket) *
                      </div>
                      <button className="btn" onClick={addEsteira}
                        style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 11 }}>+ sleeve</button>
                    </div>
                    {form.novo_portfolio.esteiras.length === 0 && (
                      <div className="c-mut" style={{ fontSize: 11, padding: "8px 0" }}>
                        Add at least 1 sleeve. Assets are added later in Engines → Strategies.
                      </div>
                    )}
                    {form.novo_portfolio.esteiras.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 30px", gap: 6, marginBottom: 2, fontSize: 9, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        <span>Sleeve name</span><span>Pillar (optional)</span><span>Weight %</span><span />
                      </div>
                    )}
                    {form.novo_portfolio.esteiras.map((e, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 30px", gap: 6, marginBottom: 4 }}>
                        <input className="input" value={e.nome} placeholder="e.g. SEMIS" aria-label="Sleeve name"
                          onChange={(ev) => updateEsteira(i, { nome: ev.target.value.toUpperCase() })}
                          style={INPUT_STYLE} />
                        <input className="input" value={e.pilar || ""} placeholder="e.g. Pillar A" aria-label="Pillar (optional)"
                          onChange={(ev) => updateEsteira(i, { pilar: ev.target.value })}
                          style={INPUT_STYLE} />
                        <input className="input" type="number" value={e.peso_pct} min={0} max={100} aria-label="Weight in percent"
                          onChange={(ev) => updateEsteira(i, { peso_pct: Number(ev.target.value) })}
                          style={INPUT_STYLE} />
                        <button className="btn ghost" onClick={() => removeEsteira(i)}
                          style={{ padding: "4px 8px", color: "var(--red-text)", borderColor: "var(--red)" }}
                          title="remove sleeve" aria-label={`Remove sleeve ${e.nome || i + 1}`}>
                          <i className="ti ti-x" />
                        </button>
                      </div>
                    ))}
                    {form.novo_portfolio.esteiras.length > 0 && (
                      <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
                        Sum of weights: <b>{form.novo_portfolio.esteiras.reduce((s, e) => s + (e.peso_pct || 0), 0)}%</b>
                        {" · "}Ideally 100%.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--tx3)" }}>Validated engine from the catalog. Engines in <b>lab</b> cannot become an ETP.</div>
              {motores.map((m) => {
                const disabled = m.status !== "homologado";
                return (
                  <div key={m.id}
                    onClick={() => !disabled && set("motor_id", m.id)}
                    style={pickCard(form.motor_id === m.id, disabled)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ color: "var(--gold)" }}>{m.nome}</span>
                        <span style={{ fontSize: 11, color: "var(--tx3)", marginLeft: 8 }}>{m.versao}</span>
                        <span className={`tag ${m.status === "homologado" ? "g" : "y"}`} style={{ marginLeft: 8 }}>{m.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--tx2)" }}>{m.descricao}</div>
                    </div>
                    <div style={{ minWidth: 120, textAlign: "right", fontSize: 11 }}>
                      <div>CAGR <b>{m.metricas_homologacao?.cagr ?? "—"}%</b></div>
                      <div>Sortino <b>{m.metricas_homologacao?.sortino ?? "—"}</b></div>
                      <div>DD <b>{m.metricas_homologacao?.max_dd ?? "—"}%</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--tx3)", flex: 1 }}>
                  Real engine validation in the <b>live Arena</b> (in-sample + holdout from the same run, 8-gate battery).
                  <div style={{ marginTop: 4 }}>Engine: <b style={{ color: "var(--gold)" }}>{motorSel?.nome}</b> · Portfolio(s): <b>{portsSel.map((p) => p.id).join(" + ") || "—"}</b></div>
                </div>
                <button className="btn" onClick={runBacktest} disabled={running} style={{ background: "var(--gold)", color: "#000" }}>
                  {running ? "Running…" : bt ? "Run again" : "Run backtest"}
                </button>
              </div>

              {bt && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      fontSize: 32, fontWeight: 700, padding: "6px 16px",
                      background: bt.grade === "A" ? "var(--green-bg)" : bt.grade === "B" ? "var(--gold-bg)" : "var(--red-bg)",
                      color: bt.grade === "A" ? "#2ECC71" : bt.grade === "B" ? "#F39C12" : "var(--red-text)",
                      border: `1px solid ${bt.grade === "A" ? "#2ECC71" : bt.grade === "B" ? "#F39C12" : "var(--red-text)"}`,
                      borderRadius: 6,
                    }}>{bt.grade}</div>
                    <div style={{ fontSize: 12, color: "var(--tx3)" }}>
                      run: <span style={{ fontFamily: "monospace" }}>{bt.run_id ?? "—"}</span>
                      {bt.arena_verdict && (
                        <span style={{ marginLeft: 8, color: bt.arena_verdict === "ACCEPTED" ? "var(--green)" : "var(--red-text)" }}>
                          Arena: {bt.arena_verdict}
                        </span>
                      )}
                      {bt.arena_run_name && <span style={{ marginLeft: 8 }}>· {bt.arena_run_name}</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <MetricBox title={`OOS · holdout${bt.oos_split ? ` (${bt.oos_split}→today)` : ""}`} m={bt.metricas_oos} />
                    <MetricBox title="IN-SAMPLE · Arena run" m={bt.metricas_full} />
                  </div>

                  {bt.homologacao_producao && bt.homologacao_producao.cagr != null && (
                    <div style={{ padding: 10, border: "1px solid var(--gold)", background: "var(--gold-bg)", borderRadius: 4, fontSize: 12 }}>
                      <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>
                        PRODUCTION REFERENCE (DeLorean · config the ETP would trade)
                      </div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>CAGR <b>{bt.homologacao_producao.cagr}%</b></span>
                        <span>Sortino <b>{bt.homologacao_producao.sortino ?? "—"}</b></span>
                        <span>Calmar <b>{bt.homologacao_producao.calmar ?? "—"}</b></span>
                        <span>MaxDD <b>{bt.homologacao_producao.max_dd ?? "—"}%</b></span>
                        <span>Grade <b>{bt.homologacao_producao.grade ?? "—"}</b></span>
                      </div>
                      <div style={{ marginTop: 4, color: "var(--tx3)", fontSize: 11 }}>
                        Production numbers differ from the Arena run above (isolated variant, test universe). Both are real.
                      </div>
                    </div>
                  )}

                  {bt.red_flags.length > 0 && (
                    <div style={{ padding: 10, border: "1px solid #E74C3C", background: "var(--red-bg)", borderRadius: 4, fontSize: 12 }}>
                      <div style={{ color: "var(--red-text)", fontWeight: 600, marginBottom: 4 }}>RED FLAGS</div>
                      {bt.red_flags.map((f, i) => <div key={i}>· {f}</div>)}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: "var(--tx3)" }}>
                    Validators:{" "}
                    {Object.entries(bt.validadores).map(([k, v]) => (
                      <span key={k} style={{ marginRight: 10, color: v ? "var(--green)" : "var(--red-text)" }}>
                        <i className={`ti ${v ? "ti-check" : "ti-x"}`} style={{ fontSize: 11, marginRight: 3 }} />{k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!bt && !running && (
                <div className="c-mut" style={{ fontSize: 12, padding: 20, textAlign: "center" }}>
                  Running a backtest is required before promoting.
                </div>
              )}
            </div>
          )}

          {step === 5 && bt && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--tx3)" }}>Final review. After promoting, the ETP becomes visible in Admin › Strategies › ETPs and in Mission Control.</div>
              <ReviewLine k="Commercial name" v={form.nome_comercial} />
              <ReviewLine k="Ticker" v={form.ticker_listing} />
              <ReviewLine k="ISIN" v={form.isin_provisorio || "— (to be issued)"} />
              <ReviewLine k="Custody" v={form.custodia} />
              <ReviewLine k="Jurisdiction" v={form.jurisdicao} />
              <ReviewLine k="Portfolio" v={effectivePortfolioLabel()} />
              <ReviewLine k="Engine" v={`${motorSel?.nome} ${motorSel?.versao}`} />
              <ReviewLine k="Grade" v={<span style={{ fontWeight: 700, color: bt.grade === "A" ? "#2ECC71" : bt.grade === "B" ? "#F39C12" : "var(--red-text)" }}>{bt.grade}</span>} />
              <ReviewLine k="Backtest run" v={<span style={{ fontFamily: "monospace" }}>{bt.run_id}</span>} />
              <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>
                Grade A or B → ETP goes in as <b>listed</b>. Otherwise it stays as <b>candidate</b> for recalibration.
              </div>
            </div>
          )}

          {err && <div style={{ marginTop: 12, padding: 10, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 4, fontSize: 12 }}>Error: {err}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn ghost" onClick={requestClose}>Cancel</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>← Back</button>
            {step < 5 && (
              <button className="btn" style={{ background: canAdvance() ? "var(--gold)" : undefined, color: canAdvance() ? "#000" : undefined }}
                onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                Next →
              </button>
            )}
            {step === 5 && (
              <button className="btn" style={{ background: "var(--green)", color: "#000" }}
                onClick={submit} disabled={saving}>
                {saving ? "Promoting…" : <><i className="ti ti-check" style={{ marginRight: 5 }} />Promote ETP</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--line)",
  borderRadius: 4, color: "var(--tx)", fontSize: 13, outline: "none",
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
}

function pickCard(selected: boolean, disabled = false): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
    border: `1px solid ${selected ? "var(--gold)" : "var(--line)"}`,
    background: selected ? "#1a1810" : "transparent",
    borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

function MetricBox({ title, m }: { title: string; m: Metrica }) {
  const fmt = (v?: number, suf = "") => (v == null ? "—" : `${v}${suf}`);
  return (
    <div style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 4 }}>
      <div style={{ fontSize: 11, color: "var(--tx3)", letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12 }}>
        <div>CAGR <b style={{ color: "var(--gold)" }}>{fmt(m.cagr, "%")}</b></div>
        <div>Sortino <b style={{ color: "var(--gold)" }}>{fmt(m.sortino)}</b></div>
        <div>Calmar <b>{fmt(m.calmar)}</b></div>
        <div>DD <b style={{ color: "var(--red-text)" }}>{fmt(m.max_dd, "%")}</b></div>
      </div>
    </div>
  );
}

function ReviewLine({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
      <div style={{ minWidth: 140, fontSize: 11, color: "var(--tx3)", textTransform: "uppercase" }}>{k}</div>
      <div style={{ fontSize: 13 }}>{v}</div>
    </div>
  );
}

"use client";
import { useState } from "react";
import type {
  MotorNoPortfolio,
  EstruturaAttackStocks,
  EstruturaAttackEtfs,
  EstruturaDetector,
} from "@/lib/portfolioComposicao";
import { useDialog } from "../ui/Dialog";

interface Props {
  motor: MotorNoPortfolio;
  onOpenEsteira: (pilarNome: string | null, esteiraNome: string) => void;
  onAddEsteira: (pilarNome: string | null, esteiraNome: string, pesoPct: number) => void;
  onRemoveEsteira: (esteiraNome: string) => void;
  onFork: () => void;
}

function isAttackStocks(e: unknown): e is EstruturaAttackStocks {
  return !!e && typeof e === "object" && "pilares" in e;
}
function isAttackEtfs(e: unknown): e is EstruturaAttackEtfs {
  return !!e && typeof e === "object" && "buckets_n" in e;
}
function isDetector(e: unknown): e is EstruturaDetector {
  return !!e && typeof e === "object" && "formulas" in e;
}

export default function MotorStudio({ motor, onOpenEsteira, onAddEsteira, onRemoveEsteira, onFork }: Props) {
  const dialog = useDialog();
  const [novaEsteiraPilar, setNovaEsteiraPilar] = useState<string | null>(null);
  const [novaEsteiraNome, setNovaEsteiraNome] = useState("");
  const [novoPilarNome, setNovoPilarNome] = useState("");
  const [novoPilarEsteira, setNovoPilarEsteira] = useState("");
  const [showNovoPilar, setShowNovoPilar] = useState(false);
  const locked = motor.status === "prod";

  return (
    <div style={{ padding: 12 }}>
      {locked && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "var(--gold-bg)",
            border: "1px solid var(--gold)",
            borderRadius: 6,
            marginBottom: 14,
            fontSize: 12,
          }}
        >
          <i className="ti ti-lock" style={{ color: "var(--gold)" }} />
          <span>🔒 APPROVED · immutable — this engine is tested and in production. Editing strategies requires a fork.</span>
          <button className="btn" style={{ marginLeft: "auto", padding: "4px 12px", fontSize: 11 }} onClick={onFork}>
            <i className="ti ti-git-fork" style={{ marginRight: 5 }} />Fork to candidate
          </button>
        </div>
      )}

      {isAttackStocks(motor.estrutura) && (
        <div>
          {motor.estrutura.pilares.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 10 }}>
              {motor.estrutura.pilares.length} pillars · weights{" "}
              {motor.estrutura.pilares.some((p) => p.peso_modo === "emergente")
                ? "emergent (engine's global ranking)"
                : "fixed"}
            </div>
          )}

          {/* Empty state — criar primeiro pilar */}
          {motor.estrutura.pilares.length === 0 && !locked && (
            <div className="card" style={{ padding: 20, borderColor: "var(--gold)", borderWidth: 1.5, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
                Engine with no pillars
              </div>
              <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 14, lineHeight: 1.5 }}>
                This engine has no pillars or strategies. Create the first pillar and a strategy
                to start adding assets.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Pillar name *</div>
                  <input
                    className="input"
                    placeholder="E.g.: Pillar A · Attack"
                    value={novoPilarNome}
                    onChange={(e) => setNovoPilarNome(e.target.value)}
                    style={{ fontSize: 12, width: "100%" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>First strategy *</div>
                  <input
                    className="input"
                    placeholder="Ex: TECH_LEADERS"
                    value={novoPilarEsteira}
                    onChange={(e) => setNovoPilarEsteira(e.target.value.toUpperCase())}
                    style={{ fontSize: 12, width: "100%" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn"
                  disabled={!novoPilarNome.trim() || !novoPilarEsteira.trim()}
                  onClick={() => {
                    onAddEsteira(novoPilarNome.trim(), novoPilarEsteira.trim(), 100);
                    setNovoPilarNome("");
                    setNovoPilarEsteira("");
                  }}
                  style={{ fontSize: 12 }}
                >
                  <i className="ti ti-plus" style={{ marginRight: 5 }} />
                  Create pillar + strategy
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 10, lineHeight: 1.5 }}>
                Pillar suggestions: <b>Pillar A · Attack</b> (aggressive stocks), <b>Pillar B · Leaders</b> (blue chips),
                <b> Pillar C · Defense</b> (protection). The strategy is the basket of assets within the pillar.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {motor.estrutura.pilares.map((pilar) => (
              <div key={pilar.nome} className="card" style={{ padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{pilar.nome}</span>
                  <span
                    className="tag"
                    style={{
                      marginLeft: 8,
                      background: pilar.peso_modo === "emergente" ? "var(--gold-bg)" : "var(--blue-bg)",
                      color: pilar.peso_modo === "emergente" ? "var(--gold)" : "var(--blue)",
                    }}
                  >
                    {pilar.peso_modo === "emergente" ? "emergent weight" : `${pilar.peso_pct}%`}
                  </span>
                  <button
                    className="btn ghost"
                    disabled={locked}
                    title={locked ? "🔒 approved engine — create a fork to add strategies" : undefined}
                    style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", opacity: locked ? 0.4 : 1, cursor: locked ? "not-allowed" : "pointer" }}
                    onClick={() => !locked && setNovaEsteiraPilar(pilar.nome)}
                  >
                    + strategy
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {pilar.esteiras.map((est) => (
                    <div
                      key={est.nome}
                      onClick={() => onOpenEsteira(pilar.nome, est.nome)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 5,
                        cursor: "pointer",
                        fontSize: 11,
                        minWidth: 130,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
                    >
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ fontWeight: 600 }}>{est.nome}</div>
                        <button
                          className="btn ghost"
                          disabled={locked}
                          style={{ marginLeft: "auto", fontSize: 11, padding: "5px 8px", color: "var(--red-text)", opacity: locked ? 0.35 : 1, cursor: locked ? "not-allowed" : "pointer" }}
                          title={locked ? "🔒 approved engine — create a fork to remove strategies" : "remove strategy"}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (locked) return;
                            const ok = await dialog.confirm({
                              title: `Remove the strategy ${est.nome}?`,
                              body: `${est.ativos.length} asset(s) will be removed along with it. This removal writes directly to the backend.`,
                              danger: true,
                              confirmLabel: "Remove strategy",
                            });
                            if (ok) onRemoveEsteira(est.nome);
                          }}
                        >
                          <i className="ti ti-x" />
                        </button>
                      </div>
                      <div style={{ color: "var(--tx3)", marginTop: 2 }}>
                        {est.peso_pct}% · {est.ativos.length} assets
                      </div>
                      <div style={{ color: "var(--tx2)", marginTop: 2, fontSize: 10 }}>
                        {est.ativos.map((a) => a.ticker).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>

                {novaEsteiraPilar === pilar.nome && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input
                      className="input"
                      placeholder="strategy name"
                      value={novaEsteiraNome}
                      onChange={(e) => setNovaEsteiraNome(e.target.value.toUpperCase())}
                      style={{ fontSize: 11, padding: "4px 8px", flex: 1 }}
                    />
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => {
                        if (!novaEsteiraNome.trim()) return;
                        onAddEsteira(pilar.nome, novaEsteiraNome.trim(), 10);
                        setNovaEsteiraNome("");
                        setNovaEsteiraPilar(null);
                      }}
                    >
                      Add
                    </button>
                    <button
                      className="btn ghost"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => {
                        setNovaEsteiraPilar(null);
                        setNovaEsteiraNome("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New pillar (when pillars already exist) */}
          {!locked && motor.estrutura.pilares.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {!showNovoPilar ? (
                <button
                  className="btn ghost"
                  style={{ fontSize: 11, padding: "5px 12px" }}
                  onClick={() => setShowNovoPilar(true)}
                >
                  <i className="ti ti-plus" style={{ marginRight: 4 }} />New pillar
                </button>
              ) : (
                <div className="card" style={{ padding: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Pillar name</div>
                    <input
                      className="input"
                      placeholder="E.g.: Pillar E · New"
                      value={novoPilarNome}
                      onChange={(e) => setNovoPilarNome(e.target.value)}
                      style={{ fontSize: 11, width: "100%" }}
                      autoFocus
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>First strategy</div>
                    <input
                      className="input"
                      placeholder="E.g.: ETF_CORE"
                      value={novoPilarEsteira}
                      onChange={(e) => setNovoPilarEsteira(e.target.value.toUpperCase())}
                      style={{ fontSize: 11, width: "100%" }}
                    />
                  </div>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: "5px 12px" }}
                    disabled={!novoPilarNome.trim() || !novoPilarEsteira.trim()}
                    onClick={() => {
                      onAddEsteira(novoPilarNome.trim(), novoPilarEsteira.trim(), 10);
                      setNovoPilarNome("");
                      setNovoPilarEsteira("");
                      setShowNovoPilar(false);
                    }}
                  >
                    Create
                  </button>
                  <button
                    className="btn ghost"
                    style={{ fontSize: 11, padding: "5px 10px" }}
                    onClick={() => { setShowNovoPilar(false); setNovoPilarNome(""); setNovoPilarEsteira(""); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {motor.estrutura.regras_internas && Object.keys(motor.estrutura.regras_internas).length > 0 && (
            <div className="card" style={{ padding: 10, marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 6 }}>
                Engine internal rules
              </div>
              <div style={{ display: "grid", gap: 4, fontSize: 11 }}>
                {Object.entries(motor.estrutura.regras_internas).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "var(--tx3)", minWidth: 160 }}>{k}</span>
                    <span style={{ color: "var(--tx2)" }}>
                      {Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isAttackEtfs(motor.estrutura) && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            ETF rotation engine — managed by the ETF Rotation catalog itself. Not editable here.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
            <div>
              Buckets: <b style={{ color: "var(--gold)" }}>{motor.estrutura.buckets_n}</b>
            </div>
            <div>
              ETFs: <b style={{ color: "var(--gold)" }}>{motor.estrutura.etfs_n}</b>
            </div>
            {motor.estrutura.signal && (
              <div style={{ gridColumn: "span 2" }}>
                Signal: <b>{motor.estrutura.signal}</b>
              </div>
            )}
            {motor.estrutura.config && (
              <div style={{ gridColumn: "span 2" }}>
                Config: <b>{motor.estrutura.config}</b>
              </div>
            )}
            {motor.estrutura.mask_anti_phantom != null && (
              <div style={{ gridColumn: "span 2" }}>
                Mask anti-phantom:{" "}
                <b style={{ color: motor.estrutura.mask_anti_phantom ? "var(--green)" : "var(--tx3)" }}>
                  {motor.estrutura.mask_anti_phantom ? "active" : "inactive"}
                </b>
              </div>
            )}
          </div>
        </div>
      )}

      {isDetector(motor.estrutura) && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Detector engine — emits regime signal. Has no assets, only weighted formulas.
            {motor.estrutura.emite_sinal && (
              <span style={{ color: "var(--tx3)" }}> Emits: {motor.estrutura.emite_sinal}</span>
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {motor.estrutura.formulas.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  borderRadius: 5,
                }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 12, minWidth: 110 }}>{f.id}</span>
                <div style={{ flex: 1, height: 6, background: "rgba(0,0,0,.3)", borderRadius: 3 }}>
                  <div
                    style={{
                      width: `${f.peso * 100}%`,
                      height: "100%",
                      background: "var(--gold)",
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, minWidth: 50, textAlign: "right", color: "var(--gold)" }}>
                  {(f.peso * 100).toFixed(0)}%
                </span>
                <span style={{ fontSize: 10, color: "var(--tx3)", minWidth: 160 }}>{f.descricao}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 10 }}>
            Formula editing via Formula Studio (sprint 2).
          </div>
        </div>
      )}
    </div>
  );
}

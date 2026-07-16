"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { EsteiraNo, Arena, RegraPeso } from "@/lib/portfolioComposicao";
import { useDialog } from "../ui/Dialog";

interface RegistryFormula {
  id: string;
  nome: string;
  categoria: string;
  status: string;
  descricao: string;
}

interface CatalogItem {
  ticker: string;
  nome: string;
  setor: string;
  subsetor: string;
  classe: string;
}

interface Props {
  esteira: EsteiraNo;
  onAddAtivo: (ticker: string, pesoPct: number, tipo: string) => void;
  onRemoveAtivo: (ticker: string) => void;
  onSaveArena: (arena: Arena) => void;
  onClose: () => void;
  locked?: boolean;
}

const REGRA_PESO_LABEL: Record<RegraPeso, string> = {
  igual: "Equal among leaders",
  forca_sinal: "By signal strength",
  inverse_vol: "Inverse-vol",
  cap: "Cap by position",
};

const CLASSES = ["TODOS", "AÇÃO", "ETF", "COMMODITY", "ÍNDICE"] as const;

export default function EsteiraStudio({ esteira, onAddAtivo, onRemoveAtivo, onSaveArena, onClose, locked = false }: Props) {
  const dialog = useDialog();
  const [ticker, setTicker] = useState("");
  const [peso, setPeso] = useState(10);
  const [tipo, setTipo] = useState("AÇÃO");
  const [showPicker, setShowPicker] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerClasse, setPickerClasse] = useState<string>("TODOS");

  // ---- Competition arena ----
  const [rankers, setRankers] = useState<RegistryFormula[]>([]);
  const [universoTxt, setUniversoTxt] = useState((esteira.arena?.universo_tickers || []).join(", "));
  const [rankerId, setRankerId] = useState<string>(esteira.arena?.ranker_formula_id || "");
  const [topN, setTopN] = useState<number | "">(esteira.arena?.selecao_top_n ?? "");
  const [regraPeso, setRegraPeso] = useState<RegraPeso>(esteira.arena?.regra_peso || "igual");
  const [capPct, setCapPct] = useState<number | "">(esteira.arena?.peso_cap_pct ?? "");
  const [rebalanceFreq, setRebalanceFreq] = useState(esteira.arena?.rebalance_freq || "mensal");

  useEffect(() => {
    apiGet<{ formulas: RegistryFormula[] }>("/v1/registry/formulas")
      .then((d) => setRankers((d.formulas || []).filter((f) => f.categoria === "Ranker" && f.status === "homologada")))
      .catch(() => setRankers([]));
    apiGet<{ items: CatalogItem[] }>("/v1/assets/catalog")
      .then((d) => setCatalog(d.items || []))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const somaAtivos = esteira.ativos.reduce((s, a) => s + a.peso_pct, 0);
  const universoTickers = universoTxt.split(/[,\n]/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  const arenaConfigurada = !!esteira.arena;
  const existingTickers = new Set(esteira.ativos.map((a) => a.ticker));
  const filteredCatalog = catalog.filter((item) => {
    if (existingTickers.has(item.ticker)) return false;
    if (pickerClasse !== "TODOS" && item.classe !== pickerClasse) return false;
    if (pickerQ) {
      const ql = pickerQ.toLowerCase();
      return item.ticker.toLowerCase().includes(ql) || item.nome.toLowerCase().includes(ql) || item.setor.toLowerCase().includes(ql);
    }
    return true;
  });

  function handleSaveArena() {
    if (universoTickers.length > 500) {
      dialog.notify("The universe cannot have more than 500 assets.", "error");
      return;
    }
    onSaveArena({
      universo_tickers: universoTickers,
      ranker_formula_id: rankerId || null,
      selecao_top_n: topN === "" ? null : Number(topN),
      regra_peso: regraPeso,
      peso_cap_pct: regraPeso === "cap" ? (capPct === "" ? null : Number(capPct)) : null,
      rebalance_freq: rebalanceFreq,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        zIndex: "var(--z-modal)" as never,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 620, maxHeight: "85vh", overflow: "auto", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase" }}>Strategy</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--gold)" }}>{esteira.nome}</div>
          </div>
          <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {locked && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "var(--gold-bg)", border: "1px solid var(--gold)", borderRadius: 6, marginBottom: 12, fontSize: 11.5 }}>
              <i className="ti ti-lock" style={{ color: "var(--gold)" }} />
              <span>🔒 approved engine — immutable. Fork the portfolio to edit.</span>
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 14 }}>
            Portfolio weight: <b style={{ color: "var(--tx)" }}>{esteira.peso_pct}%</b>
            {esteira.peso_modo && ` · mode: ${esteira.peso_modo}`}
          </div>

          {/* ===== COMPETITION ARENA ===== */}
          <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 14, marginBottom: 16, background: "rgba(201,160,44,.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gold)" }}>🎯 Competition arena</span>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: arenaConfigurada ? "var(--green-bg)" : "var(--raise)", color: arenaConfigurada ? "var(--green)" : "var(--tx3)" }}>
                {arenaConfigurada ? "configured" : "not configured · manual basket"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 12, lineHeight: 1.5 }}>
              Assets compete through a ranker; the leaders (top-N) stay long — AlphaDroid-style, with no asset limit.
              Without an arena, the strategy is a manually curated basket (the table below).
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>
                  Universe · competing assets (up to 500) <span style={{ color: "var(--tx2)" }}>· {universoTickers.length} entered</span>
                </div>
                <textarea
                  className="input"
                  disabled={locked}
                  placeholder="NVDA, MSFT, AAPL, GOOGL, AMZN, META, ..."
                  value={universoTxt}
                  onChange={(e) => setUniversoTxt(e.target.value)}
                  style={{ fontSize: 11.5, width: "100%", minHeight: 56, resize: "vertical", opacity: locked ? 0.5 : 1 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Ranker (approved formula)</div>
                  <select className="input" disabled={locked} value={rankerId} onChange={(e) => setRankerId(e.target.value)} style={{ fontSize: 12, width: "100%", opacity: locked ? 0.5 : 1 }}>
                    <option value="">— none —</option>
                    {rankers.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                  {rankers.length === 0 && (
                    <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 3 }}>No approved Ranker formula in the catalog.</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Top-N leaders</div>
                  <input
                    className="input" type="number" min={1} disabled={locked}
                    value={topN} onChange={(e) => setTopN(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{ fontSize: 12, width: "100%", opacity: locked ? 0.5 : 1 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: regraPeso === "cap" ? "1fr 110px 1fr" : "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Leader weighting</div>
                  <select className="input" disabled={locked} value={regraPeso} onChange={(e) => setRegraPeso(e.target.value as RegraPeso)} style={{ fontSize: 12, width: "100%", opacity: locked ? 0.5 : 1 }}>
                    {(Object.keys(REGRA_PESO_LABEL) as RegraPeso[]).map((r) => (
                      <option key={r} value={r}>{REGRA_PESO_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
                {regraPeso === "cap" && (
                  <div>
                    <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Cap %</div>
                    <input
                      className="input" type="number" min={0} max={100} disabled={locked}
                      value={capPct} onChange={(e) => setCapPct(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ fontSize: 12, width: "100%", opacity: locked ? 0.5 : 1 }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 4 }}>Rebalance</div>
                  <select className="input" disabled={locked} value={rebalanceFreq} onChange={(e) => setRebalanceFreq(e.target.value)} style={{ fontSize: 12, width: "100%", opacity: locked ? 0.5 : 1 }}>
                    <option value="mensal">Monthly</option>
                    <option value="mensal+defesa_diaria">Monthly + daily defense</option>
                    <option value="semanal">Weekly</option>
                    <option value="diario">Daily</option>
                  </select>
                </div>
              </div>

              {!locked && (
                <button className="btn" style={{ fontSize: 12, justifySelf: "start" }} onClick={handleSaveArena}>
                  <i className="ti ti-device-floppy" style={{ marginRight: 5 }} />Save arena
                </button>
              )}
            </div>
          </div>

          {/* ===== CURRENT LEADERS (competition result / manual basket) ===== */}
          <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 6 }}>
            {arenaConfigurada ? "Current leaders (result of the last competition)" : "Basket assets"}
          </div>
          <table style={{ width: "100%", fontSize: 12, marginBottom: 12 }}>
            <thead>
              <tr style={{ color: "var(--tx3)", textAlign: "left" }}>
                <th style={{ paddingBottom: 6 }}>Ticker</th>
                <th style={{ paddingBottom: 6 }}>Type</th>
                <th style={{ paddingBottom: 6, textAlign: "right" }}>Weight</th>
                <th style={{ paddingBottom: 6 }}></th>
              </tr>
            </thead>
            <tbody>
              {esteira.ativos.map((a) => (
                <tr key={a.ticker} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>{a.ticker}</td>
                  <td style={{ color: "var(--tx3)" }}>{a.tipo || "—"}</td>
                  <td style={{ textAlign: "right" }}>{a.peso_pct}%</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn ghost"
                      disabled={locked}
                      style={{ fontSize: 11, padding: "5px 9px", color: "var(--red-text)", opacity: locked ? 0.35 : 1, cursor: locked ? "not-allowed" : "pointer" }}
                      title={locked ? "🔒 approved engine — fork to edit" : undefined}
                      onClick={async () => {
                        if (locked) return;
                        const ok = await dialog.confirm({
                          title: `Remove ${a.ticker} from the strategy?`,
                          body: "The removal is written directly to the backend (no need to click Save).",
                          danger: true,
                          confirmLabel: "Remove asset",
                        });
                        if (ok) onRemoveAtivo(a.ticker);
                      }}
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 11, color: somaAtivos === 100 ? "var(--green)" : "var(--orange)", marginBottom: 14 }}>
            Total: {somaAtivos}% {somaAtivos !== 100 && "(ideally 100%)"}
          </div>

          {!locked && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 3 }}>Ticker</div>
                  <input
                    className="input"
                    placeholder="TICKER"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    style={{ fontSize: 12, width: "100%" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 3 }}>Class</div>
                  <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ fontSize: 12, width: 110 }}>
                    <option value="AÇÃO">AÇÃO</option>
                    <option value="ETF">ETF</option>
                    <option value="COMMODITY">COMMODITY</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", marginBottom: 3 }}>Weight %</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={peso}
                    onChange={(e) => setPeso(Number(e.target.value))}
                    style={{ fontSize: 12, width: 70 }}
                  />
                </div>
                <button
                  className="btn"
                  style={{ fontSize: 12, whiteSpace: "nowrap" }}
                  onClick={() => {
                    if (!ticker.trim()) return;
                    onAddAtivo(ticker.trim(), peso, tipo);
                    setTicker("");
                    setPeso(10);
                  }}
                >
                  + Add
                </button>
                <button
                  className="btn ghost"
                  style={{ fontSize: 11, whiteSpace: "nowrap", color: "var(--gold)" }}
                  onClick={() => setShowPicker(!showPicker)}
                >
                  {showPicker ? "Close list" : "Search assets"}
                </button>
              </div>

              {/* ===== ASSET PICKER ===== */}
              {showPicker && (
                <div style={{ marginTop: 10, border: "1px solid var(--gold)", borderRadius: 6, padding: 10, background: "rgba(201,160,44,.03)" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                    <input
                      className="input"
                      placeholder="Search ticker, name, or sector..."
                      value={pickerQ}
                      onChange={(e) => setPickerQ(e.target.value)}
                      style={{ fontSize: 12, flex: 1 }}
                      autoFocus
                    />
                    {CLASSES.map((c) => (
                      <button
                        key={c}
                        className="btn ghost"
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          color: pickerClasse === c ? "var(--gold)" : "var(--tx3)",
                          borderColor: pickerClasse === c ? "var(--gold)" : "var(--line)",
                          fontWeight: pickerClasse === c ? 700 : 400,
                        }}
                        onClick={() => setPickerClasse(c)}
                      >
                        {c === "TODOS" ? "All" : c}
                      </button>
                    ))}
                  </div>

                  <div style={{ maxHeight: 220, overflowY: "auto", fontSize: 11 }}>
                    {filteredCatalog.length === 0 ? (
                      <div style={{ padding: 12, color: "var(--tx3)", textAlign: "center" }}>
                        No assets found{pickerQ ? ` for "${pickerQ}"` : ""}.
                      </div>
                    ) : (
                      <table style={{ width: "100%" }}>
                        <thead>
                          <tr style={{ color: "var(--tx3)", textAlign: "left", fontSize: 10 }}>
                            <th style={{ padding: "4px 0" }}>Ticker</th>
                            <th>Name</th>
                            <th>Sector</th>
                            <th>Class</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCatalog.slice(0, 50).map((item) => (
                            <tr
                              key={item.ticker}
                              style={{ borderTop: "1px solid var(--line)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,160,44,.06)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                            >
                              <td style={{ padding: "5px 0", fontWeight: 600, color: "var(--gold)" }}>{item.ticker}</td>
                              <td style={{ color: "var(--tx2)" }}>{item.nome}</td>
                              <td style={{ color: "var(--tx3)" }}>{item.setor}</td>
                              <td>
                                <span className={`tag ${item.classe === "ETF" ? "b" : item.classe === "AÇÃO" ? "g" : "a"}`} style={{ fontSize: 9 }}>
                                  {item.classe}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  className="btn"
                                  style={{ fontSize: 10, padding: "2px 8px" }}
                                  onClick={() => {
                                    const classeMap: Record<string, string> = { "AÇÃO": "AÇÃO", "ETF": "ETF", "COMMODITY": "COMMODITY", "ÍNDICE": "ETF" };
                                    onAddAtivo(item.ticker, peso, classeMap[item.classe] || "AÇÃO");
                                  }}
                                >
                                  + Add
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {filteredCatalog.length > 50 && (
                      <div style={{ padding: 6, color: "var(--tx3)", fontSize: 10, textAlign: "center" }}>
                        Showing 50 of {filteredCatalog.length} — refine your search.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 10 }}>
                Adding/removing an asset writes directly to the backend — no need to click &quot;Save&quot;.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

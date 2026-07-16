"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { publishScreenData } from "@/lib/jim-data";
import { useDialog } from "../ui/Dialog";
import type { ScreenId } from "@/lib/nav";

interface Motor { id: string; nome: string; versao: string; status: string; descricao: string }
interface Portfolio {
  id: string; nome: string; descricao?: string; motor: string; motor_version: string;
  mode: string; estado: string; capital_usd: number; cagr_pct?: number; sortino?: number; max_dd_pct?: number;
}

export default function Construtor({ go }: { go: (id: ScreenId, param?: string) => void }) {
  const [portfolios, setPortfolios] = useState<Portfolio[] | null>(null);
  const [motores, setMotores] = useState<Motor[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [motorId, setMotorId] = useState("");
  const [descricao, setDescricao] = useState("");
  const dialog = useDialog();

  useEffect(() => {
    apiGet<{ portfolios: Portfolio[] }>("/v1/strategies/").then((d) => setPortfolios(d.portfolios || [])).catch(() => {});
    apiGet<{ motores: Motor[] }>("/v1/registry/motores").then((d) => {
      const ms = d.motores || [];
      setMotores(ms);
      const hom = ms.filter((x) => x.status === "homologado");
      if (hom.length) setMotorId(hom[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!portfolios && !motores.length) return;
    const mods = (portfolios || []).filter((p) => p.mode === "model");
    publishScreenData(
      "construtor",
      `${mods.length} strategies in lab · ${motores.length} engines available`,
      { portfolios, motores },
      { briefing: `Builder with ${mods.length} model portfolios and ${motores.length} registered engines.` }
    );
  }, [portfolios, motores]);

  const modelos = (portfolios || []).filter((p) => p.mode === "model");
  const homologados = motores.filter((m) => m.status === "homologado");

  async function criarEstrategia() {
    if (!nome.trim()) { dialog.notify("Enter a name.", "error"); return; }
    if (!motorId) { dialog.notify("Select an engine.", "error"); return; }
    setCreating(true);
    const slug = nome.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 12);
    const id = slug + "_" + Date.now().toString(36).slice(-4);
    const motor = motores.find((m) => m.id === motorId);
    try {
      const res = await apiPost<{ portfolio: Portfolio }>("/v1/strategies/", {
        id,
        nome: nome.trim(),
        descricao: descricao.trim() || `Strategy created in Builder · engine ${motor?.nome || motorId}`,
        motor: motor?.nome || motorId,
        motor_version: motor?.versao || "v1.0",
        mode: "model",
        owner: "Harpian",
        capital_usd: 1_000_000,
      });
      dialog.notify(`Strategy "${nome}" created. Opening the Studio…`, "success");
      go("portfolio-studio", res.portfolio.id);
    } catch (e) {
      dialog.notify("Error creating strategy: " + String((e as Error).message || e), "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">Strategy Builder</div>
          <div className="sub">Create new strategies and edit existing ones in the Portfolio Studio.</div>
        </div>
        <button className="btn" onClick={() => setWizardOpen(true)}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} /> New Strategy
        </button>
      </div>

      {/* Inline mini-wizard */}
      {wizardOpen && (
        <div className="card mb" style={{ borderColor: "var(--gold)", borderWidth: 1.5 }}>
          <h2><span>New Strategy</span></h2>
          <div className="grid g3" style={{ gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8, display: "block", marginBottom: 4 }}>
                Strategy name *
              </label>
              <input
                className="input" style={{ width: "100%" }}
                value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="E.g.: HC-US Aggressive v2"
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8, display: "block", marginBottom: 4 }}>
                Engine (approved) *
              </label>
              <select className="input" style={{ width: "100%" }} value={motorId} onChange={(e) => setMotorId(e.target.value)}>
                {homologados.length === 0 && <option value="">No approved engine</option>}
                {homologados.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome} ({m.versao})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8, display: "block", marginBottom: 4 }}>
                Description (optional)
              </label>
              <input
                className="input" style={{ width: "100%" }}
                value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder="Brief description"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={() => setWizardOpen(false)} disabled={creating}>Cancel</button>
            <button className="btn" onClick={criarEstrategia} disabled={creating || !nome.trim() || !motorId}>
              {creating ? "Creating…" : "Create and open in Studio →"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 10 }}>
            The strategy is created as a <b>model</b> (simulation). In the Studio you build pillars, sleeves and assets.
            After approval via backtest, promote it to active in Admin.
          </div>
        </div>
      )}

      {/* Existing model portfolios */}
      <div className="card mb">
        <h2>
          <span>Strategies in the lab · {modelos.length} model{modelos.length !== 1 ? "s" : ""}</span>
        </h2>
        {portfolios === null ? (
          <div className="ph" style={{ padding: 20 }}>Loading…</div>
        ) : modelos.length === 0 ? (
          <div className="ph" style={{ padding: 20 }}>
            No model strategy yet. Click <b>New Strategy</b> to get started.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Engine</th><th>State</th>
                <th style={{ textAlign: "right" }}>CAGR</th>
                <th style={{ textAlign: "right" }}>Sortino</th>
                <th style={{ textAlign: "right" }}>Max DD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((p) => (
                <tr key={p.id}>
                  <td className="tk"><b style={{ color: "var(--gold)" }}>{p.id}</b></td>
                  <td>
                    {p.nome}
                    {p.descricao && <div className="c-mut2" style={{ fontSize: 10 }}>{p.descricao}</div>}
                  </td>
                  <td className="c-mut" style={{ fontSize: 11 }}>{p.motor} <span className="c-mut2">{p.motor_version}</span></td>
                  <td>
                    <span className={`tag ${p.estado === "homologado" ? "g" : p.estado === "lab" ? "a" : "b"}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", color: (p.cagr_pct ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                    {p.cagr_pct != null ? `${p.cagr_pct}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{p.sortino != null ? p.sortino.toFixed(2) : "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--red)" }}>{p.max_dd_pct != null ? `${p.max_dd_pct}%` : "—"}</td>
                  <td>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => go("portfolio-studio", p.id)}
                    >
                      <i className="ti ti-settings" style={{ fontSize: 13, marginRight: 4 }} />Edit in Studio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick guide */}
      <div className="card mb" style={{ opacity: 0.85 }}>
        <h2><span>How it works</span></h2>
        <div className="grid g3" style={{ gap: 12, fontSize: 12, color: "var(--tx2)" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>1</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Create here</div>
            Give it a name and choose the engine. The strategy starts as a model in the Lab.
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>2</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Build in Studio</div>
            Add pillars, sleeves (asset baskets), configure the arena and the Maestro.
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>3</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Approve and promote</div>
            Run the backtest (2 windows). If grade A/B, promote it to active in Admin.
          </div>
        </div>
      </div>

      <div className="foot">Builder · Lab · creates model portfolios → Portfolio Studio → Backtest → Admin (promote)</div>
    </div>
  );
}

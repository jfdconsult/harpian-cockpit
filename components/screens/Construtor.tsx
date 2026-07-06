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
    apiGet<{ portfolios: Portfolio[] }>("/v1/strategies/").then((d) => setPortfolios(d.portfolios)).catch(() => {});
    apiGet<{ motores: Motor[] }>("/v1/registry/motores").then((d) => {
      setMotores(d.motores);
      const hom = d.motores.filter((m) => m.status === "homologado");
      if (hom.length) setMotorId(hom[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!portfolios && !motores.length) return;
    const mods = (portfolios || []).filter((p) => p.mode === "model");
    publishScreenData(
      "construtor",
      `${mods.length} estratégias em lab · ${motores.length} motores disponíveis`,
      { portfolios, motores },
      { briefing: `Construtor com ${mods.length} portfolios modelo e ${motores.length} motores cadastrados.` }
    );
  }, [portfolios, motores]);

  const modelos = (portfolios || []).filter((p) => p.mode === "model");
  const homologados = motores.filter((m) => m.status === "homologado");

  async function criarEstrategia() {
    if (!nome.trim()) { dialog.notify("Informe um nome.", "error"); return; }
    if (!motorId) { dialog.notify("Selecione um motor.", "error"); return; }
    setCreating(true);
    const slug = nome.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 12);
    const id = slug + "_" + Date.now().toString(36).slice(-4);
    const motor = motores.find((m) => m.id === motorId);
    try {
      const res = await apiPost<{ portfolio: Portfolio }>("/v1/strategies/", {
        id,
        nome: nome.trim(),
        descricao: descricao.trim() || `Estratégia criada no Construtor · motor ${motor?.nome || motorId}`,
        motor: motor?.nome || motorId,
        motor_version: motor?.versao || "v1.0",
        mode: "model",
        owner: "Harpian",
        capital_usd: 1_000_000,
      });
      dialog.notify(`Estratégia "${nome}" criada. Abrindo o Studio…`, "success");
      go("portfolio-studio", res.portfolio.id);
    } catch (e) {
      dialog.notify("Erro ao criar: " + String((e as Error).message || e), "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">Construtor de Estratégias</div>
          <div className="sub">Crie novas estratégias e edite as existentes no Portfolio Studio.</div>
        </div>
        <button className="btn" onClick={() => setWizardOpen(true)}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} /> Nova Estratégia
        </button>
      </div>

      {/* Mini-wizard inline */}
      {wizardOpen && (
        <div className="card mb" style={{ borderColor: "var(--gold)", borderWidth: 1.5 }}>
          <h2><span>Nova Estratégia</span></h2>
          <div className="grid g3" style={{ gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8, display: "block", marginBottom: 4 }}>
                Nome da estratégia *
              </label>
              <input
                className="input" style={{ width: "100%" }}
                value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: HC-US Agressivo v2"
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8, display: "block", marginBottom: 4 }}>
                Motor (homologado) *
              </label>
              <select className="input" style={{ width: "100%" }} value={motorId} onChange={(e) => setMotorId(e.target.value)}>
                {homologados.length === 0 && <option value="">Nenhum motor homologado</option>}
                {homologados.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome} ({m.versao})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: .8, display: "block", marginBottom: 4 }}>
                Descrição (opcional)
              </label>
              <input
                className="input" style={{ width: "100%" }}
                value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder="Breve descrição"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={() => setWizardOpen(false)} disabled={creating}>Cancelar</button>
            <button className="btn" onClick={criarEstrategia} disabled={creating || !nome.trim() || !motorId}>
              {creating ? "Criando…" : "Criar e abrir no Studio →"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 10 }}>
            A estratégia nasce como <b>modelo</b> (simulação). No Studio você monta pilares, esteiras e ativos.
            Depois de homologar via backtest, promova para ativo em Admin.
          </div>
        </div>
      )}

      {/* Portfolios modelo existentes */}
      <div className="card mb">
        <h2>
          <span>Estratégias em laboratório · {modelos.length} modelo{modelos.length !== 1 ? "s" : ""}</span>
        </h2>
        {portfolios === null ? (
          <div className="ph" style={{ padding: 20 }}>Carregando…</div>
        ) : modelos.length === 0 ? (
          <div className="ph" style={{ padding: 20 }}>
            Nenhuma estratégia modelo. Clique em <b>Nova Estratégia</b> para começar.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Nome</th><th>Motor</th><th>Estado</th>
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
                      <i className="ti ti-settings" style={{ fontSize: 13, marginRight: 4 }} />Editar no Studio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Guia rápido */}
      <div className="card mb" style={{ opacity: 0.85 }}>
        <h2><span>Como funciona</span></h2>
        <div className="grid g3" style={{ gap: 12, fontSize: 12, color: "var(--tx2)" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>1</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Criar aqui</div>
            Dê um nome e escolha o motor. A estratégia nasce como modelo no Lab.
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>2</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Montar no Studio</div>
            Adicione pilares, esteiras (cestas de ativos), configure a arena e o Maestro.
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>3</div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Homologar e promover</div>
            Rode o backtest (2 janelas). Se grade A/B, promova para ativo em Admin.
          </div>
        </div>
      </div>

      <div className="foot">Construtor · Laboratório · cria portfolios modelo → Portfolio Studio → Backtest → Admin (promover)</div>
    </div>
  );
}

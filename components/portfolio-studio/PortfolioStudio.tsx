"use client";
import { useState, type Dispatch } from "react";
import type { Composicao, Arena } from "@/lib/portfolioComposicao";
import {
  computeDiff,
  isEmptyDiff,
  fetchComposicao,
  addMotor,
  removeMotor,
  patchMotorPeso,
  addRegra,
  removeRegra,
  patchPerfil,
  activatePerfil,
  forkPortfolio,
  addEsteiraToMotor,
  removeEsteiraFromMotor,
  addAtivoToMotorEsteira,
  removeAtivoFromMotorEsteira,
  patchArenaEsteira,
} from "@/lib/portfolioComposicao";
import type { DraftAction } from "@/lib/portfolioDraft";
import { useDialog } from "../ui/Dialog";
import CanvasComposicao from "./CanvasComposicao";
import MotorStudio from "./MotorStudio";
import EsteiraStudio from "./EsteiraStudio";
import DiffPanel from "./DiffPanel";
import BacktestBadge from "./BacktestBadge";

interface Props {
  portfolioId: string;
  draft: Composicao;
  dispatch: Dispatch<DraftAction>;
  snapshot: Composicao;
  onSaved: (comp: Composicao) => void;
  onExit: () => void;
}

async function ignoreStatus(promise: Promise<unknown>, codes: number[]) {
  try {
    await promise;
  } catch (e) {
    const msg = String(e);
    const hit = codes.some((c) => msg.includes(String(c)));
    if (!hit) throw e;
  }
}

export default function PortfolioStudio({
  portfolioId,
  draft,
  dispatch,
  snapshot,
  onSaved,
  onExit,
}: Props) {
  const [nivel, setNivel] = useState<1 | 2 | 3>(1);
  const [motorSelecionado, setMotorSelecionado] = useState<string | null>(null);
  const [esteiraSelecionada, setEsteiraSelecionada] = useState<{
    pilar: string | null;
    nome: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [forking, setForking] = useState(false);
  const dialog = useDialog();

  const diff = computeDiff(snapshot, draft);
  const motorAtual = draft.motores.find((m) => m.id === motorSelecionado) || null;
  const esteiraAtual =
    motorAtual && esteiraSelecionada && "pilares" in motorAtual.estrutura
      ? motorAtual.estrutura.pilares
          .flatMap((p) => p.esteiras)
          .find((e) => e.nome === esteiraSelecionada.nome) || null
      : null;

  function goNivel1() {
    setNivel(1);
    setMotorSelecionado(null);
    setEsteiraSelecionada(null);
  }

  function drillDownMotor(motorId: string) {
    setMotorSelecionado(motorId);
    setNivel(2);
  }

  function openEsteira(pilarNome: string | null, esteiraNome: string) {
    setEsteiraSelecionada({ pilar: pilarNome, nome: esteiraNome });
    setNivel(3);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const m of diff.motoresRemoved) {
        await ignoreStatus(removeMotor(portfolioId, m.id), [404]);
      }
      for (const m of diff.motoresAdded) {
        await ignoreStatus(
          addMotor(portfolioId, {
            id: m.id,
            ref_motor_id: m.ref_motor_id,
            tipo: m.tipo,
            peso_modo: m.peso.modo,
            peso_regra_id: m.peso.regra_id,
            peso_valor: m.peso.valor,
          }),
          [409]
        );
      }
      for (const c of diff.motoresChanged) {
        const m = draft.motores.find((x) => x.id === c.id);
        if (m) {
          await ignoreStatus(
            patchMotorPeso(portfolioId, m.id, {
              modo: m.peso.modo,
              regra_id: m.peso.regra_id,
              valor: m.peso.valor,
            }),
            [404]
          );
        }
      }
      for (const r of diff.regrasRemoved) {
        await ignoreStatus(removeRegra(portfolioId, r.id), [404]);
      }
      for (const r of diff.regrasAdded) {
        await ignoreStatus(addRegra(portfolioId, r), [409, 400]);
      }
      for (const p of diff.perfisChanged) {
        const perfil = draft.perfis.find((x) => x.id === p.id);
        if (perfil) {
          await ignoreStatus(
            patchPerfil(portfolioId, p.id, { w_min: perfil.w_min, w_max: perfil.w_max }),
            [404]
          );
        }
      }
      if (diff.perfilAtivoChanged?.to) {
        await ignoreStatus(activatePerfil(portfolioId, diff.perfilAtivoChanged.to), [404]);
      }

      const fresh = await fetchComposicao(portfolioId);
      onSaved(fresh);
    } catch (e) {
      dialog.notify("Erro ao salvar: " + String(e), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    dispatch({ type: "LOAD", composicao: snapshot });
    goNivel1();
  }

  async function handleForkMotor() {
    setForking(true);
    try {
      const res = await forkPortfolio(portfolioId);
      dialog.notify(`Fork criado: ${res.portfolio.id} — abra em Admin › Portfolios para editar sem afetar produção.`, "success");
    } catch (e) {
      dialog.notify("Erro ao criar fork: " + String(e), "error");
    } finally {
      setForking(false);
    }
  }

  // Esteira/Ativo dentro de um motor: grava direto no backend primeiro (persistência
  // real), e só então atualiza o draft local com dispatch — assim uma falha na API
  // não deixa o rascunho "mentindo" sobre o que foi salvo, e mudanças pendentes de
  // motor/regra/perfil (ainda não salvas) não são perdidas por um reload completo.
  async function handleAddEsteiraMotor(motorId: string, pilarNome: string | null, esteiraNome: string, pesoPct: number) {
    try {
      const motorPendente = diff.motoresAdded.find((m) => m.id === motorId);
      if (motorPendente) {
        await ignoreStatus(
          addMotor(portfolioId, {
            id: motorPendente.id,
            ref_motor_id: motorPendente.ref_motor_id,
            tipo: motorPendente.tipo,
            peso_modo: motorPendente.peso.modo,
            peso_regra_id: motorPendente.peso.regra_id,
            peso_valor: motorPendente.peso.valor,
          }),
          [409],
        );
      }
      await addEsteiraToMotor(portfolioId, motorId, { nome: esteiraNome, peso_pct: pesoPct, pilar: pilarNome });
      dispatch({
        type: "ADD_ESTEIRA",
        motor_id: motorId,
        pilar: pilarNome,
        esteira: { nome: esteiraNome, peso_pct: pesoPct, ativos: [] },
      });
    } catch (e) {
      dialog.notify("Erro ao adicionar esteira: " + String(e), "error");
    }
  }

  async function handleRemoveEsteiraMotor(motorId: string, esteiraNome: string) {
    try {
      await removeEsteiraFromMotor(portfolioId, motorId, esteiraNome);
      dispatch({ type: "REMOVE_ESTEIRA", motor_id: motorId, esteira_nome: esteiraNome });
    } catch (e) {
      dialog.notify("Erro ao remover esteira: " + String(e), "error");
    }
  }

  async function handleAddAtivoMotor(motorId: string, esteiraNome: string, ticker: string, pesoPct: number, tipo: string) {
    try {
      await addAtivoToMotorEsteira(portfolioId, motorId, esteiraNome, { ticker, tipo, peso_pct: pesoPct });
      dispatch({
        type: "ADD_ATIVO",
        motor_id: motorId,
        esteira_nome: esteiraNome,
        ativo: { ticker: ticker.toUpperCase(), peso_pct: pesoPct, tipo },
      });
    } catch (e) {
      dialog.notify("Erro ao adicionar ativo: " + String(e), "error");
    }
  }

  async function handleRemoveAtivoMotor(motorId: string, esteiraNome: string, ticker: string) {
    try {
      await removeAtivoFromMotorEsteira(portfolioId, motorId, esteiraNome, ticker);
      dispatch({ type: "REMOVE_ATIVO", motor_id: motorId, esteira_nome: esteiraNome, ticker });
    } catch (e) {
      dialog.notify("Erro ao remover ativo: " + String(e), "error");
    }
  }

  async function handlePatchArena(motorId: string, esteiraNome: string, arena: Arena) {
    try {
      await patchArenaEsteira(portfolioId, motorId, esteiraNome, arena);
      dispatch({ type: "PATCH_ARENA", motor_id: motorId, esteira_nome: esteiraNome, arena });
      dialog.notify("Arena da estratégia atualizada.", "success");
    } catch (e) {
      dialog.notify("Erro ao configurar a arena: " + String(e), "error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 100px)", margin: "-16px -22px" }}>
      {/* breadcrumb + ações */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <button className="btn ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={onExit}>
          ← Sair
        </button>
        <div style={{ fontSize: 12, color: "var(--tx3)", marginLeft: 8 }}>
          <span
            style={{ cursor: "pointer", color: nivel === 1 ? "var(--gold)" : "var(--tx3)" }}
            onClick={goNivel1}
          >
            {portfolioId}
          </span>
          {motorAtual && (
            <>
              {" › "}
              <span
                style={{ cursor: "pointer", color: nivel === 2 ? "var(--gold)" : "var(--tx3)" }}
                onClick={() => setNivel(2)}
              >
                Motor {motorAtual.id} ({motorAtual.nome})
              </span>
            </>
          )}
          {esteiraSelecionada && (
            <>
              {" › "}
              <span style={{ color: "var(--gold)" }}>{esteiraSelecionada.nome}</span>
            </>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn ghost" style={{ fontSize: 11 }} onClick={handleDiscard} disabled={isEmptyDiff(diff)}>
            Descartar
          </button>
          <button className="btn" style={{ fontSize: 11 }} onClick={handleSave} disabled={saving || isEmptyDiff(diff)}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* diff + backtest */}
      <div style={{ display: "flex", gap: 10, padding: "10px 16px" }}>
        <div style={{ flex: 1 }}>
          <DiffPanel diff={diff} />
        </div>
        <div style={{ flex: 2 }}>
          <BacktestBadge draft={draft} portfolioId={portfolioId} />
        </div>
      </div>

      {/* corpo */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {nivel === 1 && (
          <CanvasComposicao
            draft={draft}
            onAddMotor={(motor) => dispatch({ type: "ADD_MOTOR", motor })}
            onRemoveMotor={(motorId) => dispatch({ type: "REMOVE_MOTOR", motor_id: motorId })}
            onAddRegra={(regra) => dispatch({ type: "ADD_REGRA", regra })}
            onRemoveRegra={(regraId) => dispatch({ type: "REMOVE_REGRA", regra_id: regraId })}
            onActivatePerfil={(perfilId) => dispatch({ type: "ACTIVATE_PERFIL", perfil_id: perfilId })}
            onPatchPerfil={(perfilId, patch) =>
              dispatch({ type: "PATCH_PERFIL", perfil_id: perfilId, patch })
            }
            onDrillDownMotor={drillDownMotor}
          />
        )}

        {nivel === 2 && motorAtual && (
          <MotorStudio
            motor={motorAtual}
            onOpenEsteira={openEsteira}
            onAddEsteira={(pilarNome, esteiraNome, pesoPct) =>
              handleAddEsteiraMotor(motorAtual.id, pilarNome, esteiraNome, pesoPct)
            }
            onRemoveEsteira={(esteiraNome) => handleRemoveEsteiraMotor(motorAtual.id, esteiraNome)}
            onFork={handleForkMotor}
          />
        )}

        {nivel === 2 && !motorAtual && (
          <div className="c-mut" style={{ padding: 20 }}>
            Motor não encontrado no rascunho.
          </div>
        )}
      </div>

      {nivel === 3 && motorAtual && esteiraAtual && (
        <EsteiraStudio
          esteira={esteiraAtual}
          locked={motorAtual.status === "prod"}
          onAddAtivo={(ticker, pesoPct, tipo) =>
            handleAddAtivoMotor(motorAtual.id, esteiraAtual.nome, ticker, pesoPct, tipo)
          }
          onRemoveAtivo={(ticker) => handleRemoveAtivoMotor(motorAtual.id, esteiraAtual.nome, ticker)}
          onSaveArena={(arena) => handlePatchArena(motorAtual.id, esteiraAtual.nome, arena)}
          onClose={() => setNivel(2)}
        />
      )}

      {forking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "var(--z-dialog)" as never,
            color: "var(--tx)",
          }}
        >
          Criando fork…
        </div>
      )}
    </div>
  );
}

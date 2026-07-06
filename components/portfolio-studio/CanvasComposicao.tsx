"use client";
import { useMemo, useState } from "react";
import type { Composicao, MotorNoPortfolio, Regra } from "@/lib/portfolioComposicao";
import MotorCard from "./MotorCard";
import RegraNode from "./RegraNode";
import ConnectionsSVG, { type LayoutBox } from "./ConnectionsSVG";
import CatalogSidebar from "./CatalogSidebar";
import PerfilPanel from "./PerfilPanel";
import MaestroModal from "./MaestroModal";

interface RegistryMotor {
  id: string;
  nome: string;
  versao: string;
  status: string;
  descricao: string;
}

interface Props {
  draft: Composicao;
  onAddMotor: (motor: MotorNoPortfolio) => void;
  onRemoveMotor: (motorId: string) => void;
  onAddRegra: (regra: Regra) => void;
  onRemoveRegra: (regraId: string) => void;
  onActivatePerfil: (perfilId: string) => void;
  onPatchPerfil: (perfilId: string, patch: { w_min?: number; w_max?: number }) => void;
  onDrillDownMotor: (motorId: string) => void;
}

const MOTOR_W = 220;
const MOTOR_H = 140;
const REGRA_SIZE = 160;
const ROW_GAP_Y = 100;
const COL_GAP_X = 40;
const PAD = 30;

function nextLocalId(existing: string[]): string {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  return letters.find((c) => !existing.includes(c)) || `M${existing.length + 1}`;
}

export default function CanvasComposicao({
  draft,
  onAddMotor,
  onRemoveMotor,
  onAddRegra,
  onRemoveRegra,
  onActivatePerfil,
  onPatchPerfil,
  onDrillDownMotor,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [regraAbertaId, setRegraAbertaId] = useState<string | null>(null);

  const attackMotores = draft.motores.filter((m) => m.tipo !== "detector");
  const detectorMotores = draft.motores.filter((m) => m.tipo === "detector");
  const regraAberta = draft.regras.find((r) => r.id === regraAbertaId) || null;

  const { motorLayout, regraLayout, canvasW, canvasH } = useMemo(() => {
    const motorLayout = new Map<string, LayoutBox>();
    const regraLayout = new Map<string, LayoutBox>();

    attackMotores.forEach((m, i) => {
      motorLayout.set(m.id, {
        x: PAD + i * (MOTOR_W + COL_GAP_X),
        y: PAD,
        w: MOTOR_W,
        h: MOTOR_H,
      });
    });

    const regraY = PAD + MOTOR_H + ROW_GAP_Y;
    draft.regras.forEach((r, i) => {
      const connected = [r.fonte_sinal, ...r.alvos]
        .filter((id): id is string => !!id)
        .map((id) => motorLayout.get(id))
        .filter((b): b is LayoutBox => !!b);
      const avgX =
        connected.length > 0
          ? connected.reduce((s, b) => s + b.x + b.w / 2, 0) / connected.length - REGRA_SIZE / 2
          : PAD + i * (REGRA_SIZE + COL_GAP_X);
      regraLayout.set(r.id, { x: Math.max(PAD, avgX), y: regraY, w: REGRA_SIZE, h: REGRA_SIZE });
    });

    const detectorY = regraY + REGRA_SIZE + ROW_GAP_Y;
    detectorMotores.forEach((m, i) => {
      motorLayout.set(m.id, {
        x: PAD + i * (MOTOR_W + COL_GAP_X),
        y: draft.regras.length > 0 ? detectorY : regraY,
        w: MOTOR_W,
        h: MOTOR_H,
      });
    });

    const maxCols = Math.max(attackMotores.length, detectorMotores.length, 1);
    const canvasW = PAD * 2 + maxCols * (MOTOR_W + COL_GAP_X);
    const canvasH =
      PAD * 2 +
      MOTOR_H +
      (draft.regras.length > 0 ? ROW_GAP_Y + REGRA_SIZE : 0) +
      (detectorMotores.length > 0 ? ROW_GAP_Y + MOTOR_H : 0) +
      100;

    return { motorLayout, regraLayout, canvasW: Math.max(canvasW, 900), canvasH: Math.max(canvasH, 500) };
  }, [attackMotores, detectorMotores, draft.regras]);

  function buildMotorFromRegistry(rm: RegistryMotor): MotorNoPortfolio {
    const tipo: MotorNoPortfolio["tipo"] =
      rm.nome.toLowerCase().includes("defesa") || rm.nome.toLowerCase().includes("crs")
        ? "detector"
        : rm.nome.toLowerCase().includes("11") || rm.nome.toLowerCase().includes("etf")
        ? "attack_etfs"
        : "attack_stocks";
    const localId = nextLocalId(draft.motores.map((m) => m.id));
    return {
      id: localId,
      ref_motor_id: rm.id,
      nome: rm.nome,
      versao: rm.versao,
      tipo,
      status: "candidate",
      peso: { modo: tipo === "detector" ? "n/a" : "dinamico", regra_id: null, valor: null },
      estrutura: tipo === "detector" ? { formulas: [] } : { pilares: [] },
    };
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const motorRaw = e.dataTransfer.getData("application/x-motor-catalog");
    if (motorRaw) {
      const rm: RegistryMotor = JSON.parse(motorRaw);
      onAddMotor(buildMotorFromRegistry(rm));
      return;
    }
    const regraRaw = e.dataTransfer.getData("application/x-regra-catalog");
    if (regraRaw) {
      const t = JSON.parse(regraRaw);
      addRegraFromTemplate(t);
    }
  }

  function addRegraFromTemplate(t: { id: string; tipo: string; nome: string; descricao: string }) {
    const detector = draft.motores.find((m) => m.tipo === "detector");
    const alvos = draft.motores.filter((m) => m.tipo.startsWith("attack")).map((m) => m.id);
    const id = `regra_${Date.now().toString(36)}`;
    onAddRegra({
      id,
      tipo: "dynamic_mix",
      nome: t.nome,
      fonte_sinal: detector?.id ?? null,
      alvos,
      response_type: "step",
      threshold: 0.5,
      k_steep: 8,
      descricao: t.descricao,
    });
  }

  function handleAddMotorClick(rm: RegistryMotor) {
    onAddMotor(buildMotorFromRegistry(rm));
  }

  return (
    <div style={{ display: "flex", gap: 12, padding: 12, alignItems: "flex-start" }}>
      <CatalogSidebar
        onAddMotor={handleAddMotorClick}
        onAddRegraTemplate={addRegraFromTemplate}
        existingMotorIds={draft.motores.map((m) => m.id)}
      />

      <div
        style={{
          position: "relative",
          width: canvasW,
          height: canvasH,
          background: dragOver ? "rgba(201,160,44,.06)" : "rgba(0,0,0,.15)",
          border: `1px dashed ${dragOver ? "var(--gold)" : "var(--line)"}`,
          borderRadius: 8,
          overflow: "auto",
          flexShrink: 0,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <ConnectionsSVG
          regras={draft.regras}
          motorLayout={motorLayout}
          regraLayout={regraLayout}
          width={canvasW}
          height={canvasH}
        />

        {draft.motores.map((m) => {
          const box = motorLayout.get(m.id);
          if (!box) return null;
          return (
            <MotorCard
              key={m.id}
              motor={m}
              x={box.x}
              y={box.y}
              onDrillDown={onDrillDownMotor}
              onRemove={onRemoveMotor}
            />
          );
        })}

        {draft.regras.map((r) => {
          const box = regraLayout.get(r.id);
          if (!box) return null;
          return <RegraNode key={r.id} regra={r} x={box.x} y={box.y} onRemove={onRemoveRegra} onOpen={setRegraAbertaId} />;
        })}

        {draft.motores.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--tx3)",
              fontSize: 13,
              textAlign: "center",
              padding: 20,
            }}
          >
            Arraste um motor do catálogo à esquerda, ou clique num item da lista.
          </div>
        )}
      </div>

      <div style={{ width: 300, flexShrink: 0 }}>
        <PerfilPanel
          perfis={draft.perfis}
          adrTravas={draft.adr_travas}
          onActivate={onActivatePerfil}
          onPatch={onPatchPerfil}
        />
      </div>

      {regraAberta && (
        <MaestroModal
          regra={regraAberta}
          motoresAlvo={draft.motores.filter((m) => regraAberta.alvos.includes(m.id))}
          motorSensor={draft.motores.find((m) => m.id === regraAberta.fonte_sinal) || null}
          onClose={() => setRegraAbertaId(null)}
        />
      )}
    </div>
  );
}

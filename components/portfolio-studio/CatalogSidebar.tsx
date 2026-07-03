"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SeloBadge } from "./ArvoreViva";
import { seloMotorCatalogo } from "@/lib/homologacao";

interface RegistryMotor {
  id: string;
  nome: string;
  versao: string;
  status: string;
  descricao: string;
  metricas_homologacao?: { cagr?: number; sortino?: number; grade?: string };
}

interface RegraTemplate {
  id: string;
  tipo: string;
  nome: string;
  descricao: string;
}

const REGRA_TEMPLATES: RegraTemplate[] = [
  { id: "template-mix", tipo: "dynamic_mix", nome: "Dynamic Mix", descricao: "Redistribui carga entre motores de ataque a partir de um sinal de regime." },
];

interface Props {
  onAddMotor: (m: RegistryMotor) => void;
  onAddRegraTemplate: (t: RegraTemplate) => void;
  existingMotorIds: string[];
}

export default function CatalogSidebar({ onAddMotor, onAddRegraTemplate, existingMotorIds }: Props) {
  const [tab, setTab] = useState<"motores" | "regras">("motores");
  const [motores, setMotores] = useState<RegistryMotor[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiGet<{ motores: RegistryMotor[] }>("/v1/registry/motores")
      .then((d) => setMotores(d.motores || []))
      .catch(() => setMotores([]));
  }, []);

  const filteredMotores = motores.filter(
    (m) => !q || m.nome.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="card" style={{ padding: 10, width: 240, flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        <button
          className="btn ghost"
          style={{
            flex: 1,
            fontSize: 11,
            padding: "4px 6px",
            color: tab === "motores" ? "var(--gold)" : "var(--tx2)",
            borderColor: tab === "motores" ? "var(--gold)" : "var(--line)",
          }}
          onClick={() => setTab("motores")}
        >
          Motores
        </button>
        <button
          className="btn ghost"
          style={{
            flex: 1,
            fontSize: 11,
            padding: "4px 6px",
            color: tab === "regras" ? "var(--gold)" : "var(--tx2)",
            borderColor: tab === "regras" ? "var(--gold)" : "var(--line)",
          }}
          onClick={() => setTab("regras")}
        >
          Regras
        </button>
      </div>

      <input
        className="input"
        placeholder="buscar..."
        aria-label="Buscar motores e regras"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ fontSize: 11, padding: "4px 8px", marginBottom: 8 }}
      />

      {tab === "motores" && (
        <div style={{ display: "grid", gap: 6, maxHeight: 480, overflowY: "auto" }}>
          {filteredMotores.map((m) => {
            const usedIds = existingMotorIds.filter((id) => id.length <= 2);
            const nextLocalId = ["A", "B", "C", "D", "E"].find((c) => !usedIds.includes(c)) || "X";
            const homologado = m.status === "homologado";
            return (
              <div
                key={m.id}
                draggable={homologado}
                onDragStart={(e) => {
                  if (!homologado) { e.preventDefault(); return; }
                  e.dataTransfer.setData("application/x-motor-catalog", JSON.stringify(m));
                }}
                onClick={() => homologado && onAddMotor(m)}
                title={
                  homologado
                    ? `Clique ou arraste para adicionar como motor [${nextLocalId}]`
                    : "🔒 motor não homologado — precisa ser testado e homologado antes de entrar no construtor"
                }
                style={{
                  padding: 8,
                  border: "1px solid var(--line)",
                  borderRadius: 5,
                  cursor: homologado ? "grab" : "not-allowed",
                  opacity: homologado ? 1 : 0.45,
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--tx)" }}>{m.nome}</span>
                  <span style={{ marginLeft: "auto" }}>
                    <SeloBadge selo={seloMotorCatalogo(m.status)} size="sm" />
                  </span>
                </div>
                <div style={{ color: "var(--tx3)", marginTop: 2 }}>
                  v{m.versao}
                  {m.metricas_homologacao?.grade && ` · grade ${m.metricas_homologacao.grade}`}
                  {!homologado && <span style={{ color: "var(--red-text)" }}> · não pode ser adicionado</span>}
                </div>
              </div>
            );
          })}
          {filteredMotores.length === 0 && (
            <div className="c-mut" style={{ fontSize: 11, padding: 8 }}>
              Nenhum motor encontrado.
            </div>
          )}
        </div>
      )}

      {tab === "regras" && (
        <div style={{ display: "grid", gap: 6 }}>
          {REGRA_TEMPLATES.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-regra-catalog", JSON.stringify(t));
              }}
              onClick={() => onAddRegraTemplate(t)}
              title="Clique ou arraste para adicionar ao canvas"
              style={{
                padding: 8,
                border: "1px solid var(--line)",
                borderRadius: 5,
                cursor: "grab",
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--gold)" }}>{t.nome}</div>
              <div style={{ color: "var(--tx3)", marginTop: 2 }}>{t.descricao}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 10, lineHeight: 1.4 }}>
        Clique num item para adicionar ao canvas, ou arraste até a posição desejada.
      </div>
    </div>
  );
}

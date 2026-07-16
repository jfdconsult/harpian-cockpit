"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { fetchComposicao, type Composicao, type MotorNoPortfolio, type PilarNo, type EsteiraNo } from "@/lib/portfolioComposicao";
import { seloMotor, seloPortfolio, seloEtp, type Selo } from "@/lib/homologacao";
import type { ScreenId } from "@/lib/nav";

// ============================================================
// THE LIVING TREE — the map of the entire structure, at a glance.
// ETP (road) → Portfolio (car) → Engine (⚔️ attack/🛡️ defense/🌡️ sensor)
//   → Pillar (piston) → Strategy (competition arena) → assets.
// Each piece carries its validation seal — the security key.
// ============================================================

interface Etp {
  id: string; nome: string; isin: string | null; portfolio_ids: string[];
  status: "listed" | "candidate"; aum_usd: number;
}
interface PortfolioSummary {
  id: string; nome: string; descricao?: string; motor: string; estado: string; mode: string;
}

export function SeloBadge({ selo, size = "md" }: { selo: Selo; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      title={selo.label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: "var(--mono)", fontSize: small ? 9.5 : 10.5, fontWeight: 700,
        color: selo.color, background: selo.bg, border: `1px solid ${selo.border}`,
        borderRadius: 999, padding: small ? "1px 7px" : "2px 9px", whiteSpace: "nowrap",
        textTransform: "uppercase", letterSpacing: 0.3,
      }}
    >
      {selo.emoji} {selo.label}
    </span>
  );
}

function Twisty({ open }: { open: boolean }) {
  return (
    <i
      className="ti ti-chevron-right"
      style={{ fontSize: 13, color: "var(--tx3)", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none", flexShrink: 0 }}
    />
  );
}

function Row({
  depth, icon, label, meta, selo, onClick, expandable, open, tone,
}: {
  depth: number; icon: string; label: React.ReactNode; meta?: React.ReactNode;
  selo?: Selo; onClick?: () => void; expandable?: boolean; open?: boolean;
  tone?: "atk" | "def" | "sensor";
}) {
  const toneColor = tone === "atk" ? "#37c98a" : tone === "def" ? "#4a90d9" : tone === "sensor" ? "#f0a83a" : undefined;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px", paddingLeft: 10 + depth * 22,
        borderRadius: 6, cursor: onClick ? "pointer" : "default",
        transition: "background .1s",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.background = "rgba(201,160,44,.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {expandable ? <Twisty open={!!open} /> : <span style={{ width: 13, flexShrink: 0 }} />}
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontWeight: depth <= 1 ? 700 : 600, fontSize: depth <= 1 ? 13.5 : 12.5, color: toneColor || "var(--tx)" }}>
        {label}
      </span>
      {meta && <span style={{ fontSize: 11, color: "var(--tx3)" }}>{meta}</span>}
      {selo && <span style={{ marginLeft: "auto" }}><SeloBadge selo={selo} size={depth >= 2 ? "sm" : "md"} /></span>}
    </div>
  );
}

const MOTOR_ICON: Record<string, { icon: string; tone: "atk" | "def" | "sensor"; label: string }> = {
  attack_stocks: { icon: "⚔️", tone: "atk", label: "attack · stocks" },
  attack_etfs: { icon: "⚔️", tone: "atk", label: "attack · ETFs" },
  custom: { icon: "⚔️", tone: "atk", label: "attack · custom" },
  defense: { icon: "🛡️", tone: "def", label: "defense" },
  detector: { icon: "🌡️", tone: "sensor", label: "sensor · thermometer" },
};

function MotorNode({ motor, depth, go, portfolioId }: { motor: MotorNoPortfolio; depth: number; go?: (id: ScreenId, param?: string) => void; portfolioId: string }) {
  const [open, setOpen] = useState(false);
  const meta = MOTOR_ICON[motor.tipo] || MOTOR_ICON.custom;
  const pilares: PilarNo[] = "pilares" in motor.estrutura ? motor.estrutura.pilares : [];
  const hasChildren = pilares.length > 0;

  return (
    <>
      <Row
        depth={depth} icon={meta.icon} label={motor.nome} meta={`· ${meta.label}`}
        selo={seloMotor(motor.status)} tone={meta.tone}
        expandable={hasChildren} open={open}
        onClick={() => (hasChildren ? setOpen((o) => !o) : go?.("portfolio-studio", portfolioId))}
      />
      {open && pilares.map((pilar) => (
        <PilarNode key={pilar.nome} pilar={pilar} depth={depth + 1} go={go} portfolioId={portfolioId} />
      ))}
    </>
  );
}

function PilarNode({ pilar, depth, go, portfolioId }: { pilar: PilarNo; depth: number; go?: (id: ScreenId, param?: string) => void; portfolioId: string }) {
  const [open, setOpen] = useState(false);
  const nomeVisivel = pilar.nome === "__sem_pilar__" ? "(no pillar)" : pilar.nome;
  return (
    <>
      <Row
        depth={depth} icon="🔩" label={nomeVisivel}
        meta={`· piston · ${pilar.esteiras.length} strateg${pilar.esteiras.length === 1 ? "y" : "ies"}`}
        expandable={pilar.esteiras.length > 0} open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && pilar.esteiras.map((est) => (
        <EstrategiaNode key={est.nome} estrategia={est} depth={depth + 1} go={go} portfolioId={portfolioId} />
      ))}
    </>
  );
}

function EstrategiaNode({ estrategia, depth, go, portfolioId }: { estrategia: EsteiraNo; depth: number; go?: (id: ScreenId, param?: string) => void; portfolioId: string }) {
  const tickers = estrategia.ativos.slice(0, 6).map((a) => a.ticker).join(", ");
  const resto = estrategia.ativos.length > 6 ? ` +${estrategia.ativos.length - 6}` : "";
  return (
    <Row
      depth={depth} icon="🎯" label={estrategia.nome}
      meta={`· ${estrategia.ativos.length} asset${estrategia.ativos.length === 1 ? "" : "s"} competing${tickers ? ` · ${tickers}${resto}` : ""}`}
      onClick={() => go?.("portfolio-studio", portfolioId)}
    />
  );
}

function PortfolioNode({
  summary, go, onOpen,
}: {
  summary: PortfolioSummary;
  go?: (id: ScreenId, param?: string) => void;
  onOpen: (p: PortfolioSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [comp, setComp] = useState<Composicao | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !comp) {
      setLoading(true);
      fetchComposicao(summary.id).then(setComp).catch(() => {}).finally(() => setLoading(false));
    }
  }

  const nMotores = comp?.motores.length ?? null;
  const ataque = comp?.motores.filter((m) => m.tipo !== "detector" && m.tipo !== "defense").length ?? 0;
  const defesa = comp?.motores.filter((m) => m.tipo === "defense").length ?? 0;

  return (
    <>
      <Row
        depth={1} icon="🚗" label={summary.nome || summary.id}
        meta={nMotores != null ? `· ${nMotores} engine${nMotores === 1 ? "" : "s"} (${ataque} attack · ${defesa} defense)` : summary.mode === "model" ? "· model" : "· active"}
        selo={seloPortfolio(summary.estado)}
        expandable open={open}
        onClick={toggle}
      />
      {open && loading && <Row depth={2} icon="…" label={<span style={{ color: "var(--tx3)" }}>loading composition…</span>} />}
      {open && comp && comp.motores.length === 0 && (
        <Row depth={2} icon="—" label={<span style={{ color: "var(--tx3)" }}>no engine assembled yet</span>} onClick={() => onOpen(summary)} />
      )}
      {open && comp && comp.motores.map((m) => (
        <MotorNode key={m.id} motor={m} depth={2} go={go} portfolioId={summary.id} />
      ))}
      {open && comp && (
        <Row
          depth={2} icon="✏️"
          label={<span style={{ color: "var(--gold)" }}>Open in the Workbench (Portfolio Studio) →</span>}
          onClick={() => onOpen(summary)}
        />
      )}
    </>
  );
}

export default function ArvoreViva({ go, onOpenPortfolio }: { go?: (id: ScreenId, param?: string) => void; onOpenPortfolio: (p: PortfolioSummary) => void }) {
  const [etps, setEtps] = useState<Etp[] | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioSummary[] | null>(null);
  const [openEtps, setOpenEtps] = useState<Record<string, boolean>>({});
  const [conn, setConn] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    Promise.all([
      apiGet<{ etps: Etp[] }>("/v1/registry/etps"),
      apiGet<{ portfolios: PortfolioSummary[] }>("/v1/strategies/"),
    ])
      .then(([a, b]) => {
        setEtps(a.etps);
        setPortfolios(b.portfolios);
        setOpenEtps(Object.fromEntries(a.etps.map((e) => [e.id, true])));
        setConn("ok");
      })
      .catch(() => setConn("error"));
  }, []);

  if (conn === "loading") {
    return <div className="c-mut" style={{ padding: 24, textAlign: "center" }}>Loading the structure…</div>;
  }
  if (conn === "error" || !etps || !portfolios) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--red)" }}>Could not load the tree. API offline?</div>;
  }

  const portfolioById = new Map(portfolios.map((p) => [p.id, p]));
  const idsComEtp = new Set(etps.flatMap((e) => e.portfolio_ids));
  const portfoliosOrfaos = portfolios.filter((p) => !idsComEtp.has(p.id));

  return (
    <div className="card" style={{ padding: "10px 6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 14px" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--gold)", fontWeight: 700 }}>
            The Living Tree
          </div>
          <div style={{ fontSize: 11.5, color: "var(--tx3)", marginTop: 2 }}>
            Road → Car → Engines → Pistons → Strategies. Click a piece to open the Workbench.
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--tx3)" }}>
          <span>🟢 validated</span><span>🟡 candidate</span><span>🔴 not validated</span>
        </div>
      </div>

      {etps.map((etp) => {
        const ps = etp.portfolio_ids.map((pid) => portfolioById.get(pid)).filter((p): p is PortfolioSummary => !!p);
        const faltando = etp.portfolio_ids.filter((pid) => !portfolioById.has(pid));
        const open = openEtps[etp.id];
        return (
          <div key={etp.id}>
            <Row
              depth={0} icon="🛣️" label={etp.nome}
              meta={`${etp.isin ? `· ${etp.isin} ` : ""}${etp.portfolio_ids.length === 2 ? "· 2 portfolios" : ""}`}
              selo={seloEtp(etp.status)}
              expandable open={open}
              onClick={() => setOpenEtps((s) => ({ ...s, [etp.id]: !s[etp.id] }))}
            />
            {open && ps.map((p) => <PortfolioNode key={p.id} summary={p} go={go} onOpen={onOpenPortfolio} />)}
            {open && faltando.map((pid) => (
              <Row key={pid} depth={1} icon="⚠️" label={<span style={{ color: "var(--orange)" }}>portfolio {pid} not found</span>} />
            ))}
          </div>
        );
      })}

      {portfoliosOrfaos.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
          <div style={{ padding: "4px 14px 8px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--tx3)" }}>
            Model portfolios · no ETP yet (lab)
          </div>
          {portfoliosOrfaos.map((p) => (
            <PortfolioNode key={p.id} summary={p} go={go} onOpen={onOpenPortfolio} />
          ))}
        </div>
      )}
    </div>
  );
}

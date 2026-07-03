"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import PortfolioStudio from "../portfolio-studio/PortfolioStudio";
import { fetchComposicao, type Composicao } from "@/lib/portfolioComposicao";
import { portfolioDraftReducer, EMPTY_COMPOSICAO } from "@/lib/portfolioDraft";

interface Props {
  portfolioId: string;
  onExit: () => void;
}

export default function PortfolioStudioScreen({ portfolioId, onExit }: Props) {
  const [draft, dispatch] = useReducer(portfolioDraftReducer, EMPTY_COMPOSICAO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef<Composicao>(EMPTY_COMPOSICAO);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchComposicao(portfolioId)
      .then((comp) => {
        if (cancelled) return;
        snapshotRef.current = comp;
        dispatch({ type: "LOAD", composicao: comp });
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [portfolioId]);

  function reloadSnapshot(comp: Composicao) {
    snapshotRef.current = comp;
    dispatch({ type: "LOAD", composicao: comp });
  }

  if (loading) {
    return (
      <div className="c-mut" style={{ padding: 40, textAlign: "center" }}>
        Carregando composição de {portfolioId}…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--red)" }}>
        Erro ao carregar {portfolioId}: {error}
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={onExit}>
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <PortfolioStudio
      portfolioId={portfolioId}
      draft={draft}
      dispatch={dispatch}
      snapshot={snapshotRef.current}
      onSaved={reloadSnapshot}
      onExit={onExit}
    />
  );
}

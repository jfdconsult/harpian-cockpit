"use client";
import { useEffect, useState } from "react";
import Topbar from "./Topbar";
import MissionControl from "./screens/MissionControl";
import EngineRoom from "./screens/EngineRoom";
import Ativos from "./screens/Ativos";
import Tickets from "./screens/Tickets";
import Estrategias from "./screens/Estrategias";
import Backtest from "./screens/Backtest";
import Calibracao from "./screens/Calibracao";
import Protecao from "./screens/Protecao";
import DefesaInteligente from "./screens/DefesaInteligente";
import Xri from "./screens/Xri";
import Indicadores from "./screens/Indicadores";
import Reconciliacao from "./screens/Reconciliacao";
import Observador from "./screens/Observador";
import Auditoria from "./screens/Auditoria";
import Admin from "./screens/Admin";
import Chart from "./screens/Chart";
import Cotacoes from "./screens/Cotacoes";
import Calendar from "./screens/Calendar";
import Setores from "./screens/Setores";
import AlphaDroid from "./screens/AlphaDroid";
import StrategiesStrength from "./screens/StrategiesStrength";
import PortfolioScreen from "./screens/Portfolio";
import Regime from "./screens/Regime";
import Noticias from "./screens/Noticias";
import NewsBroadcast from "./screens/NewsBroadcast";
import SocialRadar from "./screens/SocialRadar";
import InsiderOrders from "./screens/InsiderOrders";
import Institutional from "./screens/Institutional";
import CotSentiment from "./screens/CotSentiment";
import CotLegacy from "./screens/CotLegacy";
import MarketDna from "./screens/MarketDna";
import Construtor from "./screens/Construtor";
import TicketNews from "./screens/TicketNews";
import PortfolioStudioScreen from "./screens/PortfolioStudioScreen";
import PortfolioBuilder from "./screens/PortfolioBuilder";
import Placeholder from "./screens/Placeholder";
import JimDrawer from "./JimDrawer";
import NewsTicker from "./NewsTicker";
import SettingsDrawer from "./SettingsDrawer";
import { DialogProvider } from "./ui/Dialog";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { isScreenId, type ScreenId } from "@/lib/nav";

export default function Cockpit() {
  const [screen, setScreen] = useState<ScreenId>("mission-control");
  const [chartTicker, setChartTicker] = useState<string | undefined>(undefined);
  const [cotacoesClasse, setCotacoesClasse] = useState<string>("acoes");
  const [portfolioId, setPortfolioId] = useState<string>("HPC22");
  const [studioPid, setStudioPid] = useState<string>("HPC22");
  const [previousScreen, setPreviousScreen] = useState<ScreenId>("admin");
  const [jimOpen, setJimOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const go = (id: ScreenId, param?: string) => {
    if (id === "portfolio-studio") {
      setPreviousScreen(screen);
      if (param) setStudioPid(param);
    }
    setScreen(id);
    if (id === "chart" && param) setChartTicker(param);
    if (id === "cotacoes" && param) setCotacoesClasse(param);
    if (id === "portfolio" && param) setPortfolioId(param);
    if (typeof window !== "undefined") {
      // deixa a tela no endereco: permite link direto e recarregar sem cair no
      // Mission Control. Os menus abrem por hover, entao sem isso a unica forma
      // de chegar numa tela e passar o mouse pelo menu certo.
      const alvo = "#" + id + (param ? "/" + encodeURIComponent(param) : "");
      if (window.location.hash !== alvo) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search + alvo);
      }
      window.scrollTo(0, 0);
    }
  };

  // abre direto na tela pedida pelo endereco (#portfolio-builder, #backtest, ...)
  useEffect(() => {
    const abrirDoHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (!h) return;
      const [id, param] = h.split("/");
      if (isScreenId(id)) go(id, param ? decodeURIComponent(param) : undefined);
    };
    abrirDoHash();
    window.addEventListener("hashchange", abrirDoHash);
    return () => window.removeEventListener("hashchange", abrirDoHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderScreen() {
    switch (screen) {
      case "mission-control":
        return <MissionControl go={go} />;
      case "engine-room":
        return <EngineRoom />;
      case "ativos":
        return <Ativos go={go} />;
      case "ticket":
        return <Tickets go={go} />;
      case "estrategias":
        return <Estrategias go={go} />;
      case "backtest":
        return <Backtest />;
      case "calibracao":
        return <Calibracao />;
      case "protecao":
        return <Protecao go={go} />;
      case "indicadores":
        return <Indicadores />;
      case "defesa-inteligente":
        return <DefesaInteligente />;
      case "xri":
        return <Xri />;
      case "reconciliacao":
        return <Reconciliacao go={go} />;
      case "observador":
        return <Observador />;
      case "auditoria":
        return <Auditoria go={go} />;
      case "admin":
        return <Admin go={go} />;
      case "chart":
        return <Chart ticker={chartTicker || "NVDA"} go={go} />;
      case "cotacoes":
        return <Cotacoes classe={cotacoesClasse} go={go} />;
      case "calendar":
        return <Calendar />;
      case "setores":
        return <Setores go={go} />;
      case "alphadroid":
        return <AlphaDroid go={go} />;
      case "strategies-strength":
        return <StrategiesStrength go={go} />;
      case "portfolio":
        return <PortfolioScreen portfolioId={portfolioId} go={go} />;
      case "portfolio-builder":
        return <PortfolioBuilder />;
      case "regime":
        return <Regime />;
      case "noticias":
        return <Noticias go={go} />;
      case "news-broadcast":
        return <NewsBroadcast />;
      case "social-radar":
        return <SocialRadar />;
      case "insider-orders":
        return <InsiderOrders />;
      case "institutional":
        return <Institutional />;
      case "cot-sentiment":
        return <CotSentiment />;
      case "cot-legacy":
        return <CotLegacy />;
      case "market-dna":
        return <MarketDna />;
      case "construtor":
        return <Construtor go={go} />;
      case "ticket-news":
        return <TicketNews go={go} />;
      case "portfolio-studio":
        return <PortfolioStudioScreen portfolioId={studioPid} onExit={() => go(previousScreen)} />;
      default:
        return <Placeholder title={String(screen)} />;
    }
  }

  return (
    <ThemeProvider>
    <I18nProvider>
    <DialogProvider>
      <div className="app">
        <NewsTicker go={go} />
        <Topbar go={go} jimOpen={jimOpen} onJimToggle={() => setJimOpen(!jimOpen)} onSettingsToggle={() => setSettingsOpen(!settingsOpen)} />
        {/* --pb-sticky-top: altura do cabecalho fixo do Cockpit (ticker 34px +
            topbar 52px = 86px). Sem isto, a regua de KPIs sticky do Portfolio
            Builder tenta colar em top:0 da viewport e fica escondida atras do
            ticker+topbar em vez de ficar visivel logo abaixo deles. */}
        <div className="main" style={{ ["--pb-sticky-top" as unknown as string]: "86px" } as React.CSSProperties}>{renderScreen()}</div>
        <JimDrawer open={jimOpen} onClose={() => setJimOpen(false)} screen={screen} />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </DialogProvider>
    </I18nProvider>
    </ThemeProvider>
  );
}

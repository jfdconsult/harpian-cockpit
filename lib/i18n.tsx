"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type Lang = "pt" | "en";

const dict: Record<string, Record<Lang, string>> = {
  "mission_control": { pt: "Mission Control", en: "Mission Control" },
  "estado_ao_vivo": { pt: "Estado ao vivo dos portfólios, mudanças do dia e tickets — direto da API /v1.", en: "Live portfolio state, daily changes and tickets — straight from the API /v1." },
  "total_alocado": { pt: "Total alocado", en: "Total allocated" },
  "portfolios": { pt: "portfólios", en: "portfolios" },
  "mudancas_hoje": { pt: "Mudanças hoje", en: "Changes today" },
  "tickets_pendentes": { pt: "Tickets pendentes", en: "Pending tickets" },
  "regime_global": { pt: "Regime global", en: "Global regime" },
  "ocultar_inativos": { pt: "Ocultar inativos", en: "Hide inactive" },
  "mostrar_inativos": { pt: "Mostrar inativos", en: "Show inactive" },
  "role_para_ver_mais": { pt: "role para ver mais", en: "scroll for more" },
  "api_ao_vivo": { pt: "API ao vivo", en: "API live" },
  "tickets_do_dia": { pt: "TICKETS DO DIA · A EXECUTAR", en: "TODAY'S TICKETS · TO EXECUTE" },
  "mercado_ao_vivo": { pt: "MERCADO · AO VIVO", en: "MARKET · LIVE" },
  "ativo": { pt: "ATIVO", en: "ASSET" },
  "lado": { pt: "LADO", en: "SIDE" },
  "portfolio_col": { pt: "PORTFÓLIO", en: "PORTFOLIO" },
  "valor": { pt: "VALOR", en: "VALUE" },
  "status": { pt: "STATUS", en: "STATUS" },
  "ticker": { pt: "TICKER", en: "TICKER" },
  "nome": { pt: "NOME", en: "NAME" },
  "ultimo": { pt: "ÚLTIMO", en: "LAST" },
  "dia": { pt: "DIA", en: "DAY" },
  "executar": { pt: "Executar", en: "Execute" },
  "comprar": { pt: "COMPRAR", en: "BUY" },
  "vender": { pt: "VENDER", en: "SELL" },
  "pendente": { pt: "pendente", en: "pending" },
  "todos_portfolios": { pt: "Todos os portfólios", en: "All portfolios" },
  "configuracoes": { pt: "Configurações", en: "Settings" },
  "tema": { pt: "Tema", en: "Theme" },
  "idioma": { pt: "Idioma", en: "Language" },
  "notificacoes": { pt: "Notificações", en: "Notifications" },
  "tema_navy": { pt: "Navy (Padrão)", en: "Navy (Default)" },
  "tema_light": { pt: "Claro", en: "Light" },
  "tema_dark": { pt: "Escuro", en: "Dark" },
  "portugues": { pt: "Português", en: "Portuguese" },
  "ingles": { pt: "Inglês", en: "English" },
  "email_matinal": { pt: "Email matinal", en: "Morning email" },
  "email_matinal_desc": { pt: "Receba lista de tarefas, notícias e calendário econômico.", en: "Receive task list, news and economic calendar." },
  "horario_envio": { pt: "Horário de envio", en: "Send time" },
  "fuso_horario": { pt: "Fuso horário", en: "Timezone" },
  "salvar": { pt: "Salvar", en: "Save" },
  "fechar": { pt: "Fechar", en: "Close" },
  "missao": { pt: "Missão", en: "Mission" },
  "motores": { pt: "Motores", en: "Engines" },
  "ordens": { pt: "Ordens", en: "Orders" },
  "laboratorio": { pt: "Laboratório", en: "Laboratory" },
  "defesa": { pt: "Defesa", en: "Defense" },
  "mercado": { pt: "Mercado", en: "Market" },
  "inteligencia": { pt: "Intelligence", en: "Intelligence" },
  "auditoria": { pt: "Auditoria", en: "Audit" },
  "admin": { pt: "Admin", en: "Admin" },
  "noticias": { pt: "Notícias", en: "News" },
  "calendario_fed": { pt: "CALENDÁRIO FED", en: "FED CALENDAR" },
  "social_radar": { pt: "SOCIAL RADAR", en: "SOCIAL RADAR" },
  "ativo_mode": { pt: "ATIVO", en: "ACTIVE" },
  "modelo_mode": { pt: "MODELO", en: "MODEL" },
  "ordens_executam": { pt: "ORDENS EXECUTAM VIA IBKR", en: "ORDERS EXECUTE VIA IBKR" },
  "ordens_nao_executam": { pt: "ORDENS NÃO EXECUTAM · SIMULAÇÃO", en: "ORDERS DO NOT EXECUTE · SIMULATION" },
  "exposicao": { pt: "Exposição", en: "Exposure" },
  "dd_do_mes": { pt: "DD do mês", en: "Month DD" },
  "risk_number": { pt: "Risk Number", en: "Risk Number" },
  "owner": { pt: "Owner", en: "Owner" },
  "capital_simbolico": { pt: "Capital simbólico", en: "Symbolic capital" },
  "alocado": { pt: "Alocado", en: "Allocated" },
  "conta_ibkr": { pt: "IBKR account", en: "IBKR account" },
  "email_placeholder": { pt: "seu@email.com", en: "your@email.com" },
  "notif_salvas": { pt: "Configurações salvas!", en: "Settings saved!" },
  "detectado_auto": { pt: "Detectado automaticamente", en: "Auto-detected" },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {}, t: (k) => k });

const STORAGE_KEY = "harpian-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && ["pt", "en"].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    if (l === lang) return;
    const msg = lang === "pt"
      ? "O site será recarregado no novo idioma. Deseja continuar?"
      : "The site will reload in the new language. Continue?";
    if (!window.confirm(msg)) return;
    localStorage.setItem(STORAGE_KEY, l);
    window.location.reload();
  };

  const t = useCallback((key: string): string => {
    return dict[key]?.[lang] ?? key;
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

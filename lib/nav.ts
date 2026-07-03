// ============================================================
// HARPIAN COCKPIT GESTOR — Navegação (menus + dropdowns, padrão Terminal)
// ============================================================
export type ScreenId =
  | "mission-control"
  | "engine-room"
  | "ativos"
  | "ticket"
  | "estrategias"
  | "backtest"
  | "calibracao"
  | "protecao"
  | "indicadores"
  | "reconciliacao"
  | "observador"
  | "auditoria"
  | "admin"
  | "chart"
  | "setores"
  | "alphadroid"
  | "strategies-strength"
  | "portfolio"
  | "regime"
  | "noticias"
  | "news-broadcast"
  | "social-radar"
  | "insider-orders"
  | "institutional"
  | "cot-sentiment"
  | "cot-legacy"
  | "portfolio-studio";

export interface MenuItem {
  id: ScreenId;
  label: string;
  icon: string;
  tag?: string;
  param?: string;
}
export interface MenuColumn {
  label?: string;
  items: MenuItem[];
}
export interface Menu {
  label: string;
  icon: string;
  direct?: ScreenId;
  wide?: boolean;
  columns?: MenuColumn[];
}

export const MENUS: Menu[] = [
  { label: "Missão", icon: "ti-command", direct: "mission-control" },
  {
    label: "Motores",
    icon: "ti-engine",
    columns: [
      {
        items: [
          { id: "engine-room", label: "Engine Room", icon: "ti-cpu" },
          { id: "estrategias", label: "Estratégias / ETPs", icon: "ti-hierarchy" },
          { id: "alphadroid", label: "Setores · Forças", icon: "ti-chart-bar", tag: "+ criar" },
          { id: "strategies-strength", label: "Estratégias · Forças", icon: "ti-target", tag: "+ criar" },
          { id: "ativos", label: "Ativos (scanner)", icon: "ti-radar-2" },
          { id: "chart", label: "Gráfico DSPT", icon: "ti-chart-candle" },
        ],
      },
    ],
  },
  {
    label: "Ordens",
    icon: "ti-send",
    columns: [
      {
        items: [
          { id: "ticket", label: "Tickets do dia", icon: "ti-ticket", tag: "IBKR" },
          { id: "reconciliacao", label: "Reconciliação", icon: "ti-checks" },
        ],
      },
    ],
  },
  {
    label: "Laboratório",
    icon: "ti-flask",
    columns: [
      {
        items: [
          { id: "backtest", label: "Backtest Lab", icon: "ti-history" },
          { id: "calibracao", label: "Calibração", icon: "ti-adjustments" },
          { id: "observador", label: "Observador (IA)", icon: "ti-eye-search" },
        ],
      },
    ],
  },
  {
    label: "Defesa",
    icon: "ti-shield-half",
    columns: [
      {
        items: [
          { id: "protecao", label: "Proteção & Defesa", icon: "ti-shield-check" },
          { id: "indicadores", label: "Indicadores sistêmicos", icon: "ti-activity" },
        ],
      },
    ],
  },
  {
    label: "Mercado",
    icon: "ti-radar",
    columns: [
      {
        items: [
          { id: "regime", label: "Regime de mercado", icon: "ti-activity" },
          { id: "noticias", label: "Notícias", icon: "ti-news" },
        ],
      },
    ],
  },
  {
    label: "Intelligence",
    icon: "ti-building",
    columns: [
      {
        items: [
          { id: "social-radar", label: "Social Radar", icon: "ti-radar-2", tag: "novo" },
          { id: "news-broadcast", label: "News Broadcast", icon: "ti-broadcast", tag: "novo" },
          { id: "insider-orders", label: "Insider Orders", icon: "ti-gavel", tag: "novo" },
          { id: "institutional", label: "13F Holdings", icon: "ti-report-money", tag: "SEC" },
          { id: "cot-sentiment", label: "COT Intelligence", icon: "ti-flame", tag: "CFTC" },
          { id: "cot-legacy", label: "COT Data Explorer", icon: "ti-chart-bar" },
        ],
      },
    ],
  },
  { label: "Auditoria", icon: "ti-notebook", direct: "auditoria" },
  { label: "Admin", icon: "ti-settings", direct: "admin" },
];

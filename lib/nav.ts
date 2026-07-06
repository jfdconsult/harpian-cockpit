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
  | "defesa-inteligente"
  | "indicadores"
  | "reconciliacao"
  | "observador"
  | "auditoria"
  | "admin"
  | "chart"
  | "cotacoes"
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
  | "market-dna"
  | "portfolio-studio"
  | "construtor";

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
          { id: "construtor", label: "Construtor", icon: "ti-puzzle", tag: "criar" },
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
          { id: "defesa-inteligente", label: "Defesa Inteligente", icon: "ti-shield-bolt", tag: "novo" },
          { id: "protecao", label: "Proteção & Defesa", icon: "ti-shield-check" },
          { id: "indicadores", label: "Indicadores sistêmicos", icon: "ti-activity" },
          { id: "regime", label: "Regime de mercado", icon: "ti-activity" },
        ],
      },
    ],
  },
  {
    label: "Mercado",
    icon: "ti-chart-candle",
    columns: [
      {
        label: "Cotações",
        items: [
          { id: "cotacoes", label: "Ações", icon: "ti-building-bank", param: "acoes" },
          { id: "cotacoes", label: "ETFs", icon: "ti-layers-intersect", param: "etfs" },
          { id: "cotacoes", label: "Commodities", icon: "ti-flame", param: "commodities" },
          { id: "cotacoes", label: "Cripto", icon: "ti-currency-bitcoin", param: "cripto" },
          { id: "cotacoes", label: "Índices internacionais", icon: "ti-world", param: "indices" },
          { id: "cotacoes", label: "Forex (câmbio)", icon: "ti-arrows-exchange", param: "forex" },
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
          { id: "market-dna", label: "Market DNA", icon: "ti-dna-2", tag: "novo" },
        ],
      },
    ],
  },
  { label: "Auditoria", icon: "ti-notebook", direct: "auditoria" },
  { label: "Admin", icon: "ti-settings", direct: "admin" },
];

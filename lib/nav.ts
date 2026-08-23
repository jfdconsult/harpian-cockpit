// ============================================================
// HARPIAN COCKPIT MANAGER — Navigation (menus + dropdowns, Terminal pattern)
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
  | "xri"
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
  | "fundamentos"
  | "portfolio-studio"
  | "portfolio-builder"
  | "construtor"
  | "ticket-news"
  | "calendar";

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
  { label: "Mission", icon: "ti-command", direct: "mission-control" },
  {
    label: "Engines",
    icon: "ti-engine",
    columns: [
      {
        items: [
          { id: "engine-room", label: "Engine Room", icon: "ti-cpu" },
          { id: "estrategias", label: "Strategies / ETPs", icon: "ti-hierarchy" },
          { id: "alphadroid", label: "Sectors · Strength", icon: "ti-chart-bar", tag: "+ create" },
          { id: "strategies-strength", label: "Strategies · Strength", icon: "ti-target", tag: "+ create" },
          { id: "ativos", label: "Assets (scanner)", icon: "ti-radar-2" },
          { id: "chart", label: "DSPT Chart", icon: "ti-chart-candle" },
        ],
      },
    ],
  },
  {
    label: "Orders",
    icon: "ti-send",
    columns: [
      {
        items: [
          { id: "ticket", label: "Today's Tickets", icon: "ti-ticket", tag: "IBKR" },
          { id: "ticket-news", label: "Ticket News", icon: "ti-news", tag: "new" },
          { id: "reconciliacao", label: "Reconciliation", icon: "ti-checks" },
        ],
      },
    ],
  },
  {
    label: "Lab",
    icon: "ti-flask",
    columns: [
      {
        items: [
          { id: "construtor", label: "Builder", icon: "ti-puzzle", tag: "create" },
          { id: "portfolio-builder", label: "Portfolio Builder", icon: "ti-layout-grid-add", tag: "new" },
          { id: "backtest", label: "Backtest Lab", icon: "ti-history" },
          { id: "calibracao", label: "Calibration", icon: "ti-adjustments" },
          { id: "observador", label: "Observer (AI)", icon: "ti-eye-search" },
        ],
      },
    ],
  },
  {
    label: "Defense",
    icon: "ti-shield-half",
    columns: [
      {
        items: [
          { id: "defesa-inteligente", label: "Smart Defense", icon: "ti-shield-bolt", tag: "new" },
          { id: "xri", label: "External Risk (XRI)", icon: "ti-world-exclamation", tag: "new" },
          { id: "protecao", label: "Protection & Defense", icon: "ti-shield-check" },
          { id: "indicadores", label: "Systemic Indicators", icon: "ti-activity" },
          { id: "regime", label: "Market Regime", icon: "ti-activity" },
        ],
      },
    ],
  },
  {
    label: "Market",
    icon: "ti-chart-candle",
    columns: [
      {
        label: "Quotes",
        items: [
          { id: "cotacoes", label: "Stocks", icon: "ti-building-bank", param: "acoes" },
          { id: "cotacoes", label: "ETFs", icon: "ti-layers-intersect", param: "etfs" },
          { id: "cotacoes", label: "Commodities", icon: "ti-flame", param: "commodities" },
          { id: "cotacoes", label: "Crypto", icon: "ti-currency-bitcoin", param: "cripto" },
          { id: "cotacoes", label: "International Indices", icon: "ti-world", param: "indices" },
          { id: "cotacoes", label: "Forex (FX)", icon: "ti-arrows-exchange", param: "forex" },
        ],
      },
      {
        label: "Agenda",
        items: [
          { id: "calendar", label: "Calendar", icon: "ti-calendar-event", tag: "new" },
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
          { id: "social-radar", label: "Social Radar", icon: "ti-radar-2", tag: "new" },
          { id: "news-broadcast", label: "News Broadcast", icon: "ti-broadcast", tag: "new" },
          { id: "insider-orders", label: "Insider Orders", icon: "ti-gavel", tag: "new" },
          { id: "institutional", label: "13F Holdings", icon: "ti-report-money", tag: "SEC" },
          { id: "cot-sentiment", label: "COT Intelligence", icon: "ti-flame", tag: "CFTC" },
          { id: "cot-legacy", label: "COT Data Explorer", icon: "ti-chart-bar" },
          { id: "market-dna", label: "Market DNA", icon: "ti-dna-2", tag: "new" },
          { id: "fundamentos", label: "Fundamental Base", icon: "ti-report-analytics", tag: "SEC" },
        ],
      },
    ],
  },
  { label: "Audit", icon: "ti-notebook", direct: "auditoria" },
  { label: "Admin", icon: "ti-settings", direct: "admin" },
];

/** O texto veio do endereco (#tela): so aceita se for uma tela que existe. */
const IDS_VALIDOS: ReadonlySet<string> = new Set(
  MENUS.flatMap((m) => [
    ...(m.direct ? [m.direct as string] : []),
    ...(m.columns ?? []).flatMap((c) => c.items.map((i) => i.id as string)),
  ]),
);
export function isScreenId(v: string): v is ScreenId {
  return IDS_VALIDOS.has(v);
}

# HARPIAN COCKPIT GESTOR

## Stack
- Next.js 16.2.9 + React 19 + TypeScript
- Port: 8960 (`next dev -p 8960`)
- Lightweight Charts (TradingView) for candle/DSPT charts
- No backend — all data comes from HQP API or external APIs

## How to run
```bash
npm install
npm run dev   # http://localhost:8960
```

## Architecture

### Entry point
- `app/layout.tsx` — root layout, wraps ThemeProvider + I18nProvider
- `app/page.tsx` — loads Cockpit.tsx
- `components/Cockpit.tsx` — main shell (sidebar + topbar + screen router)

### Screen system
Screens live in `components/screens/`. Navigation defined in `lib/nav.ts`.
Cockpit.tsx renders the active screen based on `screenId` state.

Menu structure (from nav.ts):
- **Missão** — Mission Control (dashboard with live portfolio state, daily changes, tickets)
- **Motores** — Engine Room, Estratégias/ETPs, Setores·Forças, Estratégias·Forças, Ativos scanner, Gráfico DSPT
- **Ordens** — Tickets do dia (IBKR), Reconciliação
- **Laboratório** — Construtor, Backtest Lab, Calibração, Observador (IA)
- **Defesa** — Defesa Inteligente (NEW), Proteção & Defesa, Indicadores sistêmicos, Regime de mercado
- **Mercado** — Cotações (Ações, ETFs, Commodities, Cripto, Índices, Forex)
- **Intelligence** — Social Radar, News Broadcast, Insider Orders, 13F Holdings, COT Intelligence, COT Data Explorer, Market DNA
- **Auditoria** — Audit trail
- **Admin** — Administration panel

### Screens (57+ files):
#### Core screens
- MissionControl.tsx — Dashboard with live portfolio cards, ticker, JIM
- EngineRoom.tsx — Engine monitoring view
- Tickets.tsx — Daily execution tickets (IBKR integration)
- Portfolio.tsx — Portfolio detail view
- Estrategias.tsx — Strategy/ETP management

#### Lab/Builder screens
- Construtor.tsx — Strategy constructor
- Backtest.tsx — Backtest laboratory
- Calibracao.tsx — Calibration tools
- Observador.tsx — AI Observer

#### Defense screens
- DefesaInteligente.tsx — NEW: unified defense screen with 180° thermometer gauge (4 zones: Defense/Red, Low Risk/Yellow, Neutral/Gray, Risk-On/Green), protection indicators, Market DNA, trend arrows
- Protecao.tsx — Protection & Defense view
- Indicadores.tsx — Systemic indicators
- Regime.tsx — Market regime analysis

#### Market/Intelligence screens
- Cotacoes.tsx — Quotes table (supports param: acoes/etfs/commodities/cripto/indices/forex)
- MarketDna.tsx — Market DNA analysis
- CotSentiment.tsx — COT Intelligence (CFTC)
- CotLegacy.tsx — COT Data Explorer
- Institutional.tsx — 13F Holdings (SEC)
- SocialRadar.tsx — Social sentiment
- NewsBroadcast.tsx — News broadcast
- InsiderOrders.tsx — Insider trading orders
- Chart.tsx — DSPT candle chart
- TradingViewWidget.tsx — TradingView embedded widget

#### Sector/Strength screens
- AlphaDroid.tsx — Sector strength analysis
- StrategiesStrength.tsx — Strategy strength view
- Setores.tsx — Sectors view
- Ativos.tsx — Asset scanner

#### Admin screens
- Admin.tsx — Administration panel
- Auditoria.tsx — Audit trail
- Reconciliacao.tsx — Order reconciliation

#### Other screens
- Noticias.tsx — News view
- PortfolioStudioScreen.tsx — Portfolio Studio wrapper screen
- Placeholder.tsx — Placeholder for screens under construction

#### Portfolio Studio (advanced builder)
- portfolio-studio/PortfolioStudio.tsx — Main studio component
- portfolio-studio/MotorStudio.tsx — Motor builder
- portfolio-studio/CanvasComposicao.tsx — Composition canvas
- portfolio-studio/ArvoreViva.tsx — Live tree visualization
- portfolio-studio/EsteiraStudio.tsx — Pipeline studio
- portfolio-studio/MaestroPanel.tsx + MaestroModal.tsx — Orchestrator
- portfolio-studio/RegraNode.tsx — Rule node component
- portfolio-studio/MotorCard.tsx — Motor card
- portfolio-studio/BacktestBadge.tsx — Backtest badge
- portfolio-studio/PerfilPanel.tsx — Profile panel
- portfolio-studio/CatalogSidebar.tsx — Asset catalog sidebar
- portfolio-studio/ConnectionsSVG.tsx — Connection lines
- portfolio-studio/DiffPanel.tsx — Diff/changes panel

### Shared components
- `components/Cockpit.tsx` — Main app shell
- `components/Topbar.tsx` — Top bar with logo, JIM button, settings
- `components/JimDrawer.tsx` — JIM AI sidebar drawer
- `components/SettingsDrawer.tsx` — Settings drawer
- `components/NewsTicker.tsx` — Breaking news ticker
- `components/RegimeGauge.tsx` — Regime gauge component
- `components/TicketChart.tsx` — Ticket visualization
- `components/MomentumBar.tsx` — Momentum bar component
- `components/AddBasketModal.tsx` — Add basket modal
- `components/ExecuteOrderModal.tsx` — Order execution popup
- `components/ui/Dialog.tsx` — Dialog component
- `components/wizards/NewEtpWizard.tsx` — New ETP creation wizard

### Lib modules
- `lib/nav.ts` — Menu structure and ScreenId types
- `lib/i18n.tsx` — Internationalization (PT/EN) with confirm+reload
- `lib/theme.tsx` — Theme provider (navy/light/dark) using CSS variables
- `lib/api.ts` — HQP API client
- `lib/data.ts` — Data utilities
- `lib/feeds.ts` — News/data feed helpers
- `lib/jim-context.ts` — JIM AI context management
- `lib/jim-data.ts` — JIM data access layer
- `lib/jim-knowledge.ts` — JIM knowledge base
- `lib/jim-sessions.ts` — JIM session persistence
- `lib/customBaskets.ts` — Custom basket management
- `lib/homologacao.ts` — Homologation validation
- `lib/portfolioComposicao.ts` — Portfolio composition logic
- `lib/portfolioDraft.ts` — Portfolio draft state management

### Data
- `data/jim-sessions/default.json` — Default JIM session data

## Theme System (CSS Variables)
Three themes in `app/globals.css`:
- **Navy** (default): dark blue background, no data-theme
- **Light** (`data-theme="light"`): white/light gray
- **Dark** (`data-theme="dark"`): dark gray/black

Variables: `--bg`, `--bg2`, `--panel`, `--panel2`, `--raise`, `--tx`, `--tx2`, `--tx3`, `--line`, `--line2`, `--gold`, `--gold2`, `--gold-deep`, `--green`, `--red`, `--orange`, `--blue`, `--cyan`

Semantic tag backgrounds: `--green-bg`, `--gold-bg`, `--red-bg`, `--blue-bg`

Z-index scale: `--z-topbar:50`, `--z-dropdown:60`, `--z-modal:200`, `--z-dialog:300`, `--z-toast:400`

ALWAYS use CSS variables. NEVER hardcode colors.

## i18n System
- `lib/i18n.tsx` with `useI18n()` hook
- Dict-based: `t("key")` returns PT or EN string
- Language switch: confirm dialog + page reload
- localStorage key: `harpian-lang`

## JIM AI Assistant
- Proactive AI assistant in sidebar drawer
- `publishScreenData()` pattern: screens publish visible data for JIM
- JIM Morning Briefing on MissionControl
- Uses `var(--panel)` background + `var(--tx)` text (theme-aware)
- Chat API lives in the HQP backend (`/v1/jim/chat`, `/v1/jim/sessions`) — no local API routes

## DefesaInteligente (new screen)
180-degree thermometer gauge with 4 zones:
- Defense (left, red #E74C3C) — system in full defense
- Low Risk (upper-left, yellow #E5B800) — reduced exposure
- Neutral (upper-right, gray #7d96b3) — neutral stance
- Risk-On (right, green #2ECC71) — full risk exposure

APIs: `/v1/protection/indicators` + `GOV_API/api/market-dna`

## IMPORTANT RULES
- This is the INTERNAL Cockpit for the quant team / gestor
- It CAN show engine details, strategies, calibration — but NEVER expose proprietary formulas to clients
- Sortino (not Sharpe) is the standard risk metric
- Risk Number must appear in all risk tables
- Never `git add -A` — stage specific files
- Air Gap: NOTHING goes to IBKR without human approval

# ONBOARDING — HARPIAN QUANT PLATFORM (HQP)
## Documento para Claude Code do Diogo

> **Data:** 2026-07-07
> **Autor:** João Daniel (via Claude Code)
> **Objetivo:** Este documento é o ponto de entrada para o Claude Code do Diogo entender e trabalhar em todo o sistema HQP — Cockpit, Terminal e API.

---

## 1. VISAO GERAL

A **Harpian Quant Platform (HQP)** e um sistema de gestao quantitativa institucional para investimentos em acoes e ETFs americanos. O sistema e composto por 3 aplicacoes:

| App | Repo | Local | Porta | Publico-alvo |
|-----|------|-------|-------|-------------|
| **Cockpit Gestor** | `jfdconsult/hqp-platform` (subpasta front em `harpian-cockpit-next`) | `C:\dev\harpian-cockpit-next` | 8960 | Gestor quant interno (Joao, Diogo) |
| **Terminal MFO** | `jfdconsult/harpian-terminal-next` | `C:\dev\harpian-terminal-next` | 8950 | Cliente externo (MFO, assessor, gestor) |
| **HQP API** | `jfdconsult/hqp-platform` (subpasta `api/`) | `C:\dev\hqp-platform\api` | 8080 (local) / hqp-api.fly.dev (prod) | Backend FastAPI compartilhado |

### Principio fundamental
- **Cockpit** = interno, mostra TUDO (sinais, formulas, gatilhos, CRS, HSA, motores)
- **Terminal** = cliente, mostra RESULTADO/POSTURA, NUNCA sinais/gatilhos/formulas proprietarias
- **API** = backend unico FastAPI, serve ambos com controle RBAC por role

### Regras inviolaveis
1. `AI_IN_DECISION_LOOP = False` — JIM (IA) NUNCA toma decisao, apenas aconselha
2. Nenhuma ordem vai para IBKR sem aprovacao humana (gate humano)
3. Motor homologado (status=prod) e IMUTAVEL — para editar, faz fork
4. Sortino (nao Sharpe) e a metrica padrao
5. harpian/harpian (repo quant) NUNCA pode ser publico
6. `.env.local` nunca no git

---

## 2. COMO RODAR

### Pre-requisitos
- Node.js 20+
- Python 3.12+
- Git

### Cockpit (Next.js 16 + React 19)
```bash
cd C:\dev\harpian-cockpit-next
npm install
npm run dev          # porta 8960
```

### Terminal (Next.js 16 + React 19)
```bash
cd C:\dev\harpian-terminal-next
npm install
npm run dev          # porta 8950 (default Next.js 3000, mas use 8950)
```

### API (FastAPI + Python)
```bash
cd C:\dev\hqp-platform\api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### Variaveis de ambiente
Copiar `.env.local.example` para `.env.local` em cada projeto. Chaves necessarias:
- `ANTHROPIC_API_KEY` — para JIM (IA assistente)
- `NEXT_PUBLIC_HQP_API_URL` — URL da API (default: `http://localhost:8080`)

### Producao
- API: `hqp-api.fly.dev` (Fly.io, scale-to-zero, regiao `iad`)
- Cockpit: `jfdconsult.github.io/harpian-cockpit` (GitHub Pages, static export)
- Terminal: deploy local / GitHub Pages

---

## 3. ARQUITETURA

```
┌──────────────────────────────────────────────────────────────┐
│                     USUARIOS                                  │
│  Gestor Quant (Cockpit:8960)    MFO/Assessor (Terminal:8950) │
└──────────────┬───────────────────────────┬───────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    HQP API (FastAPI)                          │
│                  hqp-api.fly.dev:8080                         │
│                                                              │
│  22 Routers · 82+ Endpoints · RBAC 7 roles                  │
│  Clean Architecture: Ports & Adapters                        │
│                                                              │
│  Ports REAIS:          Ports MOCK:                           │
│  - Yahoo Finance       - OrderGateway (IBKR)                │
│  - Anthropic (JIM)     - Accounting (Lynk)                  │
│  - Arena (homologacao) - RiskScore (Nitrogen)               │
└──────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  Dados: Yahoo EOD · AlphaDroid snapshot · Arena snapshot     │
│  Parquet universes (broad_us, sectors_macro, defense)        │
│  Audit trail (JSONL append-only)                             │
│  Cache: Redis (prod) / in-memory (dev)                      │
└──────────────────────────────────────────────────────────────┘
```

### Stack tecnica
- **Frontend:** Next.js 16, React 19, TypeScript, CSS custom properties (sem Tailwind)
- **Backend:** FastAPI, Pydantic, httpx, pandas, pyarrow, anthropic SDK
- **Charts:** Lightweight Charts (TradingView open-source)
- **Deploy:** Fly.io (API), GitHub Pages (frontends)
- **Temas:** 3 temas (navy/light/dark) via CSS `data-theme`
- **i18n:** PT-BR e EN via React Context

---

## 4. COCKPIT GESTOR — MAPA COMPLETO

### Estrutura do projeto (`C:\dev\harpian-cockpit-next`)
```
app/
  layout.tsx        # Root layout
  page.tsx          # Renderiza <Cockpit />
  globals.css       # Design system HDS v2 (~762 linhas)

components/
  Cockpit.tsx       # SPA shell: router de telas por estado React
  Topbar.tsx        # Barra superior com menus dropdown
  JimDrawer.tsx     # Painel IA (drawer direita)
  SettingsDrawer.tsx # Config: tema, idioma, notificacoes
  NewsTicker.tsx    # Ticker de noticias (marquee)
  MomentumBar.tsx   # Barra de momentum visual
  ExecuteOrderModal.tsx  # Modal de execucao de ordem

  screens/          # 33 telas (ver tabela abaixo)
  portfolio-studio/ # 14 componentes do construtor de portfolios
  wizards/          # Wizard "Novo ETP"
  ui/               # Dialog generico

lib/
  api.ts            # Cliente HTTP para HQP API
  nav.ts            # Definicao de navegacao (31 ScreenIds)
  theme.tsx         # Provider de tema (navy/light/dark)
  i18n.tsx          # Provider de idioma (PT/EN)
  jim-data.ts       # Barramento de dados do JIM (pub/sub)
  jim-context.ts    # Contexto de tela para JIM
  jim-sessions.ts   # Persistencia de sessoes JIM
  jim-knowledge.ts  # Integracao Black Library + JD NEWS
  data.ts           # Dados mock + helpers de formatacao
  feeds.ts          # Cliente de noticias e social
  portfolioComposicao.ts  # Tipos e cliente do Portfolio Studio v2
  portfolioDraft.ts       # Store de rascunho do Portfolio Studio
  customBaskets.ts        # Cestas customizadas (localStorage)
  homologacao.ts          # Selos de homologacao
```

### Telas do Cockpit (33 screens)

| Tela | Arquivo | Funcao |
|------|---------|--------|
| **Mission Control** | `MissionControl.tsx` | Dashboard: KPIs, status portfolios, tickets pendentes |
| **Engine Room** | `EngineRoom.tsx` | Estado dos motores (HC-US 3.1, 11, TOTAL, IG) |
| **Ativos** | `Ativos.tsx` | Scanner de ativos: momentum, volume, setor, RS |
| **Tickets** | `Tickets.tsx` | Ordens do dia: agrupadas por portfolio/conta IBKR, aprovacao batch |
| **Estrategias** | `Estrategias.tsx` | Catalogo de estrategias (arvore Pilar > Esteira > Ativo) |
| **Portfolio** | `Portfolio.tsx` | Detalhe de portfolio: composicao v2 com momentum real e Active Buy |
| **Portfolio Studio** | `PortfolioStudioScreen.tsx` | Construtor visual de portfolios (canvas drag-and-drop) |
| **Construtor** | `Construtor.tsx` | Wizard de criacao de ETP |
| **Backtest** | `Backtest.tsx` | Laboratorio de backtests: formulario, historico, metricas |
| **Calibracao** | `Calibracao.tsx` | Studio de calibracao de formulas |
| **Protecao** | `Protecao.tsx` | Defesa 3 camadas, Pilar D, logica de reentrada |
| **Defesa Inteligente** | `DefesaInteligente.tsx` | Defesa inteligente (novo) |
| **Indicadores** | `Indicadores.tsx` | Indicadores sistemicos: 4 sensores (EMA, VIX, gauges) |
| **Regime** | `Regime.tsx` | Classificacao de regime de mercado |
| **Reconciliacao** | `Reconciliacao.tsx` | HQP target vs IBKR real vs Lynks contabil |
| **Observador** | `Observador.tsx` | Observador IA: monitoramento automatizado |
| **Auditoria** | `Auditoria.tsx` | Trilha de auditoria / compliance |
| **Admin** | `Admin.tsx` | Kill switch, modo paper/live, usuarios, integracoes |
| **Chart** | `Chart.tsx` | Grafico DSPT: 4 paineis sincronizados, candlestick + estudos |
| **Cotacoes** | `Cotacoes.tsx` | Cotacoes ao vivo (por classe: acoes, ETFs, commodities, crypto) |
| **Setores** | `Setores.tsx` | Analise setorial |
| **AlphaDroid** | `AlphaDroid.tsx` | Competicao de forca setorial (estilo AlphaDroid) |
| **Strategies Strength** | `StrategiesStrength.tsx` | Comparacao de forca entre estrategias |
| **Noticias** | `Noticias.tsx` | Feed de noticias (legado) |
| **News Broadcast** | `NewsBroadcast.tsx` | Broadcast de noticias real-time (RSS/API) |
| **Social Radar** | `SocialRadar.tsx` | Radar de sentimento social (StockTwits) |
| **Insider Orders** | `InsiderOrders.tsx` | Ordens de insiders (SEC Form 4) |
| **Institutional** | `Institutional.tsx` | Holdings institucionais 13F (SEC) |
| **COT Sentiment** | `CotSentiment.tsx` | Inteligencia COT (CFTC) |
| **COT Legacy** | `CotLegacy.tsx` | Explorador de dados COT legado |
| **Market DNA** | `MarketDna.tsx` | Analise de DNA de mercado |

---

## 5. TERMINAL MFO — MAPA COMPLETO

### Estrutura do projeto (`C:\dev\harpian-terminal-next`)
```
app/
  layout.tsx         # Root layout
  page.tsx           # Renderiza <Terminal />
  globals.css        # Design system (~357 linhas)
  questionario/[id]/ # Questionario de suitability (rota separada)
  api/               # API Routes Next.js (server-side)
    asset/route.ts       # Metricas de ativo + serie normalizada
    candles/route.ts     # OHLC candlestick + volume
    drawdown/route.ts    # Graficos de drawdown
    quotes/route.ts      # Cotacoes batch (cache 8h)
    ticker/route.ts      # Ticker tape ao vivo
    snapshot/route.ts    # Snapshot overnight (FILTRO DE CONFIDENCIALIDADE)
    core-drawdown/route.ts     # Underwater CORE22+ vs S&P vs Nasdaq
    fund-benchmarks/route.ts   # Metricas CORE22+ vs benchmarks
    portfolio-growth/route.ts  # Simulacao de crescimento
    jim/chat/route.ts          # Chat JIM (Anthropic API)
    jim/sessions/route.ts      # Sessoes JIM

components/
  Terminal.tsx       # SPA shell (equivalente ao Cockpit.tsx)
  Topbar.tsx         # Barra superior
  Ticker.tsx         # Ticker tape com dados ao vivo
  JimDrawer.tsx      # JIM IA (drawer direita)
  SettingsDrawer.tsx # Config: tema, idioma

  screens/           # 27+ telas (ver tabela)

lib/
  nav.ts             # 27 ScreenIds, menus
  theme.tsx          # Temas (navy/light/dark)
  i18n.tsx           # Idioma (PT/EN)
  market.ts          # Universo de mercado (200+ symbols)
  funds.ts           # Dados dos fundos (HPC22, HPC11, LCORE22)
  clients.ts         # Dados de clientes mock
  clientStore.ts     # CRUD de clientes (localStorage)
  portfolioModels.ts # 6 portfolios modelo (P1-P6)
  yahoo.ts           # Cliente Yahoo Finance + funcoes quant (Sharpe, Sortino, etc.)
  indicators.ts      # Indicadores tecnicos (EMA, DEMA cascade, TEMA, SMA, Bollinger, RSI)
  core22.ts          # Loader de dados CORE22+ (CSV)
  jim-data.ts        # Barramento de dados JIM
  jim-context.ts     # Contexto de tela JIM + system prompt
  jim-knowledge.ts   # Black Library + JD NEWS
  jim-sessions.ts    # Sessoes JIM
  hqp.ts             # Cliente HQP API
  feeds.ts           # Noticias e social
  snapshot.ts        # Snapshot overnight
  cache.ts           # Cache em disco (.cache/)
  format.ts          # Helpers de formatacao
  csv.ts             # Parser CSV para importacao
  riskLevels.ts      # Risk Numbers por nivel
  favorites.ts       # Favoritos (localStorage)
```

### Telas do Terminal (27 screens)

| Tela | Arquivo | Funcao |
|------|---------|--------|
| **Painel** | `Painel.tsx` | Dashboard: cards de fundos, top posicoes, regime, defesa, widgets drag-and-drop |
| **Fundo** | `Fundo.tsx` | Detalhe do fundo (7 abas): Visao, Composicao, Performance, Risco, Defesa, Economia, Como Investir |
| **Cotacoes** | `Cotacoes.tsx` | Cotacoes real-time: indices, ETFs, acoes, commodities, crypto, forex |
| **Acoes** | `Acoes.tsx` | Grafico de ativo: candlestick, indicadores tecnicos, TradingView |
| **Regime** | `Regime.tsx` | Regime de mercado: RISK-ON/OFF, defesa |
| **Risco** | `Risco.tsx` | Comparacao de risco: 4 niveis (Conservador a Ultra) |
| **Clientes** | `Clientes.tsx` | CRM: lista de clientes com AUM, Risk Number |
| **Cliente** | `Cliente.tsx` | Detalhe do cliente: perfil, portfolios, metricas |
| **Carteira** | `Carteira.tsx` | Portfolio do cliente: posicoes, pesos, rebalanceamento |
| **Portfolio Detalhe** | `PortfolioDetail.tsx` | Breakdown por produto |
| **Ordem** | `Ordem.tsx` | Geracao de ordens (Lynk API) |
| **Importar** | `Importar.tsx` | Importacao de portfolio (CSV) |
| **Alertas** | `Alertas.tsx` | Centro de alertas |
| **Noticias** | `Noticias.tsx` | Feed de noticias curado |
| **News Broadcast** | `NewsBroadcast.tsx` | Broadcast real-time |
| **Social Radar** | `SocialRadar.tsx` | StockTwits / social monitoring |
| **Insider Orders** | `InsiderOrders.tsx` | SEC Form 4 |
| **Institutional** | `Institutional.tsx` | 13F Holdings |
| **Market DNA** | `MarketDna.tsx` | DNA de mercado |
| **COT Sentiment** | `CotSentiment.tsx` | Inteligencia COT |
| **COT Legacy** | `CotLegacy.tsx` | Dados COT legado |
| **Integracoes** | `Integracoes.tsx` | Status de integracoes |
| **Marca** | `Marca.tsx` | White-label branding |
| **Config** | `Config.tsx` | Configuracao do terminal |
| **API** | `ApiIntegracao.tsx` | Documentacao da API |
| **Tutorial** | `Tutorial.tsx` | Tutorial interativo |

### Diferenca Cockpit vs Terminal
O **Terminal NAO tem** (exclusivo do Cockpit):
- Engine Room, Calibracao, Backtest Lab, Portfolio Studio
- Admin (kill switch, modos), Reconciliacao, Auditoria
- Indicadores sistemicos, Defesa Inteligente
- AlphaDroid, Strategies Strength

O **Terminal TEM a mais** (exclusivo):
- Fundos (pagina de detalhe com 7 abas)
- Clientes CRM, Carteira, Importar
- Ordens (Lynk), Questionario de suitability
- White-label (Marca), Tutorial
- API Routes proprias (Yahoo direto, snapshot com filtro de confidencialidade)

---

## 6. HQP API — MAPA COMPLETO

### Estrutura do projeto (`C:\dev\hqp-platform\api`)
```
app/
  main.py            # FastAPI app, CORS, monta 22 routers
  deps.py            # current_user, current_tenant (multi-tenant)
  schemas.py         # Modelos Pydantic
  core/
    config.py        # Settings (env vars, AI_IN_DECISION_LOOP=False)
    security.py      # RBAC: 7 roles, alcadas, require_role()
    cache.py         # Redis/in-memory cache
  ports/
    base.py          # 5 interfaces abstratas (Clean Architecture)
    mock.py          # Implementacoes mock + wiring
    yahoo.py         # Yahoo Finance REAL
    anthropic_advisor.py  # Claude/JIM REAL
  mock/
    data.py          # Seed data (~1000 linhas): portfolios, tickets, clientes, etc.
  routers/           # 22 routers (82+ endpoints)
  services/
    indicators.py    # EMA, DEMA, TEMA, SMA, ROC
    analysis.py      # Score, ranking, classificacao
    dspt.py          # Sinais DSPT (Diogo): momentum D13/J37, RS barcolor
    arena_client.py  # Cliente harpian-arena.fly.dev
    delorean_local.py # Motor de backtest local (parquet)
    dualmom_engine.py # Motor dual-momentum
    registry_store.py # Store persistente JSON (motores/formulas)
    audit_store.py   # Audit log JSONL (append-only)
    overnight.py     # Le output do pipeline noturno
  data/
    baskets.py       # Definicoes de cestas de ativos
    alphadroid_strategies.json  # Snapshot AlphaDroid (22 estrategias)
    arena_snapshot.json         # Snapshot Arena
    audit_log.jsonl             # Log de auditoria persistente
    universes/*.parquet         # Universos para backtest
```

### Endpoints principais (agrupados por dominio)

#### Dashboard & Portfolios
- `GET /v1/dashboard` — Mission Control (portfolios + resumo diario)
- `GET /v1/strategies/` — Lista portfolios
- `GET /v1/strategies/{id}/composicao` — Composicao v2 (motores > pilares > esteiras > ativos)
- `GET /v1/strategies/{id}/momentum` — Momentum por esteira (J37/D13)
- `POST /v1/strategies/{id}/motor` — Adicionar motor (gate: homologado)
- `POST /v1/strategies/{id}/promote-to-active` — Promover portfolio
- `POST /v1/strategies/{id}/fork` — Fork para edicao

#### Tickets (Ordens)
- `GET /v1/tickets` — Lista tickets (filtro por portfolio)
- `GET /v1/tickets/history` — Historico com filtros
- `POST /v1/tickets/batch-approve` — Aprovacao batch por portfolio/conta IBKR
- `POST /v1/tickets/{ticker}/approve` — Aprovar individual (gate humano)
- `POST /v1/tickets/{ticker}/reject` — Rejeitar

#### Mercado & Ativos
- `GET /v1/market/quote/{ticker}` — Cotacao EOD (Yahoo real)
- `GET /v1/market/quotes` — Cotacoes batch
- `GET /v1/market/chart/{ticker}` — OHLCV + EMA + DEMA + DSPT
- `GET /v1/assets/scan` — Scanner: momentum D13/J37, RS, score, ranking
- `GET /v1/assets/sectors` — Momentum setorial
- `GET /v1/assets/catalog` — Catalogo para Portfolio Studio

#### AlphaDroid
- `GET /v1/alphadroid/strategies` — 22 estrategias com momentum
- `GET /v1/alphadroid/sector-strengths` — Forca setorial (cache 5min)
- `GET /v1/alphadroid/strategy-strengths` — Forca de estrategias

#### Protecao & Risco
- `GET /v1/protection/defense` — Estado da defesa
- `GET /v1/protection/indicators` — Indicadores sistemicos
- `GET /v1/protection/pilar-d` — Universo e top-4 do Pilar D
- `GET /v1/risk-number/` — Risk Numbers de todos os portfolios

#### JIM (IA)
- `POST /v1/jim/chat` — Chat multi-turno (Claude API, screen-aware, air-gapped)

#### Registry (Catalogo)
- `GET /v1/registry/motores` — Lista motores (com dados Arena)
- `GET /v1/registry/formulas` — Lista formulas
- `GET /v1/registry/etps` — Lista ETPs
- `POST /v1/registry/etps/backtest-preview` — Preview backtest via Arena

#### Outros
- `GET /v1/news` — Feed de noticias (RSS CNBC/MarketWatch/Yahoo)
- `GET /v1/social/trending` — StockTwits trending
- `GET /v1/engine-room/` — Estado dos motores
- `GET /v1/observador/` — Observador IA
- `GET /v1/audit` — Trilha de auditoria
- `GET /v1/backtest/runs` — Historico de backtests
- `GET /v1/mfo/clients` — Clientes MFO (multi-tenant)

### RBAC — 7 Roles
| Role | Alcada (USD) | Descricao |
|------|-------------|-----------|
| `socio_gestor` | Ilimitada | Socio-gestor (Joao) |
| `gestor_quant` | $5M | Gestor quantitativo (Diogo) |
| `operacoes` | $1M | Operacoes |
| `cro` | $250K | Chief Risk Officer |
| `mfo_admin` | — | Admin do MFO (cliente) |
| `assessor` | — | Assessor (cliente) |
| `cliente` | — | Cliente final |

---

## 7. CONCEITOS-CHAVE

### Composicao v2 (Portfolio)
```
Portfolio
  └── motores[]              # Motores de investimento
       └── estrutura
            └── pilares[]    # Setores (Technology, Healthcare, etc.)
                 └── esteiras[]   # Estrategias dentro do pilar
                      └── ativos[]  # Tickers (AAPL, MSFT, etc.)
                           ├── mom_j37    # Momentum DEMA cascade 37 dias
                           ├── mom_d13    # Momentum DEMA cascade 13 dias
                           └── active_buy # Boolean: lider da esteira
```

### DSPT (sinais do Diogo)
- **D13/J37:** Momentum calculado via DEMA-cascade (NAO e DEMA Mulloy padrao, e cascata com alpha=1/d)
- **RS Barcolor:** Long/Short/L-FVG/S-FVG baseado em DEMA de retornos percentuais
- **Active Buy:** O ativo com maior mom_j37 em cada esteira recebe `active_buy: true`
- Implementado em `api/app/services/dspt.py`

### JIM (Harpian Intelligence)
- Assistente IA baseado em Claude (Haiku para respostas rapidas, Sonnet para analise profunda)
- **Screen-aware:** cada tela publica dados via barramento `jim-data.ts`, JIM recebe como contexto
- **Regra de ouro:** JIM NUNCA pergunta "o que voce ve na tela" — ele ja sabe
- **Proativo:** ao abrir uma tela, JIM nomeia o item com dados reais + 3 chips de perguntas provaveis
- **Air-gapped:** JIM aconselha, nunca decide/executa
- **Knowledge sources:** Black Library (cpa-jd.fly.dev), JD NEWS (jd-news-api.fly.dev), biblioteca de livros

### AlphaDroid CORE22+
- 22 sleeves (estrategias), 10 pilares (setores), 241 ativos
- Cada sleeve compete internamente: o lider recebe Active Buy
- Benchmark read-only: AlphaDroid e a barra a bater, melhorias sao nos NOSSOS motores

### Portfolios ativos
| ID | Nome | Conta IBKR | Status |
|----|------|-----------|--------|
| HPC22 | HC-US20 | U15982774 | Ativo (agressivo) |
| HPC11 | HC-US I.G. | U14897733 | Ativo (homologado) |
| LCORE22 | Lynk Core22 | U15902883 | Ativo (AlphaDroid CORE22+ replica) |
| HCUST | HC-US TOTAL | — | Lab |
| HPCIG | HC-US I.G. ADVANCE | — | Lab |

### Tickets agrupados por portfolio
- Cada portfolio mapeia para uma conta IBKR distinta
- Aprovacao e por portfolio (batch approve) porque sao contas separadas
- `POST /v1/tickets/batch-approve?portfolio_id=HPC22` aprova todos os pendentes do HPC22

---

## 8. DESIGN SYSTEM (CSS)

### Temas
3 temas controlados por `data-theme` no `<html>`:
- **Navy** (default): fundo `#0A1A30`, paineis escuros, gold `#C9A02C`
- **Light**: fundo `#f0f2f5`, paineis brancos
- **Dark**: fundo `#000000`, paineis pretos

### Variaveis CSS principais
```css
--bg, --bg2, --panel, --panel2, --raise   /* camadas de fundo */
--line, --line2                            /* bordas */
--gold, --gold2, --gold-deep              /* cor primaria (acento) */
--green, --red, --orange, --blue, --cyan  /* cores semanticas */
--tx, --tx2, --tx3                        /* hierarquia de texto */
--sans, --mono                            /* tipografia */
--r-sm:6px, --r-md:8px, --r-lg:12px      /* border-radius */
--gap:12px, --pad:14px                    /* espacamento */
```

### Icones
Tabler Icons (CDN webfont) — classe `ti ti-{nome-do-icone}`

### Principio de densidade
- Estilo Bloomberg/AlphaDroid: **densidade > espaco**
- Multi-coluna, minima rolagem, preencher vertical
- Medir a 1920px de largura

---

## 9. FLUXO DE TRABALHO

### Para adicionar uma nova tela ao Cockpit:
1. Criar `components/screens/NovaTela.tsx`
2. Adicionar ScreenId em `lib/nav.ts` (tipo union + array MENUS)
3. Adicionar case no switch de `Cockpit.tsx`
4. Adicionar CSS em `app/globals.css` se necessario
5. Se precisar de dados, criar/usar endpoint na API

### Para adicionar uma nova tela ao Terminal:
1. Criar `components/screens/NovaTela.tsx`
2. Adicionar ScreenId em `lib/nav.ts`
3. Adicionar case no switch de `Terminal.tsx`
4. Se precisar de API Route local, criar em `app/api/`
5. Adicionar CSS em `app/globals.css`

### Para adicionar um novo endpoint na API:
1. Criar/editar router em `app/routers/`
2. Se precisar de dados mock, adicionar em `app/mock/data.py`
3. Se precisar de servico, criar em `app/services/`
4. Montar o router em `app/main.py`
5. Testar via Swagger UI (`/docs`)

### Para integrar JIM em uma nova tela:
1. Em `lib/jim-data.ts`: chamar `publishScreenData()` quando dados carregarem
2. Em `lib/jim-context.ts`: adicionar contexto da tela (titulo, descricao, dados disponiveis)
3. JIM automaticamente recebe os dados e gera greeting + suggestions

---

## 10. SERVICOS EXTERNOS

| Servico | URL | Funcao |
|---------|-----|--------|
| HQP API | hqp-api.fly.dev | Backend principal |
| Arena | harpian-arena.fly.dev | Homologacao de motores (32 estrategias, 8 gates) |
| Black Library | cpa-jd.fly.dev/blacklibrary/* | Base de conhecimento institucional |
| JD NEWS | jd-news-api.fly.dev | Curadoria diaria de noticias |
| Yahoo Finance | v8 API | Cotacoes EOD, OHLCV, historico |
| StockTwits | API | Sentimento social |
| CNBC/MarketWatch | RSS | Feed de noticias |
| IBKR | (mock) | Interactive Brokers — execucao de ordens |
| Lynk | (mock) | Contabilidade de fundos |
| Nitrogen | (mock) | Risk Number |

---

## 11. TESTES

### API — Invariantes arquiteturais (`api/tests/test_invariants.py`)
```bash
cd C:\dev\hqp-platform\api
python -m pytest tests/ -v
```
Testa: air-gap, isolamento de tenant, gate de risco, RBAC, JIM nao decide.

### Frontend — sem test suite formal
Verificacao visual via dev server + preview no navegador.

---

## 12. DEPLOY

### API (Fly.io)
```bash
cd C:\dev\hqp-platform\api
fly deploy
```
- Regiao: `iad` (US East)
- Scale-to-zero habilitado
- Secrets via `fly secrets set`

### Cockpit (GitHub Pages)
```bash
cd C:\dev\harpian-cockpit-next
npm run build    # gera export estatico em out/
# push para branch gh-pages ou configurar GitHub Actions
```
`next.config.ts` ja tem `basePath: '/harpian-cockpit'` para prod.

### Terminal
Deploy manual ou GitHub Pages (configurar `basePath` no `next.config.ts`).

---

## 13. PROMPT PARA CLAUDE CODE DO DIOGO

Cole este bloco como instrucao inicial no Claude Code:

```
Voce e o assistente de desenvolvimento do Diogo na plataforma HARPIAN (HQP).
O sistema tem 3 partes: Cockpit (C:\dev\harpian-cockpit-next, porta 8960),
Terminal (C:\dev\harpian-terminal-next, porta 8950) e API (C:\dev\hqp-platform\api, porta 8080).

Leia o documento C:\dev\ONBOARDING_DIOGO_CLAUDE_CODE.md para entender toda a arquitetura.

Regras:
1. NUNCA exponha sinais/gatilhos/CRS/HSA/formulas no Terminal (so no Cockpit)
2. AI_IN_DECISION_LOOP = False — JIM aconselha, nunca decide
3. Motor homologado e imutavel — fork para editar
4. Sortino (nao Sharpe) e a metrica padrao
5. Densidade > espaco (estilo Bloomberg)
6. Temas: navy/light/dark via data-theme
7. i18n: PT-BR e EN via React Context
8. CSS: custom properties, sem Tailwind
9. Nunca commitar .env.local
10. git add especifico (nunca git add -A)

Para rodar: npm run dev no Cockpit (8960) e Terminal (8950), uvicorn no API (8080).
Swagger UI da API em http://localhost:8080/docs.
```

---

*Documento gerado em 2026-07-07. Para duvidas, consultar Joao Daniel.*

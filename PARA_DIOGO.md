# HANDOFF — HARPIAN COCKPIT GESTOR
**Para: Diogo | Data: 2026-07-06**

## O que e
Cockpit interno para o gestor/equipe quant. Aqui SIM podemos ver motores, estrategias, calibracao, backtests. E o centro de controle operacional. Referencia: terminal denso estilo AlphaDroid (muita informacao, pouco scroll).

## Stack
- Next.js 16 + React 19 + TypeScript
- Porta 8960
- Sem backend proprio — consome HQP API + APIs externas
- Lightweight Charts para graficos

## Como rodar
```bash
cd C:\dev\harpian-cockpit-next
npm install
npm run dev
```
Acesse http://localhost:8960

## Estrutura de pastas
```
harpian-cockpit-next/
├── app/
│   ├── layout.tsx          # Root layout (ThemeProvider + I18nProvider)
│   ├── page.tsx            # Carrega Cockpit.tsx
│   ├── globals.css         # Temas + variaveis CSS
│   └── api/
│       └── jim/
│           ├── chat/route.ts     # Endpoint de chat do JIM
│           └── sessions/route.ts # Persistencia de sessoes JIM
├── components/
│   ├── Cockpit.tsx          # Shell principal (sidebar + topbar + router)
│   ├── Topbar.tsx           # Barra superior
│   ├── JimDrawer.tsx        # Drawer do JIM AI
│   ├── SettingsDrawer.tsx   # Drawer de configuracoes
│   ├── NewsTicker.tsx       # Ticker de noticias
│   ├── RegimeGauge.tsx      # Gauge de regime
│   ├── MomentumBar.tsx      # Barra de momentum
│   ├── TicketChart.tsx      # Grafico de tickets
│   ├── AddBasketModal.tsx   # Modal de adicionar cesta
│   ├── ExecuteOrderModal.tsx # Popup de execucao de ordem
│   ├── screens/             # Todas as telas (30+ arquivos)
│   ├── portfolio-studio/    # Construtor de portfolios (13 componentes)
│   ├── wizards/             # Wizards (NewEtpWizard)
│   └── ui/                  # Componentes base (Dialog)
├── lib/
│   ├── nav.ts              # Menus e tipos de tela
│   ├── i18n.tsx            # Internacionalizacao PT/EN
│   ├── theme.tsx           # Provider de temas
│   ├── api.ts              # Cliente HQP API
│   ├── data.ts             # Utilitarios de dados
│   ├── feeds.ts            # Helpers de feeds/noticias
│   ├── jim-context.ts      # Contexto do JIM AI
│   ├── jim-data.ts         # Camada de dados do JIM
│   ├── jim-knowledge.ts    # Base de conhecimento do JIM
│   ├── jim-sessions.ts     # Persistencia de sessoes JIM
│   ├── customBaskets.ts    # Cestas customizadas
│   ├── homologacao.ts      # Validacao de homologacao
│   ├── portfolioComposicao.ts # Logica de composicao
│   └── portfolioDraft.ts   # Estado de rascunho de portfolio
├── data/
│   └── jim-sessions/
│       └── default.json    # Sessao padrao do JIM
└── public/                  # Assets estaticos
```

## Sistema de temas
Identico ao Terminal — 3 temas via CSS variables:
- **Navy** (padrao), **Claro** (`data-theme="light"`), **Escuro** (`data-theme="dark"`)
- NUNCA cores hardcoded. Sempre `var(--variavel)`
- Variaveis principais: `--bg`, `--bg2`, `--panel`, `--tx`, `--tx2`, `--tx3`, `--line`, `--line2`, `--gold`

## i18n
Identico ao Terminal — `useI18n()` + confirm + reload ao trocar idioma.

## JIM AI
Mesmo padrao do Terminal — publishScreenData(), drawer lateral, insights proativos.
JIM no Cockpit tem acesso a MAIS dados (motores, estrategias, backtests).
Tem API routes proprias em `app/api/jim/`.

## Telas por categoria

### Missao
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Mission Control | MissionControl.tsx | Dashboard com cards de portfolio, tickets, mercado |

### Motores
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Engine Room | EngineRoom.tsx | Visao dos motores em execucao |
| Estrategias | Estrategias.tsx | ETPs e estrategias |
| Setores/Forcas | AlphaDroid.tsx | Analise setorial |
| Estrategias/Forcas | StrategiesStrength.tsx | Forca das estrategias |
| Ativos | Ativos.tsx | Scanner de ativos |
| Grafico DSPT | Chart.tsx | Grafico candle com DSPT |

### Ordens
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Tickets do dia | Tickets.tsx | Tickets de execucao (IBKR) |
| Reconciliacao | Reconciliacao.tsx | Reconciliacao de ordens |

### Laboratorio
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Construtor | Construtor.tsx | Criar portfolios e estrategias |
| Backtest Lab | Backtest.tsx | Backtesting |
| Calibracao | Calibracao.tsx | Calibracao de parametros |
| Observador | Observador.tsx | IA observadora |

### Defesa (NOVIDADES desta sessao)
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Defesa Inteligente | DefesaInteligente.tsx | **NOVA**: gauge 180 graus com 4 zonas (Vermelho/Amarelo/Cinza/Verde) + indicadores + Market DNA |
| Protecao & Defesa | Protecao.tsx | Painel de protecao |
| Indicadores | Indicadores.tsx | Indicadores sistemicos |
| Regime | Regime.tsx | Regime de mercado |

### Mercado
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Cotacoes | Cotacoes.tsx | Tabela de cotacoes (param: acoes/etfs/commodities/cripto/indices/forex) |

### Intelligence (compartilhado com Terminal)
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Social Radar | SocialRadar.tsx | Sentimento social |
| News Broadcast | NewsBroadcast.tsx | Broadcast de noticias |
| Insider Orders | InsiderOrders.tsx | Ordens de insiders |
| 13F Holdings | Institutional.tsx | Holdings institucionais (SEC) |
| COT Intelligence | CotSentiment.tsx | Inteligencia COT (CFTC) |
| COT Data Explorer | CotLegacy.tsx | Explorador de dados COT |
| Market DNA | MarketDna.tsx | Analise Market DNA |

### Admin
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Auditoria | Auditoria.tsx | Audit trail |
| Admin | Admin.tsx | Painel de administracao |

### Outras
| Tela | Arquivo | Descricao |
|------|---------|-----------|
| Setores | Setores.tsx | Visao de setores |
| Portfolio | Portfolio.tsx | Detalhe de portfolio |
| Noticias | Noticias.tsx | Visao de noticias |
| TradingView | TradingViewWidget.tsx | Widget TradingView embutido |
| Portfolio Studio | PortfolioStudioScreen.tsx | Wrapper do Portfolio Studio |

### Portfolio Studio (13 componentes)
Sistema de construcao visual de portfolios com canvas, arvore viva, motors, regras.
- PortfolioStudio.tsx — Componente principal
- MotorStudio.tsx — Construtor de motores
- CanvasComposicao.tsx — Canvas de composicao
- ArvoreViva.tsx — Arvore viva (visualizacao)
- EsteiraStudio.tsx — Esteira de pipeline
- MaestroPanel.tsx + MaestroModal.tsx — Orquestrador
- RegraNode.tsx — No de regra
- MotorCard.tsx — Card de motor
- BacktestBadge.tsx — Badge de backtest
- PerfilPanel.tsx — Painel de perfil
- CatalogSidebar.tsx — Sidebar de catalogo de ativos
- ConnectionsSVG.tsx — Linhas de conexao
- DiffPanel.tsx — Painel de diff/mudancas

## Mudancas recentes (sessao 2026-07-06)
1. **DefesaInteligente.tsx** — Tela NOVA de defesa unificada com termometro 180 graus (4 zonas: Defesa/Amarelo/Neutro/Risk-On), trend arrows, indicadores de protecao, Market DNA
2. **nav.ts** — Adicionado screen "defesa-inteligente" no menu Defesa
3. **Cockpit.tsx** — Router atualizado para renderizar DefesaInteligente
4. **i18n.tsx** — Reload com confirm ao trocar idioma

## Repo GitHub
- Remote: https://github.com/jfdconsult/harpian-cockpit.git
- Branch: main

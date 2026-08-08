# Portfolio Builder — arquitetura

**Criado em:** 01/08/2026 · **movido para o cockpit em:** 01/08/2026
**Onde:** `harpian-cockpit-next` · tela `portfolio-builder`, menu **Lab → Portfolio Builder**
**Link direto:** `http://localhost:8960/#portfolio-builder`
**Stack:** Next 16 · React 19 · TypeScript · lightweight-charts

> **Por que no cockpit e nunca no terminal do cliente.** O modulo serve o historico
> diario completo das 41 estrategias — curva de capital, momento e ticker carregado dia a
> dia desde 1988. Com isso na mao, um cliente remonta o motor. O cockpit e interno e fica
> atras de Basic Auth (`middleware.ts`); o terminal e do cliente. **Nasceu no terminal por
> erro meu e foi removido de la por inteiro** — codigo, rotas e os 17 MB de dataset.

Módulo de construção de portfólio **a quatro mãos com o cliente**, ao vivo, sobre as 34
estratégias do AlphaDroid. O cliente escolhe estratégias, define peso (ou piso e teto), e a
curva se refaz na hora. O ato termina na linha do tempo: *"em 25/10/2007 você estava
carregando o quê?"*

---

## 1. A fronteira que não se cruza

**Este módulo não calcula momento.** `RetMes%`, `IR`, `Slope` e `Sigma` chegam prontos, dia a
dia, do motor do Diogo (cascata dupla de EMA, d=30), conferido contra a planilha original com
erro < 1e-14.

O que este código faz é só duas coisas:

1. traduzir momento **já calculado** em **peso de portfólio**
2. compor as curvas de capital das estratégias nesse peso

Se alguém precisar mexer no cálculo de momento, o lugar é
`C:\dev\estrategias salvas para apresentacao\_pipeline\momentum_core.py` — **não aqui**.

---

## 2. Arquivos

| Arquivo | O que é |
|---|---|
| `lib/portfolio-builder/types.ts` | Contratos: `Sleeve`, `PortfolioConfig`, `SimResult`, `StrategySeries` |
| `lib/portfolio-builder/engine.ts` | Resolução de pesos + simulação. Puro, sem React |
| `lib/portfolio-builder/engine.test.ts` | 30 asserções, roda com `npx tsx` |
| `lib/portfolio-builder/benchmark-sets.ts` | Os 3 SETs prontos: composição dos blocos + overlay + métricas (§9) |
| `lib/portfolio-builder/benchmark-sets.test.ts` | Valida os SETs contra a tabela da §3 da spec |
| `components/screens/PortfolioBuilder.tsx` | A tela |
| `components/screens/SetsHarpian.tsx` | O painel dos 3 SETs, no topo da tela |
| `app/api/strategy-catalog/route.ts` | Catálogo + calendário mestre |
| `app/api/strategy-series/[id]/route.ts` | Série diária de uma estratégia (lazy) |
| `app/api/benchmark-sets/route.ts` | Blocos dos 3 SETs |
| `data/strategies/` | O dataset: 17 MB, 41 séries + calendário + benchmark + `benchmark-sets.json` |

**Rodar os testes:**

```bash
npx tsx lib/portfolio-builder/engine.test.ts
npx tsx lib/portfolio-builder/benchmark-sets.test.ts
```

---

## 3. O dataset

Gerado por `_pipeline\export_dataset.py` na pasta da apresentação. Para atualizar com dados
novos, rodar lá e copiar `dataset\` para `data/strategies/`.

**Atualização de preços 2026-08-05:** os fechamentos de tickers CORE22 + SID foram
atualizados fora deste módulo, em `C:\dev\harpian-data-warehouse\market_data\core_sid_close_panel.parquet`.
O painel tem 426 tickers, 16.256 datas, janela 1962-01-02 → 2026-08-05, com 416 tickers
com dados e 414 atualizados até 2026-08-05. A base ampla consolidada está em
`C:\dev\harpian-data-warehouse\market_data\broad_panel_plus_core_sid_updated.parquet`.
Ver `C:\dev\harpian-cockpit-next\MARKET_DATA_UPDATE_20260805.md`.

**Não confundir:** esta atualização de preços não torna o pipeline de SETs seguro para rodar.
O P0 do `suavemin15` continua: `export_3sets.py` ainda não sabe gerar o bloco SUAVE e pode
apagar o Institucional Dinâmico se for executado antes do porte do motor.

Codificação pensada para caber e carregar rápido:

- **datas por offset** num calendário mestre de 9.548 pregões (1988-09-01 → 2026-07-31);
  cada série é um sufixo contíguo dele
- **símbolos por dicionário** + índice diário
- **defesa sai de graça**: o dicionário traz um flag por símbolo, então `defesa[dia]` é uma
  consulta, não um campo armazenado

Carregamento é **lazy** — só a série da estratégia escolhida desce.

---

## 4. Como a defesa é detectada

O CSV do AlphaDroid **não tem** um flag de StormGuard por dia. Mas o cabeçalho do bloco de
trades declara o **universo próprio** de cada estratégia (as 12 ações dela, depois de uma
coluna `BMS`). A regra é:

> símbolo do dia **fora** do universo declarado ⇒ camada de defesa armada

Não precisa adivinhar quais tickers são defensivos, e a regra vale para as 34 sem exceção
porque cada estratégia declara o próprio universo. Numa estratégia de Utilities, carregar
`TLT-` ou `GLD-` é defesa; numa de Treasuries, `TLT-` é a posição normal e só `$CASH` é defesa.

**Validação.** As 21 estratégias de ações colapsam em exatamente **3 grupos** de dias de
defesa, e cada grupo é um modo de execução (`Trade: Weekends` 2.296 dias · `Any Day` 2.374 ·
`Automatic` 2.020). Ou seja: o StormGuard é um sinal **de mercado** — dispara na mesma data
para todo mundo, e o que muda é só em que dia a troca é executada.

Os períodos derivados batem com a história sem que ninguém tenha escrito uma data:

| Período | O que era |
|---|---|
| 2007-10-30 → 2009-06-15 | Crise financeira global |
| 2000-10-24 → 2003-05-05 | Dot-com, em duas pernas |
| 1990-07-31 → 1991-02-04 | Guerra do Golfo — armou 2 dias **antes** da invasão do Kuwait |
| 2010-05-10 → 2010-08-03 | Flash crash, 2 pregões depois |
| 2020-03-02 → 2020-04-09 | COVID, 8 pregões após o topo |

> **Isto substitui `app/api/etp-defense-periods`**, que hoje é mock com 9 períodos escritos à
> mão — o comentário do próprio arquivo pede a troca. O mock erra as bordas (tem COVID como
> 24/02→15/05; o real é 02/03→09/04). Migrar quando alguém tiver um minuto.
>
> **Pendente:** confirmar a leitura com o Diogo antes de virar número em apresentação.

---

## 5. Os dois modos de alocação

### Linear
Peso fixo escolhido pelo cliente, constante o tempo todo. Rebalance periódico volta ao alvo.

### Dinâmico
O peso segue a **força do momento**, entre um **piso** e um **teto** por estratégia.

`solveWeights()` é um **water-filling**: reparte proporcional ao score, trava quem estourou um
limite, redistribui o resto entre as livres, repete até ninguém violar nada. Um simples
"proporcional e depois corta no teto" devolveria soma diferente de 100%.

Decisões embutidas, todas testadas:

- **momento negativo → score 0**, a estratégia cai no piso (não vira peso negativo)
- **`dropNegative`** opcional zera em vez de parar no piso
- **ninguém com momento positivo** → rateio igualitário acima dos pisos. Isso **não** deixa o
  portfólio exposto: quando o momento some, as próprias estratégias já estão em título ou
  caixa pelo StormGuard. **A defesa mora dentro delas, não no alocador.**
- **viabilidade** é checada antes: soma dos pisos ≤ 100% ≤ soma dos tetos

### Sem look-ahead
O peso de um rebalance usa o momento do **fechamento do dia t** e só passa a valer a partir de
**t+1**. Há um teste que corta a série no meio e confere que o passado simulado não muda.

---

## 5b. Janela de análise, métricas e painéis

**Janelas fixas, não arrasto.** A pergunta na mesa é sempre *"e se eu tivesse investido há
X?"* — então a escolha é discreta: Este ano (YTD), 1, 2, 3, 5, 10, 15, 20, 30 anos e Tudo.
Padrão: 10 anos. A janela conta para trás a partir do **último dia com dado**, não de hoje:
senão o mesmo botão mostraria número diferente a cada semana conforme o arquivo envelhece.
Se a janela pedida for maior que o histórico disponível, o gráfico não mente — avisa quantos
anos realmente tem.

**Métricas.** Além de CAGR, vol, Sharpe e máx DD:

| Métrica | O que é | Por que está aqui |
|---|---|---|
| **Sortino** | retorno ÷ desvio só das quedas | O Sharpe pune um mês de +30% como se fosse risco. Num portfólio de momento isso distorce. |
| **Calmar** | CAGR ÷ maior queda | Retorno por unidade de dor — é o que o cliente sente na pele. |
| **Correlação com S&P** | Pearson dos retornos diários na janela | Recalcula a cada estratégia que entra ou sai. É o argumento de diversificação. |

### Correlação separada por regime — leia antes de apresentar

A correlação cheia **mistura dois regimes opostos e não descreve nenhum dos dois**: exposto o
portfólio anda com o índice, blindado ele descola. O número único é a média disso. Por isso a
tela mostra os dois lados, classificando o retorno do dia `d` pelo estado da defesa **do dia
`d`** — o retorno foi ganho carregando a posição daquele dia.

Portfólio de 6 setoriais, os mesmos dados, só mudando a janela:

| Janela | Exposto: corr / port / S&P | Defesa: corr / port / S&P |
|---|---|---|
| Tudo (38a) | 0,68 · +33,9% · +16,6% | **−0,28 · +15,2% · −0,4%** |
| 20 anos | 0,70 · +33,1% · +16,7% | **−0,31 · +16,3% · −0,2%** |
| 10 anos | 0,66 · +38,2% · +16,4% | −0,20 · +7,8% · **+12,7%** |
| 5 anos | 0,63 · +49,3% · +13,9% | **+0,09** · +8,5% · **+12,8%** |

**Na janela longa a defesa se paga; nas curtas, não.** Em 20 e 38 anos ela arma quando o S&P
está realmente caindo (−0,2% e −0,4% ao ano nesses dias) e o portfólio segue ganhando 15–16%.
Em 5 e 10 anos ela arma enquanto o índice **sobe** 12,7%/12,8% — e o portfólio rende só 8%
nesses dias. No recorte de 5 anos a correlação em defesa chega a **+0,09**: o descolamento
sumiu.

Ou seja, na última década a defesa custou dinheiro, e foram em boa parte alarmes falsos. Isso
não invalida o sistema — é o preço do seguro num período sem sinistro grande — mas **muda o
que se pode dizer em cima do gráfico**. Se a apresentação abrir na janela de 5 anos e o
cliente perguntar o que a defesa fez por ele, a resposta honesta naquele recorte é: custou.
O argumento da defesa vive nas janelas longas.

O CAGR do S&P na mesma janela aparece embaixo do retorno do portfólio, lado a lado.

**O benchmark é do sistema, não da seleção.** Cada estratégia carrega uma cópia da referência
reescalada para o próprio nascimento; conferido que a razão entre duas cópias é constante até
a 6ª casa, ou seja é a mesma série. `export_dataset.py` elege uma como referência mestre
(`benchmark.json`). Se saísse de uma das selecionadas, trocar uma estratégia mudaria o
benchmark junto — e duas correlações deixariam de ser comparáveis.

**Painéis com seta.** "O que você estava carregando" e "Períodos de defesa" abrem e fecham no
título. Defesa começa fechada (é lista longa); o carregamento começa aberto.

---

## 6. Decisões de interface que têm motivo

- **Tile só com título e valor.** A explicação saía dentro do tile e deixava uma faixa morta
  à direita em cada um — nove tiles, nove buracos. Agora o tile é clicável e a explicação
  abre na barra do topo, onde há largura para texto de verdade. Efeito colateral bom: o
  quadro de correlação por regime subiu ~60 px e os tiles ficaram densos (grid de 118 px).
  As explicações são **contextuais** — leem os números da simulação corrente, não são
  legendas fixas ("Aqui está em 1,29 contra Sharpe de 0,92 — a diferença é a volatilidade
  de alta que estava sendo cobrada como perigo"). A faixa nasce **encostada nos tiles**, não
  no topo da tela: o texto tem de aparecer ao lado do número que o cliente apontou, senão o
  olho perde a ligação entre os dois (proximidade, Laws of UX). A barra de janelas fica só
  com as janelas.
- **Barra de 100%** — o cliente vê a alocação, não soma de cabeça (Krug).
- **Aviso de custo em histórico** — cada estratégia no catálogo mostra `−18a` quando entrar
  nela recorta o backtest. Vira um momento bom da apresentação em vez de uma surpresa.
- **Simulação automática** com 120 ms de atraso — arrastar o peso muda a curva na hora. É isso
  que faz a construção parecer a quatro mãos, e não um formulário com botão de enviar.
- **Faixa de defesa** em SVG próprio, não série de gráfico: o que importa ali é a leitura de
  bloco ("esse pedaço todo estava defendido"), não o valor pontual.
- **Limiar de defesa com folga de 1e-9** — num portfólio 50/50, "metade blindada" cai
  exatamente em cima de 0,5 e a borda do período passaria a ser decidida por arredondamento.
  Sem a folga, apareciam períodos terminando no dia do rebalance por acaso.
- **Ano parcial não concorre** a melhor/pior ano: o portfólio começa em setembro de 1988, e
  quatro meses não disputam com doze.

---

## 7. Em aberto — decisões do João

1. **Rebalance padrão.** Está mensal, com seletor na tela (diário a anual).
2. **Janela quando as estratégias nascem em datas diferentes.** Padrão: só o período em comum,
   com aviso. A alternativa (cada uma entra quando nasce) está no seletor.
3. **Ligar os modelos P1–P6** como ponto de partida do portfólio. Eles moram no terminal
   (`harpian-terminal-next/lib/portfolioModels.ts`) e teriam de ser copiados para cá — o
   modulo nao pode depender do repo do cliente.
4. **Trocar o mock de `etp-defense-periods`** do terminal pelos períodos reais (§4).
5. **Corrigir os 7 nomes truncados** das estratégias S36C–S42C (§9 do HANDOFF do dataset).

## 9. Os SETs prontos (benchmarks pré-montados) — v3, 100% AlphaDroid

**Spec:** `C:\dev\estrategias salvas para apresentacao\_lab\SPEC_3_SETS_BUILDER.md` (v3)
**Onde aparece:** botões na barra do topo, ao lado dos anos. Clicar carrega o setup inteiro no
builder — sleeves, pesos, rebalance, janela travada e overlay — e o painel de Resultado se
enche sozinho.

### A regra da v3

**A composição é 100% AlphaDroid.** Saiu o bloco `HC-US IG`, que era o motor HC-US 3.1 da
Harpian (321 ações americanas individuais) e ocupava 30–40% de cada SET. O que a Harpian assina
agora é só o **balanceamento entre os dois motores do AlphaDroid**.

O custo foi medido antes de decidir, não depois: Sharpe caiu de 1,64/1,65/1,70 para
1,63/1,64/1,63 — dentro do ruído. O preço real foi 2022 (de ≈0% para −8%). Em troca, a
correlação com o S&P caiu de 0,49–0,52 para **0,42** e não há mais caixa-preta para explicar
na mesa. Medições em `_lab\dissecar_hcusig.py` e `_lab\sem_hcusig.py`.

### Os dois blocos e o gatilho

| Bloco | O que faz |
|---|---|
| **Rotação K=20** | as 20 de maior RetMes do mês, teto de 10% cada |
| **Corr-min 20** | as 20 que menos andam juntas, peso igual, 1,67 troca/rebalance |

**Gatilho de amplitude** — a peça que substituiu a máquina de regime do motor que saiu: quando
menos de **12 das 41** têm momento positivo, o bloco de rotação inteiro vai para as 5
estratégias de preservação de capital. Disparou **11 vezes em 178 rebalances**, sendo 7 delas o
bear de 2022 seguido. Leva o Calmar da rotação de 1,17 para 1,47.

Sem ele não existe nada no nível do portfólio: a defesa StormGuard mora dentro de cada
estratégia e não conversa entre elas.

### Os 3 SETs

| SET | Composição | Sharpe | Calmar | CAGR | maxDD | 2022 |
|---|---|---|---|---|---|---|
| D3 AGRESSIVO | 50% rotação + 50% corr-min | 1,63 | 1,47 | 34,3% | −23,4% | −7,6% |
| D5 BALANCEADO | 40/40/20 com Agg.Bond | **1,64** | 1,46 | 27,5% | −18,8% | −8,7% |
| D6 CONSERVADOR | D5 + vol-target 12% a.a. | 1,63 | **1,48** | 20,5% | −13,9% | −8,3% |
| EW-41 (régua) | as 41 com peso igual | 1,57 | 1,20 | 25,4% | −21,1% | −15,3% |

Janela fixa **2011-08-01 → 2026-06-04**, que não obedece ao seletor de janela da tela: é a
janela em que os números foram medidos e aprovados.

### Modo dinâmico com peso de bloco travado

O SET carrega em `mode: "dynamic"` — é o que ele é, e a tela precisa acender "Alocação
dinâmica". Mas o peso ENTRE OS BLOCOS é fixo, e no modo dinâmico o motor distribui por score.
Como os blocos não têm score, sem `min = max = peso` o water-filling racharia tudo em partes
iguais. `presets.test.ts` trava essa invariante.

### A fronteira

Os dois blocos rodam offline (`_pipeline\export_3sets.py`) e chegam como streams de retorno
diário. A **composição** — mistura mensal t/t+1 e overlay com sleeve de caixa — roda no app, e
`benchmark-sets.test.ts` confere cada célula da tabela de validação e da tabela ano a ano.

### Para atualizar

```bash
cd "C:\dev\estrategias salvas para apresentacao\_pipeline"
python export_3sets.py
cd C:\dev\harpian-cockpit-next
npx tsx lib/portfolio-builder/benchmark-sets.test.ts
npx tsx lib/portfolio-builder/presets.test.ts
```

---

## 10. Modo apresentação

**Onde:** botão `▶ Modo apresentação` no cabeçalho, ao lado do seletor de alocação. Acende
quando há portfólio simulado. Tela cheia por cima de tudo; `Esc` volta, espaço toca/pausa.

O que roda: a curva avança no tempo com o S&P de benchmark, e à esquerda as **41 estratégias
empilhadas**, cada uma com o nome e uma barra ao lado que cresce e encolhe conforme a alocação
do dia. Sem número na barra de propósito — 41 números mudando 4× por segundo ninguém lê; o
número que importa (data, capital, retorno, S&P, quantas em carteira) fica grande no topo.

Cortes de 5 / 10 / 15 anos e Tudo; velocidades de 0,5× a 4× (120 a 1.000 pregões por segundo);
scrubber para voltar a um momento específico.

### A boneca russa dos pesos

Num SET o portfólio tem 2–3 sleeves (blocos), não 41. As barras precisam do peso de cada
estratégia, então `lib/portfolio-builder/apresentacao.ts` desmonta:

```
peso da estratégia i no dia d
    = peso do BLOCO no portfólio naquele dia   (do motor, com deriva)
    × peso da estratégia DENTRO do bloco       (do export, com deriva)
```

O segundo fator vem de `pesosDiarios` no `benchmark-sets.json` — matriz de 41 × 3.733 por
bloco, em décimo de ponto percentual (450 = 4,5%). É peso **diário**, não do rebalance: dentro
do mês ele deriva com o desempenho de cada uma, e é essa deriva que faz a barra respirar em vez
de pular uma vez por mês. Custa ~750 KB dos 1,37 MB do arquivo.

Num portfólio montado à mão não há bloco: cada sleeve já é uma linha, e o mesmo código serve.

### Escala da barra

Não é o pico global — uma estratégia que chegou a 12% achataria as outras 40 o tempo todo. É o
percentil 95 dos picos de cada linha, com piso de 2%. Blocos inteiros (HC-US IG, renda fixa)
saturam a barra, o que é correto: 40% constante É o topo da escala.

### Performance

A animação **não passa por estado do React**: um `requestAnimationFrame` avança o cursor e
escreve direto no `style.width` das barras e no `update()` da série do gráfico. Re-renderizar
43 linhas 60 vezes por segundo derrubaria a tela na hora em que ela precisa impressionar.

> `rAF` não roda em aba oculta — se a animação parecer travada num teste automatizado, é isso,
> não bug. Com a aba na frente roda normal. O `dt` é limitado a 0,25 s para a curva não dar um
> salto quando o apresentador volta de outro app.

---

## 8. O que este módulo já mostra e vale discutir

Num portfólio 50/50 de Consumer Discretionary + Energy, 1988–2026:

| | Linear | Dinâmico |
|---|---|---|
| Retorno ao ano | 32,4% | 42,2% |
| Maior queda | −39,1% | −55,6% |

**Alocação dinâmica rende mais e cai muito mais.** Concentrar no líder de momento cobra caro,
e o número está na tela em vez de escondido. Vale decidir como esse trade-off vai ser
apresentado antes de sentar com o cliente.

E o dado que mais convence: num portfólio de Utilities + Technology + Treasuries, o maior
drawdown **não é 2008** — é 2025. Em 2008 o portfólio estava 100% blindado em `TLT-` e `$CASH`.

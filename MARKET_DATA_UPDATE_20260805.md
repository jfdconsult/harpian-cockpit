# Harpian — Atualização de Fechamentos / Tickers

**Data da atualização:** 2026-08-05  
**Executor:** Hermes / WSL  
**Fonte usada nesta rodada:** Yahoo Finance via `yfinance`  
**Motivo:** atualizar os valores de fechamento dos tickers das estratégias CORE22 + SID até a data atual para permitir cálculo de momentum/retornos recentes.

---

## 1. Escopo atualizado

Universo operacional usado nesta rodada:

- 40 estratégias internas CORE22 + SID.
- 426 tickers únicos extraídos de:
  - `C:\dev\alphadroid-reverse\hce\data\core22_universe.json`
  - `C:\dev\alphadroid-reverse\hce\data\sid_universe.json`
  - auditoria consolidada em `C:\dev\HARPIAN_CORE_SID_TICKER_COVERAGE_20260805.csv`

Importante: esta atualização é de **preços/fechamentos de ativos/tickers**. Ela **não resolve** o P0 do `suavemin15` no pipeline dos SETs. O pipeline de SETs continua bloqueado até o motor SUAVE ser portado para `export_3sets.py`.

---

## 2. Resultado da atualização

Arquivo principal para uso em cálculo de momentum/close:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_close_panel.parquet
```

Características:

- 426 colunas/tickers.
- 16.256 datas.
- Período total: 1962-01-02 até 2026-08-05.
- 416 tickers com fechamento disponível após merge.
- 414 tickers atualizados até 2026-08-05.
- 1 ticker atualizado até 2026-08-04: `EA`.
- 1 ticker com histórico encerrado em 2018-06-15: `TWX`.
- 10 tickers ainda sem preço nesta rodada.

Arquivo consolidado amplo, sem sobrescrever a base original:

```text
C:\dev\harpian-data-warehouse\market_data\broad_panel_plus_core_sid_updated.parquet
C:\dev\alphadroid-reverse\BROAD_UNIVERSE\broad_panel_plus_core_sid_updated.parquet
```

Características da base ampla consolidada:

- 1.006 tickers.
- 16.256 datas.
- Período total: 1962-01-02 até 2026-08-05.
- Junta a base antiga `broad_panel.parquet` com os tickers CORE22/SID baixados agora.
- A base original `broad_panel.parquet` não foi sobrescrita.

---

## 3. Tickers pendentes / sem fechamento Yahoo

A segunda tentativa com aliases corrigiu `BRKB` para `BRK-B` e salvou a coluna como `BRKB`.

Permanecem sem fechamento nesta rodada:

```text
BK
BMC
CA
HOLX
K
MMC
MOLX
PALM
SEE
SKS
```

Observações:

- `TWX` tem histórico até 2018-06-15 e deve ser tratado como ativo antigo/delisted no cálculo.
- `EA` veio até 2026-08-04, possivelmente por calendário/atraso do provider.
- Alguns tickers pendentes parecem delisted/antigos; outros podem exigir provider alternativo ou alias manual.
- Próximo fallback recomendado: Alpaca/SIP ou outro vendor institucional, quando as credenciais estiverem disponíveis no WSL.

---

## 4. Arquivos de controle gerados

Relatório final:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_final_update_report_20260805_170352.json
```

Cobertura ticker a ticker:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_final_coverage_after_update_20260805_170352.csv
```

Download bruto Yahoo de fechamento:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_yfinance_close_download_20260805_165729.parquet
```

Adj Close Yahoo:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_yfinance_adj_close_download_20260805_165729.parquet
```

Volume Yahoo:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_yfinance_volume_download_20260805_165729.parquet
```

Backups dos parquets antigos antes da criação dos painéis novos:

```text
C:\dev\harpian-data-warehouse\market_data\backups\20260805_165729
```

Scripts usados:

```text
C:\dev\update_harpian_core_sid_prices.py
C:\dev\retry_harpian_failed_prices.py
C:\dev\finalize_harpian_price_update.py
```

---

## 5. Como o próximo Claude deve usar isto

Para cálculo de momentum/close dos ativos das 40 estratégias internas, usar primeiro:

```text
C:\dev\harpian-data-warehouse\market_data\core_sid_close_panel.parquet
```

Para uma base mais ampla que preserva a base histórica antiga e adiciona CORE22/SID:

```text
C:\dev\harpian-data-warehouse\market_data\broad_panel_plus_core_sid_updated.parquet
```

Não usar `broad_panel.parquet` sozinho para concluir cobertura das estratégias, porque ele continua sendo a base antiga e não inclui todos os tickers atualizados nesta rodada.

Não rodar `export_3sets.py`/`run_all.py` ainda se o objetivo for SETs de produção: o P0 do `suavemin15` continua válido. Primeiro portar o motor SUAVE para o pipeline e executar o teste de reprodução descrito em `HANDOFF_MASTER_20260804.md` §7.

---

## 6. Resumo executivo para handoff

> Em 2026-08-05 foi criada a base atualizada de fechamentos CORE22/SID em `C:\dev\harpian-data-warehouse\market_data\core_sid_close_panel.parquet`: 426 tickers, 16.256 datas, 1962-01-02 a 2026-08-05; 416 tickers com dados, 414 atualizados até 2026-08-05. A base ampla consolidada está em `broad_panel_plus_core_sid_updated.parquet` com 1.006 tickers. A atualização de preços NÃO libera o pipeline dos SETs: o P0 do `suavemin15` continua bloqueando `export_3sets.py` até o motor SUAVE ser integrado.

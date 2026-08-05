# Análise institucional do SUAVE — versão corrigida

*(Texto do JIM AI de 04/08/2026 com os números conferidos contra a série real —
correções em `CHECAGEM_JIM_20260804.md`. Esta é a versão que pode circular.)*

---

O portfólio entregou um resultado sólido em base risk-adjusted: **8,85% ao ano
em 15 anos** — US$ 100k iniciais viraram US$ 357k — com volatilidade controlada
em 4,7% e **Sharpe de 1,82**, consistente dentro e fora da amostra (1,82 IS /
1,86 HO). Métricas que indicam eficiência estrutural, não sorte de janela.

A correlação com o S&P é o ponto institucional mais relevante — e é mais forte
do que o número médio sugere. A correlação cheia é de **0,30**; nos momentos em
que ela importa, **cai**: 0,12 nos períodos em que o S&P esteve em drawdown
superior a 10%, e **0,03 nos ~10% piores meses do índice** — meses em que o
S&P caiu em média 6,9% e este portfólio ficou flat (−0,05%). A diversificação
melhora exatamente no stress, porque o gatilho de amplitude e o overlay de
volatilidade já retiraram a carteira do risco antes — em fevereiro–abril de
2020, a queda máxima foi de **1,86%**.

Num cenário de 100% do motor DMAX puro, o investidor teria visto **~67% ao ano
com volatilidade de 35% e quedas de até 38%** — um perfil para outro mandato.
O SUAVE é o mesmo motor na dose que um mandato conservador aguenta: exposição
média de 22%, dimensionada semanalmente pelo alvo de volatilidade de 3,5%.

O que funcionou foi a restrição. O piso de 1% em cada uma das 15 estratégias
elimina concentração e mantém todas sempre alocadas; o overlay age como
guarda-chuva automático, puxando exposição para baixo quando a turbulência
sobe — **decisão semanal**, sobre a volatilidade da carteira sem escala, sem
olhar para frente. O motor rebalanceia mensalmente por momento. O resultado
prático: **nenhum ano negativo em 15** (pior: 2022, +0,85%), queda máxima de
−4,42%, e apenas **5 quedas maiores que 3% em 15 anos — nenhuma maior que 5%**,
com 2/3 do tempo em máxima histórica ou a menos de 1% dela.

A fraqueza é também sua força: o portfólio deixa retorno na mesa por design.
Os ~78% médios fora do motor estão modelados **a caixa com juro zero** — uma
convenção conservadora do backtest, não uma limitação do produto. Remunerando
esse caixa a T-bill de 3 meses (curva FRED), o mesmo histórico teria entregado
**~10,3% ao ano com a mesma queda máxima** — em 2024, +22,5% contra +17,2% da
convenção a juro zero. Essa é a projeção de implementação; a curva oficial
permanece na convenção conservadora até a validação completa.

Daqui para frente, três pontos de monitoramento: (1) a volatilidade realizada
da série **líquida** contra a banda do alvo de 3,5% — é o termômetro de que o
overlay está calibrado; (2) a correlação com o S&P em janelas de stress contra
a régua histórica de 0,03–0,12; (3) revisão trimestral da calibração. A
implementação do caixa em T-bills captura o regime de juros naturalmente, sem
necessidade de regras condicionais de exposição. Perfil recomendado: cliente
com horizonte longo e aversão a barulho.

*Ressalva de integridade: métricas de backtest com seleção sobre 23.754
combinações; custos de transação não modelados; validação independente
(protocolo Arena) pendente antes de qualquer selo.*

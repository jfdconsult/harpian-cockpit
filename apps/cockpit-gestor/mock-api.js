/* ============================================================
   MOCK API SHIM — intercepta fetch() e devolve dados mock inline.
   Permite rodar o cockpit como site estático (GitHub Pages)
   sem backend FastAPI.
   Incluir ANTES de qualquer script da página:
     <script src="mock-api.js"></script>
   ============================================================ */
(function(){
'use strict';

// ========== MOCK DATA (espelho do data.py) ==========

var PORTFOLIOS = [
  {"id":"HPC11","nome":"HPC11","descricao":"ETF · Investment Grade","isin":"a confirmar",
   "motor":"Híbrido US 3.1 + US 11","motor_version":"v4.1",
   "regime":"RISK-ON","alocado_usd":38200000,"exposicao_pct":92,"dd_mes_pct":-3.2,
   "risk_number":18,"mudancas_entradas":2,"mudancas_saidas":1,
   "cagr_pct":19.2,"sortino":1.75,"calmar":1.93,"max_dd_pct":-9.96,
   "cota":104.12,"estado":"homologado","pilares":[],"esteiras":[
     {"nome":"TECH_BROAD","peso_pct":40,"ativos":[{"ticker":"QQQ","tipo":"ETF","peso_pct":50},{"ticker":"VGT","tipo":"ETF","peso_pct":50}]},
     {"nome":"HEALTH","peso_pct":20,"ativos":[{"ticker":"XLV","tipo":"ETF","peso_pct":60},{"ticker":"LLY","tipo":"AÇÃO","peso_pct":40}]},
     {"nome":"CYCLICALS","peso_pct":20,"ativos":[{"ticker":"XLY","tipo":"ETF","peso_pct":50},{"ticker":"XLF","tipo":"ETF","peso_pct":50}]},
     {"nome":"Defesa","peso_pct":20,"ativos":[{"ticker":"GLD","tipo":"COMMODITY","peso_pct":25},{"ticker":"TLT","tipo":"ETF","peso_pct":25},{"ticker":"XLU","tipo":"ETF","peso_pct":25},{"ticker":"XLE","tipo":"ETF","peso_pct":25}]}
   ]},
  {"id":"HPC22","nome":"HPC22","descricao":"Ações · agressivo · LS155","isin":"XS3386635109",
   "motor":"HC-US 3.1","motor_version":"v3.0",
   "regime":"WARNING","alocado_usd":27900000,"exposicao_pct":71,"dd_mes_pct":-5.8,
   "risk_number":29,"mudancas_entradas":4,"mudancas_saidas":3,
   "cagr_pct":43.3,"sortino":2.22,"calmar":1.73,"max_dd_pct":-25.0,
   "cota":128.40,"estado":"live","pilares":[
     {"nome":"Pilar A · Inovação","peso_pct":45,"esteiras":[
       {"nome":"SEMIS","peso_pct":40,"ativos":[{"ticker":"NVDA","tipo":"AÇÃO","peso_pct":40},{"ticker":"AVGO","tipo":"AÇÃO","peso_pct":35},{"ticker":"SOXX","tipo":"ETF","peso_pct":25}]},
       {"nome":"TECH_CONC","peso_pct":35,"ativos":[{"ticker":"PLTR","tipo":"AÇÃO","peso_pct":50},{"ticker":"MSFT","tipo":"AÇÃO","peso_pct":50}]},
       {"nome":"COMM","peso_pct":25,"ativos":[{"ticker":"GOOGL","tipo":"AÇÃO","peso_pct":50},{"ticker":"META","tipo":"AÇÃO","peso_pct":50}]}
     ]},
     {"nome":"Pilar B · Líderes","peso_pct":30,"esteiras":[
       {"nome":"HEALTH","peso_pct":40,"ativos":[{"ticker":"LLY","tipo":"AÇÃO","peso_pct":60},{"ticker":"XLV","tipo":"ETF","peso_pct":40}]},
       {"nome":"FIN_INDS","peso_pct":60,"ativos":[{"ticker":"JPM","tipo":"AÇÃO","peso_pct":40},{"ticker":"CAT","tipo":"AÇÃO","peso_pct":30},{"ticker":"XLI","tipo":"ETF","peso_pct":30}]}
     ]},
     {"nome":"Pilar C · Navegador","peso_pct":15,"esteiras":[
       {"nome":"ENERGY_MAT_UTIL","peso_pct":100,"ativos":[{"ticker":"XLE","tipo":"ETF","peso_pct":40},{"ticker":"XLB","tipo":"ETF","peso_pct":30},{"ticker":"XLU","tipo":"ETF","peso_pct":30}]}
     ]},
     {"nome":"Pilar D · Defesa","peso_pct":10,"esteiras":[
       {"nome":"DEF_TOP4","peso_pct":100,"ativos":[{"ticker":"GLD","tipo":"COMMODITY","peso_pct":30},{"ticker":"TLT","tipo":"ETF","peso_pct":25},{"ticker":"XLU","tipo":"ETF","peso_pct":25},{"ticker":"XLE","tipo":"ETF","peso_pct":20}]}
     ]}
   ],"esteiras":[]},
  {"id":"HCUST","nome":"HC-US TOTAL","descricao":"cestão 9/9","isin":null,
   "motor":"HC-US TOTAL","motor_version":"v1.0",
   "regime":"RISK-ON","alocado_usd":18100000,"exposicao_pct":96,"dd_mes_pct":-2.1,
   "risk_number":41,"mudancas_entradas":1,"mudancas_saidas":1,
   "cagr_pct":44.2,"sortino":2.16,"calmar":1.59,"max_dd_pct":-27.9,
   "cota":115.30,"estado":"lab","pilares":[],"esteiras":[]}
];

var TICKETS = [
  {"id":"T001","ticker":"NVDA","nome":"NVIDIA","side":"buy","tipo":"AUMENTO","portfolio_id":"HPC22",
   "motivo":"aceleração momentum · ranking #1","quantidade":1200,"valor_usd":142000,
   "status":"pendente","score":82,"mom_126d":34.5,"pilar":"A · Inovação","esteira":"SEMIS"},
  {"id":"T002","ticker":"AVGO","nome":"Broadcom","side":"buy","tipo":"AUMENTO","portfolio_id":"HPC22",
   "motivo":"aceleração momentum · ranking #2","quantidade":410,"valor_usd":98000,
   "status":"pendente","score":78,"mom_126d":28.1,"pilar":"A · Inovação","esteira":"SEMIS"},
  {"id":"T003","ticker":"AAPL","nome":"Apple","side":"sell","tipo":"REDUÇÃO","portfolio_id":"HPC22",
   "motivo":"freando · perdeu ranking","quantidade":980,"valor_usd":195000,
   "status":"pendente","score":45,"mom_126d":-8.2,"pilar":"A · Inovação","esteira":"TECH_CONC"},
  {"id":"T004","ticker":"TSLA","nome":"Tesla","side":"sell","tipo":"TROCA","portfolio_id":"HPC22",
   "motivo":"sai do ranking → SMCI entra","quantidade":500,"valor_usd":120000,
   "status":"pendente","score":32,"mom_126d":-15.0,"pilar":"B · Líderes","esteira":"FIN_INDS","troca_para":"SMCI"},
  {"id":"T005","ticker":"XLE","nome":"Energy Select","side":"buy","tipo":"ENTRADA","portfolio_id":"HPC22",
   "motivo":"defesa · entrada no top-4","quantidade":620,"valor_usd":55000,
   "status":"pendente","score":60,"mom_126d":12.0,"pilar":"D · Defesa","esteira":"DEF_TOP4"},
  {"id":"T006","ticker":"MU","side":"buy","tipo":"AUMENTO","portfolio_id":"HPC22",
   "motivo":"aceleração","quantidade":900,"valor_usd":98000,
   "status":"enviado","score":71,"mom_126d":18.5,"pilar":"A · Inovação","esteira":"SEMIS"},
  {"id":"T007","ticker":"UNH","side":"buy","tipo":"ENTRADA","portfolio_id":"HCUST",
   "motivo":"rotação defensiva","quantidade":300,"valor_usd":88000,
   "status":"pendente","score":55,"mom_126d":5.2,"pilar":null,"esteira":null},
  {"id":"T008","ticker":"GLD","side":"sell","tipo":"REDUÇÃO","portfolio_id":"HPC11",
   "motivo":"realocação · ouro saindo do top-4","quantidade":400,"valor_usd":88000,
   "status":"enviado","score":48,"mom_126d":-3.1,"pilar":null,"esteira":"Defesa"}
];

var AUDIT = [
  {"ts":"2026-06-27T17:00:05","actor":"scheduler","role":"system","tenant_id":"harpian","action":"pipeline.eod_completed","ref":"run_20260627","detail":"Yahoo/FRED fetch OK · 34 tickers · 0 falhas"},
  {"ts":"2026-06-27T17:00:12","actor":"scheduler","role":"system","tenant_id":"harpian","action":"motor.daily_run","ref":"run_20260627","detail":"HC-US 3.1 v3 · HPC22 · 8 ordens geradas"},
  {"ts":"2026-06-27T09:35:22","actor":"João Daniel","role":"socio_gestor","tenant_id":"harpian","action":"ticket.approved","ref":"T006","detail":"MU buy 900 · aprovado sem ajuste"},
  {"ts":"2026-06-27T09:37:15","actor":"system","role":"system","tenant_id":"harpian","action":"order.filled","ref":"T006","detail":"MU buy 900 @$108.42 · preenchido parcial (800/900)"},
  {"ts":"2026-06-26T09:40:00","actor":"Diogo","role":"gestor_quant","tenant_id":"harpian","action":"version.promoted","ref":"strategy_v3.0","detail":"HC-US 3.1 v3 promovido ao registry · golden-master OK"},
  {"ts":"2026-06-25T14:20:00","actor":"João Daniel","role":"socio_gestor","tenant_id":"harpian","action":"kill_switch.activated","ref":"ks_20260625","detail":"Kill switch ativado — pausa de execução (voltou 16h)"}
];

var DEFENSE_STATE = {
  "HPC22":{"regime":"WARNING","defesa_pct":29,"pilares":{"A":{"nome":"Inovação","temp":0.42,"turb":0.38,"trend_break":0.45,"jerk":0.44,"limiar":0.60,"status":"ataque"},"B":{"nome":"Líderes","temp":0.55,"turb":0.52,"trend_break":0.58,"jerk":0.56,"limiar":0.60,"status":"alerta"},"C":{"nome":"Navegador","temp":0.31,"turb":0.28,"trend_break":0.34,"jerk":0.30,"limiar":0.60,"status":"ataque"},"D":{"nome":"Defesa","temp":0.18,"turb":0.15,"trend_break":0.20,"jerk":0.19,"limiar":null,"status":"ativo"}},"cc":0.62,"cc_gate_low":0.55,"cc_gate_high":0.75,"g":0.35,"ema20_acima":true,"velocity":1.2,"reentry":{"status":"monitorando","days_in_defense":0,"target_pct":null}},
  "HPC11":{"regime":"RISK-ON","defesa_pct":8,"pilares":{},"cc":0.48,"cc_gate_low":0.55,"cc_gate_high":0.75,"g":0.0,"ema20_acima":true,"velocity":2.1,"reentry":{"status":"n/a","days_in_defense":0,"target_pct":null}}
};

var INDICATORS_STATE = {
  "temperatura":{"valor":0.42,"limiar":0.60,"status":"normal","desc":"Média ponderada turb/trend-break/jerk"},
  "cross_correlation":{"valor":0.62,"limiar_low":0.55,"limiar_high":0.75,"g":0.35,"status":"elevado","desc":"Correlação cruzada dos ativos"},
  "ema20":{"valor":"acima","dist_pct":2.3,"status":"ok","desc":"EMA 20 como filtro de re-entrada"},
  "mac_score":{"valor":68,"limiar":50,"status":"positivo","desc":"Macro: 13F + COT + Fed funds"}
};

var PILAR_D = {
  "universo":["TLT","IEF","SHY","BIL","AGG","GLD","XLE","XLU","XLP","XLV"],
  "top4_atual":["GLD","XLE","TLT","XLU"],"cap_pct":34,"rotacao_freq":"mensal","contribuicao_ytd_pct":3.2
};

var BACKTEST_RUNS = [
  {"id":"BT001","alvo":"HPC22","estrategia":"HC-US 3.1","metodo":"DeLorean","periodo":"2007-2026","custos_bps":15,"rebalance":"mensal + defesa diária","status":"completo","grade":"A","ts":"2026-06-26T14:30:00",
   "metricas":{"oos":{"cagr":43.3,"sortino":2.22,"calmar":1.73,"max_dd":-25.0,"risk_num":29},"cheio":{"cagr":34.0,"sortino":2.03,"calmar":0.90,"max_dd":-30.4,"risk_num":29}},
   "crises":{"GFC_2008":-8.6,"COVID_2020":-21.3,"Bear_2022":9.1},
   "annual_returns":{"2007":12.5,"2008":-8.6,"2009":45.2,"2010":22.1,"2011":8.4,"2012":18.9,"2013":38.2,"2014":15.6,"2015":4.2,"2016":28.4,"2017":42.1,"2018":-12.5,"2019":55.8,"2020":38.4,"2021":62.1,"2022":9.1,"2023":48.2,"2024":35.6,"2025":28.9}},
  {"id":"BT002","alvo":"HPC11","estrategia":"Híbrido v4","metodo":"DeLorean","periodo":"2007-2026","custos_bps":15,"rebalance":"mensal","status":"completo","grade":"A","ts":"2026-06-25T10:00:00",
   "metricas":{"oos":{"cagr":19.2,"sortino":1.75,"calmar":1.93,"max_dd":-9.96,"risk_num":18},"cheio":{"cagr":16.8,"sortino":1.63,"calmar":1.42,"max_dd":-11.8,"risk_num":18}},
   "crises":{"GFC_2008":-4.2,"COVID_2020":-8.1,"Bear_2022":2.3},"annual_returns":{}},
  {"id":"BT003","alvo":"H-01 candidato","estrategia":"termômetro v2","metodo":"DeLorean","periodo":"2016-2026","custos_bps":15,"rebalance":"mensal","status":"rodando","grade":null,"ts":"2026-06-27T09:15:00","metricas":{},"crises":{},"annual_returns":{}},
  {"id":"BT004","alvo":"H-00 half-life","estrategia":"half-life curto","metodo":"DeLorean","periodo":"2007-2026","custos_bps":15,"rebalance":"mensal","status":"red_flag","grade":"F","ts":"2026-06-24T16:00:00",
   "metricas":{"oos":{"cagr":112.0,"sortino":5.08,"calmar":4.2,"max_dd":-8.0,"risk_num":15}},"crises":{},"annual_returns":{},
   "red_flags":["Sortino > 4.5 (5.08)","CAGR > 100% (112%)"]}
];

var FORMULAS = [
  {"id":"F01","grupo":"Defesa","nome":"Temperatura · pesos","desc":"turb · trend-break · jerk","valor_atual":"0,40 / 0,35 / 0,25","unidade":"pesos","editavel":true},
  {"id":"F02","grupo":"Ataque","nome":"Gate momentum 126d","desc":"corte de entrada","valor_atual":"+5,0%","unidade":"%","editavel":true},
  {"id":"F03","grupo":"Defesa","nome":"Banda do gatilho (cc)","desc":"correlação cruzada graduada","valor_atual":"0,55 → 0,75","unidade":"faixa","editavel":true},
  {"id":"F04","grupo":"Ataque","nome":"Slots de concentração","desc":"4@10% / 2@7,5% / 2@5%","valor_atual":"19 posições","unidade":"posições","editavel":true},
  {"id":"F05","grupo":"Ataque","nome":"Ranking — momentum 126d","desc":"janela do momentum de seleção","valor_atual":"126 dias","unidade":"dias","editavel":true},
  {"id":"F06","grupo":"Defesa","nome":"EMA re-entry","desc":"EMA 20 como filtro de re-entrada","valor_atual":"EMA(20)","unidade":"período","editavel":true},
  {"id":"F07","grupo":"Pilar D","nome":"Cap defesa","desc":"limite máximo do Pilar D na carteira","valor_atual":"34%","unidade":"%","editavel":true},
  {"id":"F08","grupo":"Pilar D","nome":"Top-N rotação","desc":"quantos ativos entram na rotação","valor_atual":"4","unidade":"ativos","editavel":true},
  {"id":"F09","grupo":"Ataque","nome":"DEMA cascata tau","desc":"período curto do DEMA-cascata","valor_atual":"36 dias","unidade":"dias","editavel":true},
  {"id":"F10","grupo":"Defesa","nome":"Jerk threshold","desc":"limiar de aceleração da queda","valor_atual":"0,25","unidade":"score","editavel":true}
];

var CALIBRATION_CANDIDATES = [
  {"id":"C-12","descricao":"Filtro de earnings + gate 5,5%","status":"validado","hipotese":"H-02","ts":"2026-06-26T15:00:00",
   "alteracoes":[{"formula_id":"F02","de":"+5,0%","para":"+5,5%"},{"formula_id":"F_NEW","nome":"Filtro earnings","de":"off","para":"ligado"}],
   "metricas_atual":{"sortino":1.89,"cagr":38.6,"max_dd":-48.0,"calmar":0.80},
   "metricas_candidato":{"sortino":1.94,"cagr":40.1,"max_dd":-45.2,"calmar":0.89},
   "golden_master":true,"validadores_9":true,"wf_gap":0.27}
];

var RECONCILIATION = [
  {"ticker":"NVDA","hqp_target":1200,"ibkr_fill":1200,"lynks_pos":1200,"delta":0,"status":"ok"},
  {"ticker":"MU","hqp_target":900,"ibkr_fill":800,"lynks_pos":800,"delta":-100,"status":"parcial","nota":"Preenchido parcial — 100 unid. pendentes na IBKR"},
  {"ticker":"GLD","hqp_target":-400,"ibkr_fill":-400,"lynks_pos":-400,"delta":0,"status":"ok"},
  {"ticker":"XOM","hqp_target":-2500,"ibkr_fill":0,"lynks_pos":2500,"delta":2500,"status":"pendente","nota":"Ordem ainda não executada na IBKR"}
];

var ADMIN_CONFIG = {
  "users":[
    {"id":"u1","nome":"João Daniel","role":"socio_gestor","perms":["ver","rodar","aprovar","calibrar","promover","config"]},
    {"id":"u2","nome":"Diogo","role":"gestor_quant","perms":["ver","rodar","calibrar","promover"]},
    {"id":"u3","nome":"JP","role":"operacoes","perms":["ver","rodar","aprovar"]},
    {"id":"u4","nome":"Johnny","role":"operacoes","perms":["ver","rodar"]}
  ],
  "integrations":[
    {"nome":"IBKR","status":"conectado","scope":"execução","last_sync":"2026-06-27T09:37:15"},
    {"nome":"Lynks","status":"conectado","scope":"contabilidade","last_sync":"2026-06-27T08:00:00"},
    {"nome":"Yahoo Finance","status":"ativo","scope":"dados EOD","last_sync":"2026-06-27T17:00:05"},
    {"nome":"FRED","status":"ativo","scope":"macro","last_sync":"2026-06-27T17:00:05"},
    {"nome":"Claude API","status":"ativo","scope":"JIM conselheiro","last_sync":"2026-06-27T09:35:00"},
    {"nome":"Nitrogen","status":"pendente","scope":"Risk Number","last_sync":null}
  ],
  "kill_switch":false,"mode":"paper","eod_schedule":"17:00 ET"
};

var COMPLIANCE = {
  "jurisdicao":"ETP · Vienna Stock Exchange · EU",
  "reqs":[
    {"area":"Fiduciary","status":"ok","desc":"Segregação de ativos, custódia BNY Mellon"},
    {"area":"Air-gap IA","status":"ok","desc":"Claude não decide/executa — ADR 0003/0004"},
    {"area":"Audit trail","status":"ok","desc":"Append-only, imutável"},
    {"area":"2-window validation","status":"ok","desc":"2007-2016 + 2016-2026 + cheio"},
    {"area":"Segregação IBKR/Claude","status":"ok","desc":"Escopos isolados"},
    {"area":"Secrets vault","status":"ok","desc":"Fly.io vault, nunca em código/DB/front"},
    {"area":"Notes restriction","status":"ok","desc":"Não oferecido/vendido a US persons/EEA/UK"}
  ],
  "fitness_functions":[
    {"nome":"Air-gap runtime","status":"pass","desc":"AI_IN_DECISION_LOOP is False"},
    {"nome":"Tenant isolation","status":"pass","desc":"Cross-tenant → 404"},
    {"nome":"Risk gate","status":"pass","desc":"Produto > mandato → bloqueado"},
    {"nome":"Alçada gate","status":"pass","desc":"Valor > alçada → bloqueado"},
    {"nome":"RBAC","status":"pass","desc":"Cliente não acessa /dashboard"},
    {"nome":"Golden-master","status":"pass","desc":"Reproduz byte-a-byte"},
    {"nome":"Red-flag detector","status":"pass","desc":"Sortino>4.5 / CAGR>100% = erro"},
    {"nome":"Walk-forward gap","status":"pass","desc":"OOS ≥ IS"},
    {"nome":"Concentration cap","status":"pass","desc":"Máx 4@10% + 5ª+ 7,5%"}
  ]
};

var OBSERVADOR = {
  "scorecard":{"pilar_A":{"acertos":82,"erros":18,"acuracia_pct":82},"pilar_B":{"acertos":75,"erros":25,"acuracia_pct":75},"pilar_C":{"acertos":88,"erros":12,"acuracia_pct":88},"pilar_D":{"acertos":91,"erros":9,"acuracia_pct":91}},
  "alertas":[
    {"tipo":"edge_decay","pilar":"B","desc":"Pilar B com edge decaindo nos últimos 3 meses","sev":"amber","ts":"2026-06-27"},
    {"tipo":"regime_change","pilar":null,"desc":"Cross-correlation subiu para 0.62 — zona de alerta","sev":"amber","ts":"2026-06-26"},
    {"tipo":"calibration_opp","pilar":"A","desc":"DEMA tau=36 melhorou Sortino em 0.12 no walk-forward","sev":"green","ts":"2026-06-25"}
  ],
  "hipoteses":[
    {"id":"H-01","desc":"Termômetro v2 com jerk ponderado","status":"testando","ts":"2026-06-20"},
    {"id":"H-02","desc":"Filtro de earnings (95% bateram resultado)","status":"validado","ts":"2026-06-26"},
    {"id":"H-03","desc":"Half-life curto no momentum","status":"rejeitado","ts":"2026-06-24"}
  ]
};

var ENGINE_ROOM = {"as_of":"2026-06-26","gerado":"2026-06-28 03:00:04","data_source":"ALPACA + LOCAL","equity":100000,"cash":100000,"mode":"PAPER","regime":{"estado":"RISK-OFF","descricao":"Defesa no comando — rotação defensiva + Pilar D","crs":0.489,"watch":0.28,"defesa":0.406,"exposicao_ataque_pct":34},"pilares":[{"nome":"Inovação","proxy":"SOXX","temp":0.448,"lim":0.45,"delta_24h":0,"delta_5d":null,"turb":0.57,"trend_break":0,"jerk":0,"folga":0.002,"status":"folga"},{"nome":"Líderes","proxy":"QQQ","temp":0.554,"lim":0.40,"delta_24h":0,"delta_5d":0.177,"turb":0.58,"trend_break":0,"jerk":1,"folga":-0.154,"status":"GATILHO"},{"nome":"Navegador","proxy":"SPY","temp":0.403,"lim":0.45,"delta_24h":0,"delta_5d":0.06,"turb":0.47,"trend_break":0,"jerk":0.69,"folga":0.047,"status":"folga"}],"pilares_resumo":{"max":0.554,"media":0.468,"em_defesa":"1/3"},"indicadores":[{"nome":"CRS composto","valor":0.489,"desc":"0.083 além do gatilho","needle_pct":38.9,"cor":"#F39C12","delta_24h":0,"delta_5d":0.067,"delta_5d_dir":"up"},{"nome":"Correlação cruzada","valor":0.88,"desc":"DE-RISK TOTAL","needle_pct":0,"cor":"#E74C3C","delta_24h":0,"delta_5d":-0.054,"delta_5d_dir":"dn"},{"nome":"Amplitude >EMA200","valor_fmt":"57%","desc":"do universo","needle_pct":57.1,"cor":"#2ECC71","delta_24h":0,"delta_5d":0.075,"delta_5d_dir":"up"},{"nome":"EMA20 (reentrada)","tipo":"chips","chips":[{"label":"SPY","ok":false},{"label":"QQQ","ok":false},{"label":"SOXX","ok":false}],"desc_right":"defesa hoje: 0%"},{"nome":"MAC Score","tipo":"standalone","desc":"standalone — não integrado ao gatilho"}],"carga":{"perfis":[{"nome":"CONSERVATIVE","cor":"#2E7D32","a_pct":13,"b_pct":87,"range_nota":"CONS 31,9→3,5%"},{"nome":"BALANCE","cor":"#C9A02C","a_pct":23,"b_pct":77,"range_nota":"BAL 52,7→8,4%"},{"nome":"ADVANCE","cor":"#C0392B","a_pct":35,"b_pct":65,"range_nota":"ADV 70→17%"}],"legenda":"A ataque = ações HC-US 3.1 · Pilar D = ETFs defensivos (WTA D1/D2/D3) · B = ETFs HC-US 11."},"orientacao":[{"perfil":"CONSERVATIVE","cor":"#2E7D32","delta":"—","dir":"fl","tag":"NEU","texto":"Manter alocação · ações 13% · ETFs 87%"},{"perfil":"BALANCE","cor":"#C9A02C","delta":"—","dir":"fl","tag":"NEU","texto":"Manter alocação · ações 23% · ETFs 77%"},{"perfil":"ADVANCE","cor":"#C0392B","delta":"—","dir":"fl","tag":"NEU","texto":"Manter alocação · ações 35% · ETFs 65%"}],"pilar_d":{"lane_vencedora":"D2 HEALTH + STAPLES","carga":"—","holdings":[{"ticker":"UNH","peso_pct":25},{"ticker":"CVS","peso_pct":25},{"ticker":"LLY","peso_pct":25},{"ticker":"ABBV","peso_pct":25}],"rocs":[{"lane":"D1","roc":"+11.1%"},{"lane":"D2","roc":"+40.0%","winner":true},{"lane":"D3","roc":"+0.7%"}],"nota":"Sistema em ataque hoje."},"motor_a":[{"rank":1,"ticker":"HOLX","nome":"Hologic, Inc","mom_12_1":11,"mom_bar_pct":1.9,"acel":"fl","peso_pct":10.1},{"rank":2,"ticker":"IRDM","nome":"Iridium Communications","mom_12_1":185,"mom_bar_pct":32.1,"acel":"dn","peso_pct":6.9},{"rank":3,"ticker":"LIT","nome":"Global X Lithium","mom_12_1":126,"mom_bar_pct":21.8,"acel":"dn","peso_pct":6.7},{"rank":4,"ticker":"STRL","nome":"Sterling Infrastructure","mom_12_1":211,"mom_bar_pct":36.6,"acel":"dn","peso_pct":6.3},{"rank":5,"ticker":"EQIX","nome":"Equinix REIT","mom_12_1":45,"mom_bar_pct":7.7,"acel":"fl","peso_pct":5.8}],"motor_b":[{"sleeve":"EquityDividend","peso_pct":20,"picks":["NOBL","DVY","HDV"],"mom_63d":-47.5,"mom_bar_pct":49,"mom_dir":"neg","acel":"up"},{"sleeve":"Innovation","peso_pct":20,"picks":["CIBR"],"mom_63d":20.4,"mom_bar_pct":21.1,"mom_dir":"pos","acel":"dn"},{"sleeve":"Energy","peso_pct":20,"picks":["UNG","DBO"],"mom_63d":10.8,"mom_bar_pct":11.2,"mom_dir":"pos","acel":"up"}]};

var RISK_NUMBERS = {"HPC22":{"risk_number":29,"benchmark_spy":27.6,"peer":"Agressivo","historico":[{"data":"2026-06","valor":29},{"data":"2026-05","valor":28},{"data":"2026-04","valor":31}]},"HPC11":{"risk_number":18,"benchmark_spy":27.6,"peer":"Equilibrado","historico":[{"data":"2026-06","valor":18},{"data":"2026-05","valor":17},{"data":"2026-04","valor":19}]},"HCUST":{"risk_number":41,"benchmark_spy":27.6,"peer":"Agressivo","historico":[{"data":"2026-06","valor":41},{"data":"2026-05","valor":39}]}};

var CONTAS = {"HPC22":{"nav":27900000,"nav_share":128.40,"month_return_pct":-5.8,"ytd_return_pct":18.4,"holdings":[{"ticker":"NVDA","qty":4200,"price":148.50,"value":623700,"contrib_pct":2.2,"weight_pct":8.5},{"ticker":"AVGO","qty":1800,"price":242.10,"value":435780,"contrib_pct":1.8,"weight_pct":6.1},{"ticker":"PLTR","qty":3500,"price":82.30,"value":288050,"contrib_pct":0.9,"weight_pct":4.0}],"fees":{"admin_pct":1.0,"perf_pct":10.0,"custody_pct":0.15,"spread_bps":5}},"HPC11":{"nav":38200000,"nav_share":104.12,"month_return_pct":-3.2,"ytd_return_pct":12.1,"holdings":[{"ticker":"QQQ","qty":8000,"price":525.40,"value":4203200,"contrib_pct":3.1,"weight_pct":11.0}],"fees":{"admin_pct":0.75,"perf_pct":5.0,"custody_pct":0.12,"spread_bps":3}}};

var REENTRY_STATE = {"HPC22":{"mode":"monitorando","days":0,"ema_cross":false,"velocity":1.2,"sizing_pct":0},"HPC11":{"mode":"n/a","days":0,"ema_cross":true,"velocity":2.1,"sizing_pct":100}};

// ========== MOCK MARKET QUOTES ==========
var MOCK_QUOTES = [
  {"ticker":"^GSPC","name":"S&P 500","last":5842.18,"day_pct":0.42,"ok":true},
  {"ticker":"^IXIC","name":"NASDAQ","last":19215.40,"day_pct":0.65,"ok":true},
  {"ticker":"^VIX","name":"VIX","last":14.82,"day_pct":-3.10,"ok":true},
  {"ticker":"GLD","name":"SPDR Gold","last":234.50,"day_pct":0.18,"ok":true},
  {"ticker":"NVDA","name":"NVIDIA","last":148.50,"day_pct":1.22,"ok":true},
  {"ticker":"AAPL","name":"Apple","last":198.70,"day_pct":-0.35,"ok":true},
  {"ticker":"QQQ","name":"Invesco QQQ","last":525.40,"day_pct":0.58,"ok":true},
  {"ticker":"XOM","name":"Exxon Mobil","last":108.20,"day_pct":-0.82,"ok":true}
];

// ========== MOCK BASKETS (para ativos.html) ==========
var BASKETS = ["HC-US 3.1 (ações)","HC-US 11 (ETFs)","Defesa top-4"];
var BASKET_SCAN = {
  "HC-US 3.1 (ações)":[
    {"ticker":"NVDA","nome":"NVIDIA","rs":2,"rs_label":"buy","mom_d13":0.82,"mom_j37":0.65,"mom_126d":34.5,"weight_pct":8.5},
    {"ticker":"AVGO","nome":"Broadcom","rs":2,"rs_label":"buy","mom_d13":0.71,"mom_j37":0.58,"mom_126d":28.1,"weight_pct":6.1},
    {"ticker":"PLTR","nome":"Palantir","rs":1,"rs_label":"neutral","mom_d13":0.45,"mom_j37":0.32,"mom_126d":18.5,"weight_pct":4.0},
    {"ticker":"MSFT","nome":"Microsoft","rs":1,"rs_label":"neutral","mom_d13":0.38,"mom_j37":0.42,"mom_126d":12.2,"weight_pct":5.8},
    {"ticker":"GOOGL","nome":"Alphabet","rs":1,"rs_label":"neutral","mom_d13":0.29,"mom_j37":0.31,"mom_126d":8.4,"weight_pct":3.1},
    {"ticker":"META","nome":"Meta","rs":2,"rs_label":"buy","mom_d13":0.68,"mom_j37":0.55,"mom_126d":22.3,"weight_pct":4.5},
    {"ticker":"LLY","nome":"Eli Lilly","rs":-1,"rs_label":"sell","mom_d13":-0.15,"mom_j37":-0.22,"mom_126d":-8.2,"weight_pct":2.8},
    {"ticker":"JPM","nome":"JPMorgan","rs":1,"rs_label":"neutral","mom_d13":0.33,"mom_j37":0.28,"mom_126d":10.1,"weight_pct":3.5}
  ],
  "HC-US 11 (ETFs)":[
    {"ticker":"QQQ","nome":"Invesco QQQ","rs":2,"rs_label":"buy","mom_d13":0.55,"mom_j37":0.48,"mom_126d":15.2,"weight_pct":11.0},
    {"ticker":"VGT","nome":"Vanguard IT","rs":1,"rs_label":"neutral","mom_d13":0.42,"mom_j37":0.38,"mom_126d":12.8,"weight_pct":9.5},
    {"ticker":"XLV","nome":"Health Care","rs":-1,"rs_label":"sell","mom_d13":-0.08,"mom_j37":-0.12,"mom_126d":-2.1,"weight_pct":2.0}
  ],
  "Defesa top-4":[
    {"ticker":"GLD","nome":"SPDR Gold","rs":1,"rs_label":"neutral","mom_d13":0.18,"mom_j37":0.15,"mom_126d":5.2,"weight_pct":7.5},
    {"ticker":"TLT","nome":"iShares 20y Treasury","rs":-2,"rs_label":"sell","mom_d13":-0.35,"mom_j37":-0.28,"mom_126d":-12.1,"weight_pct":6.3},
    {"ticker":"XLU","nome":"Utilities","rs":1,"rs_label":"neutral","mom_d13":0.22,"mom_j37":0.18,"mom_126d":4.8,"weight_pct":6.3},
    {"ticker":"XLE","nome":"Energy","rs":2,"rs_label":"buy","mom_d13":0.48,"mom_j37":0.42,"mom_126d":12.0,"weight_pct":5.0}
  ]
};

// ========== MOCK CHART DATA (generates synthetic candles) ==========
function generateCandles(ticker, rng){
  var days = {"1mo":22,"3mo":66,"6mo":132,"1y":252,"2y":504,"5y":1260}[rng]||252;
  var base = {"NVDA":148,"AVGO":242,"AAPL":198,"QQQ":525,"GLD":234,"TLT":92,"XLE":88,"MSFT":468,"GOOGL":185,"META":542,"SPY":584}[ticker]||150;
  var candles=[], close=base*0.7, d=new Date(); d.setDate(d.getDate()-days);
  for(var i=0;i<days;i++){
    d.setDate(d.getDate()+1); if(d.getDay()===0||d.getDay()===6) continue;
    var ret=(Math.random()-0.48)*0.03; close=close*(1+ret);
    var hi=close*(1+Math.random()*0.015), lo=close*(1-Math.random()*0.015), op=close*(1+(Math.random()-0.5)*0.01);
    candles.push({time:d.toISOString().slice(0,10),open:+op.toFixed(2),high:+hi.toFixed(2),low:+lo.toFixed(2),close:+close.toFixed(2),volume:Math.floor(Math.random()*5e7+1e6)});
  }
  return candles;
}

// ========== ROUTE MAP ==========
function route(url){
  var u = url.replace(/https?:\/\/[^/]+/,'');

  // /v1/dashboard
  if(u==='/v1/dashboard'){
    var total=0, mud=0, pend=0;
    PORTFOLIOS.forEach(function(p){total+=p.alocado_usd; mud+=p.mudancas_entradas+p.mudancas_saidas;});
    TICKETS.forEach(function(t){if(t.status==='pendente')pend++;});
    return {portfolios:PORTFOLIOS,resumo:{total_alocado_usd:total,mudancas_hoje:mud,tickets_pendentes:pend,regime_global:"RISK-ON"},tickets:TICKETS.slice(0,5)};
  }

  // /v1/market/quotes
  if(u==='/v1/market/quotes'||u.indexOf('/v1/market/quotes?')===0)
    return {quotes:MOCK_QUOTES,source:"mock"};

  // /v1/market/chart/{ticker}
  var cm=u.match(/\/v1\/market\/chart\/([^?]+)/);
  if(cm){
    var tk=cm[1], rng='1y'; var rm=u.match(/rng=([^&]+)/); if(rm) rng=rm[1];
    var candles=generateCandles(tk,rng);
    return {ticker:tk,name:tk,ok:true,candles:candles,indicators:{ema20:[],ema50:[],ema200:[],dema36:[]},studies:{bar_colors:[],barcode:[],distance:[],tr:[],dema_d13:[],dema_j37:[],threshold:[]},meta:{range:rng,bars:candles.length,sma200:candles.length?candles[candles.length-1].close:null,last:candles.length?candles[candles.length-1].close:null}};
  }

  // /v1/tickets
  if(u==='/v1/tickets') return {tickets:TICKETS};

  // /v1/tickets/{ticker}/approve
  if(u.match(/\/v1\/tickets\/[^/]+\/approve/)) return {ok:true,status:"aprovado"};

  // /v1/strategies
  if(u==='/v1/strategies/'||u==='/v1/strategies') return {portfolios:PORTFOLIOS};

  // /v1/assets/baskets
  if(u==='/v1/assets/baskets') return {baskets:BASKETS};

  // /v1/assets/scan
  var sm=u.match(/\/v1\/assets\/scan\?basket=([^&]+)/);
  if(sm){var b=decodeURIComponent(sm[1]); return {basket:b,ativos:BASKET_SCAN[b]||[],rs_note:"RS = DSPT_06 (mock) · Momento D13/J37 = DSPT_05"};}

  // /v1/assets/insight
  if(u.indexOf('/v1/assets/insight')===0) return {insight:"Cesta apresenta momentum positivo na maioria dos ativos. NVDA e META lideram o ranking RS. LLY em sinal de venda — monitorar."};

  // /v1/assets/position/{ticker}
  var pm=u.match(/\/v1\/assets\/position\/([^?]+)/);
  if(pm) return {ticker:pm[1],portfolio_id:"HPC22",allocation_pct:5.2,action:"MANTER",action_detail:"Posição alinhada com o target do motor"};

  // /v1/backtest/runs
  if(u==='/v1/backtest/runs') return {runs:BACKTEST_RUNS};

  // /v1/backtest/submit
  if(u==='/v1/backtest/submit') return {ok:true,id:"BT005",status:"submetido"};

  // /v1/calibration/formulas
  if(u==='/v1/calibration/formulas') return {formulas:FORMULAS};

  // /v1/calibration/candidates
  if(u==='/v1/calibration/candidates') return {candidates:CALIBRATION_CANDIDATES};

  // /v1/calibration/candidates/{id}/promote
  if(u.match(/\/v1\/calibration\/candidates\/[^/]+\/promote/)) return {ok:true,status:"promovido"};

  // /v1/calibration/jim
  if(u.indexOf('/v1/calibration/jim')===0) return {response:"JIM: Ajuste dentro do esperado. O gate de 5,5% é marginalmente mais restritivo mas reduz drawdown em ~3pp. Recomendo validar em janela 2016-2026 antes de promover."};

  // /v1/protection/defense
  if(u.indexOf('/v1/protection/defense')===0){
    var pid='HPC22'; var pdm=u.match(/portfolio_id=([^&]+)/); if(pdm) pid=pdm[1];
    return DEFENSE_STATE[pid]||DEFENSE_STATE.HPC22;
  }

  // /v1/protection/pilar-d
  if(u==='/v1/protection/pilar-d') return PILAR_D;

  // /v1/protection/indicators
  if(u==='/v1/protection/indicators'){
    var arr=[];for(var k in INDICATORS_STATE){arr.push(Object.assign({id:k},INDICATORS_STATE[k]));}
    return {indicators:arr};
  }

  // /v1/reconciliation
  if(u==='/v1/reconciliation/'||u==='/v1/reconciliation'){
    var ok=0,parcial=0,pend=0,td=0;
    RECONCILIATION.forEach(function(r){if(r.status==='ok')ok++;else if(r.status==='parcial')parcial++;else pend++;td+=Math.abs(r.delta);});
    return {items:RECONCILIATION,resumo:{total:RECONCILIATION.length,ok:ok,parcial:parcial,pendente:pend,total_delta:td}};
  }

  // /v1/audit
  if(u==='/v1/audit') return {events:AUDIT};

  // /v1/admin/config
  if(u==='/v1/admin/config') return ADMIN_CONFIG;

  // /v1/admin/kill-switch
  if(u==='/v1/admin/kill-switch') return {ok:true,kill_switch:!ADMIN_CONFIG.kill_switch};

  // /v1/admin/mode
  if(u==='/v1/admin/mode') return {ok:true,mode:"paper"};

  // /v1/engine-room
  if(u==='/v1/engine-room/'||u==='/v1/engine-room') return ENGINE_ROOM;

  // /v1/observador
  if(u==='/v1/observador/'||u==='/v1/observador') return OBSERVADOR;

  return null;
}

// ========== INTERCEPT FETCH ==========
var _realFetch = window.fetch;
window.fetch = function(url, opts){
  if(typeof url === 'string' && url.indexOf('/v1/')!==-1){
    var data = route(url);
    if(data !== null){
      return Promise.resolve(new Response(JSON.stringify(data), {status:200, headers:{'Content-Type':'application/json'}}));
    }
  }
  return _realFetch.apply(this, arguments);
};

console.log('%c[MOCK-API] Shim ativo — dados embutidos, sem backend', 'color:#C9A02C;font-weight:bold');
})();

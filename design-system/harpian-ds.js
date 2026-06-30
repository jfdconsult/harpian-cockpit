/* ============================================================
   HARPIAN DESIGN SYSTEM (harpian-ds) · v1 — componentes JS
   Funções puras que retornam HTML string (framework-agnostic).
   Usar nos 3 front-ends. Window.HDS namespace.
   ============================================================ */
(function (root) {
  'use strict';

  var COLORS = { green:'#2ECC71', amber:'#F39C12', red:'#E74C3C', blue:'#4A90D9', gold:'#C9A02C', mut:'#7d96b3' };

  function pad(n){ return String(n).padStart(2,'0'); }
  function nfmt(n){ return Number(n).toLocaleString('pt-BR'); }

  /* Relógio: injeta HH:MM:SS num elemento por id e mantém */
  function clock(id){
    function t(){ var d=new Date(); var el=document.getElementById(id); if(el) el.textContent=pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()); }
    setInterval(t,1000); t();
  }

  /* Medidor de regime · 4 estados (a meia-lua com agulha do Engine Room).
     state: 'RISK-OFF'|'WARNING'|'RISK-ON'|'CÉU ABERTO' · sub: texto opcional */
  function regimeGauge(state, sub){
    var map = { 'RISK-OFF':[0.13,COLORS.red], 'WARNING':[0.38,COLORS.amber], 'RISK-ON':[0.62,COLORS.green], 'CÉU ABERTO':[0.88,COLORS.blue] };
    var m = map[state] || map['RISK-ON']; var frac = m[0], col = m[1];
    var ang = (180 - frac*180) * Math.PI/180; var L = 118;
    var nx = 200 + L*Math.cos(ang), ny = 200 - L*Math.sin(ang);
    return '<svg viewBox="0 0 400 232" width="100%" style="display:block;max-height:200px">'
      + '<path d="M40,200 A160,160 0 0,1 86.9,86.9" fill="none" stroke="#E74C3C" stroke-width="24" stroke-linecap="round" opacity=".9"/>'
      + '<path d="M86.9,86.9 A160,160 0 0,1 200,40" fill="none" stroke="#F39C12" stroke-width="24" opacity=".9"/>'
      + '<path d="M200,40 A160,160 0 0,1 313.1,86.9" fill="none" stroke="#2ECC71" stroke-width="24" opacity=".9"/>'
      + '<path d="M313.1,86.9 A160,160 0 0,1 360,200" fill="none" stroke="#4A90D9" stroke-width="24" stroke-linecap="round" opacity=".9"/>'
      + '<text x="50" y="222" fill="#E74C3C" font-size="11" font-weight="700" text-anchor="middle">RISK-OFF</text>'
      + '<text x="128" y="58" fill="#F39C12" font-size="9.5" font-weight="700" text-anchor="middle">WARNING</text>'
      + '<text x="300" y="66" fill="#2ECC71" font-size="11" font-weight="700" text-anchor="middle">RISK-ON</text>'
      + '<text x="350" y="222" fill="#4A90D9" font-size="9.5" font-weight="700" text-anchor="middle">CÉU ABERTO</text>'
      + '<line x1="200" y1="200" x2="'+nx.toFixed(1)+'" y2="'+ny.toFixed(1)+'" stroke="#fff" stroke-width="4" stroke-linecap="round"/>'
      + '<circle cx="200" cy="200" r="9" fill="#fff"/><circle cx="200" cy="200" r="4" fill="#0A1A30"/>'
      + '<text x="200" y="150" fill="'+col+'" font-size="27" font-weight="800" text-anchor="middle">'+state+'</text>'
      + (sub ? '<text x="200" y="174" fill="#7d96b3" font-size="11" text-anchor="middle">'+sub+'</text>' : '')
      + '</svg>';
  }

  /* Régua-agulha (bullet) · zonas vermelho→âmbar→verde→azul + agulha branca.
     name, sub, pct (0-100 posição da agulha), dist (texto direita), distColor */
  function bullet(name, sub, pct, dist, distColor){
    return '<div class="hds-prow"><div class="hds-phead"><span>'+name+' <small>'+(sub||'')+'</small></span>'
      + (dist ? '<span class="hds-dist" style="color:'+(distColor||COLORS.green)+'">'+dist+'</span>' : '')
      + '</div><div class="hds-bullet">'
      + '<div class="hds-bz" style="left:0;width:25%;background:#E74C3C"></div>'
      + '<div class="hds-bz" style="left:25%;width:25%;background:#F39C12"></div>'
      + '<div class="hds-bz" style="left:50%;width:25%;background:#2ECC71"></div>'
      + '<div class="hds-bz" style="left:75%;width:25%;background:#4A90D9"></div>'
      + '<div class="hds-bneedle" style="left:calc('+pct+'% - 1px)"></div></div></div>';
  }

  /* KPI card */
  function kpi(label, value, sub, cls){
    return '<div class="hds-kpi"><div class="l">'+label+'</div><div class="v '+(cls||'')+'">'+value+'</div>'
      + (sub ? '<div class="s">'+sub+'</div>' : '') + '</div>';
  }

  /* statechip por estado de semáforo */
  function stateChip(text, sem){ return '<span class="hds-statechip '+(sem||'g')+'">'+text+'</span>'; }

  /* tag pequena */
  function tag(text, sem){ return '<span class="hds-tag '+(sem||'b')+'">'+text+'</span>'; }

  /* topbar padrão (string). cfg: {brand, ctx, state:{text,sem}, user, clockId} */
  function topbar(cfg){
    cfg = cfg || {};
    return '<div class="hds-top">'
      + '<div class="hds-brand">'+(cfg.brand||'HARPIAN')+' <small>'+(cfg.small||'')+'</small></div>'
      + '<div class="hds-ctx" id="'+(cfg.ctxId||'hds-ctx')+'">'+(cfg.ctx||'')+'</div>'
      + (cfg.state ? stateChip(cfg.state.text, cfg.state.sem) : '')
      + '<div class="hds-top-right">'
      + (cfg.jim === false ? '' : '<button class="hds-jim-btn" onclick="HDS.jim.toggle()" title="JIM Copilot — acesso à memória de cálculo de cada item">JIM</button>')
      + '<span>'+(cfg.user||'')+'</span>'
      + (cfg.clockId ? '<span class="hds-clock" id="'+cfg.clockId+'">--:--:--</span>' : '')
      + '<span style="color:var(--gold);cursor:pointer">sair</span></div></div>';
  }

  /* JIM Copilot — drawer global (todas as telas). Inspirado em Jim Simons;
     acesso à memória de cálculo de cada item. setContext() preenche o painel. */
  var jim = {
    _mounted: false,
    mount: function () {
      if (this._mounted) return;
      var bd = document.createElement('div'); bd.id = 'hds-jim-back'; bd.className = 'hds-jim-back';
      bd.onclick = function () { jim.close(); };
      var d = document.createElement('div'); d.id = 'hds-jim-drawer'; d.className = 'hds-jim-drawer';
      d.innerHTML = '<div class="hds-jim-head"><div class="hds-jim-ava">JIM</div>'
        + '<div><div class="hds-jim-name">JIM Copilot</div><div class="hds-jim-sub">inspirado em Jim Simons · vê a memória de cálculo</div></div>'
        + '<span class="hds-jim-x" onclick="HDS.jim.close()">&#10005;</span></div>'
        + '<div class="hds-jim-body" id="hds-jim-body"><div class="hds-jim-msg">Selecione um item para eu analisar a memória de cálculo dele.</div></div>'
        + '<div class="hds-jim-foot"><input class="hds-jim-input" placeholder="Pergunte ao JIM..."><button class="hds-jim-send">Enviar</button></div>';
      document.body.appendChild(bd); document.body.appendChild(d);
      this._mounted = true;
    },
    open: function () { this.mount(); document.getElementById('hds-jim-drawer').classList.add('open'); document.getElementById('hds-jim-back').classList.add('show'); },
    close: function () { if (!this._mounted) return; document.getElementById('hds-jim-drawer').classList.remove('open'); document.getElementById('hds-jim-back').classList.remove('show'); },
    toggle: function () { this.mount(); var open = document.getElementById('hds-jim-drawer').classList.contains('open'); if (open) this.close(); else this.open(); },
    /* ctx: título (string) · msgs: [string] · qbtns: [string] */
    setContext: function (ctx, msgs, qbtns) {
      this.mount();
      var b = document.getElementById('hds-jim-body'); if (!b) return;
      var h = ctx ? '<div class="hds-jim-ctx">' + ctx + '</div>' : '';
      (msgs || []).forEach(function (m) { h += '<div class="hds-jim-msg">' + m + '</div>'; });
      if (qbtns && qbtns.length) h += '<div class="hds-jim-qbtns">' + qbtns.map(function (q) { return '<span class="hds-jim-qbtn">' + q + '</span>'; }).join('') + '</div>';
      b.innerHTML = h;
    }
  };

  /* nav (string). items: [{id,label,on}] · onNav: nome de função global(id) */
  function nav(items, onNav){
    return '<div class="hds-nav">' + items.map(function(it){
      return '<span class="'+(it.on?'on':'')+'" onclick="'+(onNav||'go')+'(\''+it.id+'\',this)">'+it.label+'</span>';
    }).join('') + '</div>';
  }

  root.HDS = {
    COLORS: COLORS, pad: pad, nfmt: nfmt, clock: clock,
    regimeGauge: regimeGauge, bullet: bullet, kpi: kpi,
    stateChip: stateChip, tag: tag, topbar: topbar, nav: nav, jim: jim
  };
})(window);

"use client";
import { useEffect, useMemo, useState } from "react";
import { fmtN, fmtUSD } from "@/lib/data";
import { publishScreenData, requestJim } from "@/lib/jim-data";
import { memoriaDeCalculo, perguntasSugeridas,
         type Doc, type Empresa } from "@/lib/fundamentos";

// ============================================================================
// FUNDAMENTOS — os tres niveis da leitura fundamentalista
//
// POR QUE TRES NIVEIS E NAO UMA LISTA DE 974 EMPRESAS
// ---------------------------------------------------
// Uma lista de 974 nomes nao e informacao: e um arquivo. A decisao de portfolio
// acontece em tres perguntas encaixadas, e cada uma tem sua propria unidade:
//
//   1 SETOR     para onde o capital esta indo
//   2 SUBSETOR  qual pedaco do setor esta puxando (um setor de 200 empresas nao
//               e comparavel consigo mesmo — ver l7b_subsetor.py no pipeline)
//   3 EMPRESA   a que preco entra e a que preco sai
//
// A tela desce nessa ordem e nunca mostra o nivel 3 sem o contexto do nivel 2.
//
// O EIXO QUE JUSTIFICA A TELA EXISTIR
// -----------------------------------
// O cockpit ja tem momento em varias telas. O que nao tinha e a DIVERGENCIA:
// percentil de fundamento menos percentil de momento na mesma secao transversal.
// Fundamento bom com momento ruim e candidato de entrada; fundamento ruim com
// momento bom e posicao a vigiar. Momento sozinho nao separa os dois casos.
// ============================================================================

const GRAU_COR: Record<string, string> = {
  A: "var(--green)", B: "var(--green)", C: "var(--tx2)",
  D: "var(--gold)", E: "var(--red)",
};
const n1 = (v: number | null | undefined, s = "") =>
  v === null || v === undefined ? "—" : `${v.toFixed(1)}${s}`;
const n2 = (v: number | null | undefined, s = "") =>
  v === null || v === undefined ? "—" : `${v.toFixed(2)}${s}`;
const sinal = (v: number | null | undefined) =>
  v === null || v === undefined ? "var(--tx3)" : v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--tx2)";

function Grau({ g }: { g: string | null }) {
  if (!g) return <span style={{ color: "var(--tx3)" }}>—</span>;
  return (
    <span style={{
      display: "inline-block", minWidth: 20, textAlign: "center",
      fontWeight: 700, color: GRAU_COR[g] || "var(--tx2)",
      border: `1px solid ${GRAU_COR[g] || "var(--tx3)"}`, borderRadius: 3,
      fontSize: 11, padding: "1px 5px",
    }}>{g}</span>
  );
}

export default function Fundamentos() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [setor, setSetor] = useState<string | null>(null);
  const [subsetor, setSubsetor] = useState<string | null>(null);
  const [soComPreco, setSoComPreco] = useState(false);

  useEffect(() => {
    fetch("/api/fundamentos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then((d: Doc) => setDoc(d))
      .catch((e) => setErro(e?.como || "base fundamentalista indisponivel"));
  }, []);

  useEffect(() => {
    if (!doc) return;
    const lider = [...doc.setores].sort((a, b) => (b.score_medio ?? -9) - (a.score_medio ?? -9))[0];
    publishScreenData(
      "fundamentos",
      `${doc.universo.empresas} empresas, ${doc.universo.subsetores} subsetores, ` +
      `fundamento mais forte: ${lider?.setor ?? "—"} (preco de ${doc.data_preco})`,
      { setores: doc.setores, universo: doc.universo },
      {
        briefing:
          `Base fundamentalista SEC point-in-time com ${doc.universo.empresas} empresas em ` +
          `${doc.universo.setores} setores. Momento disponivel para ${doc.universo.com_momento}. ` +
          `Setor com melhor fundamento: ${lider?.setor ?? "—"}.`,
      },
    );
  }, [doc]);

  const subsDoSetor = useMemo(
    () => (doc && setor ? doc.subsetores.filter((s) => s.setor === setor) : []),
    [doc, setor],
  );
  const empresasDoNivel = useMemo(() => {
    if (!doc) return [];
    let e = doc.empresas;
    if (setor) e = e.filter((x) => x.setor_hx === setor);
    if (subsetor) e = e.filter((x) => x.subsetor_hx === subsetor);
    if (soComPreco) e = e.filter((x) => x.mom_12_1 !== null);
    return [...e].sort((a, b) => (b.valor_mercado ?? 0) - (a.valor_mercado ?? 0));
  }, [doc, setor, subsetor, soComPreco]);

  // Divergencia so tem sentido onde HA os dois eixos. Filtra por tamanho para
  // nao encher o painel de micro-cap iliquida, que domina qualquer ranking de
  // extremo por ser onde o dado e mais ruidoso.
  const divergentes = useMemo(() => {
    if (!doc) return { subiu: [] as Empresa[], desceu: [] as Empresa[] };
    const base = doc.empresas.filter(
      (e) => e.divergencia !== null && (e.valor_mercado ?? 0) >= 2e9 && !e.estrangeiro,
    );
    const ord = [...base].sort((a, b) => (b.divergencia ?? 0) - (a.divergencia ?? 0));
    return { subiu: ord.slice(0, 8), desceu: ord.slice(-8).reverse() };
  }, [doc]);

  // O maior tombo mes a mes na contagem de tickers com preco. Nao e cosmetico:
  // um corte de dois tercos na cobertura muda o que a tela pode afirmar, e sem
  // apontar o mes o leitor atribui a queda ao mercado em vez de a alimentacao.
  const degrau = useMemo(() => {
    const c = doc?.cobertura_preco_mensal ?? [];
    let pior: { mes_de: string; mes_para: string; de: number; para: number } | null = null;
    for (let i = 1; i < c.length; i++) {
      const q = c[i].tickers / (c[i - 1].tickers || 1);
      if (q < 0.75 && (!pior || q < pior.para / pior.de)) {
        pior = { mes_de: c[i - 1].mes, mes_para: c[i].mes, de: c[i - 1].tickers, para: c[i].tickers };
      }
    }
    return pior;
  }, [doc]);

  // Botao J de uma empresa: publica o snapshot FOCADO e so entao pede a gaveta.
  // A ordem importa — invertida, a gaveta abriria lendo o snapshot anterior e
  // explicaria a empresa errada com toda a confianca do mundo.
  function analisar(e: Empresa) {
    if (!doc) return;
    publishScreenData(
      "fundamentos",
      `Analise individual: ${e.nome} (${e.ticker}) — HS ${e.JD_SCORE_FUND ?? "n/d"}, ` +
      `${e.setor_hx} > ${e.subsetor_hx}`,
      e,
      { briefing: memoriaDeCalculo(e, doc), suggestions: perguntasSugeridas(e) },
    );
    requestJim();
  }

  if (erro) {
    return (
      <div className="screen">
        <div className="crumb">Intelligence › <b>Fundamentos</b></div>
        <div className="h1">Fundamental Base</div>
        <div className="placeholder" style={{ marginTop: 16 }}>
          Base nao exportada. Rode <b>python export_cockpit.py</b> em
          <code style={{ marginLeft: 4 }}>harpian-fundamentals\pipeline</code>.
        </div>
      </div>
    );
  }
  if (!doc) return <div className="screen"><div className="placeholder">carregando base…</div></div>;

  const u = doc.universo;
  const stats = [
    { v: fmtN(u.empresas), l: "Empresas (SEC)" },
    { v: `${u.valor_tri_domestico.toFixed(1)} tri`, l: "Valor domestico" },
    { v: `${u.setores} / ${u.subsetores}`, l: "Setores / subsetores" },
    { v: `${fmtN(u.com_momento)}`, l: "Com serie de preco" },
  ];

  return (
    <div className="screen">
      <div className="crumb">
        Intelligence ›{" "}
        <b style={{ cursor: setor ? "pointer" : "default" }}
           onClick={() => { setSetor(null); setSubsetor(null); }}>Fundamentos</b>
        {setor && <> › <b style={{ cursor: subsetor ? "pointer" : "default" }}
           onClick={() => setSubsetor(null)}>{setor}</b></>}
        {subsetor && <> › <b>{subsetor}</b></>}
      </div>
      <div className="h1">Fundamental Base</div>
      <div className="sub">
        SEC XBRL point-in-time · preco de {doc.data_preco} · exportado {doc.gerado_em.slice(0, 10)}
      </div>

      <div className="grid g4" style={{ margin: "14px 0" }}>
        {stats.map((s, i) => (
          <div className="card" key={i} style={{ textAlign: "center", padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4, textTransform: "uppercase", letterSpacing: ".5px" }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* A cobertura de preco e a restricao que manda nesta tela: fundamento
          existe para 974, momento para 413. Dizer isso na cara evita que o
          painel seja lido como se as 974 tivessem os dois eixos. */}
      <div className="card" style={{ marginBottom: 14, borderLeft: "3px solid var(--gold)" }}>
        <div style={{ fontSize: 11, color: "var(--tx2)", lineHeight: 1.6 }}>
          <b style={{ color: "var(--gold)" }}>Cobertura.</b>{" "}
          Fundamento existe para as {fmtN(u.empresas)} empresas; momento so para{" "}
          {fmtN(u.com_momento)} ({((100 * u.com_momento) / u.empresas).toFixed(0)}%),
          que sao as que tem serie de preco na base. Cruzamento fundamento × momento
          e divergencia so valem nesse subconjunto.
          {u.estrangeiros > 0 && ` ${u.estrangeiros} emissores estrangeiros (20-F/40-F) ficam fora dos agregados de valor: contagem em ordinarias e preco em ADR nao sao comparaveis.`}
        </div>
        {degrau && (
          <div style={{ fontSize: 11, color: "var(--tx2)", lineHeight: 1.6, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--bd)" }}>
            <b style={{ color: "var(--red)" }}>Degrau na serie de precos.</b>{" "}
            O painel caiu de {fmtN(degrau.de)} tickers em {degrau.mes_de} para{" "}
            {fmtN(degrau.para)} em {degrau.mes_para}. Nao e mudanca de mercado — e a
            alimentacao de precos que parou de cobrir a cauda. Enquanto isso durar, o
            eixo de momento desta tela descreve o nucleo liquido, nao o universo.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          {doc.cobertura_preco_mensal.map((c) => (
            <span key={c.mes} style={{ fontSize: 10, color: "var(--tx3)" }}>
              {c.mes}{" "}
              <b style={{ color: c.tickers < 600 ? "var(--red)" : "var(--tx2)" }}>{c.tickers}</b>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------- NIVEL 1: SETOR */}
      {!setor && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>Nivel 1 · Setores</h3>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th className="num">Emp.</th>
                    <th className="num">Valor</th>
                    <th style={{ textAlign: "center" }}>Fund.</th>
                    <th style={{ textAlign: "center" }}>Mom.</th>
                    <th style={{ textAlign: "center" }}>Preco</th>
                    <th className="num">Score</th>
                    <th className="num">Mom. med.</th>
                    <th className="num">Amplitude</th>
                    <th className="num">P/L</th>
                    <th className="num">Percentil</th>
                    <th className="num">Top-3</th>
                    <th className="num">Diverg.</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.setores.map((s) => (
                    <tr key={s.setor} style={{ cursor: "pointer" }} onClick={() => setSetor(s.setor)}>
                      <td style={{ fontWeight: 600, color: "var(--tx)" }}>
                        {s.setor}
                        <span style={{ color: "var(--tx3)", fontWeight: 400, marginLeft: 6, fontSize: 10 }}>
                          {s.subsetores} sub
                        </span>
                      </td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{s.empresas}</td>
                      <td className="num" style={{ color: "var(--tx)" }}>{n1(s.valor_tri, " tri")}</td>
                      <td style={{ textAlign: "center" }}><Grau g={s.grau_score} /></td>
                      <td style={{ textAlign: "center" }}><Grau g={s.grau_mom} /></td>
                      <td style={{ textAlign: "center" }}><Grau g={s.grau_preco} /></td>
                      <td className="num" style={{ color: sinal(s.score_medio) }}>{n2(s.score_medio)}</td>
                      <td className="num" style={{ color: sinal(s.mom_mediano) }}>{n1(s.mom_mediano, "%")}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{n1(s.amplitude_mom_pct, "%")}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{n1(s.pl_mediano)}</td>
                      <td className="num" style={{ color: "var(--tx2)" }}>{n1(s.percentil_hist)}</td>
                      <td className="num" style={{ color: (s.top3_pct ?? 0) > 50 ? "var(--gold)" : "var(--tx2)" }}>{n1(s.top3_pct, "%")}</td>
                      <td className="num" style={{ color: sinal(s.divergencia_mediana) }}>{n1(s.divergencia_mediana)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 8, lineHeight: 1.6 }}>
              <b>Amplitude</b> e o percentual de empresas do setor com momento positivo — separa
              setor que sobe inteiro de setor puxado por tres nomes. <b>Top-3</b> acima de 50%
              (em ambar) avisa que o agregado descreve poucas empresas, nao o setor.
              <b> Percentil</b> e onde o P/L de hoje esta na propria historia do grupo:
              alto significa caro contra si mesmo. Clique no setor para abrir os subsetores.
            </div>
          </div>

          {/* DIVERGENCIA — o cruzamento que so existe nesta tela */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="card">
              <h3 style={{ color: "var(--green)" }}>Fundamento a frente do preco</h3>
              <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 8 }}>
                Bom no fundamento, fraco no momento. Acima de US$ 2 bi, domesticas.
              </div>
              <table>
                <thead><tr><th>Ticker</th><th>Empresa</th><th className="num">HS</th><th className="num">Mom.</th><th className="num">Diverg.</th></tr></thead>
                <tbody>
                  {divergentes.subiu.map((e) => (
                    <tr key={e.ticker}>
                      <td style={{ fontWeight: 700, color: "var(--gold)" }}>{e.ticker}</td>
                      <td style={{ color: "var(--tx2)", fontSize: 11 }}>{e.nome?.slice(0, 26)}</td>
                      <td className="num" style={{ color: sinal(e.JD_SCORE_FUND) }}>{n1(e.JD_SCORE_FUND)}</td>
                      <td className="num" style={{ color: sinal(e.mom_12_1) }}>{n1((e.mom_12_1 ?? 0) * 100, "%")}</td>
                      <td className="num pos">{n1(e.divergencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 style={{ color: "var(--red)" }}>Preco a frente do fundamento</h3>
              <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 8 }}>
                Subindo sem lastro no fundamento. Posicao a vigiar, nao venda automatica.
              </div>
              <table>
                <thead><tr><th>Ticker</th><th>Empresa</th><th className="num">HS</th><th className="num">Mom.</th><th className="num">Diverg.</th></tr></thead>
                <tbody>
                  {divergentes.desceu.map((e) => (
                    <tr key={e.ticker}>
                      <td style={{ fontWeight: 700, color: "var(--gold)" }}>{e.ticker}</td>
                      <td style={{ color: "var(--tx2)", fontSize: 11 }}>{e.nome?.slice(0, 26)}</td>
                      <td className="num" style={{ color: sinal(e.JD_SCORE_FUND) }}>{n1(e.JD_SCORE_FUND)}</td>
                      <td className="num" style={{ color: sinal(e.mom_12_1) }}>{n1((e.mom_12_1 ?? 0) * 100, "%")}</td>
                      <td className="num neg">{n1(e.divergencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------- NIVEL 2: SUBSETOR */}
      {setor && !subsetor && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Nivel 2 · Subsetores de {setor}</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Subsetor</th>
                  <th className="num">Emp.</th>
                  <th className="num">Valor</th>
                  <th className="num">% setor</th>
                  <th style={{ textAlign: "center" }}>Fund.</th>
                  <th style={{ textAlign: "center" }}>Mom.</th>
                  <th className="num">Score</th>
                  <th className="num">Ponderado</th>
                  <th className="num">Mom. med.</th>
                  <th className="num">Amplitude</th>
                  <th className="num">P/L</th>
                  <th className="num">Top-1</th>
                  <th style={{ textAlign: "center" }}>Confianca</th>
                </tr>
              </thead>
              <tbody>
                {subsDoSetor.map((s) => (
                  <tr key={s.subsetor} style={{ cursor: "pointer" }} onClick={() => setSubsetor(s.subsetor)}>
                    <td style={{ fontWeight: 600, color: "var(--tx)" }}>{s.subsetor}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{s.empresas}</td>
                    <td className="num" style={{ color: "var(--tx)" }}>{n2(s.valor_tri, " tri")}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{n1(s.pct_do_setor, "%")}</td>
                    <td style={{ textAlign: "center" }}><Grau g={s.grau_score} /></td>
                    <td style={{ textAlign: "center" }}><Grau g={s.grau_mom} /></td>
                    <td className="num" style={{ color: sinal(s.score_medio) }}>{n2(s.score_medio)}</td>
                    {/* Igualitario vs ponderado: quando divergem muito, as grandes
                        do grupo discordam das pequenas — e o agregado simples mente. */}
                    <td className="num" style={{ color: sinal(s.score_ponderado) }}>{n2(s.score_ponderado)}</td>
                    <td className="num" style={{ color: sinal(s.mom_mediano) }}>{n1(s.mom_mediano, "%")}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{n1(s.amplitude_mom_pct, "%")}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{n1(s.pl_mediano)}</td>
                    <td className="num" style={{ color: (s.top1_pct ?? 0) > 40 ? "var(--gold)" : "var(--tx2)" }}>{n1(s.top1_pct, "%")}</td>
                    <td style={{
                      textAlign: "center", fontSize: 10,
                      color: s.confianca === "ALTA" ? "var(--green)" : s.confianca === "BAIXA" ? "var(--red)" : "var(--tx2)",
                    }}>{s.confianca ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 8, lineHeight: 1.6 }}>
            <b>Score</b> igualitario contra <b>ponderado</b> por valor: quando os dois divergem,
            as grandes do grupo discordam das pequenas e o numero simples nao descreve o cluster.
            <b> Confianca</b> e o peso epistemico — cluster pequeno ou classificado por regra
            generica nao vale o mesmo que um curado nome a nome.
          </div>
        </div>
      )}

      {/* --------------------------------------------------- NIVEL 3: EMPRESA */}
      {setor && (
        <div className="card">
          <div className="flex between wrap" style={{ alignItems: "center" }}>
            <h3>
              Nivel 3 · {subsetor ?? setor}
              <span style={{ color: "var(--tx3)", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                {empresasDoNivel.length} empresas
              </span>
            </h3>
            <label style={{ fontSize: 11, color: "var(--tx2)", display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={soComPreco} onChange={(e) => setSoComPreco(e.target.checked)} />
              so com serie de preco
            </label>
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto", overflowX: "auto" }}>
            <table className="tb-fixa">
              <thead>
                <tr>
                  <th>Ticker</th><th>Empresa</th>
                  <th className="num">Valor</th>
                  <th className="num">Preco</th>
                  <th className="num">Compra</th>
                  <th className="num">Venda</th>
                  <th className="num">HS</th>
                  <th>Postura</th>
                  <th className="num">F</th>
                  <th className="num">P/L</th>
                  <th className="num">Perc.</th>
                  <th className="num">ROIC</th>
                  <th className="num">FCF y.</th>
                  <th className="num">Mom.</th>
                  <th className="num">Diverg.</th>
                  <th style={{ textAlign: "center" }}>Dado</th>
                  <th style={{ textAlign: "center" }} title="analise do JIM">JIM</th>
                </tr>
              </thead>
              <tbody>
                {empresasDoNivel.map((e) => (
                  <tr key={e.ticker + e.nome}>
                    <td style={{ fontWeight: 700, color: "var(--gold)" }}>
                      {e.ticker}
                      {e.estrangeiro && <span title="emissor estrangeiro: valor de mercado nao confiavel" style={{ color: "var(--tx3)", marginLeft: 4 }}>*</span>}
                    </td>
                    <td style={{ color: "var(--tx2)", fontSize: 11 }}>{e.nome?.slice(0, 30)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{e.valor_mercado ? fmtUSD(e.valor_mercado) : "—"}</td>
                    <td className="num" style={{ color: "var(--tx)" }}>{n2(e.fechamento)}</td>
                    {/* Preco de gatilho: ancora historica do proprio ativo, nao alvo
                        de consenso. Abaixo do de compra, o multiplo esta no fundo da
                        propria faixa; acima do de venda, no topo. */}
                    <td className="num" style={{ color: "var(--green)" }}>{n2(e.preco_compra_hist)}</td>
                    <td className="num" style={{ color: "var(--red)" }}>{n2(e.preco_venda_hist)}</td>
                    <td className="num" style={{ color: sinal(e.JD_SCORE_FUND), fontWeight: 600 }}>{n1(e.JD_SCORE_FUND)}</td>
                    <td style={{ fontSize: 10, color: e.n_gatilhos ? "var(--red)" : "var(--tx2)" }}>
                      {e.postura ?? "—"}
                      {!!e.n_gatilhos && <span title="gatilhos defensivos acionados" style={{ marginLeft: 4 }}>▲{e.n_gatilhos}</span>}
                    </td>
                    <td className="num" style={{ color: (e.F_Score ?? 0) >= 7 ? "var(--green)" : (e.F_Score ?? 9) <= 3 ? "var(--red)" : "var(--tx2)" }}>{e.F_Score ?? "—"}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{n1(e.PL)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{n1(e.PL_percentil_hist)}</td>
                    <td className="num" style={{ color: "var(--tx2)" }}>{n1((e.ROIC ?? 0) * 100, "%")}</td>
                    <td className="num" style={{ color: sinal(e.fcf_yield_pct) }}>{n1(e.fcf_yield_pct, "%")}</td>
                    <td className="num" style={{ color: sinal(e.mom_12_1) }}>{e.mom_12_1 === null ? "—" : n1(e.mom_12_1 * 100, "%")}</td>
                    <td className="num" style={{ color: sinal(e.divergencia) }}>{n1(e.divergencia)}</td>
                    <td style={{
                      textAlign: "center", fontSize: 10,
                      color: e.qualidade_dado === "OK" ? "var(--tx3)" : "var(--gold)",
                    }}>{e.qualidade_dado ?? "—"}</td>
                    {/* O J leva a linha inteira para o JIM: nao so os numeros
                        visiveis, mas a memoria de calculo por tras deles. */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => analisar(e)}
                        title={`Analise do JIM para ${e.ticker} — ancoras, memoria de calculo e origem do dado`}
                        aria-label={`Analisar ${e.ticker} com o JIM`}
                        style={{
                          width: 20, height: 20, lineHeight: "18px", padding: 0,
                          borderRadius: 4, cursor: "pointer",
                          background: "transparent", color: "var(--gold)",
                          border: "1px solid var(--gold)",
                          fontWeight: 700, fontSize: 11, fontFamily: "inherit",
                        }}
                      >J</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 8, lineHeight: 1.6 }}>
            <b>Compra / Venda</b> sao ancoras do proprio historico do ativo (fundo e topo da
            faixa de multiplo), nao alvo de consenso nem recomendacao.
            <b> Dado</b> diferente de OK significa fundamento defasado ou incompleto — o score
            existe, mas a frescura do dado e um eixo separado da postura de mercado.
            <b> *</b> marca emissor estrangeiro, cujo valor de mercado nao e comparavel.
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, color: "var(--tx3)", lineHeight: 1.7 }}>
          {doc.ressalvas.map((r, i) => (<div key={i}>· {r}</div>))}
        </div>
      </div>
    </div>
  );
}

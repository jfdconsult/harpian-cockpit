"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { apiGet } from "@/lib/api";
import TradingViewWidget from "./TradingViewWidget";
import type { ScreenId } from "@/lib/nav";

const RANGES = ["3mo", "6mo", "1y", "2y", "5y"] as const;
type Range = (typeof RANGES)[number];

interface StudyDef { on: boolean; lbl: string }
type StudyKey = "trend" | "barcolor" | "atr" | "impulse" | "barcode" | "dist" | "mom";
const INITIAL_STUDIES: Record<StudyKey, StudyDef> = {
  trend: { on: true, lbl: "EMA/DEMA/TEMA" },
  barcolor: { on: true, lbl: "Cor das barras" },
  atr: { on: true, lbl: "Projeção ATR" },
  impulse: { on: false, lbl: "Fibo impulso" },
  barcode: { on: true, lbl: "Barcode" },
  dist: { on: true, lbl: "Distância EMA" },
  mom: { on: true, lbl: "Momento D13/J37" },
};
const SUB_OF: Partial<Record<StudyKey, "barcode" | "dist" | "mom">> = { barcode: "barcode", dist: "dist", mom: "mom" };

const COL = { ema: "#E8ECF1", dema: "#FF3DFF", tema: "#4A90D9", d13: "#E0C160", j37: "#4A90D9", thr: "#5b7a99", up: "#2ECC71", dn: "#E74C3C" };

const COLLEGEND: [string, string][] = [
  ["#00E5FF", "Compra (cruz.↑)"], ["#FF3DFF", "Venda (cruz.↓)"], ["#2ECC71", "FVG alta"],
  ["#2E86FF", "FVG alta · barra baixa"], ["#E74C3C", "FVG baixa"], ["#C9A02C", "FVG baixa · barra alta"],
  ["#7FA8C9", "Alta normal"], ["#3E5A7E", "Baixa normal"],
];

interface Point { time: number; value: number; color?: string }
interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
interface ChartResp {
  ticker: string; name?: string; ok: boolean; candles: Candle[];
  studies?: {
    ema?: Point[]; dema?: Point[]; tema?: Point[]; bar_colors?: string[];
    dyn_atr?: { dir: string; atr: number; levels: number[] };
    impulses?: { dir: string; levels: Record<string, number> }[];
    barcode?: Point[];
    ema_dist?: { dist: Point[]; threshold: Point[]; true_range: Point[] };
    mom_d13?: Point[]; mom_j37?: Point[];
  };
  meta?: { bars: number };
}
interface PositionResp {
  has_position: boolean; total_weight_pct?: number; total_value_usd?: number;
  holdings?: { portfolio: string }[]; action: string;
}

function fmt(v: number | null | undefined) { return v == null ? "—" : v.toFixed(2); }

export default function Chart({ ticker, go }: { ticker: string; go: (id: ScreenId, param?: string) => void }) {
  const mainElRef = useRef<HTMLDivElement>(null);
  const barcodeElRef = useRef<HTMLDivElement>(null);
  const distElRef = useRef<HTMLDivElement>(null);
  const momElRef = useRef<HTMLDivElement>(null);
  const stackElRef = useRef<HTMLDivElement>(null);

  const chartsRef = useRef<Record<string, IChartApi>>({});
  const seriesRef = useRef<Record<string, ISeriesApi<never>>>({});
  const priceLinesRef = useRef<unknown[]>([]);
  const lastDataRef = useRef<ChartResp | null>(null);
  const legendElRef = useRef<HTMLDivElement>(null);

  const [range, setRange] = useState<Range>("1y");
  const [view, setView] = useState<"dspt" | "tv">("dspt");
  const [studies, setStudies] = useState(INITIAL_STUDIES);
  const [tname, setTname] = useState("carregando...");
  const [price, setPrice] = useState("—");
  const [pct, setPct] = useState<{ text: string; up: boolean } | null>(null);
  const [meta, setMeta] = useState("—");
  const [distVals, setDistVals] = useState({ dist: "—", tr: "—", thr: "—" });
  const [momVals, setMomVals] = useState({ d13: "—", j37: "—" });
  const [position, setPosition] = useState<PositionResp | null>(null);

  // Init charts once
  useEffect(() => {
    if (!mainElRef.current || !barcodeElRef.current || !distElRef.current || !momElRef.current) return;
    const baseOpts = (el: HTMLDivElement, showTime: boolean) => ({
      width: el.clientWidth, height: el.clientHeight,
      layout: { background: { color: "#0A1A30" }, textColor: "#7d96b3", fontSize: 11 },
      grid: { vertLines: { color: "#16304f" }, horzLines: { color: "#13283f" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1d3a5f" },
      timeScale: { borderColor: "#1d3a5f", timeVisible: false, rightOffset: 5, visible: showTime },
      handleScroll: true, handleScale: true,
    });

    const main = createChart(mainElRef.current, baseOpts(mainElRef.current, false) as never);
    main.priceScale("right").applyOptions({ scaleMargins: { top: 0.06, bottom: 0.2 } });
    const candle = main.addCandlestickSeries({ upColor: COL.up, downColor: COL.dn, borderUpColor: COL.up, borderDownColor: COL.dn, wickUpColor: COL.up, wickDownColor: COL.dn });
    const vol = main.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "volume" });
    main.priceScale("volume").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
    const ema = main.addLineSeries({ color: COL.ema, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const dema = main.addLineSeries({ color: COL.dema, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const tema = main.addLineSeries({ color: COL.tema, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    const barcode = createChart(barcodeElRef.current, baseOpts(barcodeElRef.current, false) as never);
    barcode.priceScale("right").applyOptions({ scaleMargins: { top: 0.12, bottom: 0.12 } });
    const barcodeSeries = barcode.addHistogramSeries({ priceFormat: { type: "price", precision: 0, minMove: 1 }, base: 0 });

    const dist = createChart(distElRef.current, baseOpts(distElRef.current, false) as never);
    dist.priceScale("right").applyOptions({ scaleMargins: { top: 0.12, bottom: 0.06 } });
    const distSeries = dist.addHistogramSeries({ base: 0, priceLineVisible: false, lastValueVisible: true });
    const trSeries = dist.addLineSeries({ color: "#5ec4e8", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
    const thrSeries = dist.addLineSeries({ color: COL.thr, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });

    const mom = createChart(momElRef.current, baseOpts(momElRef.current, true) as never);
    mom.priceScale("right").applyOptions({ scaleMargins: { top: 0.12, bottom: 0.12 } });
    const zeroSeries = mom.addLineSeries({ color: "#1d3a5f", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const d13Series = mom.addLineSeries({ color: COL.d13, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
    const j37Series = mom.addLineSeries({ color: COL.j37, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });

    chartsRef.current = { main, barcode, dist, mom };
    seriesRef.current = { candle, vol, ema, dema, tema, barcodeSeries, distSeries, trSeries, thrSeries, zeroSeries, d13Series, j37Series } as never;

    main.subscribeCrosshairMove((param) => {
      const lg = legendElRef.current;
      if (!lg) return;
      if (!param || !param.time || !param.seriesData) { lg.innerHTML = ""; return; }
      const d = param.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined;
      if (!d) { lg.innerHTML = ""; return; }
      const c = d.close >= d.open ? COL.up : COL.dn;
      let html = `<div class="lg" style="color:${c}">O ${fmt(d.open)}  H ${fmt(d.high)}  L ${fmt(d.low)}  C ${fmt(d.close)}</div>`;
      lg.innerHTML = html;
    });

    let syncing = false;
    const allCharts = [main, barcode, dist, mom];
    allCharts.forEach((src) => {
      src.timeScale().subscribeVisibleLogicalRangeChange((r) => {
        if (syncing || !r) return;
        syncing = true;
        allCharts.forEach((dst) => { if (dst !== src) dst.timeScale().setVisibleLogicalRange(r); });
        syncing = false;
      });
    });

    const resizeAll = () => {
      const map: Record<string, HTMLDivElement | null> = { main: mainElRef.current, barcode: barcodeElRef.current, dist: distElRef.current, mom: momElRef.current };
      Object.entries(map).forEach(([k, el]) => {
        if (el && chartsRef.current[k]) chartsRef.current[k].applyOptions({ width: el.clientWidth, height: el.clientHeight });
      });
    };
    const ro = new ResizeObserver(resizeAll);
    if (stackElRef.current) ro.observe(stackElRef.current);
    window.addEventListener("resize", resizeAll);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resizeAll);
      [main, barcode, dist, mom].forEach((c) => { try { c.remove(); } catch { /* noop */ } });
    };
  }, []);

  function applyData(d: ChartResp) {
    lastDataRef.current = d;
    const S = d.studies || {};
    const s = seriesRef.current as never as {
      candle: ISeriesApi<"Candlestick">; vol: ISeriesApi<"Histogram">; ema: ISeriesApi<"Line">; dema: ISeriesApi<"Line">; tema: ISeriesApi<"Line">;
      barcodeSeries: ISeriesApi<"Histogram">; distSeries: ISeriesApi<"Histogram">; trSeries: ISeriesApi<"Line">; thrSeries: ISeriesApi<"Line">;
      zeroSeries: ISeriesApi<"Line">; d13Series: ISeriesApi<"Line">; j37Series: ISeriesApi<"Line">;
    };

    const cd = d.candles.map((c, i) => {
      const base: Record<string, unknown> = { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
      if (studies.barcolor.on && S.bar_colors && S.bar_colors[i]) {
        base.color = S.bar_colors[i]; base.borderColor = S.bar_colors[i]; base.wickColor = S.bar_colors[i];
      }
      return base;
    });
    s.candle.setData(cd as never);
    s.vol.setData(d.candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "rgba(46,204,113,.22)" : "rgba(231,76,60,.22)" })) as never);

    s.ema.setData((studies.trend.on ? S.ema : []) as never);
    s.dema.setData((studies.trend.on ? S.dema : []) as never);
    s.tema.setData((studies.trend.on ? S.tema : []) as never);

    s.barcodeSeries.setData((S.barcode || []).map((p) => ({ time: p.time, value: p.value, color: p.value > 0 ? "rgba(46,204,113,.85)" : p.value < 0 ? "rgba(231,76,60,.85)" : "#3E5A7E" })) as never);

    s.distSeries.setData((S.ema_dist?.dist || []) as never);
    s.trSeries.setData((S.ema_dist?.true_range || []) as never);
    s.thrSeries.setData((S.ema_dist?.threshold || []) as never);
    const dlast = (S.ema_dist?.dist || []).slice(-1)[0];
    const trlast = (S.ema_dist?.true_range || []).slice(-1)[0];
    const thrlast = (S.ema_dist?.threshold || []).slice(-1)[0];
    setDistVals({ dist: dlast ? dlast.value.toFixed(2) : "—", tr: trlast ? trlast.value.toFixed(2) : "—", thr: thrlast ? thrlast.value.toFixed(2) : "—" });

    const zero = (S.mom_d13 || []).map((p) => ({ time: p.time, value: 0 }));
    s.zeroSeries.setData(zero as never);
    s.d13Series.setData((studies.mom.on ? S.mom_d13 || [] : []) as never);
    s.j37Series.setData((studies.mom.on ? S.mom_j37 || [] : []) as never);
    const d13last = (S.mom_d13 || []).slice(-1)[0], j37last = (S.mom_j37 || []).slice(-1)[0];
    setMomVals({ d13: d13last?.value != null ? d13last.value.toFixed(2) : "—", j37: j37last?.value != null ? j37last.value.toFixed(2) : "—" });

    drawLines(S);
    chartsRef.current.main?.timeScale().fitContent();
  }

  function drawLines(S: NonNullable<ChartResp["studies"]>) {
    const s = seriesRef.current as never as { candle: ISeriesApi<"Candlestick"> };
    priceLinesRef.current.forEach((pl) => { try { s.candle.removePriceLine(pl as never); } catch { /* noop */ } });
    priceLinesRef.current = [];
    if (studies.atr.on && S.dyn_atr?.levels) {
      const lbls = ["0", "1·ATR", "1.5·ATR", "2·ATR"];
      S.dyn_atr.levels.forEach((lv, i) => {
        priceLinesRef.current.push(s.candle.createPriceLine({ price: lv, color: "rgba(125,150,179,.55)", lineWidth: 1, lineStyle: i === 0 ? 0 : 2, axisLabelVisible: true, title: `ATR ${lbls[i]}` } as never));
      });
    }
    if (studies.impulse.on && S.impulses && S.impulses.length) {
      const imp = S.impulses[S.impulses.length - 1];
      const L = imp.levels;
      const up = imp.dir === "up";
      const fib: [string, number, string][] = [["0", L["0"], "#C9A02C"], ["+100%", L.p100, up ? COL.up : COL.dn], ["+200%", L.p200, up ? COL.up : COL.dn], ["-100%", L.m100, "#E74C3C"]];
      fib.forEach(([label, price, color]) => {
        priceLinesRef.current.push(s.candle.createPriceLine({ price, color, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `Fib ${label}` } as never));
      });
    }
  }

  // Fetch chart data on ticker/range change
  useEffect(() => {
    apiGet<ChartResp>(`/v1/market/chart/${ticker}?rng=${range}`)
      .then((d) => {
        if (!d.ok || !d.candles.length) { setMeta(`Sem dados para ${ticker}`); return; }
        setTname(d.name || ticker);
        const last = d.candles[d.candles.length - 1];
        const prev = d.candles.length > 1 ? d.candles[d.candles.length - 2].close : last.open;
        const chg = last.close - prev, pctv = (chg / prev) * 100;
        setPrice(`$${last.close.toFixed(2)}`);
        setPct({ text: `${chg >= 0 ? "+" : ""}${chg.toFixed(2)} (${pctv >= 0 ? "+" : ""}${pctv.toFixed(2)}%)`, up: chg >= 0 });
        applyData(d);
        const imp = (d.studies?.impulses || []).length;
        setMeta(`bars:${d.meta?.bars ?? "—"}|impulsos:${imp}`);
      })
      .catch((e) => setMeta(`Erro: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, range]);

  // Re-apply data when studies toggle
  useEffect(() => {
    if (lastDataRef.current) applyData(lastDataRef.current);
    setTimeout(() => {
      const map: Record<string, HTMLDivElement | null> = { main: mainElRef.current, barcode: barcodeElRef.current, dist: distElRef.current, mom: momElRef.current };
      Object.entries(map).forEach(([k, el]) => {
        if (el && chartsRef.current[k]) chartsRef.current[k].applyOptions({ width: el.clientWidth, height: el.clientHeight });
      });
    }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studies]);

  useEffect(() => {
    apiGet<PositionResp>(`/v1/assets/position/${ticker}`).then(setPosition).catch(() => {});
  }, [ticker]);

  function toggleStudy(k: StudyKey) {
    setStudies((prev) => ({ ...prev, [k]: { ...prev[k], on: !prev[k].on } }));
  }

  const posCls: Record<string, string> = { AUMENTAR: "buy", COMPRAR: "buy", REDUZIR: "red", ZERAR: "zero", TROCAR: "zero", MANTER: "hold", FORA: "out" };
  const [barsCount, impCount] = meta.startsWith("bars:") ? meta.replace("bars:", "").split("|impulsos:") : ["—", "0"];

  return (
    <div className="screen ch-wrap">
      <div className="ch-bar">
        <span className="ch-back" onClick={() => go("ativos")}>&larr; Voltar</span>
        <span className="ch-ticker">{ticker}</span>
        <span className="ch-name">{tname}</span>
        <span className="ch-price">{price}</span>
        {pct && <span className={`ch-pct ${pct.up ? "up" : "dn"}`}>{pct.text}</span>}
        <div className="ch-range">
          {RANGES.map((r) => (
            <button key={r} className={r === range ? "on" : ""} onClick={() => setRange(r)}>{r.toUpperCase()}</button>
          ))}
        </div>
        <span className="ch-daily">candles diários</span>
        {position && (
          <span className="ch-pos">
            Alocado: {position.has_position ? (
              <>
                <b>{position.total_weight_pct}%</b> · US$ {position.total_value_usd?.toLocaleString("pt-BR")}
                {position.holdings?.[0] ? ` · ${position.holdings[0].portfolio}` : ""}
              </>
            ) : <b>sem posição</b>}{" "}
            <span className={`ch-act ${posCls[position.action] || "hold"}`}>{position.action}</span>
          </span>
        )}
        <div className="ch-right">
          <a className="ch-tv" href={`https://br.tradingview.com/chart/nNpCdTJZ/?symbol=${ticker}`} target="_blank" rel="noopener" title="Abrir no TradingView com template HARPIAN DSPT">
            <svg viewBox="0 0 36 28"><path d="M14 22H7V6h7v16zm8-16h7v16h-7V6zm-2 0h-4v16h4V6z" /></svg>DSPT completo
          </a>
        </div>
      </div>

      <div className="ch-toolbar">
        <span className="ch-tlabel">VISÃO</span>
        <div className="ch-studies" style={{ marginRight: 14 }}>
          <button className={view === "dspt" ? "on" : ""} onClick={() => setView("dspt")}>Gráfico DSPT</button>
          <button className={view === "tv" ? "on" : ""} onClick={() => setView("tv")}>TradingView</button>
        </div>
        {view === "dspt" && (
          <>
            <span className="ch-tlabel">ESTUDOS DSPT</span>
            <div className="ch-studies">
              {(Object.keys(studies) as StudyKey[]).map((k) => (
                <button key={k} className={studies[k].on ? "on" : ""} onClick={() => toggleStudy(k)}>{studies[k].lbl}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="ch-collegend" style={{ display: view === "dspt" && studies.barcolor.on ? "flex" : "none" }}>
        <span style={{ color: "var(--gold)", fontWeight: 700, letterSpacing: ".5px" }}>COR DAS BARRAS</span>
        {COLLEGEND.map(([color, label]) => (
          <span className="ci" key={label}><span className="sw" style={{ background: color }} />{label}</span>
        ))}
      </div>

      {view === "tv" && (
        <div style={{ padding: "8px 0" }}>
          <TradingViewWidget ticker={ticker} />
        </div>
      )}

      <div className="ch-stack" ref={stackElRef} style={{ display: view === "dspt" ? undefined : "none" }}>
        <div className="ch-pane main">
          <div className="ch-legend" ref={legendElRef} />
          <div className="ch-cv" ref={mainElRef} />
        </div>
        <div className="ch-pane sub" style={{ display: studies.barcode.on ? undefined : "none" }}>
          <div className="lbl">BARCODE <b>−2…+2</b> · onde fechou + EMA/ATR</div>
          <div className="ch-cv" ref={barcodeElRef} />
        </div>
        <div className="ch-pane sub" style={{ display: studies.dist.on ? undefined : "none" }}>
          <div className="lbl">DISTÂNCIA <b>{distVals.dist}</b> · TR <b>{distVals.tr}</b> · LIMIAR <b>{distVals.thr}</b> · em ATR</div>
          <div className="ch-cv" ref={distElRef} />
        </div>
        <div className="ch-pane sub" style={{ display: studies.mom.on ? undefined : "none" }}>
          <div className="lbl">MOMENTO · D13 <b style={{ color: "#E0C160" }}>{momVals.d13}</b> Diogo &nbsp; J37 <b style={{ color: "#4A90D9" }}>{momVals.j37}</b> João</div>
          <div className="ch-cv" ref={momElRef} />
        </div>
      </div>

      <div className="ch-meta" style={{ display: view === "dspt" ? undefined : "none" }}>
        <span>Barras: <b>{barsCount}</b></span>
        <span>EMA/DEMA/TEMA: <b>α=1/13 cascata (Diogo)</b></span>
        <span>Impulsos: <b>{impCount}</b></span>
        <span>Momento: <b>D13</b> + <b>J37</b></span>
        <span>Fonte: <b>Yahoo EOD</b></span>
        <span className="ch-src">estudos DSPT computados local · sem TradingView</span>
      </div>
    </div>
  );
}

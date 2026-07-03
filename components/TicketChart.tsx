"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import { apiGet } from "@/lib/api";

export default function TicketChart({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let chart: IChartApi | null = null;
    let cancelled = false;

    chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: "#0A1A30" }, textColor: "#7d96b3", fontSize: 10 },
      grid: { vertLines: { color: "#16304f" }, horzLines: { color: "#13283f" } },
      rightPriceScale: { borderColor: "#1d3a5f" },
      timeScale: { borderColor: "#1d3a5f", timeVisible: false },
    });
    const cs = chart.addCandlestickSeries({ upColor: "#2ECC71", downColor: "#E74C3C", borderUpColor: "#2ECC71", borderDownColor: "#E74C3C", wickUpColor: "#2ECC71", wickDownColor: "#E74C3C" });

    apiGet<{ ok: boolean; candles: never[]; studies?: { ema?: never[]; dema?: never[] } }>(`/v1/market/chart/${ticker}?rng=6mo`)
      .then((d) => {
        if (cancelled || !d.ok || !d.candles?.length || !chart) return;
        cs.setData(d.candles);
        const S = d.studies || {};
        if (S.ema) {
          const e = chart.addLineSeries({ color: "#E8ECF1", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          e.setData(S.ema);
        }
        if (S.dema) {
          const dm = chart.addLineSeries({ color: "#FF3DFF", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          dm.setData(S.dema);
        }
        chart.timeScale().fitContent();
      })
      .catch(() => {});

    const ro = new ResizeObserver(() => {
      if (chart) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
      if (chart) chart.remove();
    };
  }, [ticker]);

  return <div ref={ref} style={{ flex: 1, minHeight: 0 }} />;
}

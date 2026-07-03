"use client";
import { useEffect, useRef } from "react";

// Widget oficial do TradingView (gratuito). Estudos nativos (RSI/MACD).
// Os indicadores DSPT (Pine) ficam no gráfico próprio (aba DSPT) e no deep-link.
// Mapa Yahoo → símbolo TradingView para os casos que não resolvem direto.
const TV_MAP: Record<string, string> = {
  "^GSPC": "SP:SPX",
  "^IXIC": "NASDAQ:IXIC",
  "^DJI": "DJ:DJI",
  "^VIX": "CBOE:VIX",
  "^TNX": "TVC:US10Y",
  GLD: "AMEX:GLD",
  SPY: "AMEX:SPY",
  QQQ: "NASDAQ:QQQ",
};

function toTvSymbol(ticker: string): string {
  if (TV_MAP[ticker]) return TV_MAP[ticker];
  if (ticker.startsWith("^")) return ticker.slice(1);
  return ticker;
}

export default function TradingViewWidget({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '<div id="tvchart" style="height:520px;width:100%"></div>';
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => {
      const TV = (window as unknown as { TradingView?: { widget: new (o: unknown) => void } }).TradingView;
      if (TV) new TV.widget({
        container_id: "tvchart",
        symbol: toTvSymbol(ticker),
        interval: "D",
        theme: "dark",
        style: "1",
        locale: "br",
        autosize: true,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
        backgroundColor: "rgba(10,26,48,1)",
      });
    };
    el.appendChild(s);
    return () => { el.innerHTML = ""; };
  }, [ticker]);

  return <div ref={ref} style={{ height: 520, width: "100%" }} />;
}

"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    TradingView?: any;
  }
}

type Levels = {
  symbol: string;
  asof: string;
  daily: { lines: { name: string; value: number; style?: "solid" | "dashed"; color?: string }[] };
};

const TV_SYMBOLS: Record<string, string> = {
  NQ: "CME_MINI:NQ1!",
  ES: "CME_MINI:ES1!",
  BTCUSD: "CRYPTO:BTCUSD",
  CL: "NYMEX:CL1!",
  GC: "COMEX:GC1!",
};

export default function TVAdvancedChart({
  symbol = "ES",
  dark = false,
}: {
  symbol?: keyof typeof TV_SYMBOLS | string;
  dark?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [shapeIds, setShapeIds] = useState<string[]>([]);

  useEffect(() => {
    if (window.TradingView) return;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!window.TradingView || !containerRef.current) return;
    if (widgetRef.current?.remove) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    const tvSymbol = TV_SYMBOLS[symbol as string] ?? (symbol as string);

    widgetRef.current = new window.TradingView.widget({
      container_id: containerRef.current.id,
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: dark ? "dark" : "light",
      style: "1",
      locale: "en",
      withdateranges: true,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      disabled_features: ["header_compare", "header_saveload", "timeframes_toolbar"],
      enabled_features: ["header_symbol_search", "header_in_fullscreen_mode"],
      studies: [],
      toolbar_bg: dark ? "#131722" : "#ffffff",
      callback: () => {
        // Widget is ready, apply levels after a short delay
        setTimeout(() => applyLevels(), 1000);
      },
    });

    async function applyLevels() {
      if (shapeIds.length) {
        try {
          const chart = widgetRef.current?.chart?.();
          shapeIds.forEach((id) => chart.removeEntity(id));
          setShapeIds([]);
        } catch {}
      }

      const res = await fetch(`/api/levels?symbol=${encodeURIComponent(symbol as string)}&asof=today`);
      if (!res.ok) return;
      const levels: Levels = await res.json();
      const chart = widgetRef.current.chart();

      const ids: string[] = [];
      for (const L of levels.daily.lines) {
        const id = chart.createShape(
          { price: L.value, text: L.name },
          {
            shape: "horizontal_line",
            disableSelection: true,
            lock: true,
            disableSave: true,
            text: L.name,
            overrides: {
              color: L.color || (dark ? "#8b5cf6" : "#4f46e5"),
              linewidth: 1,
              linestyle: L.style === "dashed" ? 2 : 0,
              showLabel: true,
            },
          }
        );
        ids.push(id);
      }
      setShapeIds(ids);
    }

    return () => {
      if (widgetRef.current?.remove) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [symbol, dark]);

  return (
    <div className="relative h-[70vh] w-full rounded-2xl border p-0 shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
      <div id="tv-advanced-chart" ref={containerRef} className="absolute inset-0" />
    </div>
  );
}


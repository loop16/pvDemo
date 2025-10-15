"use client";

import { useEffect, useRef } from "react";
import type { OhlcBar, Levels } from "@/types";

const HEADER_H = 64; // keep in sync with CSS var

export default function ChartClient({ symbol = "SPY" }: { symbol?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      const mod: any = await import("lightweight-charts");
      const createChart = mod.createChart ?? mod.default?.createChart;
      const CrosshairMode = mod.CrosshairMode ?? mod.default?.CrosshairMode;
      if (!createChart) {
        console.error("lightweight-charts failed to load");
        return;
      }

      if (!ref.current || destroyed) return;

      const el = ref.current;
      const { width, height } = el.getBoundingClientRect();

      const chart = createChart(el, {
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
        layout: { 
          background: { color: "#ffffff" },
          textColor: "#333333"
        },
        rightPriceScale: { 
          borderVisible: true, 
          borderColor: "#d1d5db",
          scaleMargins: { top: 0.1, bottom: 0.1 }
        },
        timeScale: { 
          borderVisible: true, 
          borderColor: "#d1d5db", 
          timeVisible: true,
          rightOffset: 5,
          barSpacing: 3
        },
        grid: { 
          vertLines: { visible: false }, 
          horzLines: { visible: false } 
        },
        ...(CrosshairMode ? { crosshair: { mode: CrosshairMode.Normal } } : {}),
      });
      chartRef.current = chart;

      const series = chart.addCandlestickSeries({
        upColor: '#90EE90',        // Light green body for bullish candles
        downColor: '#000000',      // Black body for bearish candles
        borderUpColor: '#558B2F',  // Dark green border for bullish candles
        borderDownColor: '#000000', // Black border for bearish candles
        wickUpColor: '#696969',    // Dark gray wick for bullish candles
        wickDownColor: '#4F4F4F',  // Darker gray wick for bearish candles
      });

      // Keep candles away from edges so nothing looks "cut off"
      series.priceScale().applyOptions({
        scaleMargins: { top: 0.15, bottom: 0.10 },
      });

      const ohlcv: OhlcBar[] = await fetch(`/api/ohlcv?symbol=${symbol}&range=max`).then(r => r.json());
      
      // Filter to last 2 years of data
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const filteredData = ohlcv.filter(bar => new Date(bar.time) >= twoYearsAgo);
      
      series.setData(filteredData as any);

      const levels: Levels = await fetch(`/api/levels?symbol=${symbol}&asof=today`).then(r => r.json());
      for (const L of levels.daily.lines) {
        series.createPriceLine({
          price: L.value,
          title: L.name,
          lineWidth: 1,
          lineStyle: L.style === "dashed" ? 2 : 0,
        });
      }
      chart.timeScale().fitContent();

      // Resize on container changes
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          chart.resize(Math.floor(cr.width), Math.floor(cr.height));
        }
      });
      ro.observe(el);

      // Also on window resize (Safari sometimes misses RO)
      const onWin = () => {
        const r = el.getBoundingClientRect();
        chart.resize(Math.floor(r.width), Math.floor(r.height));
      };
      window.addEventListener("resize", onWin);

      return () => {
        window.removeEventListener("resize", onWin);
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
      };
    })();

    return () => {
      destroyed = true;
      chartRef.current?.remove?.();
    };
  }, [symbol]);

  return <div id="chart-root" ref={ref} className="chart-root w-full h-full border border-neutral-200" />;
}


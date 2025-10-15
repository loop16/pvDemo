"use client";

import { useEffect, useRef } from "react";

declare global { interface Window { TradingView?: any } }

type SearchResult = { symbol:string; full_name:string; description:string; exchange:string; ticker:string; type:string; };
type Bar = { time:number; open:number; high:number; low:number; close:number; volume?:number };

class MyDatafeed {
  baseUrl: string;
  constructor(baseUrl: string) { this.baseUrl = baseUrl; }

  onReady(cb: (x:any)=>void) {
    setTimeout(() => cb({
      supported_resolutions: ["1","5","15","60","1D"],
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
    }), 0);
  }

  searchSymbols(userInput: string, _exchange: string, _type: string, onResult: (x:SearchResult[])=>void) {
    fetch(`${this.baseUrl}/search?query=${encodeURIComponent(userInput)}`)
      .then(r => r.json()).then(onResult).catch(()=>onResult([]));
  }

  resolveSymbol(symbol: string, onResolve:(meta:any)=>void, onError:(e:any)=>void) {
    fetch(`${this.baseUrl}/symbols?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json()).then(onResolve).catch(onError);
  }

  getBars(symbolInfo:any, resolution:string, periodParams:any, onResult:(bars:Bar[], meta:any)=>void, onError:(e:any)=>void) {
    const { from, to } = periodParams; // epoch seconds
    const res = resolution === "D" ? "1D" : resolution;
    const url = `${this.baseUrl}/bars?symbol=${encodeURIComponent(symbolInfo.name)}&res=${res}&from=${from}&to=${to}`;
    fetch(url)
      .then(r => r.json())
      .then((bars:Bar[]) => onResult(bars, { noData: bars.length === 0 }))
      .catch(onError);
  }

  subscribeBars(_s:any,_r:string,_cb:(bar:Bar)=>void,_uid:string,_reset:()=>void) { /* no realtime for now */ }
  unsubscribeBars(_uid:string) { /* noop */ }
  getServerTime?(cb:(t:number)=>void) { cb(Math.floor(Date.now()/1000)); }
}

export default function TVChartCL({ symbol="ES" }: { symbol?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  // load the library script from /public/charting_library
  useEffect(() => {
    let mounted = true;

    const ensure = async () => {
      if ((window as any).TradingView?.widget) return;
      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.src = "/charting_library/charting_library.js";
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    };

    (async () => {
      await ensure();
      if (!mounted || !ref.current) return;

      // destroy old instance if any
      if (widgetRef.current?.remove) widgetRef.current.remove();

      const tv = new (window as any).TradingView.widget({
        container_id: ref.current,
        library_path: "/charting_library/",
        autosize: true,
        symbol,
        interval: "1D",
        datafeed: new MyDatafeed("/api/tv"),
        timezone: "Etc/UTC",
        locale: "en",
        theme: "Light",
        // Keep search in header (it now queries ONLY our 5 symbols)
        disabled_features: [
          "use_localstorage_for_settings",
          "header_compare",
          "pane_context_menu",      // disable right-click pane menu
          "show_logo_on_all_charts"
        ],
        enabled_features: ["header_symbol_search"],
        load_last_chart: false,
        overrides: {
          "paneProperties.background": "#FFFFFF",
          "paneProperties.horzGridProperties.color": "#F1F5F9",
          "paneProperties.vertGridProperties.color": "#F1F5F9",
          "scalesProperties.textColor": "#6B7280",
        },
      });

      widgetRef.current = tv;

      tv.onChartReady(async () => {
        // initial overlays for default symbol
        const chart = tv.chart();
        await drawLevels(chart, symbol);

        // re-draw when user changes symbol via header search
        chart.onSymbolChanged().subscribe(null, async (s:any) => {
          await drawLevels(chart, s.name);
        });
      });
    })();

    return () => {
      mounted = false;
      widgetRef.current?.remove?.();
    };
  }, [symbol]);

  return (
    <div className="relative h-[70vh] w-full rounded-2xl border border-neutral-200 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
      <div ref={ref} className="absolute inset-0" />
    </div>
  );
}

// fetch your levels and draw horizontal lines
async function drawLevels(chart:any, sym:string) {
  const r = await fetch(`/api/levels?symbol=${encodeURIComponent(sym)}&asof=today`);
  if (!r.ok) return;
  const levels = await r.json();
  // remove old lines (simple approach: reload the pane)
  // better: track entity ids and delete; keeping simple here:
  chart.resetData();

  // redraw bars (chart.resetData just resets graphics; the library refills bars)
  // Price lines:
  for (const L of levels.daily?.lines ?? []) {
    chart.createShape({ price: L.value, text: L.name }, {
      shape: "horizontal_line",
      lock: true, disableSave: true, disableSelection: true,
      overrides: {
        color: L.color ?? "#4F46E5",
        linewidth: 1,
        linestyle: L.style === "dashed" ? 2 : 0,
        showLabel: true,
      },
    });
  }
}
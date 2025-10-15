"use client";

import { useEffect, useState } from "react";
import ChartPanel from "@/components/ChartPanel";
import { Toolbar } from "@/components/Toolbar";
import { SidePanel } from "@/components/SidePanel";
import { normalizeBars } from "@/utils/normalize";

type SimpleModel = "simple" | "pro";
type Metrics = { price: number | null; changePct: number | null };

const AVAILABLE_SYMBOLS = ["NQ", "BTCUSD", "CL", "GC", "SPX"] as const;

export default function DemoPage() {
  const [symbol, setSymbol] = useState("SPX");
  const [bars, setBars] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ price: null, changePct: null });
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<SimpleModel>("simple");

  async function fetchBars(sym: string) {
    const res = await fetch(`/api/ohlcv?symbol=${encodeURIComponent(sym)}&range=max`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeBars(raw);
  }

  const handleLoad = async (input: string) => {
    const next = input.trim().toUpperCase();
    if (!AVAILABLE_SYMBOLS.includes(next as (typeof AVAILABLE_SYMBOLS)[number])) {
      setError(`Symbol ${next} not available in demo. Choose from ${AVAILABLE_SYMBOLS.join(", ")}.`);
      return;
    }

    setSymbol(next);
    setError(null);

    try {
      const data = await fetchBars(next);
      setBars(data);

      if (data.length >= 2) {
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        const price = +last.close;
        const changePct = prev && prev.close ? +(((price - prev.close) / prev.close) * 100).toFixed(2) : 0;
        setMetrics({ price, changePct });
      } else {
        setMetrics({ price: null, changePct: null });
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load data.");
      setBars([]);
      setMetrics({ price: null, changePct: null });
    }
  };

  useEffect(() => {
    handleLoad("SPX");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="header">
        <Toolbar onLoad={handleLoad} />
      </header>

      <main className="chart-area">
        <ChartPanel 
          data={bars}
          symbol={symbol}
          selectedModel={selectedModel}
          selectedOutcome={"AUTO" as any}
        />
        {error && <div className="error">{error}</div>}
      </main>

      <aside className="sidebar">
        <SidePanel 
          quarterLevels={null}
          metrics={metrics}
          selectedModel={selectedModel}
          onModelChange={(model) => {
            if (model === "overlay") return;
            setSelectedModel(model as SimpleModel);
          }}
          selectedOutcome={"AUTO" as any}
          onOutcomeChange={() => {}}
          showOverlay={false}
          showOutcome={false}
        />

        <div className="card mt-4">
          <div className="card-title">Demo</div>
          <div className="text-sm text-gray-700 space-y-2">
            <p>This demo has access to 5 assets:</p>
            <ul className="list-disc ml-5">
              <li>SPX</li>
              <li>NQ</li>
              <li>BTCUSD</li>
              <li>CL</li>
              <li>GC</li>
            </ul>
            <p>Data is limited to May 2025.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

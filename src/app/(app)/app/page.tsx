"use client";
import { useState, useEffect } from "react";
import ChartPanel from "@/components/ChartPanel";
import { Toolbar } from "@/components/Toolbar";
import { SidePanel } from "@/components/SidePanel";
import { normalizeBars } from "@/utils/normalize";

type OutcomeKey = 'AUTO' | 'LONG_TRUE' | 'LONG_FALSE' | 'SHORT_TRUE' | 'SHORT_FALSE' | 'NONE';

const AVAILABLE_SYMBOLS = ["NQ", "BTCUSD", "CL", "GC", "SPX"];

export default function AppPage() {
  const [symbol, setSymbol] = useState("SPX");
  const [bars, setBars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quarterLevels, setQuarterLevels] = useState<null | {
    upper20:number; upper50:number; upper80:number; lower20:number; lower50:number; lower80:number;
  }>(null);
  const [metrics, setMetrics] = useState<{ price:number|null; changePct:number|null }>({ price: null, changePct: null });
  const [selectedModel, setSelectedModel] = useState<'simple' | 'pro' | 'overlay' | 'beta'>('simple');
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeKey>('AUTO');
  const [overlaySymbol, setOverlaySymbol] = useState<string | null>(null);
  const [overlayLevels, setOverlayLevels] = useState<any>(null);

  async function fetchBars(sym: string) {
    const res = await fetch(`/api/ohlcv?symbol=${encodeURIComponent(sym)}&range=max`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return normalizeBars(raw); // ensures correct shape & time
  }

  async function fetchOverlayLevels(sym: string) {
    const res = await fetch(`/api/levels?symbol=${encodeURIComponent(sym)}&model=pro`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  const handleLoad = async (newSymbol: string) => {
    if (!AVAILABLE_SYMBOLS.includes(newSymbol.toUpperCase())) {
      setError(`Symbol ${newSymbol} not supported. Available: ${AVAILABLE_SYMBOLS.join(', ')}`);
      return;
    }

    setSymbol(newSymbol.toUpperCase());
    setLoading(true); 
    setError(null);
    try {
      const data = await fetchBars(newSymbol.trim());
      setBars(data);
      // compute metrics: last close and 24h change vs prior close
      if (data.length >= 2) {
        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        const price = +last.close;
        const changePct = prev && prev.close ? +(((price - prev.close) / prev.close) * 100).toFixed(2) : 0;
        setMetrics({ price, changePct });
      } else {
        setMetrics({ price: null, changePct: null });
      }
      // levels now supplied by ChartPanel callback for exact parity with drawn labels
      setQuarterLevels(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data');
      setBars([]);
      setQuarterLevels(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlaySelect = async (newOverlaySymbol: string) => {
    try {
      setOverlaySymbol(newOverlaySymbol);
      // Fetch only levels data for the overlay asset (keep current asset's price data)
      const levelsData = await fetchOverlayLevels(newOverlaySymbol);
      setOverlayLevels(levelsData);
      
      // Clear quarter levels since we'll get new ones from the overlay asset
      setQuarterLevels(null);
    } catch (err) {
      console.error('Failed to load overlay data:', err);
      setOverlaySymbol(null);
      setOverlayLevels(null);
    }
  };

  const handleModelChange = (model: 'simple' | 'pro' | 'overlay' | 'beta') => {
    setSelectedModel(model);
    // Clear overlay data when switching away from overlay mode
    if (model !== 'overlay') {
      setOverlaySymbol(null);
      setOverlayLevels(null);
      // Clear quarter levels since we'll get new ones from the current asset
      setQuarterLevels(null);
    }
  };

  // Auto-load default chart on mount
  useEffect(() => {
    handleLoad("SPX");
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
          onQuarterLevels={setQuarterLevels}
          selectedModel={selectedModel}
          selectedOutcome={selectedOutcome}
          overlaySymbol={overlaySymbol}
          overlayLevels={overlayLevels}
        />
        {error && <div className="error">{error}</div>}
      </main>

      <aside className="sidebar">
        <SidePanel 
          quarterLevels={quarterLevels} 
          metrics={metrics}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          selectedOutcome={selectedOutcome}
          onOutcomeChange={setSelectedOutcome}
          onOverlaySelect={handleOverlaySelect}
          overlaySymbol={overlaySymbol}
        />
      </aside>
    </div>
  );
}


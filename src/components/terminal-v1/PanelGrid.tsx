'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import TerminalChart from './TerminalChart';
import SymbolSearch from './SymbolSearch';
import { useChartData } from '@/hooks/useChartData';
import type { LayoutMode, PanelConfig, SymbolEntry } from './types';

// ============================================================================
// MODEL SELECTOR
// ============================================================================

function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const models = ['pro', 'simple', 'beta'] as const;
  return (
    <div className="flex items-center gap-0">
      {models.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2 h-[24px] text-[10px] uppercase tracking-wider border transition-colors ${
            value === m
              ? 'bg-[#1a1a2e] text-[#ddd] border-[#333]'
              : 'bg-transparent text-[#555] border-[#222] hover:text-[#888]'
          }`}
          style={{
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
            marginLeft: m === models[0] ? 0 : -1,
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// SINGLE PANEL
// ============================================================================

function ChartPanelUnit({
  config,
  isActive,
  onActivate,
  onConfigChange,
  onClose,
  symbols,
  source,
  showClose,
}: {
  config: PanelConfig;
  isActive: boolean;
  onActivate: () => void;
  onConfigChange: (cfg: Partial<PanelConfig>) => void;
  onClose?: () => void;
  symbols: SymbolEntry[];
  source: 'demo' | 'live';
  showClose: boolean;
}) {
  const { bars, levels, loading, error } = useChartData(config.symbol, config.model, source);
  const [priceInfo, setPriceInfo] = useState<{
    close: number;
    change: number;
    changePct: number;
  } | null>(null);

  const changeColor = priceInfo
    ? priceInfo.changePct >= 0
      ? '#00d68f'
      : '#ff4757'
    : '#666';

  return (
    <div
      className="flex flex-col min-w-0 min-h-0 overflow-hidden"
      style={{
        border: `1px solid ${isActive ? '#2962ff33' : '#1a1a1a'}`,
        background: '#0a0a0a',
      }}
      onClick={onActivate}
    >
      {/* Panel header */}
      <div
        className="flex items-center gap-2 px-2 shrink-0"
        style={{
          height: 32,
          borderBottom: '1px solid #1a1a1a',
          background: '#0c0c0c',
        }}
      >
        <SymbolSearch
          value={config.symbol}
          onChange={(sym) => onConfigChange({ symbol: sym })}
          symbols={symbols}
        />
        <ModelSelector
          value={config.model}
          onChange={(m) => onConfigChange({ model: m as PanelConfig['model'] })}
        />
        <div className="flex-1" />
        {priceInfo && (
          <div
            className="flex items-center gap-3 text-[11px]"
            style={{ fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
          >
            <span className="text-[#ddd]">
              {priceInfo.close >= 10000
                ? priceInfo.close.toFixed(0)
                : priceInfo.close >= 100
                ? priceInfo.close.toFixed(1)
                : priceInfo.close.toFixed(2)}
            </span>
            <span style={{ color: changeColor }}>
              {priceInfo.changePct >= 0 ? '+' : ''}
              {priceInfo.changePct.toFixed(2)}%
            </span>
          </div>
        )}
        {loading && !bars.length && (
          <span
            className="text-[10px] text-[#555] animate-pulse"
            style={{ fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
          >
            Loading...
          </span>
        )}
        {showClose && onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ml-1 w-5 h-5 flex items-center justify-center text-[#444] hover:text-[#888] transition-colors"
            title="Close panel"
          >
            <svg width={10} height={10} viewBox="0 0 10 10" stroke="currentColor" strokeWidth={1.5}>
              <line x1={1} y1={1} x2={9} y2={9} />
              <line x1={9} y1={1} x2={1} y2={9} />
            </svg>
          </button>
        )}
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 relative">
        <TerminalChart
          symbol={config.symbol}
          source={source}
          model={config.model}
          bars={bars}
          levels={levels}
          loading={loading}
          error={error}
          onPriceInfo={setPriceInfo}
        />
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-2 shrink-0"
        style={{
          height: 20,
          borderTop: '1px solid #1a1a1a',
          background: '#0a0a0a',
          fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
        }}
      >
        <span className="text-[10px] text-[#444]">
          {config.symbol} &middot; D &middot; {config.model.toUpperCase()}
        </span>
        <span className="text-[10px] text-[#333]">
          {bars.length > 0 ? `${bars.length} bars` : ''}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// RESIZE HANDLE
// ============================================================================

function ResizeHandle({
  direction,
  onDrag,
}: {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startRef.current = direction === 'horizontal' ? e.clientX : e.clientY;

      const onMove = (me: MouseEvent) => {
        const current = direction === 'horizontal' ? me.clientX : me.clientY;
        const delta = current - startRef.current;
        startRef.current = current;
        onDrag(delta);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [direction, onDrag]
  );

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className={`flex-shrink-0 ${
        direction === 'horizontal'
          ? 'w-[4px] cursor-col-resize hover:bg-[#2962ff44]'
          : 'h-[4px] cursor-row-resize hover:bg-[#2962ff44]'
      }`}
      style={{
        background: '#111',
        transition: 'background 0.15s',
      }}
    />
  );
}

// ============================================================================
// PANEL GRID
// ============================================================================

const DEFAULT_PANELS: PanelConfig[] = [
  { id: '1', symbol: 'SPX', model: 'pro' },
  { id: '2', symbol: 'BTCUSD', model: 'pro' },
  { id: '3', symbol: 'GC', model: 'pro' },
  { id: '4', symbol: 'NQ', model: 'pro' },
];

export interface PanelGridProps {
  layout: LayoutMode;
  symbols: SymbolEntry[];
  source?: 'demo' | 'live';
  initialSymbol?: string;
}

export default function PanelGrid({ layout, symbols, source = 'live', initialSymbol }: PanelGridProps) {
  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    const base = [...DEFAULT_PANELS];
    if (initialSymbol) {
      base[0] = { ...base[0], symbol: initialSymbol };
    }
    return base;
  });
  const [activePanel, setActivePanel] = useState('1');

  // Resize fractions (0-1 range, split position)
  const [colSplit, setColSplit] = useState(0.5);
  const [rowSplit, setRowSplit] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update initial symbol when it changes
  useEffect(() => {
    if (initialSymbol) {
      setPanels((prev) => {
        const next = [...prev];
        next[0] = { ...next[0], symbol: initialSymbol };
        return next;
      });
    }
  }, [initialSymbol]);

  const updatePanel = useCallback((id: string, cfg: Partial<PanelConfig>) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...cfg } : p)));
  }, []);

  const onColDrag = useCallback(
    (delta: number) => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setColSplit((prev) => Math.max(0.15, Math.min(0.85, prev + delta / w)));
    },
    []
  );

  const onRowDrag = useCallback(
    (delta: number) => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      setRowSplit((prev) => Math.max(0.15, Math.min(0.85, prev + delta / h)));
    },
    []
  );

  const panelCount = layout === '1x1' ? 1 : layout === '2x2' ? 4 : 2;
  const activePanels = panels.slice(0, panelCount);

  const renderPanel = (panel: PanelConfig) => (
    <ChartPanelUnit
      key={panel.id}
      config={panel}
      isActive={activePanel === panel.id}
      onActivate={() => setActivePanel(panel.id)}
      onConfigChange={(cfg) => updatePanel(panel.id, cfg)}
      symbols={symbols}
      source={source}
      showClose={panelCount > 1}
    />
  );

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      {layout === '1x1' && (
        <div className="w-full h-full">{renderPanel(activePanels[0])}</div>
      )}

      {layout === '1x2' && (
        <div className="flex w-full h-full">
          <div style={{ width: `${colSplit * 100}%` }}>{renderPanel(activePanels[0])}</div>
          <ResizeHandle direction="horizontal" onDrag={onColDrag} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {activePanels[1] && renderPanel(activePanels[1])}
          </div>
        </div>
      )}

      {layout === '2x1' && (
        <div className="flex flex-col w-full h-full">
          <div style={{ height: `${rowSplit * 100}%` }}>{renderPanel(activePanels[0])}</div>
          <ResizeHandle direction="vertical" onDrag={onRowDrag} />
          <div style={{ flex: 1, minHeight: 0 }}>
            {activePanels[1] && renderPanel(activePanels[1])}
          </div>
        </div>
      )}

      {layout === '2x2' && (
        <div className="flex flex-col w-full h-full">
          {/* Top row */}
          <div className="flex" style={{ height: `${rowSplit * 100}%` }}>
            <div style={{ width: `${colSplit * 100}%` }}>{renderPanel(activePanels[0])}</div>
            <ResizeHandle direction="horizontal" onDrag={onColDrag} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {activePanels[1] && renderPanel(activePanels[1])}
            </div>
          </div>
          <ResizeHandle direction="vertical" onDrag={onRowDrag} />
          {/* Bottom row */}
          <div className="flex" style={{ flex: 1, minHeight: 0 }}>
            <div style={{ width: `${colSplit * 100}%` }}>
              {activePanels[2] && renderPanel(activePanels[2])}
            </div>
            <ResizeHandle direction="horizontal" onDrag={onColDrag} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {activePanels[3] && renderPanel(activePanels[3])}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

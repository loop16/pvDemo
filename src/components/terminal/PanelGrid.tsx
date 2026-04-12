'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import NativeChart from './NativeChart';
import SymbolSearch from './SymbolSearch';
import { useTheme } from './ThemeContext';
import { useChartData } from '@/hooks/useChartData';
import type { LayoutMode, PanelConfig, SymbolEntry } from './types';

// ============================================================================
// THEME
// ============================================================================

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

// ============================================================================
// MODEL SELECTOR — sliding pill
// ============================================================================

const MODEL_ITEMS = ['pro', 'simple', 'beta', 'overlay'] as const;
const MODEL_W = 46; // px per segment

function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const { theme } = useTheme();
  const activeIdx = Math.max(0, MODEL_ITEMS.indexOf(value as typeof MODEL_ITEMS[number]));

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: theme.activeNavBg,
        borderRadius: 999,
        padding: '2px',
        height: 24,
        flexShrink: 0,
      }}
    >
      {/* Sliding pill */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: MODEL_W,
          height: 20,
          borderRadius: 999,
          background: theme.text,
          transform: `translateX(${activeIdx * MODEL_W}px)`,
          transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      />
      {MODEL_ITEMS.map((m, i) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            position: 'relative',
            zIndex: 1,
            width: MODEL_W,
            height: 20,
            fontSize: 9,
            fontFamily: MONO,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            border: 'none',
            background: 'transparent',
            color: value === m ? theme.bg : theme.textDim,
            cursor: 'pointer',
            transition: 'color 0.18s',
            padding: 0,
            flexShrink: 0,
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// SCENARIO SELECTOR — sliding pill
// ============================================================================

const SCENARIO_ITEMS = [
  { value: 'AUTO',       label: 'AUTO' },
  { value: 'LONG_TRUE',  label: 'L+'   },
  { value: 'LONG_FALSE', label: 'L−'   },
  { value: 'SHORT_TRUE', label: 'S+'   },
  { value: 'SHORT_FALSE',label: 'S−'   },
] as const;

const SCENARIO_W = 36; // px per segment

function ScenarioSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (scenario: string) => void;
}) {
  const { theme } = useTheme();
  const activeIdx = Math.max(0, SCENARIO_ITEMS.findIndex(s => s.value === value));

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: theme.activeNavBg,
        borderRadius: 999,
        padding: '2px',
        height: 24,
        flexShrink: 0,
      }}
    >
      {/* Sliding pill */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: SCENARIO_W,
          height: 20,
          borderRadius: 999,
          background: theme.text,
          transform: `translateX(${activeIdx * SCENARIO_W}px)`,
          transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      />
      {SCENARIO_ITEMS.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          style={{
            position: 'relative',
            zIndex: 1,
            width: SCENARIO_W,
            height: 20,
            fontSize: 9,
            fontFamily: MONO,
            fontWeight: 700,
            letterSpacing: '0.06em',
            border: 'none',
            background: 'transparent',
            color: value === s.value ? theme.bg : theme.textDim,
            cursor: 'pointer',
            transition: 'color 0.18s',
            padding: 0,
            flexShrink: 0,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// SINGLE PANEL (white theme)
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
  const { theme } = useTheme();
  const defaultOverlaySymbol = config.symbol === 'SPX' ? 'NQ' : 'SPX';
  const resolvedOverlaySymbol = config.model === 'overlay' ? (config.overlaySymbol || defaultOverlaySymbol) : undefined;
  const effectiveModel = config.model === 'overlay' ? 'pro' : config.model;
  const chartData = useChartData(config.symbol, effectiveModel, source);
  // When overlay: fetch levels from the overlay symbol instead
  const overlayLevelsData = useChartData(
    resolvedOverlaySymbol || config.symbol,
    'pro',
    source,
  );
  const bars = chartData.bars;
  const levels = resolvedOverlaySymbol ? overlayLevelsData.levels : chartData.levels;
  const loading = chartData.loading || (config.model === 'overlay' && overlayLevelsData.loading);
  const error = chartData.error;
  const [priceInfo, setPriceInfo] = useState<{
    close: number;
    change: number;
    changePct: number;
  } | null>(null);
  const [overlayInput, setOverlayInput] = useState(config.overlaySymbol || '');

  const changeColor = priceInfo
    ? priceInfo.changePct >= 0
      ? theme.positive
      : theme.negative
    : theme.textDim;

  return (
    <div
      className="flex flex-col min-w-0 min-h-0 overflow-hidden h-full relative"
      style={{
        border: theme.frosted ? '1px solid rgba(200,200,210,0.4)' : `1px solid ${theme.border}`,
        background: theme.frosted ? 'rgba(255,255,255,0.3)' : theme.bg,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: theme.frosted ? '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
      }}
      onClick={onActivate}
    >
      {/* Active panel indicator — corner triangle */}
      {isActive && (
        <svg
          className="absolute top-0 right-0 z-10 pointer-events-none"
          width="12" height="12" viewBox="0 0 12 12"
        >
          <polygon points="0,0 12,0 12,12" fill={theme.accent} />
        </svg>
      )}
      {/* Panel header */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 38,
          gap: 6,
          paddingLeft: 6,
          paddingRight: 6,
          borderBottom: theme.frosted ? '1px solid rgba(200,200,210,0.3)' : `1px solid ${theme.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.5)' : theme.bg,
        }}
      >
        <SymbolSearch
          value={config.symbol}
          onChange={(sym) => onConfigChange({ symbol: sym })}
          symbols={symbols}
        />
        <ModelSelector
          value={config.model}
          onChange={(m) => onConfigChange(
            m === 'overlay'
              ? { model: m as PanelConfig['model'], overlaySymbol: config.overlaySymbol || defaultOverlaySymbol }
              : { model: m as PanelConfig['model'] }
          )}
        />
        {/* Scenario control — pro/beta only */}
        {(config.model === 'pro' || config.model === 'beta') && (
          <ScenarioSelector
            value={config.scenario || 'AUTO'}
            onChange={(s) => onConfigChange({ scenario: s as PanelConfig['scenario'] })}
          />
        )}
        {/* Overlay symbol search */}
        {config.model === 'overlay' && (
          <div className="flex items-center gap-1" style={{ marginLeft: 4 }}>
            <span style={{ fontSize: 9, color: theme.textDim, fontFamily: MONO, letterSpacing: '0.05em' }}>FROM</span>
            <SymbolSearch
              value={resolvedOverlaySymbol || defaultOverlaySymbol}
              onChange={(sym) => onConfigChange({ overlaySymbol: sym })}
              symbols={symbols}
            />
          </div>
        )}
        <div className="flex-1" />
        {priceInfo && (
          <div
            className="flex items-center gap-3 text-[11px]"
            style={{ fontFamily: MONO }}
          >
            <span style={{ color: theme.text, fontWeight: 600 }}>
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
            className="text-[10px] animate-pulse"
            style={{ fontFamily: MONO, color: theme.textDim }}
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
            className="ml-1 w-7 h-7 flex items-center justify-center transition-colors"
            style={{ color: theme.crosshair }}
            title="Close panel"
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.textSecondary; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.crosshair; }}
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
        <NativeChart
          bars={bars}
          levels={levels}
          model={config.model === 'overlay' ? 'pro' : config.model}
          outcome={config.scenario || 'AUTO'}
          loading={loading}
          error={error}
          onPriceInfo={setPriceInfo}
        />
      </div>

      {/* Status bar — 24px */}
      <div
        className="flex items-center justify-between px-2 shrink-0"
        style={{
          height: 24,
          borderTop: theme.frosted ? '1px solid rgba(200,200,210,0.3)' : `1px solid ${theme.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.5)' : theme.surface,
          fontFamily: MONO,
        }}
      >
        <span style={{ fontSize: 10, color: theme.textDim }}>
          {config.symbol} &middot; DAILY &middot; {config.model.toUpperCase()}{config.model === 'overlay' && resolvedOverlaySymbol ? ` (${resolvedOverlaySymbol})` : ''}
        </span>
        <span style={{ fontSize: 10, color: theme.borderLight === theme.border ? theme.textDim : theme.crosshair }}>
          {bars.length > 0 ? `${bars.length} bars` : ''}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// RESIZE HANDLE (white theme)
// ============================================================================

function ResizeHandle({
  direction,
  onDrag,
}: {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
}) {
  const { theme } = useTheme();
  const startRef = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      startRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
      e.currentTarget.setPointerCapture?.(e.pointerId);

      const onMove = (pe: PointerEvent) => {
        const current = direction === 'horizontal' ? pe.clientX : pe.clientY;
        const delta = current - startRef.current;
        startRef.current = current;
        onDrag(delta);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [direction, onDrag]
  );

  return (
    <div
      onPointerDown={onPointerDown}
      className={`flex-shrink-0 ${
        direction === 'horizontal'
          ? 'w-[4px] cursor-col-resize'
          : 'h-[4px] cursor-row-resize'
      }`}
      style={{
        background: theme.borderLight,
        transition: 'background 0.15s',
        touchAction: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.accent + '22'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = theme.borderLight; }}
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
  { id: '4', symbol: 'NQ1!', model: 'pro' },
];

export interface PanelGridProps {
  layout: LayoutMode;
  symbols: SymbolEntry[];
  source?: 'demo' | 'live';
  initialSymbol?: string;
  setActivePanelSymbol?: React.MutableRefObject<((symbol: string) => void) | null>;
}

const PANELS_STORAGE_KEY = 'pricevault-panels';

export default function PanelGrid({ layout, symbols, source = 'live', initialSymbol, setActivePanelSymbol }: PanelGridProps) {
  const { theme } = useTheme();
  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    // Restore last session's panel config from localStorage
    try {
      const saved = localStorage.getItem(PANELS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PanelConfig[];
        if (Array.isArray(parsed) && parsed.length >= 4) {
          const restored = parsed.slice(0, 4).map((p, i) => ({
            ...DEFAULT_PANELS[i],
            ...p,
            id: DEFAULT_PANELS[i].id,
          }));
          if (initialSymbol) restored[0] = { ...restored[0], symbol: initialSymbol };
          return restored;
        }
      }
    } catch {}
    const base = [...DEFAULT_PANELS];
    if (initialSymbol) base[0] = { ...base[0], symbol: initialSymbol };
    return base;
  });
  const [activePanel, setActivePanel] = useState('1');

  // Persist panel config whenever it changes
  useEffect(() => {
    try { localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(panels)); } catch {}
  }, [panels]);

  // Expose a function to set the active panel's symbol from outside
  useEffect(() => {
    if (setActivePanelSymbol) {
      setActivePanelSymbol.current = (symbol: string) => {
        setPanels(prev => prev.map(p => p.id === activePanel ? { ...p, symbol } : p));
      };
    }
  }, [activePanel, setActivePanelSymbol]);

  // Resizable split ratios
  const [colSplit, setColSplit] = useState(0.5);
  const [rowSplit, setRowSplit] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update first panel when initialSymbol changes
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
    <div ref={containerRef} className="w-full h-full overflow-hidden" style={{ background: theme.frosted ? 'transparent' : theme.surface }}>
      {/* Single panel */}
      {layout === '1x1' && (
        <div className="w-full h-full">{renderPanel(activePanels[0])}</div>
      )}

      {/* Side by side (1x2) */}
      {layout === '1x2' && (
        <div className="flex w-full h-full">
          <div style={{ width: `${colSplit * 100}%` }}>{renderPanel(activePanels[0])}</div>
          <ResizeHandle direction="horizontal" onDrag={onColDrag} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {activePanels[1] && renderPanel(activePanels[1])}
          </div>
        </div>
      )}

      {/* Stacked (2x1) */}
      {layout === '2x1' && (
        <div className="flex flex-col w-full h-full">
          <div style={{ height: `${rowSplit * 100}%` }}>{renderPanel(activePanels[0])}</div>
          <ResizeHandle direction="vertical" onDrag={onRowDrag} />
          <div style={{ flex: 1, minHeight: 0 }}>
            {activePanels[1] && renderPanel(activePanels[1])}
          </div>
        </div>
      )}

      {/* Quad (2x2) */}
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

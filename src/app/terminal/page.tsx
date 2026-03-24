'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PanelGrid from '@/components/terminal/PanelGrid';
import { useTheme } from '@/components/terminal/ThemeContext';
import type { LayoutMode, SymbolEntry } from '@/components/terminal/types';

// ============================================================================
// LAYOUT ICONS (white theme)
// ============================================================================

function LayoutIcon({ mode, active, color }: { mode: LayoutMode; active: boolean; color: string }) {
  const size = 16;

  switch (mode) {
    case '1x1':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16">
          <rect x={1} y={1} width={14} height={14} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
    case '1x2':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16">
          <rect x={1} y={1} width={6} height={14} fill="none" stroke={color} strokeWidth={1.5} />
          <rect x={9} y={1} width={6} height={14} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
    case '2x1':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16">
          <rect x={1} y={1} width={14} height={6} fill="none" stroke={color} strokeWidth={1.5} />
          <rect x={1} y={9} width={14} height={6} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
    case '2x2':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16">
          <rect x={1} y={1} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} />
          <rect x={9} y={1} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} />
          <rect x={1} y={9} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} />
          <rect x={9} y={9} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
  }
}

// ============================================================================
// TERMINAL CONTENT
// ============================================================================

function TerminalContent() {
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const [layout, setLayout] = useState<LayoutMode>('1x1');
  const [symbols, setSymbols] = useState<SymbolEntry[]>([]);

  const initialSymbol = searchParams.get('symbol')?.toUpperCase() || 'SPX';

  // Fetch symbols list on mount
  useEffect(() => {
    fetch('/api/symbols?source=live')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSymbols(data);
      })
      .catch(() => {
        setSymbols([
          { id: 'SPX', label: 'SPX', class: 'index' },
          { id: 'NQ', label: 'NQ', class: 'futures' },
          { id: 'BTCUSD', label: 'BTCUSD', class: 'crypto' },
          { id: 'CL', label: 'CL', class: 'futures' },
          { id: 'GC', label: 'GC', class: 'futures' },
        ]);
      });
  }, []);

  const layouts: LayoutMode[] = ['1x1', '1x2', '2x1', '2x2'];

  return (
    <div className="h-full w-full flex flex-col">
      {/* Layout toolbar */}
      <div
        className="flex items-center justify-center px-3 shrink-0"
        style={{
          height: 28,
          borderBottom: `1px solid ${theme.border}`,
          background: theme.bg,
        }}
      >
        <div className="flex items-center gap-1">
          {layouts.map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className="p-1 transition-colors"
              style={{
                background: layout === l ? theme.activeNavBg : 'transparent',
              }}
              title={l}
            >
              <LayoutIcon mode={l} active={layout === l} color={layout === l ? theme.text : theme.textDim} />
            </button>
          ))}
        </div>
      </div>

      {/* Panel area fills remaining space */}
      <div className="flex-1 min-h-0">
        <PanelGrid
          layout={layout}
          symbols={symbols}
          source="live"
          initialSymbol={initialSymbol}
        />
      </div>
    </div>
  );
}

// ============================================================================
// PAGE (with Suspense wrapper for useSearchParams)
// ============================================================================

export default function TerminalPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-full w-full flex items-center justify-center"
          style={{
            background: '#ffffff',
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          }}
        >
          <span className="text-[12px] text-[#9ca3af] animate-pulse">Loading terminal...</span>
        </div>
      }
    >
      <TerminalContent />
    </Suspense>
  );
}

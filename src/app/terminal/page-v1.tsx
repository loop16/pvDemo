'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PanelGrid from '@/components/terminal/PanelGrid';
import type { LayoutMode, SymbolEntry } from '@/components/terminal/types';

// ============================================================================
// LAYOUT ICONS
// ============================================================================

function LayoutIcon({ mode, active }: { mode: LayoutMode; active: boolean }) {
  const color = active ? '#ddd' : '#555';
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
// TERMINAL CONTENT (needs searchParams)
// ============================================================================

function TerminalContent() {
  const searchParams = useSearchParams();
  const [layout, setLayout] = useState<LayoutMode>('1x1');
  const [symbols, setSymbols] = useState<SymbolEntry[]>([]);

  const initialSymbol = searchParams.get('symbol')?.toUpperCase() || 'SPX';

  // Load available symbols
  useEffect(() => {
    fetch('/api/symbols')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSymbols(data);
      })
      .catch(() => {
        setSymbols([
          { id: 'SPX', label: 'SPX' },
          { id: 'NQ', label: 'NQ' },
          { id: 'BTCUSD', label: 'BTCUSD' },
          { id: 'CL', label: 'CL' },
          { id: 'GC', label: 'GC' },
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
          borderBottom: '1px solid #1a1a1a',
          background: '#0c0c0c',
        }}
      >
        <div className="flex items-center gap-1">
          {layouts.map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`p-1 transition-colors ${
                layout === l ? 'bg-[#1a1a2e]' : 'hover:bg-[#111]'
              }`}
              title={l}
            >
              <LayoutIcon mode={l} active={layout === l} />
            </button>
          ))}
        </div>
      </div>

      {/* Panel area */}
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
// PAGE (wraps content in Suspense for searchParams)
// ============================================================================

export default function TerminalPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-full w-full flex items-center justify-center"
          style={{
            background: '#0a0a0a',
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          }}
        >
          <span className="text-[12px] text-[#555] animate-pulse">Loading terminal...</span>
        </div>
      }
    >
      <TerminalContent />
    </Suspense>
  );
}

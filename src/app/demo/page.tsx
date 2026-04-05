'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PanelGrid from '@/components/terminal/PanelGrid';
import { useTheme } from '@/components/terminal/ThemeContext';
import type { LayoutMode, SymbolEntry } from '@/components/terminal/types';

function LayoutIcon({ mode, active, color }: { mode: LayoutMode; active: boolean; color: string }) {
  const size = 16;
  switch (mode) {
    case '1x1':
      return <svg width={size} height={size} viewBox="0 0 16 16"><rect x={1} y={1} width={14} height={14} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
    case '1x2':
      return <svg width={size} height={size} viewBox="0 0 16 16"><rect x={1} y={1} width={6} height={14} fill="none" stroke={color} strokeWidth={1.5} /><rect x={9} y={1} width={6} height={14} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
    case '2x1':
      return <svg width={size} height={size} viewBox="0 0 16 16"><rect x={1} y={1} width={14} height={6} fill="none" stroke={color} strokeWidth={1.5} /><rect x={1} y={9} width={14} height={6} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
    case '2x2':
      return <svg width={size} height={size} viewBox="0 0 16 16"><rect x={1} y={1} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} /><rect x={9} y={1} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} /><rect x={1} y={9} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} /><rect x={9} y={9} width={6} height={6} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
  }
}

function DemoContent() {
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const [layout, setLayout] = useState<LayoutMode>('1x1');
  const [symbols, setSymbols] = useState<SymbolEntry[]>([
    { id: 'SPX', label: 'SPX' },
    { id: 'NQ', label: 'NQ' },
    { id: 'BTCUSD', label: 'BTCUSD' },
    { id: 'CL', label: 'CL' },
    { id: 'GC', label: 'GC' },
  ]);

  const initialSymbol = searchParams.get('symbol')?.toUpperCase() || 'SPX';

  useEffect(() => {
    fetch('/api/symbols?source=demo')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSymbols(data); })
      .catch(() => {});
  }, []);

  const layouts: LayoutMode[] = ['1x1', '1x2', '2x1', '2x2'];

  return (
    <div className="h-full w-full flex flex-col">
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{ height: 36, borderBottom: `1px solid ${theme.border}`, background: theme.bg }}
      >
        <div className="flex items-center gap-1">
          {layouts.map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className="p-1 transition-colors"
              style={{ background: layout === l ? theme.activeNavBg : 'transparent' }}
              title={l}
            >
              <LayoutIcon mode={l} active={layout === l} color={layout === l ? theme.text : theme.textDim} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'SF Mono', monospace", letterSpacing: '0.05em' }}>
            DEMO — 5 symbols
          </span>
          <a
            href="/signup"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.bg,
              background: theme.text,
              padding: '3px 10px',
              textDecoration: 'none',
              fontFamily: "'SF Mono', monospace",
              whiteSpace: 'nowrap',
            }}
          >
            Get full access →
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <PanelGrid
          layout={layout}
          symbols={symbols}
          source="demo"
          initialSymbol={initialSymbol}
        />
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center" style={{ background: '#ffffff' }}>
          <span className="text-[12px] text-[#9ca3af] animate-pulse">Loading demo...</span>
        </div>
      }
    >
      <DemoContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PanelGrid from '@/components/terminal/PanelGrid';
import { useTheme } from '@/components/terminal/ThemeContext';
import type { ChartTheme } from '@/components/terminal/themes';
import type { LayoutMode, SymbolEntry } from '@/components/terminal/types';

// ============================================================================
// STATS SIDE PANEL
// ============================================================================

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

type AssetClass = 'equity' | 'futures' | 'crypto' | 'fx' | 'index' | 'etf';

type ModelType = 'pro' | 'simple' | 'beta';

type MoverRow = {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  mid: number;
  quarterHigh: number;
  quarterLow: number;
  highZone: string;
  lowZone: string;
  lastQCloseZone?: string;
  vsMid: number;
  zone: string;
  magnitude: number;
  direction: 'above' | 'below';
  assetClass: AssetClass;
};

type StatsSortKey = 'symbol' | 'assetClass' | 'price' | 'changePct' | 'vsMid' | 'zone' | 'magnitude' | 'highZone' | 'lowZone' | 'lastQCloseZone';
type DirFilter = 'all' | 'above' | 'below' | 'extremes';
type ClassFilter = 'all' | 'equity' | 'futures' | 'crypto' | 'fx' | 'index' | 'etf';

type StatsColumnKey = 'symbol' | 'assetClass' | 'price' | 'changePct' | 'vsMid' | 'zone' | 'magnitude' | 'highZone' | 'lowZone' | 'lastQCloseZone';

const ALL_STATS_COLUMNS: { key: StatsColumnKey; label: string; shortLabel: string; sortKey: StatsSortKey; align: 'left' | 'right'; flex: number }[] = [
  { key: 'symbol', label: 'SYMBOL', shortLabel: 'SYM', sortKey: 'symbol', align: 'left', flex: 1.3 },
  { key: 'assetClass', label: 'CLASS', shortLabel: 'CLS', sortKey: 'assetClass', align: 'left', flex: 0.7 },
  { key: 'lastQCloseZone', label: 'LAST Q', shortLabel: 'LQ', sortKey: 'lastQCloseZone', align: 'left', flex: 1.1 },
  { key: 'highZone', label: 'HIGH ZONE', shortLabel: 'HI', sortKey: 'highZone', align: 'left', flex: 1.1 },
  { key: 'lowZone', label: 'LOW ZONE', shortLabel: 'LO', sortKey: 'lowZone', align: 'left', flex: 1.1 },
  { key: 'zone', label: 'CURRENT', shortLabel: 'CUR', sortKey: 'zone', align: 'left', flex: 1.1 },
  { key: 'price', label: 'PRICE', shortLabel: 'PRC', sortKey: 'price', align: 'right', flex: 1 },
  { key: 'changePct', label: 'CHG %', shortLabel: 'CHG%', sortKey: 'changePct', align: 'right', flex: 0.8 },
  { key: 'magnitude', label: 'MAGNITUDE', shortLabel: 'MAG', sortKey: 'magnitude', align: 'right', flex: 1.1 },
];

const DEFAULT_VISIBLE_COLUMNS: StatsColumnKey[] = ['symbol', 'zone', 'changePct', 'magnitude'];

const STATS_CLASS_BADGE_COLORS: Record<AssetClass, { bg: string; text: string }> = {
  equity: { bg: 'rgba(41, 98, 255, 0.08)', text: '#2962ff' },
  futures: { bg: 'rgba(217, 119, 6, 0.08)', text: '#d97706' },
  crypto: { bg: 'rgba(156, 39, 176, 0.08)', text: '#9C27B0' },
  fx: { bg: 'rgba(22, 163, 74, 0.08)', text: '#16a34a' },
  index: { bg: 'rgba(107, 114, 128, 0.08)', text: '#6b7280' },
  etf: { bg: 'rgba(13, 148, 136, 0.08)', text: '#0d9488' },
};

const STATS_CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'EQ', futures: 'FUT', crypto: 'CRY', fx: 'FX', index: 'IDX', etf: 'ETF',
};

function StatsPanel({
  theme,
  onSymbolSelect,
  mobile = false,
  onClose,
}: {
  theme: ChartTheme;
  onSymbolSelect?: (symbol: string) => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [movers, setMovers] = useState<MoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<ModelType>('pro');
  const [dirFilter, setDirFilter] = useState<DirFilter>('all');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [sortKey, setSortKey] = useState<StatsSortKey>('magnitude');
  const [sortAsc, setSortAsc] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // -- Resizable width --
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load persisted width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pricevault-stats-width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 180) {
          setPanelWidth(parsed);
          return;
        }
      }
    } catch {}
    // Default to 33vw in px
    setPanelWidth(Math.round(window.innerWidth * 0.25));
  }, []);

  // Persist width changes
  useEffect(() => {
    if (panelWidth !== null) {
      try { localStorage.setItem('pricevault-stats-width', String(panelWidth)); } catch {}
    }
  }, [panelWidth]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelRef.current?.offsetWidth ?? panelWidth ?? 300;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const maxW = window.innerWidth * 0.5;
      // Panel is on the right, so dragging left increases width
      const delta = dragStartX.current - e.clientX;
      const newW = Math.max(180, Math.min(maxW, dragStartWidth.current + delta));
      setPanelWidth(Math.round(newW));
    };
    const handlePointerUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // -- Column visibility --
  const [visibleColumns, setVisibleColumns] = useState<StatsColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pricevault-stats-columns');
      if (saved) {
        const parsed = JSON.parse(saved) as StatsColumnKey[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate keys
          const valid = parsed.filter(k => ALL_STATS_COLUMNS.some(c => c.key === k));
          if (valid.length > 0) {
            setVisibleColumns(valid);
            return;
          }
        }
      }
    } catch {}
  }, []);

  const toggleColumn = useCallback((key: StatsColumnKey) => {
    setVisibleColumns(prev => {
      // Symbol is always visible
      if (key === 'symbol') return prev;
      let next: StatsColumnKey[];
      if (prev.includes(key)) {
        next = prev.filter(k => k !== key);
        // Must have at least symbol
        if (next.length === 0) next = ['symbol'];
      } else {
        // Insert in the canonical order
        next = ALL_STATS_COLUMNS.map(c => c.key).filter(k => prev.includes(k) || k === key);
      }
      try { localStorage.setItem('pricevault-stats-columns', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Close column picker when clicking outside
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (showColumnPicker && columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showColumnPicker]);

  const activeColumns = useMemo(() => {
    return ALL_STATS_COLUMNS.filter(c => visibleColumns.includes(c.key));
  }, [visibleColumns]);

  // -- Data fetching --
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/movers?source=live&model=${model}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMovers(data.movers || []);
    } catch {
      setMovers([]);
    } finally {
      setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleSort = (key: StatsSortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key === 'symbol' || key === 'assetClass'); }
  };

  const maxMagnitude = useMemo(() => Math.max(...movers.map(m => m.magnitude), 1), [movers]);

  const filtered = useMemo(() => movers
    .filter(m => {
      if (dirFilter === 'above') return m.direction === 'above';
      if (dirFilter === 'below') return m.direction === 'below';
      if (dirFilter === 'extremes') return m.zone.includes('BEYOND');
      return true;
    })
    .filter(m => classFilter === 'all' || m.assetClass === classFilter)
    .filter(m => !symbolSearch || m.symbol.toUpperCase().includes(symbolSearch.toUpperCase()))
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'magnitude': cmp = a.magnitude - b.magnitude; break;
        case 'changePct': cmp = a.changePct - b.changePct; break;
        case 'vsMid': cmp = a.vsMid - b.vsMid; break;
        case 'price': cmp = a.price - b.price; break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'assetClass': cmp = a.assetClass.localeCompare(b.assetClass); break;
        case 'zone': cmp = a.zone.localeCompare(b.zone); break;
        case 'highZone': cmp = (a.highZone || '').localeCompare(b.highZone || ''); break;
        case 'lowZone': cmp = (a.lowZone || '').localeCompare(b.lowZone || ''); break;
        case 'lastQCloseZone': cmp = (a.lastQCloseZone || '').localeCompare(b.lastQCloseZone || ''); break;
      }
      return sortAsc ? cmp : -cmp;
    })
    .slice(0, 150), [movers, dirFilter, classFilter, symbolSearch, sortKey, sortAsc]);

  const dirFilters: { key: DirFilter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'above', label: '\u25B2' },
    { key: 'below', label: '\u25BC' },
    { key: 'extremes', label: '!' },
  ];

  const classFilters: { key: ClassFilter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'equity', label: 'EQ' },
    { key: 'futures', label: 'FUT' },
    { key: 'crypto', label: 'CRY' },
    { key: 'fx', label: 'FX' },
    { key: 'index', label: 'IDX' },
    { key: 'etf', label: 'ETF' },
  ];

  const pill = (active: boolean) => ({
    fontSize: 8,
    fontWeight: 600 as const,
    fontFamily: MONO,
    padding: '2px 5px',
    border: 'none' as const,
    background: active ? theme.text : 'transparent',
    color: active ? theme.bg : theme.textDim,
    cursor: 'pointer' as const,
    borderRadius: 2,
    letterSpacing: '0.04em',
  });

  // -- Helpers --
  const formatPrice = (p: number) => {
    if (p >= 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  };

  const isExtreme = (m: MoverRow) => m.zone.includes('BEYOND');

  // -- Render cell --
  const renderCell = (col: typeof ALL_STATS_COLUMNS[number], m: MoverRow) => {
    const base: React.CSSProperties = {
      padding: '0 3px',
      fontVariantNumeric: 'tabular-nums',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };
    const zoneColor = (z?: string) => {
      if (!z) return theme.textDim;
      if (z.includes('BEYOND')) return '#d97706';
      if (z.includes('UP')) return '#2962ff';
      if (z.includes('DN')) return '#9C27B0';
      return theme.textDim;
    };

    switch (col.key) {
      case 'symbol':
        return (
          <span style={{ ...base, flex: col.flex, fontWeight: 700, fontSize: 11, color: isExtreme(m) ? '#d97706' : theme.text }}>
            {m.symbol}
          </span>
        );
      case 'assetClass': {
        const badge = STATS_CLASS_BADGE_COLORS[m.assetClass];
        return (
          <span style={{ flex: col.flex, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', padding: '1px 4px', borderRadius: 2, background: badge.bg, color: badge.text }}>
              {STATS_CLASS_LABELS[m.assetClass]}
            </span>
          </span>
        );
      }
      case 'lastQCloseZone':
        return (
          <span style={{ ...base, flex: col.flex, fontSize: 9, fontWeight: 500, letterSpacing: '0.03em', color: zoneColor(m.lastQCloseZone) }}>
            {m.lastQCloseZone || '—'}
          </span>
        );
      case 'highZone':
        return (
          <span style={{ ...base, flex: col.flex, fontSize: 9, fontWeight: 500, letterSpacing: '0.03em', color: zoneColor(m.highZone) }}>
            {m.highZone || '—'}
          </span>
        );
      case 'lowZone':
        return (
          <span style={{ ...base, flex: col.flex, fontSize: 9, fontWeight: 500, letterSpacing: '0.03em', color: zoneColor(m.lowZone) }}>
            {m.lowZone || '—'}
          </span>
        );
      case 'zone':
        return (
          <span style={{ ...base, flex: col.flex, fontSize: 9, fontWeight: isExtreme(m) ? 700 : 500, letterSpacing: '0.03em', color: zoneColor(m.zone) }}>
            {m.zone || '—'}
          </span>
        );
      case 'price':
        return (
          <span style={{ ...base, flex: col.flex, textAlign: 'right', color: theme.textSecondary, fontSize: 10 }}>
            {formatPrice(m.price)}
          </span>
        );
      case 'changePct':
        return (
          <span style={{ ...base, flex: col.flex, textAlign: 'right', fontWeight: 600, fontSize: 10, color: m.changePct >= 0 ? theme.positive : theme.negative }}>
            {m.changePct >= 0 ? '+' : ''}{m.changePct.toFixed(1)}
          </span>
        );
      case 'vsMid':
        return (
          <span style={{ ...base, flex: col.flex, textAlign: 'right', fontWeight: 600, fontSize: 10, color: m.direction === 'above' ? '#2962ff' : '#9C27B0' }}>
            {m.vsMid >= 0 ? '+' : ''}{m.vsMid.toFixed(1)}
          </span>
        );
      case 'magnitude': {
        const barW = (m.magnitude / maxMagnitude) * 100;
        const barColor = isExtreme(m) ? '#d97706'
          : m.direction === 'above' ? '#2962ff' : '#9C27B0';
        return (
          <span style={{ flex: col.flex, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            <span style={{ flex: '1 1 0', maxWidth: 28, height: 3, background: theme.borderLight, borderRadius: 1.5, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${barW}%`, background: barColor, borderRadius: 1.5 }} />
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: isExtreme(m) ? '#d97706' : theme.textDim, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>
              {m.magnitude.toFixed(1)}
            </span>
          </span>
        );
      }
    }
  };

  const effectiveWidth = panelWidth ?? Math.round(typeof window !== 'undefined' ? window.innerWidth * 0.25 : 400);

  return (
    <div
      ref={panelRef}
      className={`h-full flex ${mobile ? 'w-full' : 'shrink-0'}`}
      style={{
        width: mobile ? '100%' : effectiveWidth,
        minWidth: mobile ? 0 : 180,
        maxWidth: mobile ? '100%' : '50vw',
        position: 'relative',
      }}
    >
      {!mobile && (
        <div
          onPointerDown={handleDragStart}
          style={{
            width: 4,
            cursor: 'col-resize',
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
            flexShrink: 0,
            touchAction: 'none',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = theme.accent + '33'; }}
          onMouseLeave={(e) => { if (!isDragging.current) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ position: 'absolute', top: '50%', left: 0, width: 4, height: 32, marginTop: -16, borderRadius: 2, background: theme.textDim + '44' }} />
        </div>
      )}

      {/* Panel content */}
      <div
        className="h-full flex flex-col flex-1 min-w-0"
        style={{
          borderLeft: `1px solid ${theme.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.4)' : theme.bg,
          fontFamily: MONO,
          overflow: 'hidden',
          borderRadius: 8,
        }}
      >
        {/* Header: title + direction filters + column picker */}
        <div className="shrink-0" style={{ borderBottom: `1px solid ${theme.border}`, background: theme.frosted ? 'rgba(255,255,255,0.3)' : theme.surface }}>
          <div className="flex items-center justify-between px-2" style={{ height: 22 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: theme.text }}>STATS</span>
            <div className="flex items-center" style={{ gap: 2 }}>
              {mobile && onClose && (
                <button
                  onClick={onClose}
                  style={{
                    fontSize: 10,
                    fontFamily: MONO,
                    width: 24,
                    height: 24,
                    border: 'none',
                    background: 'transparent',
                    color: theme.textDim,
                    cursor: 'pointer',
                    borderRadius: 4,
                  }}
                  title="Close stats"
                >
                  &#10005;
                </button>
              )}
              <div className="flex">{dirFilters.map(f => <button key={f.key} onClick={() => setDirFilter(f.key)} style={pill(dirFilter === f.key)}>{f.label}</button>)}</div>
              {/* Column picker button */}
              <div ref={columnPickerRef} style={{ position: 'relative', marginLeft: 3 }}>
                <button
                  onClick={() => setShowColumnPicker(s => !s)}
                  style={{
                    fontSize: 8,
                    fontFamily: MONO,
                    padding: '2px 4px',
                    border: 'none',
                    background: showColumnPicker ? theme.activeNavBg : 'transparent',
                    color: showColumnPicker ? theme.text : theme.textDim,
                    cursor: 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Select columns"
                >
                  <svg width={10} height={10} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                    <path d="M2 4h12M2 8h12M2 12h12" />
                    <circle cx="5" cy="4" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="11" cy="8" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="7" cy="12" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                {showColumnPicker && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 2,
                    zIndex: 100,
                    background: theme.frosted ? 'rgba(255,255,255,0.92)' : theme.bg,
                    backdropFilter: theme.frosted ? 'blur(20px)' : undefined,
                    WebkitBackdropFilter: theme.frosted ? 'blur(20px)' : undefined,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 4,
                    padding: '4px 0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    minWidth: 120,
                  }}>
                    {ALL_STATS_COLUMNS.map(col => {
                      const checked = visibleColumns.includes(col.key);
                      const isSymbol = col.key === 'symbol';
                      return (
                        <button
                          key={col.key}
                          onClick={() => toggleColumn(col.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            width: '100%',
                            padding: '3px 8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: isSymbol ? 'default' : 'pointer',
                            fontFamily: MONO,
                            fontSize: 9,
                            fontWeight: 500,
                            color: checked ? theme.text : theme.textDim,
                            opacity: isSymbol ? 0.5 : 1,
                            letterSpacing: '0.04em',
                          }}
                        >
                          <span style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            border: `1.5px solid ${checked ? theme.accent : theme.borderLight}`,
                            background: checked ? theme.accent + '18' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 8,
                            flexShrink: 0,
                          }}>
                            {checked && <span style={{ color: theme.accent, fontWeight: 700, lineHeight: 1 }}>&#10003;</span>}
                          </span>
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center px-2" style={{ height: 20, gap: 1 }}>
            {classFilters.map(f => <button key={f.key} onClick={() => setClassFilter(f.key)} style={pill(classFilter === f.key)}>{f.label}</button>)}
          </div>
          <div className="flex items-center px-2" style={{ height: 20, gap: 2 }}>
            <span style={{ fontSize: 8, color: theme.textDim, letterSpacing: '0.06em' }}>MODEL</span>
            {(['pro', 'simple', 'beta'] as ModelType[]).map(m => (
              <button key={m} onClick={() => setModel(m)} style={pill(model === m)}>{m.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ padding: '3px 6px', borderTop: `1px solid ${theme.border}` }}>
            <div className="flex items-center" style={{ background: theme.frosted ? 'rgba(0,0,0,0.06)' : theme.bg, border: `1px solid ${theme.border}`, borderRadius: 3, padding: '0 4px', height: 18 }}>
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, marginRight: 3, opacity: 0.4 }}>
                <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="6.5" y1="6.5" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Symbol…"
                value={symbolSearch}
                onChange={e => setSymbolSearch(e.target.value)}
                style={{
                  flex: 1,
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: theme.text,
                  caretColor: theme.accent,
                }}
              />
              {symbolSearch && (
                <button
                  onClick={() => setSymbolSearch('')}
                  style={{ fontFamily: MONO, fontSize: 9, color: theme.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                >✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Sort headers */}
        <div className="flex items-center shrink-0" style={{ height: 18, borderBottom: `1px solid ${theme.border}`, background: theme.frosted ? 'rgba(255,255,255,0.2)' : theme.surface }}>
          {activeColumns.map(h => (
            <button
              key={h.key}
              onClick={() => handleSort(h.sortKey)}
              style={{
                flex: h.flex,
                fontSize: 8,
                fontWeight: 600,
                fontFamily: MONO,
                letterSpacing: '0.06em',
                color: sortKey === h.sortKey ? theme.text : theme.textDim,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: h.align,
                padding: '0 3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {h.shortLabel}{sortKey === h.sortKey ? (sortAsc ? '\u2191' : '\u2193') : ''}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {loading ? (
            <div style={{ padding: 12, fontSize: 9, color: theme.textDim, textAlign: 'center' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 12, fontSize: 9, color: theme.textDim, textAlign: 'center' }}>No results</div>
          ) : (
            filtered.map((m, i) => (
              <div
                key={m.symbol}
                onClick={() => onSymbolSelect ? onSymbolSelect(m.symbol) : router.push(`/terminal?symbol=${encodeURIComponent(m.symbol)}`)}
                className="flex items-center cursor-pointer"
                style={{
                  padding: '3px 3px',
                  fontSize: 9,
                  borderBottom: `1px solid ${theme.frosted ? 'rgba(0,0,0,0.03)' : theme.borderLight}`,
                  background: i % 2 === 0 ? 'transparent' : (theme.frosted ? 'rgba(0,0,0,0.015)' : theme.surface),
                  transition: 'background 0.08s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = theme.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (theme.frosted ? 'rgba(0,0,0,0.015)' : theme.surface); }}
              >
                {activeColumns.map(col => (
                  <span key={col.key} style={{ display: 'contents' }}>
                    {renderCell(col, m)}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-center" style={{ height: 20, borderTop: `1px solid ${theme.border}`, background: theme.frosted ? 'rgba(255,255,255,0.3)' : theme.surface, fontSize: 8, color: theme.textDim, letterSpacing: '0.06em' }}>
          {filtered.length}/{movers.length} &middot; CLICK ROW TO CHART
        </div>
      </div>
    </div>
  );
}

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
  const [layout, setLayoutState] = useState<LayoutMode>('1x1');
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const setActivePanelSymbolRef = useRef<((symbol: string) => void) | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pricevault-layout');
      if (saved && ['1x1', '1x2', '2x1', '2x2'].includes(saved)) setLayoutState(saved as LayoutMode);
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 900px)');
    const sync = () => setIsMobile(media.matches);
    sync();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  const setLayout = (l: LayoutMode) => {
    setLayoutState(l);
    try { localStorage.setItem('pricevault-layout', l); } catch {}
  };
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
  const effectiveLayout = isMobile ? '1x1' : layout;

  return (
    <div className="h-full w-full flex flex-col">
      {/* Layout toolbar */}
      <div
        className="flex items-center px-3 shrink-0"
        style={{
          height: isMobile ? 40 : 28,
          borderBottom: `1px solid ${theme.border}`,
          background: theme.surface,
          justifyContent: isMobile ? 'space-between' : 'center',
        }}
      >
        <div className="flex items-center gap-2">
          {!isMobile && (
            <>
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
              <div style={{ width: 1, height: 14, background: theme.border }} />
            </>
          )}
          {isMobile && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: theme.textDim,
              }}
            >
              MOBILE MODE
            </span>
          )}
        </div>
      </div>

      {/* Panel area + optional stats sidebar */}
      <div className="flex-1 min-h-0 relative">
        <div className={`h-full min-h-0 ${isMobile ? 'block' : 'flex'}`}>
          <div className="flex-1 min-w-0 h-full">
            <PanelGrid
              layout={effectiveLayout}
              symbols={symbols}
              source="live"
              initialSymbol={initialSymbol}
              setActivePanelSymbol={setActivePanelSymbolRef}
            />
          </div>
        </div>
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

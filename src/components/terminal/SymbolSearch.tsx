'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import type { SymbolEntry } from './types';

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

export interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
  symbols: SymbolEntry[];
}

export default function SymbolSearch({ value, onChange, symbols }: SymbolSearchProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.toLowerCase();
  const filtered = query
    ? symbols
        .filter(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            s.label.toLowerCase().includes(q) ||
            (s.class && s.class.toLowerCase().includes(q))
        )
        .sort((a, b) => {
          const aId = a.id.toLowerCase();
          const bId = b.id.toLowerCase();
          const aLabel = a.label.toLowerCase();
          const bLabel = b.label.toLowerCase();
          const rank = (id: string, label: string) => {
            if (id === q) return 0;
            if (id.startsWith(q)) return 1;
            if (label.startsWith(q)) return 2;
            if (id.includes(q)) return 3;
            if (label.includes(q)) return 4;
            return 5;
          };
          const ra = rank(aId, aLabel);
          const rb = rank(bId, bLabel);
          if (ra !== rb) return ra - rb;
          return aId.localeCompare(bId);
        })
        .slice(0, 10)
    : symbols.slice(0, 10);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setQuery('');
      setOpen(false);
      setSelectedIdx(0);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (open && filtered.length > 0 && selectedIdx < filtered.length) {
          handleSelect(filtered[selectedIdx].id);
        } else if (query.trim()) {
          handleSelect(query.trim().toUpperCase());
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    },
    [open, filtered, selectedIdx, query, handleSelect]
  );

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx, open]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: 50 }}>
      <input
        ref={inputRef}
        type="text"
        value={open ? query : value}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Symbol..."
        className="outline-none"
        style={{
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.03em',
          width: 88,
          height: 26,
          padding: '0 12px',
          background: theme.activeNavBg,
          border: 'none',
          borderRadius: 8,
          color: theme.text,
          position: 'relative',
          zIndex: 51,
          cursor: 'pointer',
        }}
        spellCheck={false}
        autoComplete="off"
      />
      {open && (
        <div
          ref={listRef}
          className="hide-scrollbar"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 2,
            width: 180,
            maxHeight: 240,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            background: `${theme.bg}ee`,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: 11, color: theme.textDim, fontFamily: MONO }}>
              No results
            </div>
          ) : (
            filtered.map((s, i) => (
              <button
                key={s.id}
                onPointerDown={(e) => { e.preventDefault(); handleSelect(s.id); }}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  fontSize: 11,
                  fontFamily: MONO,
                  background: i === selectedIdx ? theme.activeNavBg : 'transparent',
                  color: i === selectedIdx ? theme.text : theme.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                {s.id}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import type { SymbolEntry } from './types';

// ============================================================================
// SYMBOL SEARCH (white theme)
// ============================================================================

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

const CLASS_COLORS: Record<string, string> = {
  equity: '#6366f1',
  crypto: '#f59e0b',
  futures: '#10b981',
  fx: '#3b82f6',
  index: '#8b5cf6',
  etf: '#ec4899',
};

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

  // Filter and rank symbols based on query
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

  // Scroll selected item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx, open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={open ? query : value}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Symbol..."
        className="w-[140px] h-[28px] px-2 text-[12px] outline-none"
        style={{
          fontFamily: MONO,
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          color: theme.text,
        }}
        spellCheck={false}
        autoComplete="off"
      />
      {open && (
        <div
          ref={listRef}
          className="absolute top-full left-0 mt-0.5 w-[160px] max-h-[240px] overflow-y-auto z-50 shadow-sm"
          style={{ background: theme.bg, border: `1px solid ${theme.border}` }}
        >
          {filtered.length === 0 ? (
            <div
              className="px-2 py-2 text-[11px]"
              style={{ fontFamily: MONO, color: theme.textDim }}
            >
              No results
            </div>
          ) : (
            filtered.map((s, i) => (
              <button
                key={s.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s.id);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                className="w-full text-left px-2 py-1.5 text-[11px] transition-colors"
                style={{
                  fontFamily: MONO,
                  background: i === selectedIdx ? theme.activeNavBg : 'transparent',
                  color: i === selectedIdx ? theme.text : theme.textSecondary,
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

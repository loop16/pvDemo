'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { SymbolEntry } from './types';

// ============================================================================
// SYMBOL SEARCH
// ============================================================================

export interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
  symbols: SymbolEntry[];
}

export default function SymbolSearch({ value, onChange, symbols }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? symbols
        .filter(
          (s) =>
            s.id.toLowerCase().includes(query.toLowerCase()) ||
            s.label.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 30)
    : symbols.slice(0, 30);

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

  // Keep selected item scrolled into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx, open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Close on outside click
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
        className="w-[100px] h-[26px] px-2 text-[11px] bg-[#111] border border-[#2a2a2a] text-[#ccc] outline-none focus:border-[#444] placeholder:text-[#555]"
        style={{ fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
        spellCheck={false}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 mt-0.5 w-[200px] max-h-[280px] overflow-y-auto bg-[#111] border border-[#2a2a2a] z-50 shadow-xl"
        >
          {filtered.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s.id);
              }}
              onMouseEnter={() => setSelectedIdx(i)}
              className={`w-full text-left px-2 py-1 text-[11px] text-[#aaa] transition-colors block ${
                i === selectedIdx ? 'bg-[#1a1a2e] text-white' : 'hover:bg-[#1a1a2e] hover:text-white'
              }`}
              style={{ fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
            >
              <span className="text-[#ddd]">{s.id}</span>
              {s.label !== s.id && (
                <span className="ml-2 text-[#555]">{s.label}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

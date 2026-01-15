"use client";

import { useState, useRef, useEffect } from 'react';

type SymbolEntry = { id: string; label: string };

export function Toolbar({ onLoad, symbolsSource = "live", symbolsOverride }: { 
  onLoad: (symbol: string)=>void;
  symbolsSource?: "demo" | "live";
  symbolsOverride?: SymbolEntry[];
}) {
  const [query, setQuery] = useState('SPX');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [symbols, setSymbols] = useState<SymbolEntry[]>(symbolsOverride ?? []);

  useEffect(() => {
    if (symbolsOverride && symbolsOverride.length) return;
    fetch(`/api/symbols?source=${symbolsSource}`)
      .then((res) => res.json())
      .then((data: SymbolEntry[]) => setSymbols(Array.isArray(data) ? data : []))
      .catch(() => setSymbols([]));
  }, [symbolsOverride, symbolsSource]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSymbols = symbols
    .filter(symbol => {
      if (!normalizedQuery) return true;
      return (
        symbol.id.toLowerCase().includes(normalizedQuery) ||
        symbol.label.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      if (!normalizedQuery) return 0;
      const aId = a.id.toLowerCase();
      const bId = b.id.toLowerCase();
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      const rank = (id: string, label: string) => {
        if (id.startsWith(normalizedQuery)) return 0;
        if (label.startsWith(normalizedQuery)) return 1;
        if (id.includes(normalizedQuery)) return 2;
        if (label.includes(normalizedQuery)) return 3;
        return 4;
      };
      const ra = rank(aId, aLabel);
      const rb = rank(bId, bLabel);
      if (ra !== rb) return ra - rb;
      return aId.localeCompare(bId);
    });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length > 0);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        onLoad(query.trim());
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSymbols.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSymbols.length) {
          const selected = filteredSymbols[selectedIndex];
          setQuery(selected.id);
          setShowSuggestions(false);
          onLoad(selected.id);
        } else {
          onLoad(query.trim());
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSuggestionClick = (symbol: SymbolEntry) => {
    setQuery(symbol.id);
    setShowSuggestions(false);
    onLoad(symbol.id);
  };

  const handleLoadClick = () => {
    onLoad(query.trim());
    setShowSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="toolbar">
      <div className="relative">
        <input
          ref={inputRef}
          id="symbol"
          placeholder="Search symbol (e.g., ES, NQ, BTCUSD)"
          className="symbol-input"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(query.length > 0)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="symbol-search"
          inputMode="search"
          aria-autocomplete="none"
        />
        
        {showSuggestions && filteredSymbols.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-none shadow-lg z-50 max-h-48 overflow-y-auto symbol-menu"
          >
            {filteredSymbols.map((symbol, index) => (
              <div
                key={symbol.id}
                className={`px-3 py-2 cursor-pointer text-sm ${
                  index === selectedIndex 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSuggestionClick(symbol)}
              >
                <div className="font-medium">{symbol.id}</div>
                <div className="text-gray-500 text-xs">{symbol.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <button className="btn-primary" onClick={handleLoadClick}>
        Load
      </button>

      <div className="feed-pill">Daily • EOD/Delayed • 2Y</div>
    </div>
  );
}

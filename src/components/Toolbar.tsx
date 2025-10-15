"use client";

import { useState, useRef, useEffect } from 'react';

const AVAILABLE_SYMBOLS = [
  { id: "NQ", label: "Nasdaq 100 E-mini (NQ)" },
  { id: "BTCUSD", label: "Bitcoin (BTC/USD)" },
  { id: "CL", label: "Crude Oil (CL)" },
  { id: "GC", label: "Gold (GC)" },
  { id: "SPX", label: "S&P 500 Index (SPX)" }
];

export function Toolbar({ onLoad }: { onLoad: (symbol: string)=>void }) {
  const [query, setQuery] = useState('SPX');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filteredSymbols = AVAILABLE_SYMBOLS.filter(symbol =>
    symbol.id.toLowerCase().includes(query.toLowerCase()) ||
    symbol.label.toLowerCase().includes(query.toLowerCase())
  );

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

  const handleSuggestionClick = (symbol: typeof AVAILABLE_SYMBOLS[0]) => {
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

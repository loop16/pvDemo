"use client";
import React, { useState, useRef, useEffect } from 'react';

type OutcomeKey = 'AUTO' | 'LONG_TRUE' | 'LONG_FALSE' | 'SHORT_TRUE' | 'SHORT_FALSE' | 'NONE';

export function SidePanel({ quarterLevels, metrics, selectedModel, onModelChange, selectedOutcome, onOutcomeChange, onOverlaySelect, overlaySymbol, showOverlay, showOutcome }: { 
  quarterLevels: null | { upper20:number; upper50:number; upper80:number; lower20:number; lower50:number; lower80:number }, 
  metrics?: { price:number|null; changePct:number|null },
  selectedModel?: 'simple' | 'pro' | 'overlay',
  onModelChange?: (model: 'simple' | 'pro' | 'overlay') => void,
  selectedOutcome?: OutcomeKey,
  onOutcomeChange?: (outcome: OutcomeKey) => void,
  onOverlaySelect?: (symbol: string) => void,
  overlaySymbol?: string | null,
  showOverlay?: boolean,
  showOutcome?: boolean,
}) {
  // Use props if provided, otherwise fall back to local state
  const currentModel = selectedModel ?? 'simple';
  const allowOverlay = showOverlay ?? true;
  const allowOutcome = showOutcome ?? true;
  const currentOutcome = selectedOutcome ?? 'AUTO';
  
  // Custom dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  
  // Overlay state
  const [showOverlaySearch, setShowOverlaySearch] = useState(false);
  const [overlayQuery, setOverlayQuery] = useState('');
  const [overlaySymbols, setOverlaySymbols] = useState<{ id: string; label: string }[]>([]);
  const [selectedOverlayIndex, setSelectedOverlayIndex] = useState(-1);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const outcomeOptions = [
    { value: 'AUTO', label: 'Auto', description: 'Auto-detect outcome' },
    { value: 'LONG_TRUE', label: 'Strong Long', description: 'Confirmed upward breakout' },
    { value: 'LONG_FALSE', label: 'Weak Long', description: 'Failed upward breakout' },
    { value: 'SHORT_TRUE', label: 'Strong Short', description: 'Confirmed downward breakout' },
    { value: 'SHORT_FALSE', label: 'Weak Short', description: 'Failed downward breakout' }
  ] as const;

  const currentOption: (typeof outcomeOptions)[number] = outcomeOptions.find(opt => opt.value === currentOutcome) || outcomeOptions[0];

  // Available symbols for overlay (only site-supported assets)
  const availableSymbols = [
    { id: "NQ", label: "Nasdaq 100 E-mini (NQ)" },
    { id: "BTCUSD", label: "Bitcoin (BTC/USD)" },
    { id: "CL", label: "Crude Oil (CL)" },
    { id: "GC", label: "Gold (GC)" },
    { id: "SPX", label: "S&P 500 Index (SPX)" }
  ];

  const handleOptionClick = (option: (typeof outcomeOptions)[number]) => {
    onOutcomeChange?.(option.value as OutcomeKey);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  // Overlay search functionality
  const filteredOverlaySymbols = availableSymbols.filter(symbol =>
    symbol.id.toLowerCase().includes(overlayQuery.toLowerCase()) ||
    symbol.label.toLowerCase().includes(overlayQuery.toLowerCase())
  );

  const handleOverlayInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOverlayQuery(value);
    setIsEditingOverlay(true);
    setOverlaySymbols(filteredOverlaySymbols);
    setSelectedOverlayIndex(-1);
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (!showOverlaySearch) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedOverlayIndex(prev => 
          prev < filteredOverlaySymbols.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedOverlayIndex(prev => prev > 0 ? prev - 1 : filteredOverlaySymbols.length - 1);
        break;
      case 'Enter': {
        e.preventDefault();
        const trimmed = overlayQuery.trim();
        let selected = (selectedOverlayIndex >= 0 && selectedOverlayIndex < filteredOverlaySymbols.length)
          ? filteredOverlaySymbols[selectedOverlayIndex]
          : undefined;

        if (!selected && trimmed.length > 0) {
          selected = filteredOverlaySymbols.find(symbol => symbol.id.toLowerCase() === trimmed.toLowerCase())
            ?? filteredOverlaySymbols[0];
        }

        if (selected) {
          onOverlaySelect?.(selected.id);
          setShowOverlaySearch(false);
          setOverlayQuery('');
          setSelectedOverlayIndex(-1);
          setIsEditingOverlay(false);
        }
        break;
      }
      case 'Escape':
        setShowOverlaySearch(false);
        setOverlayQuery('');
        setSelectedOverlayIndex(-1);
        setIsEditingOverlay(false);
        break;
    }
  };

  const handleOverlaySymbolClick = (symbol: typeof availableSymbols[0]) => {
    onOverlaySelect?.(symbol.id);
    setShowOverlaySearch(false);
    setOverlayQuery('');
    setSelectedOverlayIndex(-1);
    setIsEditingOverlay(false);
  };

  const handleOverlayButtonClick = () => {
    if (currentModel === 'overlay') {
      // If already in overlay mode, toggle search visibility
      setShowOverlaySearch(!showOverlaySearch);
      setOverlayQuery('');
      setOverlaySymbols(filteredOverlaySymbols);
      setSelectedOverlayIndex(-1);
      setIsEditingOverlay(false);
      if (!showOverlaySearch && overlayInputRef.current) {
        setTimeout(() => overlayInputRef.current?.focus(), 0);
      }
    } else {
      // Switch to overlay mode
      onModelChange?.('overlay');
      setShowOverlaySearch(true);
      setOverlayQuery('');
      setOverlaySymbols(filteredOverlaySymbols);
      setSelectedOverlayIndex(-1);
      setIsEditingOverlay(false);
      setTimeout(() => overlayInputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setShowDropdown(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < outcomeOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : outcomeOptions.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < outcomeOptions.length) {
          handleOptionClick(outcomeOptions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node) &&
          overlayInputRef.current && !overlayInputRef.current.contains(event.target as Node)) {
        setShowOverlaySearch(false);
        setOverlayQuery('');
        setSelectedOverlayIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className="side-panel">
      <div className="card">
        <div className="card-title">Models</div>
        <div className="seg">
          <button 
            className={`seg-btn ${currentModel === 'simple' ? 'seg-btn--active' : ''}`}
            onClick={() => onModelChange?.('simple')}
          >
            Simple
          </button>
          <button 
            className={`seg-btn ${currentModel === 'pro' ? 'seg-btn--active' : ''}`}
            onClick={() => onModelChange?.('pro')}
          >
            Pro
          </button>
          {allowOverlay && (
            <button
              className={`seg-btn ${currentModel === 'overlay' ? 'seg-btn--active' : ''}`}
              onClick={handleOverlayButtonClick}
            >
              Overlay
            </button>
          )}
        </div>
        
        {allowOutcome && currentModel === 'pro' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-2">Outcome</label>
            <div className="relative">
              <div
                ref={inputRef}
                className="symbol-input cursor-pointer pr-8 flex items-center"
                onClick={() => setShowDropdown(!showDropdown)}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="combobox"
                aria-expanded={showDropdown}
                aria-haspopup="listbox"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 8px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <span className="font-medium">{currentOption.label}</span>
              </div>
              
              {showDropdown && (
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-none shadow-lg z-50 max-h-48 overflow-y-auto symbol-menu"
                >
                  {outcomeOptions.map((option, index) => (
                    <div
                      key={option.value}
                      className={`px-3 py-2 cursor-pointer text-sm ${
                        index === selectedIndex 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleOptionClick(option)}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-gray-500 text-xs">{option.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {allowOverlay && currentModel === 'overlay' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-2">Overlay Asset</label>
            <div className="relative">
              <input
                ref={overlayInputRef}
                type="text"
                placeholder="Search asset (e.g., NQ, BTCUSD, CL)"
                className="symbol-input"
                value={isEditingOverlay ? overlayQuery : (overlaySymbol ? `${overlaySymbol} - ${availableSymbols.find(s => s.id === overlaySymbol)?.label || overlaySymbol}` : '')}
                onChange={handleOverlayInputChange}
                onKeyDown={handleOverlayKeyDown}
                onFocus={() => {
                  // When user focuses on input, switch to editing mode
                  if (overlaySymbol && !isEditingOverlay) {
                    setIsEditingOverlay(true);
                    setOverlayQuery('');
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              
              {overlayQuery.length > 0 && filteredOverlaySymbols.length > 0 && (
                <div 
                  ref={overlayRef}
                  className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-none shadow-lg z-50 max-h-48 overflow-y-auto symbol-menu"
                >
                  {filteredOverlaySymbols.map((symbol, index) => (
                    <div
                      key={symbol.id}
                      className={`px-3 py-2 cursor-pointer text-sm ${
                        index === selectedOverlayIndex 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleOverlaySymbolClick(symbol)}
                    >
                      <div className="font-medium">{symbol.id}</div>
                      <div className="text-gray-500 text-xs">{symbol.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Statistics</div>
        <div className="stat"><span>Current Price</span><strong>{metrics?.price != null ? ('$' + metrics.price.toLocaleString()) : '-'}</strong></div>
        <div className="stat"><span>24h Change</span><strong className={metrics && (metrics.changePct ?? 0) >= 0 ? 'pos' : 'red'}>{metrics?.changePct != null ? ((metrics.changePct >= 0 ? '+' : '') + metrics.changePct.toFixed(2) + '%') : '-'}</strong></div>
      </div>

      {quarterLevels && (
        <>
          <div className="card">
            <div className="card-title">Quarter Levels</div>
            <div className="kv"><span>Upper 20 %</span><b className="blue">{'$' + quarterLevels.upper20.toLocaleString()}</b></div>
            <div className="kv"><span>Upper 50 %</span><b className="blue">{'$' + quarterLevels.upper50.toLocaleString()}</b></div>
            <div className="kv"><span>Upper 80 %</span><b className="blue">{'$' + quarterLevels.upper80.toLocaleString()}</b></div>
            <div className="kv"><span>Lower 20 %</span><b>{'$' + quarterLevels.lower20.toLocaleString()}</b></div>
            <div className="kv"><span>Lower 50 %</span><b>{'$' + quarterLevels.lower50.toLocaleString()}</b></div>
            <div className="kv"><span>Lower 80 %</span><b>{'$' + quarterLevels.lower80.toLocaleString()}</b></div>
          </div>

        </>
      )}
    </aside>
  );
}

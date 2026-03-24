'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Bar, LevelLine, LevelsResponse } from '@/components/terminal/types';

// ============================================================================
// Response cache + in-flight deduplication
// ============================================================================

type CacheEntry<T> = { data: T; ts: number };
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 60_000; // 1 minute

async function cachedFetch<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.data as T;
  }

  const existing = inflight.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache.set(url, { data, ts: Date.now() });
      inflight.delete(url);
      return data as T;
    })
    .catch((err) => {
      inflight.delete(url);
      throw err;
    });

  inflight.set(url, promise);
  return promise;
}

// ============================================================================
// Normalize API bar data to our internal Bar type
// ============================================================================

function normalizeTime(t: string | number): number {
  if (typeof t === 'number') {
    return t > 1e12 ? Math.floor(t / 1000) : t;
  }
  // Date string: parse to UTC seconds
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
}

type RawBar = {
  time: string | number;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  volume?: number;
};

function parseBars(raw: RawBar[]): Bar[] {
  if (!Array.isArray(raw)) return [];
  const bars: Bar[] = [];
  for (const r of raw) {
    const time = normalizeTime(r.time);
    const open = Number(r.open);
    const high = Number(r.high);
    const low = Number(r.low);
    const close = Number(r.close);
    if (!time || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
      continue;
    }
    bars.push({ time, open, high, low, close, volume: r.volume });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars;
}

// ============================================================================
// Hook
// ============================================================================

export type ChartData = {
  bars: Bar[];
  levels: LevelLine[];
  levelsAsof: string | null;
  loading: boolean;
  error: string | null;
};

export function useChartData(
  symbol: string,
  model: string = 'pro',
  source: string = 'live'
): ChartData {
  const [bars, setBars] = useState<Bar[]>([]);
  const [levels, setLevels] = useState<LevelLine[]>([]);
  const [levelsAsof, setLevelsAsof] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  const load = useCallback(async () => {
    if (!symbol) return;
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const sourceParam = source === 'demo' ? '&source=demo' : '';
      const [rawBars, levelsData] = await Promise.all([
        cachedFetch<RawBar[]>(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}${sourceParam}`),
        cachedFetch<LevelsResponse>(`/api/levels?symbol=${encodeURIComponent(symbol)}&model=${model}${sourceParam}`).catch(() => null),
      ]);

      if (token !== tokenRef.current) return; // stale request

      const parsed = parseBars(rawBars);
      if (!parsed.length) {
        setError(`No data for ${symbol}`);
        setBars([]);
        setLevels([]);
        setLevelsAsof(null);
      } else {
        setBars(parsed);
        setLevels(levelsData?.daily?.lines ?? []);
        setLevelsAsof(levelsData?.asof ?? null);
      }
    } catch (err: unknown) {
      if (token !== tokenRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setBars([]);
      setLevels([]);
      setLevelsAsof(null);
    } finally {
      if (token === tokenRef.current) {
        setLoading(false);
      }
    }
  }, [symbol, model, source]);

  useEffect(() => {
    load();
  }, [load]);

  return { bars, levels, levelsAsof, loading, error };
}

/** Invalidate cache for a specific symbol (useful for manual refresh) */
export function invalidateCache(symbol: string) {
  for (const key of cache.keys()) {
    if (key.includes(encodeURIComponent(symbol))) {
      cache.delete(key);
    }
  }
}

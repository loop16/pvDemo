"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/terminal/ThemeContext";
import type { ChartTheme } from "@/components/terminal/themes";
import dynamic from "next/dynamic";
import { useChartData } from "@/hooks/useChartData";

const NativeChart = dynamic(() => import("@/components/terminal/NativeChart"), { ssr: false });

/* -- Types --------------------------------------------------------- */

type AssetClass = "equity" | "futures" | "crypto" | "fx" | "index" | "etf";

type ModelType = "pro" | "simple" | "beta";

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
  direction: "above" | "below";
  assetClass: AssetClass;
};

type SortKey = "symbol" | "assetClass" | "price" | "changePct" | "vsMid" | "zone" | "magnitude" | "highZone" | "lowZone" | "lastQCloseZone";
type SortDir = "asc" | "desc";
type ClassTab = "ALL" | "EQUITIES" | "FUTURES" | "CRYPTO" | "FX" | "INDICES" | "ETFS";
type DirectionFilter = "ALL" | "ABOVE" | "BELOW" | "EXTREMES";

/* -- Theme-derived style constants --------------------------------- */

const FONT = "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace";

// Accent colors that don't change with theme (used for badge differentiation)
const AMBER = "#d97706";
const TEAL = "#0d9488";

/** Build the C color map from the current theme */
function buildC(theme: ChartTheme) {
  return {
    bg: theme.bg,
    surface: theme.surface,
    border: theme.border,
    borderLight: theme.borderLight,
    textPrimary: theme.text,
    textSecondary: theme.textSecondary,
    textDim: theme.textDim,
    green: theme.positive,
    red: theme.negative,
    blue: theme.levelBlue,
    purple: theme.levelPurple,
    amber: AMBER,
    teal: TEAL,
    font: FONT,
    hoverBg: theme.hoverBg,
    accent: theme.accent,
    activeNavBg: theme.activeNavBg,
  };
}

const REFRESH_INTERVAL_MS = 60_000;

/* -- Asset class config -------------------------------------------- */

const CLASS_TAB_TO_FILTER: Record<ClassTab, AssetClass | "all"> = {
  ALL: "all",
  EQUITIES: "equity",
  FUTURES: "futures",
  CRYPTO: "crypto",
  FX: "fx",
  INDICES: "index",
  ETFS: "etf",
};

const CLASS_BADGE_COLORS: Record<AssetClass, { bg: string; text: string }> = {
  equity: { bg: "rgba(41, 98, 255, 0.08)", text: "#2962ff" },
  futures: { bg: "rgba(217, 119, 6, 0.08)", text: "#d97706" },
  crypto: { bg: "rgba(156, 39, 176, 0.08)", text: "#9C27B0" },
  fx: { bg: "rgba(22, 163, 74, 0.08)", text: "#16a34a" },
  index: { bg: "rgba(107, 114, 128, 0.08)", text: "#6b7280" },
  etf: { bg: "rgba(13, 148, 136, 0.08)", text: "#0d9488" },
};

const CLASS_LABELS: Record<AssetClass, string> = {
  equity: "EQUITY",
  futures: "FUTURES",
  crypto: "CRYPTO",
  fx: "FX",
  index: "INDEX",
  etf: "ETF",
};

const CLASS_SECTION_ORDER: AssetClass[] = ["equity", "futures", "crypto", "fx", "index", "etf"];

const CLASS_SECTION_LABELS: Record<AssetClass, string> = {
  equity: "EQUITIES",
  futures: "FUTURES",
  crypto: "CRYPTO",
  fx: "FOREX",
  index: "INDICES",
  etf: "ETFs",
};

/* -- Helpers ------------------------------------------------------- */

function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 100) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function getChangeColor(pct: number, c: ReturnType<typeof buildC>): string {
  if (pct > 0) return c.green;
  if (pct < 0) return c.red;
  return c.textDim;
}

function getVsMidColor(row: MoverRow, c: ReturnType<typeof buildC>): string {
  if (row.magnitude < 1) return c.textDim;
  if (row.direction === "above") return c.blue;
  return c.purple;
}

function getZoneColor(row: MoverRow, c: ReturnType<typeof buildC>): string {
  if (row.zone.includes("BEYOND") || row.zone.includes("80-90%")) return c.amber;
  if (row.zone.includes("UP")) return c.blue;
  if (row.zone.includes("DN")) return c.purple;
  return c.textDim;
}

function isExtreme(row: MoverRow): boolean {
  return row.zone.includes("BEYOND") || row.zone.includes("80-90%");
}

/* -- Component ----------------------------------------------------- */

export default function MoversPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const C = buildC(theme);
  const [movers, setMovers] = useState<MoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [computeMs, setComputeMs] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelType>("pro");
  const [classTab, setClassTab] = useState<ClassTab>("ALL");
  const [dirFilter, setDirFilter] = useState<DirectionFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("magnitude");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [highZoneFilter, setHighZoneFilter] = useState<string>("ALL");
  const [lowZoneFilter, setLowZoneFilter] = useState<string>("ALL");
  const [closeZoneFilter, setCloseZoneFilter] = useState<string>("ALL");
  const [lastQZoneFilter, setLastQZoneFilter] = useState<string>("ALL");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* -- Fetch -- */
  const fetchMovers = useCallback(async (fetchModel?: ModelType) => {
    const m = fetchModel ?? model;
    const fetchStart = Date.now();
    setLoadingElapsed(0);
    // Show a ticking elapsed timer while loading
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    loadingTimerRef.current = setInterval(() => {
      setLoadingElapsed(Date.now() - fetchStart);
    }, 200);

    try {
      const res = await fetch(`/api/movers?source=live&model=${m}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMovers(data.movers || []);
      setComputeMs(data.computeMs ?? null);
      setIsCached(data.cached ?? false);
      setLastUpdate(new Date());
      setError(null);
      setCountdown(REFRESH_INTERVAL_MS / 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load movers";
      setError(message);
    } finally {
      setLoading(false);
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
  }, [model]);

  useEffect(() => {
    fetchMovers();
    intervalRef.current = setInterval(() => fetchMovers(), REFRESH_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, [fetchMovers]);

  /* -- Model change handler -- */
  const handleModelChange = useCallback((newModel: ModelType) => {
    if (newModel === model) return;
    setModel(newModel);
    setLoading(true);
    setCountdown(REFRESH_INTERVAL_MS / 1000);
    // The useEffect will re-trigger because model change updates fetchMovers
  }, [model]);

  /* -- Sort handler -- */
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "symbol" || key === "assetClass" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  /* -- Filter + sort -- */
  const rows = useMemo(() => {
    let filtered = [...movers];

    // Class filter
    const classValue = CLASS_TAB_TO_FILTER[classTab];
    if (classValue !== "all") {
      filtered = filtered.filter((m) => m.assetClass === classValue);
    }

    // Direction filter
    switch (dirFilter) {
      case "ABOVE":
        filtered = filtered.filter((m) => m.direction === "above");
        break;
      case "BELOW":
        filtered = filtered.filter((m) => m.direction === "below");
        break;
      case "EXTREMES":
        filtered = filtered.filter(isExtreme);
        break;
    }

    // Zone cross-filters
    if (highZoneFilter !== "ALL") {
      filtered = filtered.filter((m) => m.highZone === highZoneFilter);
    }
    if (lowZoneFilter !== "ALL") {
      filtered = filtered.filter((m) => m.lowZone === lowZoneFilter);
    }
    if (closeZoneFilter !== "ALL") {
      filtered = filtered.filter((m) => m.zone === closeZoneFilter);
    }
    if (lastQZoneFilter !== "ALL") {
      filtered = filtered.filter((m) => m.lastQCloseZone === lastQZoneFilter);
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "assetClass":
          cmp = a.assetClass.localeCompare(b.assetClass);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "changePct":
          cmp = a.changePct - b.changePct;
          break;
        case "vsMid":
          cmp = a.vsMid - b.vsMid;
          break;
        case "zone":
          cmp = a.zone.localeCompare(b.zone);
          break;
        case "magnitude":
          cmp = a.magnitude - b.magnitude;
          break;
        case "highZone":
          cmp = a.highZone.localeCompare(b.highZone);
          break;
        case "lowZone":
          cmp = a.lowZone.localeCompare(b.lowZone);
          break;
        case "lastQCloseZone":
          cmp = (a.lastQCloseZone || "").localeCompare(b.lastQCloseZone || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [movers, classTab, dirFilter, sortKey, sortDir, highZoneFilter, lowZoneFilter, closeZoneFilter, lastQZoneFilter]);

  /* -- Stats -- */
  const stats = useMemo(() => {
    const total = movers.length;
    const above = movers.filter((m) => m.direction === "above").length;
    const below = movers.filter((m) => m.direction === "below").length;
    const extremes = movers.filter(isExtreme).length;

    // Per-class stats
    const classCounts: Record<AssetClass, { above: number; below: number }> = {
      equity: { above: 0, below: 0 },
      futures: { above: 0, below: 0 },
      crypto: { above: 0, below: 0 },
      fx: { above: 0, below: 0 },
      index: { above: 0, below: 0 },
      etf: { above: 0, below: 0 },
    };
    for (const m of movers) {
      classCounts[m.assetClass][m.direction]++;
    }

    return { total, above, below, extremes, classCounts };
  }, [movers]);

  /* -- Grouped rows for ALL tab -- */
  const groupedRows = useMemo(() => {
    if (classTab !== "ALL") return null;

    const groups: Record<AssetClass, MoverRow[]> = {
      equity: [],
      futures: [],
      crypto: [],
      fx: [],
      index: [],
      etf: [],
    };

    for (const row of rows) {
      groups[row.assetClass].push(row);
    }

    // Sort within each group by magnitude
    for (const key of Object.keys(groups) as AssetClass[]) {
      groups[key].sort((a, b) => b.magnitude - a.magnitude);
    }

    return groups;
  }, [rows, classTab]);

  /* -- Max magnitude for bar scaling -- */
  const maxMagnitude = useMemo(
    () => Math.max(...rows.map((r) => r.magnitude), 1),
    [rows],
  );

  /* -- Row click -- */
  const [previewSymbol, setPreviewSymbol] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  const handleRowClick = useCallback(
    (symbol: string, e?: React.MouseEvent) => {
      if (previewSymbol === symbol) {
        setPreviewSymbol(null);
      } else {
        if (e) {
          setPreviewPos({ x: e.clientX, y: e.clientY });
        }
        setPreviewSymbol(symbol);
      }
    },
    [previewSymbol],
  );

  // Close preview on outside click
  useEffect(() => {
    if (!previewSymbol) return;
    const handler = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        setPreviewSymbol(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [previewSymbol]);

  /* -- Unique zone values for filter dropdowns -- */
  const uniqueZones = useMemo(() => {
    const highSet = new Set<string>();
    const lowSet = new Set<string>();
    const closeSet = new Set<string>();
    const lastQSet = new Set<string>();
    for (const m of movers) {
      if (m.highZone) highSet.add(m.highZone);
      if (m.lowZone) lowSet.add(m.lowZone);
      if (m.zone) closeSet.add(m.zone);
      if (m.lastQCloseZone) lastQSet.add(m.lastQCloseZone);
    }
    const sort = (s: Set<string>) => Array.from(s).sort();
    return { high: sort(highSet), low: sort(lowSet), close: sort(closeSet), lastQ: sort(lastQSet) };
  }, [movers]);

  /* -- Column headers -- */
  const columns: { key: SortKey; label: string; align: "left" | "right"; flex: number }[] = [
    { key: "symbol", label: "SYMBOL", align: "left", flex: 1.1 },
    { key: "assetClass", label: "CLASS", align: "left", flex: 0.6 },
    { key: "lastQCloseZone", label: "LAST Q", align: "left", flex: 1.1 },
    { key: "highZone", label: "HIGH ZONE", align: "left", flex: 1.1 },
    { key: "lowZone", label: "LOW ZONE", align: "left", flex: 1.1 },
    { key: "zone", label: "CURRENT ZONE", align: "left", flex: 1.2 },
    { key: "changePct", label: "CHG %", align: "right", flex: 0.7 },
    { key: "magnitude", label: "MAGNITUDE", align: "right", flex: 1 },
  ];

  /* -- Class tabs -- */
  const classTabs: { key: ClassTab; label: string }[] = [
    { key: "ALL", label: "ALL" },
    { key: "EQUITIES", label: "EQUITIES" },
    { key: "FUTURES", label: "FUTURES" },
    { key: "CRYPTO", label: "CRYPTO" },
    { key: "FX", label: "FX" },
    { key: "INDICES", label: "INDICES" },
    { key: "ETFS", label: "ETFs" },
  ];

  /* -- Direction filter tabs -- */
  const dirTabs: { key: DirectionFilter; label: string }[] = [
    { key: "ALL", label: "ALL" },
    { key: "ABOVE", label: "ABOVE MID" },
    { key: "BELOW", label: "BELOW MID" },
    { key: "EXTREMES", label: "EXTREMES" },
  ];

  /* -- Render table rows -- */
  const renderRow = (row: MoverRow, idx: number) => {
    const barWidth = (row.magnitude / maxMagnitude) * 100;
    const barColor =
      isExtreme(row)
        ? "rgba(217, 119, 6, 0.12)"
        : row.direction === "above"
          ? "rgba(41, 98, 255, 0.12)"
          : "rgba(156, 39, 176, 0.12)";
    const isExtremeRow = isExtreme(row);
    const badge = CLASS_BADGE_COLORS[row.assetClass];

    return (
      <tr
        key={`${row.assetClass}-${row.symbol}`}
        onClick={(e) => handleRowClick(row.symbol, e)}
        style={{
          cursor: "pointer",
          position: "relative",
          background: idx % 2 === 0 ? (theme.frosted ? 'rgba(255,255,255,0.4)' : C.bg) : (theme.frosted ? 'rgba(255,255,255,0.3)' : C.surface),
          borderBottom: theme.frosted ? '1px solid rgba(255,255,255,0.35)' : `1px solid ${C.borderLight}`,
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.frosted ? 'rgba(255,255,255,0.55)' : C.hoverBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = idx % 2 === 0 ? (theme.frosted ? 'rgba(255,255,255,0.4)' : C.bg) : (theme.frosted ? 'rgba(255,255,255,0.3)' : C.surface);
        }}
      >
        {/* SYMBOL */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: isExtremeRow ? 700 : 600,
            letterSpacing: "0.06em",
            color: isExtremeRow ? C.amber : C.textPrimary,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${barWidth}%`,
              background: barColor,
              pointerEvents: "none",
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>{row.symbol}</span>
        </td>

        {/* CLASS */}
        <td style={{ padding: "8px 12px" }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              padding: "2px 6px",
              borderRadius: 3,
              background: badge.bg,
              color: badge.text,
              whiteSpace: "nowrap",
            }}
          >
            {CLASS_LABELS[row.assetClass]}
          </span>
        </td>

        {/* LAST Q CLOSE ZONE */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: row.lastQCloseZone?.includes("BEYOND") || row.lastQCloseZone?.includes("80-90%") ? C.amber
              : row.lastQCloseZone?.includes("UP") ? C.blue
              : row.lastQCloseZone?.includes("DN") ? C.purple : C.textDim,
          }}
        >
          {row.lastQCloseZone || "\u2014"}
        </td>

        {/* HIGH ZONE */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: row.highZone?.includes("BEYOND") || row.highZone?.includes("80-90%") ? C.amber
              : row.highZone?.includes("UP") ? C.blue
              : row.highZone?.includes("DN") ? C.purple : C.textDim,
          }}
        >
          {row.highZone || "—"}
        </td>

        {/* LOW ZONE */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: row.lowZone?.includes("BEYOND") || row.lowZone?.includes("80-90%") ? C.amber
              : row.lowZone?.includes("DN") ? C.purple
              : row.lowZone?.includes("UP") ? C.blue : C.textDim,
          }}
        >
          {row.lowZone || "—"}
        </td>

        {/* CURRENT ZONE */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: isExtremeRow ? 700 : 500,
            letterSpacing: "0.06em",
            color: getZoneColor(row, C),
          }}
        >
          {row.zone || "—"}
        </td>

        {/* CHG % */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            textAlign: "right",
            color: getChangeColor(row.changePct, C),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatPct(row.changePct)}
        </td>

        {/* MAGNITUDE */}
        <td style={{ padding: "8px 12px", textAlign: "right" }}>
          <div className="flex items-center justify-end" style={{ gap: 8 }}>
            <div
              style={{
                flex: "1 1 0",
                maxWidth: 80,
                height: 4,
                background: C.borderLight,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${barWidth}%`,
                  background: isExtremeRow
                    ? C.amber
                    : row.direction === "above"
                      ? C.blue
                      : C.purple,
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isExtremeRow ? C.amber : C.textDim,
                fontVariantNumeric: "tabular-nums",
                minWidth: 48,
                textAlign: "right",
              }}
            >
              {row.magnitude.toFixed(2)}%
            </span>
          </div>
        </td>
      </tr>
    );
  };

  /* -- Render section header -- */
  const renderSectionHeader = (assetClass: AssetClass, count: number) => {
    const cc = stats.classCounts[assetClass];
    return (
      <tr key={`section-${assetClass}`}>
        <td
          colSpan={columns.length}
          style={{
            padding: "12px 12px 6px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: C.textSecondary,
            background: theme.frosted ? 'rgba(255,255,255,0.6)' : C.surface,
            ...(theme.frosted ? { backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' } : {}),
            borderBottom: theme.frosted ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${C.border}`,
          }}
        >
          {CLASS_SECTION_LABELS[assetClass]}
          <span style={{ fontWeight: 500, color: C.textDim, marginLeft: 8 }}>
            {cc.above} above mid, {cc.below} below
          </span>
          <span style={{ fontWeight: 500, color: C.textDim, marginLeft: 4 }}>
            ({count} total)
          </span>
        </td>
      </tr>
    );
  };

  /* -- Zone filter dropdown state -- */
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openFilterCol) return;
    const handler = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilterCol]);

  /* -- Zone filter config -- */
  const zoneFilterConfig: Record<string, { value: string; setter: (v: string) => void; options: string[] }> = {
    lastQCloseZone: { value: lastQZoneFilter, setter: setLastQZoneFilter, options: uniqueZones.lastQ },
    highZone: { value: highZoneFilter, setter: setHighZoneFilter, options: uniqueZones.high },
    lowZone: { value: lowZoneFilter, setter: setLowZoneFilter, options: uniqueZones.low },
    zone: { value: closeZoneFilter, setter: setCloseZoneFilter, options: uniqueZones.close },
  };

  /* -- Render table header -- */
  const renderTableHeader = () => (
    <thead>
      <tr>
        {columns.map((col) => {
          const zf = zoneFilterConfig[col.key];
          const totalFlex = columns.reduce((s, c) => s + c.flex, 0);
          return (
            <th
              key={col.key}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: theme.frosted ? 'rgba(255,255,255,0.7)' : C.bg,
                ...(theme.frosted ? { backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' } : {}),
                padding: "6px 8px 6px 12px",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: sortKey === col.key ? C.textPrimary : C.textDim,
                textAlign: col.align,
                borderBottom: `1px solid ${C.border}`,
                userSelect: "none",
                width: `${(col.flex / totalFlex) * 100}%`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: col.align === "right" ? "flex-end" : "flex-start", gap: 4 }}>
                {/* Sort button */}
                <span
                  onClick={() => handleSort(col.key)}
                  style={{ cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={(e) => { if (sortKey !== col.key) (e.target as HTMLElement).style.color = C.textSecondary; }}
                  onMouseLeave={(e) => { if (sortKey !== col.key) (e.target as HTMLElement).style.color = C.textDim; }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 3, fontSize: 7, opacity: 0.6 }}>
                      {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </span>
                {/* Filter dropdown for zone columns */}
                {zf && (
                  <div style={{ position: "relative" }} ref={openFilterCol === col.key ? filterDropdownRef : undefined}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenFilterCol(openFilterCol === col.key ? null : col.key); }}
                      style={{
                        fontSize: 8,
                        fontFamily: C.font,
                        fontWeight: 600,
                        padding: "2px 4px",
                        border: `1px solid ${zf.value !== "ALL" ? C.accent : C.border}`,
                        borderRadius: 2,
                        background: zf.value !== "ALL" ? (C.accent + "15") : "transparent",
                        color: zf.value !== "ALL" ? C.accent : C.textDim,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      {zf.value === "ALL" ? "▾" : "✓"}
                    </button>
                    {openFilterCol === col.key && (
                      <div
                        className="hide-scrollbar"
                        style={{
                          position: "absolute",
                          top: "100%",
                          right: 0,
                          marginTop: 2,
                          zIndex: 100,
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          borderRadius: 4,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                          maxHeight: 200,
                          overflowY: "auto",
                          minWidth: 140,
                        }}
                      >
                        <button
                          onClick={() => { zf.setter("ALL"); setOpenFilterCol(null); }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "5px 10px",
                            fontSize: 9,
                            fontFamily: C.font,
                            fontWeight: zf.value === "ALL" ? 700 : 500,
                            border: "none",
                            background: zf.value === "ALL" ? C.activeNavBg : "transparent",
                            color: zf.value === "ALL" ? C.textPrimary : C.textSecondary,
                            cursor: "pointer",
                          }}
                        >
                          ALL (no filter)
                        </button>
                        {zf.options.map(z => (
                          <button
                            key={z}
                            onClick={() => { zf.setter(z); setOpenFilterCol(null); }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "5px 10px",
                              fontSize: 9,
                              fontFamily: C.font,
                              fontWeight: zf.value === z ? 700 : 500,
                              border: "none",
                              background: zf.value === z ? C.activeNavBg : "transparent",
                              color: zf.value === z ? C.textPrimary : C.textDim,
                              cursor: "pointer",
                              borderTop: `1px solid ${C.borderLight}`,
                            }}
                            onMouseEnter={(e) => { if (zf.value !== z) e.currentTarget.style.background = C.hoverBg; }}
                            onMouseLeave={(e) => { if (zf.value !== z) e.currentTarget.style.background = "transparent"; }}
                          >
                            {z}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: theme.frosted ? 'rgba(255,255,255,0.3)' : C.bg,
        ...(theme.frosted ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}),
        color: C.textPrimary,
        fontFamily: C.font,
        overflow: "hidden",
      }}
    >
      {/* -- Stats summary bar -- */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "10px 24px",
          borderBottom: theme.frosted ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${C.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.4)' : C.surface,
          ...(theme.frosted ? { backdropFilter: 'blur(30px) saturate(1.6)', WebkitBackdropFilter: 'blur(30px) saturate(1.6)' } : {}),
        }}
      >
        <div className="flex items-center" style={{ gap: 16 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: C.textPrimary,
            }}
          >
            {stats.total} SYMBOLS
          </span>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.04em" }}>
            <span style={{ color: C.blue, fontWeight: 600 }}>{stats.above}</span> above mid
          </span>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.04em" }}>
            <span style={{ color: C.purple, fontWeight: 600 }}>{stats.below}</span> below mid
          </span>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.04em" }}>
            <span style={{ color: C.amber, fontWeight: 600 }}>{stats.extremes}</span> at extremes
          </span>

          {/* Model selector */}
          <div style={{ marginLeft: 8, borderLeft: `1px solid ${C.border}`, paddingLeft: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: C.textDim,
              }}
            >
              MODEL
            </span>
            <div className="flex" style={{ gap: 2 }}>
              {(["pro", "simple", "beta"] as ModelType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModelChange(m)}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: C.font,
                    letterSpacing: "0.08em",
                    padding: "3px 8px",
                    border: `1px solid ${model === m ? "#d1d5db" : C.border}`,
                    background: model === m ? "#f0f4ff" : "transparent",
                    color: model === m ? C.textPrimary : C.textDim,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (model !== m) {
                      e.currentTarget.style.borderColor = "#d1d5db";
                      e.currentTarget.style.color = C.textSecondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (model !== m) {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.color = C.textDim;
                    }
                  }}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 12 }}>
          {lastUpdate && (
            <span style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.04em" }}>
              Updated{" "}
              {lastUpdate.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <div className="flex items-center" style={{ gap: 4 }}>
            <div
              style={{
                width: 24,
                height: 3,
                background: C.borderLight,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(countdown / (REFRESH_INTERVAL_MS / 1000)) * 100}%`,
                  background: C.textDim,
                  borderRadius: 2,
                  transition: "width 1s linear",
                }}
              />
            </div>
            <span style={{ fontSize: 9, color: C.textDim, fontVariantNumeric: "tabular-nums" }}>
              {countdown}s
            </span>
          </div>
        </div>
      </div>

      {/* -- Filter bars -- */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "10px 24px",
          borderBottom: theme.frosted ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${C.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.5)' : C.surface,
          ...(theme.frosted ? { backdropFilter: 'blur(30px) saturate(1.6)', WebkitBackdropFilter: 'blur(30px) saturate(1.6)' } : {}),
        }}
      >
        {/* Asset class tabs */}
        <div className="flex items-center" style={{ gap: 12 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: C.textDim,
              marginRight: 4,
            }}
          >
            CLASS
          </span>
          <div className="flex" style={{ gap: 2 }}>
            {classTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setClassTab(tab.key)}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: C.font,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  border: "none",
                  borderBottom: classTab === tab.key ? `2px solid ${C.textPrimary}` : "2px solid transparent",
                  background: "transparent",
                  color: classTab === tab.key ? C.textPrimary : C.textDim,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (classTab !== tab.key) {
                    e.currentTarget.style.color = C.textSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (classTab !== tab.key) {
                    e.currentTarget.style.color = C.textDim;
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Direction filter */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: C.textDim,
              marginRight: 4,
            }}
          >
            DIRECTION
          </span>
          <div className="flex" style={{ gap: 2 }}>
            {dirTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDirFilter(tab.key)}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: C.font,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  border: `1px solid ${dirFilter === tab.key ? "#d1d5db" : C.border}`,
                  background: dirFilter === tab.key ? "#f0f4ff" : "transparent",
                  color: dirFilter === tab.key ? C.textPrimary : C.textDim,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (dirFilter !== tab.key) {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.color = C.textSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (dirFilter !== tab.key) {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.color = C.textDim;
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* -- Content -- */}
      <div className="flex-1 overflow-auto" style={{ padding: "0 24px", backdropFilter: 'blur(40px) saturate(1.8)', WebkitBackdropFilter: 'blur(40px) saturate(1.8)' }}>
        {loading ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height: "100%", color: C.textDim, fontSize: 12, gap: 12 }}
          >
            <span style={{ letterSpacing: "0.1em" }}>COMPUTING QUARTERLY POSITIONS...</span>
            {loadingElapsed > 1000 && (
              <span style={{ fontSize: 10, letterSpacing: "0.06em", opacity: 0.6 }}>
                {(loadingElapsed / 1000).toFixed(0)}s elapsed
                {loadingElapsed > 5000 ? " — first load processes all symbols" : ""}
              </span>
            )}
            <div style={{ width: 120, height: 3, background: C.borderLight, borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  background: C.accent,
                  borderRadius: 2,
                  animation: "loading-pulse 1.5s ease-in-out infinite",
                }}
              />
            </div>
            <style>{`@keyframes loading-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center"
            style={{ height: "100%", color: C.red, fontSize: 12 }}
          >
            <span style={{ letterSpacing: "0.06em" }}>{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height: "100%", color: C.textDim, fontSize: 12, gap: 12 }}
          >
            <span style={{ letterSpacing: "0.1em" }}>NO MATCHES</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>
              {movers.length} symbols loaded — filters too restrictive
            </span>
            <button
              onClick={() => {
                setHighZoneFilter("ALL");
                setLowZoneFilter("ALL");
                setCloseZoneFilter("ALL");
                setLastQZoneFilter("ALL");
                setDirFilter("ALL");
                setClassTab("ALL");
              }}
              style={{
                fontSize: 10,
                fontWeight: 600,
                fontFamily: C.font,
                letterSpacing: "0.06em",
                padding: "6px 16px",
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.textSecondary,
                cursor: "pointer",
                borderRadius: 3,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.textPrimary; e.currentTarget.style.color = C.textPrimary; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; }}
            >
              RESET ALL FILTERS
            </button>
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            {renderTableHeader()}

            <tbody>
              {rows.map((row, idx) => renderRow(row, idx))}
            </tbody>
          </table>
        )}
      </div>

      {/* -- Footer status bar -- */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "6px 24px",
          borderTop: theme.frosted ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${C.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.4)' : C.surface,
          backdropFilter: 'blur(30px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
          fontSize: 9,
          letterSpacing: "0.06em",
          color: C.textDim,
        }}
      >
        <span>
          {model.toUpperCase()} MODEL &middot; VS MIDPOINT &middot; SORTED BY{" "}
          {sortKey.toUpperCase()} {sortDir.toUpperCase()}
          {isCached && " \u00b7 CACHED"}
          {computeMs != null && !isCached && ` \u00b7 ${(computeMs / 1000).toFixed(1)}s`}
        </span>
        <span>
          {rows.length} OF {stats.total} &middot; AUTO-REFRESH {Math.round(REFRESH_INTERVAL_MS / 1000)}s &middot;{" "}
          CLICK ROW TO CHART
        </span>
      </div>

      {/* Chart preview popup */}
      {previewSymbol && <ChartPreview symbol={previewSymbol} model={model} pos={previewPos} onClose={() => setPreviewSymbol(null)} onOpen={() => router.push(`/terminal?symbol=${encodeURIComponent(previewSymbol)}`)} containerRef={previewRef} />}
    </div>
  );
}

/* ── Chart Preview Popup ──────────────────────────────── */

function ChartPreview({ symbol, model, pos, onClose, onOpen, containerRef }: {
  symbol: string;
  model: ModelType;
  pos: { x: number; y: number };
  onClose: () => void;
  onOpen: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { theme } = useTheme();
  const { bars, levels, loading } = useChartData(symbol, model === 'beta' ? 'pro' : model, 'live');
  const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace";

  // Draggable
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setDragOffset({
        x: dragStartOffset.current.x + (e.clientX - dragStart.current.x),
        y: dragStartOffset.current.y + (e.clientY - dragStart.current.y),
      });
    };
    const onUp = () => { isDragging.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { ...dragOffset };
    document.body.style.cursor = 'grabbing';
  };

  // Show last ~500 bars (~2 years) but chart will auto-zoom to last 130 (2 quarters)
  const trimmedBars = useMemo(() => {
    if (bars.length <= 500) return bars;
    return bars.slice(bars.length - 500);
  }, [bars]);

  // Position popup near cursor, clamped to viewport + drag offset
  const W = 520, H = 360;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  let baseLeft = pos.x + 12;
  let baseTop = pos.y - H / 2;
  if (baseLeft + W > vw - 16) baseLeft = pos.x - W - 12;
  if (baseTop < 16) baseTop = 16;
  if (baseTop + H > vh - 16) baseTop = vh - H - 16;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: baseLeft + dragOffset.x,
        top: baseTop + dragOffset.y,
        width: W,
        height: H,
        zIndex: 200,
        background: theme.frosted ? 'rgba(248,248,250,0.95)' : theme.bg,
        border: theme.frosted ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${theme.border}`,
        borderRadius: 12,
        boxShadow: theme.frosted
          ? '0 16px 48px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9)'
          : '0 16px 48px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: theme.frosted ? '1px solid rgba(255,255,255,0.25)' : `1px solid ${theme.border}`,
        background: theme.frosted ? 'rgba(245,245,248,0.9)' : theme.surface,
        fontFamily: MONO,
        cursor: 'grab',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, letterSpacing: '0.04em' }}>{symbol}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onOpen}
            style={{
              fontSize: 9, fontWeight: 600, fontFamily: MONO, letterSpacing: '0.06em',
              padding: '3px 10px', border: `1px solid ${theme.accent}`, borderRadius: 3,
              background: theme.accent, color: theme.badgeText, cursor: 'pointer',
            }}
          >
            OPEN
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 9, fontWeight: 600, fontFamily: MONO,
              padding: '3px 8px', border: theme.frosted ? '1px solid rgba(255,255,255,0.4)' : `1px solid ${theme.border}`, borderRadius: 3,
              background: 'transparent', color: theme.textDim, cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading && !bars.length ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.textDim, fontSize: 10, fontFamily: MONO }}>
            Loading...
          </div>
        ) : (
          <NativeChart bars={trimmedBars} levels={levels} model={model === 'overlay' ? 'pro' : model} defaultVisibleBars={130} />
        )}
      </div>
    </div>
  );
}

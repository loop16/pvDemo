"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/terminal/ThemeContext";
import type { ChartTheme } from "@/components/terminal/themes";

/* -- Types --------------------------------------------------------- */

type AssetClass = "equity" | "futures" | "crypto" | "fx" | "index" | "etf";

type MoverRow = {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  mid: number;
  vsMid: number;
  zone: string;
  magnitude: number;
  direction: "above" | "below";
  assetClass: AssetClass;
};

type SortKey = "symbol" | "assetClass" | "price" | "changePct" | "vsMid" | "zone" | "magnitude";
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
  if (row.zone.includes("NEAR MID")) return c.textDim;
  if (row.zone.includes("BEYOND") || row.zone.includes("80-90%")) return c.amber;
  if (row.direction === "above") return c.blue;
  return c.purple;
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
  const [classTab, setClassTab] = useState<ClassTab>("ALL");
  const [dirFilter, setDirFilter] = useState<DirectionFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("magnitude");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* -- Fetch -- */
  const fetchMovers = useCallback(async () => {
    const fetchStart = Date.now();
    setLoadingElapsed(0);
    // Show a ticking elapsed timer while loading
    if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    loadingTimerRef.current = setInterval(() => {
      setLoadingElapsed(Date.now() - fetchStart);
    }, 200);

    try {
      const res = await fetch("/api/movers?source=live", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    fetchMovers();
    intervalRef.current = setInterval(fetchMovers, REFRESH_INTERVAL_MS);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, [fetchMovers]);

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
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [movers, classTab, dirFilter, sortKey, sortDir]);

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
  const handleRowClick = useCallback(
    (symbol: string) => {
      router.push(`/terminal?symbol=${encodeURIComponent(symbol)}`);
    },
    [router],
  );

  /* -- Column headers -- */
  const columns: { key: SortKey; label: string; align: "left" | "right"; flex: number }[] = [
    { key: "symbol", label: "SYMBOL", align: "left", flex: 1.1 },
    { key: "assetClass", label: "CLASS", align: "left", flex: 0.7 },
    { key: "price", label: "PRICE", align: "right", flex: 0.9 },
    { key: "changePct", label: "CHG %", align: "right", flex: 0.7 },
    { key: "vsMid", label: "VS MID", align: "right", flex: 0.7 },
    { key: "zone", label: "ZONE", align: "left", flex: 1.3 },
    { key: "magnitude", label: "MAGNITUDE", align: "right", flex: 1.1 },
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
      row.direction === "above"
        ? "rgba(41, 98, 255, 0.06)"
        : "rgba(156, 39, 176, 0.06)";
    const isExtremeRow = isExtreme(row);
    const badge = CLASS_BADGE_COLORS[row.assetClass];

    return (
      <tr
        key={`${row.assetClass}-${row.symbol}`}
        onClick={() => handleRowClick(row.symbol)}
        style={{
          cursor: "pointer",
          position: "relative",
          background: idx % 2 === 0 ? C.bg : C.surface,
          borderBottom: `1px solid ${C.borderLight}`,
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = C.hoverBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = idx % 2 === 0 ? C.bg : C.surface;
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

        {/* PRICE */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 500,
            textAlign: "right",
            color: C.textPrimary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatPrice(row.price)}
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

        {/* VS MID */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 600,
            textAlign: "right",
            color: getVsMidColor(row, C),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatPct(row.vsMid)}
        </td>

        {/* ZONE */}
        <td
          style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: isExtremeRow ? 700 : 500,
            letterSpacing: "0.06em",
            color: getZoneColor(row, C),
          }}
        >
          {row.zone}
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
            background: C.bg,
            borderBottom: `1px solid ${C.border}`,
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

  /* -- Render table header -- */
  const renderTableHeader = () => (
    <thead>
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            onClick={() => handleSort(col.key)}
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: C.bg,
              padding: "10px 12px 8px",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: sortKey === col.key ? C.textPrimary : C.textDim,
              textAlign: col.align,
              cursor: "pointer",
              borderBottom: `1px solid ${C.border}`,
              userSelect: "none",
              width: `${(col.flex / columns.reduce((s, c) => s + c.flex, 0)) * 100}%`,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (sortKey !== col.key) e.currentTarget.style.color = C.textSecondary;
            }}
            onMouseLeave={(e) => {
              if (sortKey !== col.key) e.currentTarget.style.color = C.textDim;
            }}
          >
            {col.label}
            {sortKey === col.key && (
              <span style={{ marginLeft: 4, fontSize: 8, opacity: 0.6 }}>
                {sortDir === "asc" ? "\u25B2" : "\u25BC"}
              </span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: C.bg,
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
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
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
          borderBottom: `1px solid ${C.border}`,
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
      <div className="flex-1 overflow-auto" style={{ padding: "0 24px" }}>
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
            className="flex items-center justify-center"
            style={{ height: "100%", color: C.textDim, fontSize: 12 }}
          >
            <span style={{ letterSpacing: "0.1em" }}>NO DATA</span>
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
              {classTab === "ALL" && groupedRows
                ? /* Grouped by asset class with section headers */
                  CLASS_SECTION_ORDER.map((cls) => {
                    const group = groupedRows[cls];
                    if (!group || group.length === 0) return null;
                    return [
                      renderSectionHeader(cls, group.length),
                      ...group.map((row, idx) => renderRow(row, idx)),
                    ];
                  })
                : /* Flat list for specific class tab */
                  rows.map((row, idx) => renderRow(row, idx))}
            </tbody>
          </table>
        )}
      </div>

      {/* -- Footer status bar -- */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: "6px 24px",
          borderTop: `1px solid ${C.border}`,
          fontSize: 9,
          letterSpacing: "0.06em",
          color: C.textDim,
        }}
      >
        <span>
          QUARTERLY MODEL &middot; VS MIDPOINT &middot; SORTED BY{" "}
          {sortKey.toUpperCase()} {sortDir.toUpperCase()}
          {isCached && " \u00b7 CACHED"}
          {computeMs != null && !isCached && ` \u00b7 ${(computeMs / 1000).toFixed(1)}s`}
        </span>
        <span>
          {rows.length} OF {stats.total} &middot; AUTO-REFRESH {Math.round(REFRESH_INTERVAL_MS / 1000)}s &middot;{" "}
          CLICK ROW TO CHART
        </span>
      </div>
    </div>
  );
}

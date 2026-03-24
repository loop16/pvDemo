# Pricevault Terminal Refactor Plan

## Overview

Replace the current lightweight-charts-based charting system with a native canvas
renderer, and add a new Stats/Movers page. Both share a dark terminal aesthetic.

**Shared infrastructure is at `src/terminal/`** and is already created:
- `src/terminal/types.ts` — all shared TypeScript types
- `src/terminal/theme.ts` — colors, fonts, spacing constants
- `src/terminal/index.ts` — barrel export

---

## Current Architecture (as-is)

```
src/
  app/
    (app)/app/page.tsx          ← Full app (auth-gated), 1200+ symbols
    demo/page.tsx               ← Demo page, 5 symbols
    api/
      ohlcv/route.ts            ← Returns OHLCV bars (Wasabi → local CSV → mock)
      levels/route.ts           ← Returns probability levels (simple/pro/beta/overlay)
      symbols/route.ts          ← Returns available symbol list
  components/
    ChartPanel.tsx              ← 1544 lines. Uses lightweight-charts. Renders
                                   candlesticks + virtualized level lines + overlay
                                   canvas for boxes/labels/mid-bands.
    Toolbar.tsx                 ← Symbol search input + load button
    SidePanel.tsx               ← Model selector, outcome selector, quarter levels
  utils/
    quarters.ts                 ← findQuarterRanges() — detects quarters from bars
    normalize.ts                ← normalizeBars() — normalizes API data
  types/index.ts                ← Minimal shared types (OhlcBar, LevelLine, Levels)
```

### Data Flow (current)

1. Page mounts → fetches `/api/ohlcv?symbol=SPX` → gets bars array
2. Bars passed to `ChartPanel` as `data` prop
3. `ChartPanel` internally:
   a. Creates lightweight-charts instance, adds candlestick series
   b. Calls `findQuarterRanges(bars)` to detect quarterly ranges
   c. Fetches `/api/levels?symbol=X&model=Y` to get probability lines
   d. Parses lines into segments (simple) or boxes (pro/beta/overlay)
   e. Renders levels via a pool of line series (virtualized)
   f. Renders boxes/labels/mid-bands on an overlay `<canvas>`
4. `SidePanel` shows model picker, outcome selector, quarter levels

### Key Observations

- `ChartPanel` is a monolith: data fetching, quarter computation, level parsing,
  and rendering are all tangled together in one 1544-line component
- lightweight-charts handles pan/zoom/crosshair but the app already does
  significant custom canvas drawing on top
- The overlay canvas (boxes, labels, mid-bands) is manually managed with
  `requestAnimationFrame` and coordinate conversion
- Level lines use a virtualized pool of `addLineSeries()` calls — up to 2000
- The quarter detection logic in `quarters.ts` is clean and reusable
- API routes are clean and don't need changes

---

## Target Architecture (to-be)

```
src/
  terminal/                     ← SHARED (already created)
    index.ts                    ← barrel export
    types.ts                    ← all shared types
    theme.ts                    ← T (colors), FONT, FONT_SIZE, LAYOUT, helpers

  app/
    (app)/app/page.tsx          ← REPLACE: becomes terminal shell with multi-panel
    (app)/movers/page.tsx       ← NEW: Stats/Movers page (Agent: Stats)
    demo/page.tsx               ← UPDATE: swap ChartPanel for TerminalChart
    api/                        ← UNCHANGED: keep all existing API routes

  components/
    ChartPanel.tsx              ← KEEP as-is for backward compat during transition
    terminal/                   ← NEW (Agent: Terminal)
      TerminalShell.tsx         ← Multi-panel tiling layout manager
      TerminalChart.tsx         ← Single chart panel (canvas-based)
      canvas/
        CanvasChart.ts          ← Core canvas chart engine (class-based)
        renderers/
          candles.ts            ← Candlestick renderer
          levels.ts             ← Level line renderer
          boxes.ts              ← Probability box renderer
          midband.ts            ← Mid-band renderer
          labels.ts             ← Text label renderer
          grid.ts               ← Grid lines renderer
          axis-y.ts             ← Price axis (right side)
          axis-x.ts             ← Time axis (bottom)
          crosshair.ts          ← Crosshair + price/time readout
        viewport.ts             ← Viewport/camera: pan, zoom, coordinate transforms
        interaction.ts          ← Mouse/keyboard/wheel event handling
        scale.ts                ← Price scale (linear/log) math
      TerminalToolbar.tsx       ← Dark-themed symbol search + panel controls
      TerminalSidebar.tsx       ← Dark-themed model/outcome/levels panel
      PanelHeader.tsx           ← Per-panel header (symbol, model, close button)
    movers/                     ← NEW (Agent: Stats)
      MoversTable.tsx           ← Main movers table component
      MoverRow.tsx              ← Single row in movers table
      MoversHeader.tsx          ← Header with filter/sort controls
      MoversStats.tsx           ← Summary stats bar

  utils/
    quarters.ts                 ← KEEP (reuse findQuarterRanges)
    normalize.ts                ← KEEP (reuse normalizeBars)
    levels-parser.ts            ← NEW: extract level-parsing logic from ChartPanel
```

---

## Agent: Terminal — Canvas Chart System

### Mission

Build a native canvas chart that replaces lightweight-charts. The chart renders
inside a single `<canvas>` element with no external charting library. It must
handle candlestick rendering, probability levels/boxes, pan/zoom, and crosshair.

### File-by-File Spec

#### `src/components/terminal/canvas/viewport.ts`

The mathematical core. Manages the mapping between data coordinates (time, price)
and pixel coordinates on the canvas.

```
State:
  - timeRange: { start: number, end: number }     // visible unix-second range
  - priceRange: { min: number, max: number }       // visible price range
  - canvasWidth: number
  - canvasHeight: number
  - plotArea: { x, y, w, h }                       // excluding axes
  - priceAxisWidth: number (computed from label widths)
  - timeAxisHeight: number (fixed ~24px)
  - scaleMode: 'linear' | 'log'

Methods:
  - timeToX(t: number): number
  - xToTime(x: number): number
  - priceToY(p: number): number
  - yToPrice(y: number): number
  - setVisibleTimeRange(start, end): void
  - setVisiblePriceRange(min, max): void
  - autoScalePrice(bars: OhlcBar[]): void          // fit visible bars
  - panBy(dx: number, dy: number): void
  - zoomAtPoint(x: number, factor: number): void   // mouse-wheel zoom
  - resize(w: number, h: number): void
  - getVisibleBars(bars: OhlcBar[]): OhlcBar[]     // binary search
  - getVisibleBarRange(bars: OhlcBar[]): [startIdx, endIdx]
  - barWidth(): number                              // pixel width of one bar
```

#### `src/components/terminal/canvas/scale.ts`

Price scale utilities.

```
Functions:
  - linearToY(price, min, max, height): number
  - yToLinear(y, min, max, height): number
  - logToY(price, min, max, height): number
  - yToLog(y, min, max, height): number
  - niceStep(range, targetTicks): number           // e.g. 0.25, 0.5, 1, 2, 5, 10, 25, 50...
  - generatePriceTicks(min, max, height, mode): { price: number, y: number }[]
  - generateTimeTicks(start, end, width): { time: number, x: number, label: string }[]
```

#### `src/components/terminal/canvas/interaction.ts`

Event handler that attaches to the canvas and updates viewport state.

```
Handles:
  - mousedown + mousemove + mouseup → pan (dragging)
  - wheel → zoom (centered on cursor)
  - mousemove (no button) → crosshair position
  - double-click → reset to default view
  - right-click → context menu (price copy, reset)
  - keyboard: R=reset, L=toggle log/linear
  - Touch: pinch-to-zoom, drag-to-pan

Emits callbacks:
  - onViewportChange()   → triggers redraw
  - onCrosshairMove(x, y, time, price)
  - onContextMenu(x, y, price, time)
```

#### `src/components/terminal/canvas/renderers/*.ts`

Each renderer is a pure function: `(ctx, viewport, data, theme) => void`.
They draw onto the canvas context. The main chart engine calls them in order.

**`candles.ts`**
```
renderCandles(ctx, viewport, bars: OhlcBar[], theme): void
  - For each visible bar:
    - Compute x from time, barWidth from viewport
    - Compute yOpen, yClose, yHigh, yLow from prices
    - Draw wick (thin line from yHigh to yLow)
    - Draw body (filled rect from yOpen to yClose)
    - Color: theme.candleUp/candleDown based on close vs open
```

**`levels.ts`**
```
renderLevels(ctx, viewport, segments: LevelSegment[], theme): void
  - For each segment within visible time range:
    - Draw horizontal line from timeToX(t1) to timeToX(t2) at priceToY(price)
    - Apply width, color, dash pattern based on segment.style
    - Use ctx.setLineDash for dashed/dotted
```

**`boxes.ts`**
```
renderBoxes(ctx, viewport, boxes: PriceBox[], theme): void
  - For each box within visible time range:
    - Compute rect from (t1, priceHigh) to (t2, priceLow)
    - Fill with box.fill
    - Stroke top/bottom edges with box.stroke (no left/right borders)
```

**`midband.ts`**
```
renderMidBands(ctx, viewport, bands: MidBand[], theme): void
  - For each band within visible time range:
    - Draw thin horizontal line (1-2px) from t1 to t2 at price
    - Use amber/warning color from theme
```

**`labels.ts`**
```
renderLabels(ctx, viewport, labels: ChartLabel[], theme): void
  - Collision detection: skip labels that overlap
  - For each visible label:
    - Compute (x, y) from (time, price) + (dx, dy) pixel offsets
    - Measure text width, check against placed rects
    - Draw text with monospace font, matching color
```

**`grid.ts`**
```
renderGrid(ctx, viewport, theme): void
  - Generate price ticks → draw horizontal grid lines
  - Generate time ticks → draw vertical grid lines
  - Use theme.gridLine color (very faint)
```

**`axis-y.ts`**
```
renderPriceAxis(ctx, viewport, theme): void
  - Draw right-side price axis background (theme.bgPanel)
  - Generate price ticks → draw labels
  - Draw current price marker (highlighted)
  - Border line between plot area and axis
```

**`axis-x.ts`**
```
renderTimeAxis(ctx, viewport, theme): void
  - Draw bottom time axis background (theme.bgPanel)
  - Generate time ticks → draw labels (dates, times)
  - Format: "Jan 15", "2025", "Q2", etc. depending on zoom level
  - Border line between plot area and axis
```

**`crosshair.ts`**
```
renderCrosshair(ctx, viewport, crosshairPos: {x,y} | null, bars, theme): void
  - If crosshairPos is null, skip
  - Draw vertical dashed line at x
  - Draw horizontal dashed line at y
  - Draw price badge on right axis (price at cursor)
  - Draw time badge on bottom axis (time at cursor)
  - Draw OHLCV tooltip in top-left corner for the bar under cursor
```

#### `src/components/terminal/canvas/CanvasChart.ts`

The orchestrating class. Owns the canvas element, viewport, interaction handler,
and calls renderers in paint order each frame.

```
class CanvasChart {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  viewport: Viewport
  interaction: InteractionHandler
  dpr: number

  // Data state (set externally)
  bars: OhlcBar[]
  levels: LevelSegment[]
  boxes: PriceBox[]
  midBands: MidBand[]
  labels: ChartLabel[]
  crosshairPos: { x: number, y: number } | null

  constructor(container: HTMLElement)

  setData(bars, levels, boxes, midBands, labels): void
  resize(): void

  private render(): void {
    // Called on RAF when dirty
    // 1. Clear canvas
    // 2. renderGrid(ctx, viewport, theme)
    // 3. renderBoxes(ctx, viewport, boxes, theme)
    // 4. renderMidBands(ctx, viewport, midBands, theme)
    // 5. renderCandles(ctx, viewport, bars, theme)
    // 6. renderLevels(ctx, viewport, levels, theme)
    // 7. renderLabels(ctx, viewport, labels, theme)
    // 8. renderPriceAxis(ctx, viewport, theme)
    // 9. renderTimeAxis(ctx, viewport, theme)
    // 10. renderCrosshair(ctx, viewport, crosshairPos, bars, theme)
  }

  dispose(): void
}
```

#### `src/components/terminal/TerminalChart.tsx`

React wrapper around `CanvasChart`. This is the component that replaces `ChartPanel`.

```
Props:
  symbol: string
  model: ModelKey
  outcome: OutcomeKey
  levelsSource: 'demo' | 'live'
  onQuarterLevels?: (levels: QuarterLevels) => void

Internal:
  - Manages its own bar/levels fetch lifecycle
  - Creates CanvasChart instance in useEffect
  - Calls findQuarterRanges() to compute quarters
  - Calls levels-parser to build segments/boxes/labels from API response
  - Feeds data into CanvasChart.setData()
  - Handles ResizeObserver for container sizing
  - Keyboard shortcuts (R=reset, L=log toggle)

Data flow:
  1. symbol/model/outcome change → fetch /api/ohlcv + /api/levels
  2. Parse levels into LevelSegment[] | PriceBox[] depending on model
  3. canvasChart.setData(bars, levels, boxes, midBands, labels)
  4. canvasChart triggers render
```

#### `src/components/terminal/TerminalShell.tsx`

Multi-panel tiling layout for the full app page.

```
Props:
  levelsSource: 'demo' | 'live'

State:
  layout: PanelLayout ('1x1' | '1x2' | '2x1' | '2x2')
  panels: PanelState[]  (1-4 panels)

Renders:
  - CSS Grid container filling viewport
  - Grid template changes based on layout
  - Each cell contains: PanelHeader + TerminalChart
  - Toolbar at top: symbol search, layout buttons, add/remove panel

Keyboard:
  - Ctrl+1 → 1x1 layout
  - Ctrl+2 → 1x2 layout (side by side)
  - Ctrl+3 → 2x1 layout (stacked)
  - Ctrl+4 → 2x2 layout (quad)
```

#### `src/components/terminal/PanelHeader.tsx`

Compact header bar for each chart panel.

```
Renders:
  - Symbol name (monospace, bright)
  - Current price + change % (green/red)
  - Model badge (simple/pro/beta)
  - Close panel button (X) — only if multiple panels
  - Dark bg (theme.bgPanel), 28px height
```

#### `src/components/terminal/TerminalToolbar.tsx`

Dark-themed version of the current Toolbar.

```
Same functionality as current Toolbar but:
  - Dark background (theme.bgPanel)
  - Monospace text
  - Dark input fields (theme.bgSurface)
  - Layout toggle buttons (1x1, 1x2, 2x2)
  - Active panel indicator
```

#### `src/components/terminal/TerminalSidebar.tsx`

Dark-themed version of the current SidePanel.

```
Same functionality but:
  - Dark cards (theme.bgPanel with theme.border)
  - Green/red accent colors for values
  - Monospace throughout
  - Model buttons with terminal styling
  - Quarter levels with colored values
```

#### `src/utils/levels-parser.ts`

Extracted from ChartPanel.tsx. Pure utility functions.

```
Functions (moved from ChartPanel):
  - groupScenarioLines(lines: LevelLine[]) → grouped by outcome
  - parseScenarioFixed(lines: LevelLine[]) → { midPct, pairs }
  - outcomeForRange(range, bars) → OutcomeKey
  - levelIndexMap(lines: LevelLine[]) → Record<number, { pct }>
  - buildLevelSegments(quarters, lines, model, outcome, bars) → LevelSegment[]
  - buildPriceBoxes(quarters, lines, model, outcome, bars) → PriceBox[]
  - buildMidBands(quarters, lines, model) → MidBand[]
  - buildChartLabels(quarters, lines, model, outcome, bars) → ChartLabel[]
```

This file contains NO rendering code, only data transformation.

### Page Integration

**`src/app/(app)/app/page.tsx`** — Replace contents:
```tsx
"use client";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export default function AppPage() {
  return <TerminalShell levelsSource="live" />;
}
```

**`src/app/demo/page.tsx`** — Replace contents:
```tsx
"use client";
import { TerminalChart } from "@/components/terminal/TerminalChart";
// Single panel, limited symbols, demo source
```

---

## Agent: Stats — Movers Page

### Mission

Build a terminal-style stats page showing all symbols analyzed by the model,
ranked by their distance from the quarter median. This is a new route.

### File-by-File Spec

#### `src/app/(app)/movers/page.tsx`

```
Route: /app/movers (auth-gated via (app) layout)

On mount:
  1. Fetch /api/symbols?source=live → get all symbols
  2. For each symbol (batched, parallel):
     a. Fetch /api/ohlcv?symbol=X → get bars
     b. Fetch /api/levels?symbol=X&model=simple → get levels
     c. Run findQuarterRanges(bars) → get current quarter
     d. Compute current price (last bar close)
     e. Compute quarterMid from current quarter range
     f. Compute distFromMid = (price - mid) / mid * 100
  3. Build MoverRow[] array
  4. Sort by absDistFromMid descending
  5. Render MoversTable

UI Layout:
  - Full-screen dark terminal background
  - Header: "MOVERS" + date + summary stats
  - Two columns or tabs: "Above Median" | "Below Median"
  - Or a single sorted list with color coding
  - Each row: symbol, price, mid, distance %, daily change %
```

#### `src/components/movers/MoversTable.tsx`

```
Props:
  rows: MoverRow[]
  loading: boolean
  filter: 'all' | 'above' | 'below'
  sortBy: 'distance' | 'symbol' | 'change'

Renders:
  - Table header with sortable columns
  - Virtualized rows (if 1200+ symbols, use windowing)
  - Each row: symbol (mono bold), price, quarter mid, dist% (colored bar), change%
  - Distance shown as colored horizontal bar + number
  - Above median: green bar extending right
  - Below median: red bar extending left
  - Click row → navigate to /app/app?symbol=X (or open chart panel)
```

#### `src/components/movers/MoverRow.tsx`

```
Props:
  row: MoverRow
  maxDist: number (for scaling the bar width)

Renders:
  - Symbol: monospace, bright white, left-aligned
  - Price: monospace, right-aligned
  - Dist from mid: colored bar + percentage text
    - Green (#00d672) for above median
    - Red (#ff4444) for below median
    - Bar width proportional to abs distance / maxDist
  - Daily change: small text, green/red
  - Hover: bgHover background
```

#### `src/components/movers/MoversHeader.tsx`

```
Renders:
  - Title: "MOVERS" in large mono
  - Date: "as of Mar 17, 2026"
  - Filter tabs: ALL | ABOVE | BELOW
  - Search input for filtering symbols
  - Summary: "847 above / 421 below"
```

#### `src/components/movers/MoversStats.tsx`

```
Props:
  stats: MoversStats

Renders:
  - Compact stats bar
  - "1268 symbols analyzed"
  - "847 above median (66.8%)"
  - "421 below median (33.2%)"
  - "Biggest mover: TSLA +42.3% from mid"
```

### Data Fetching Strategy

The movers page needs data for ALL symbols. Fetching 1200+ symbols individually
would be too slow. Options:

**Recommended approach**: Add a new batch API endpoint.

#### `src/app/api/movers/route.ts` (NEW)

```
GET /api/movers?model=simple

Server-side:
  1. Load all symbols from index
  2. For each symbol, load latest OHLCV bars + levels
  3. Run findQuarterRanges() server-side
  4. Compute MoverRow for each
  5. Return sorted MoverRow[] array

This avoids 1200 client-side fetches. The server has direct access to
Wasabi/local data and can do this efficiently.

Response: { rows: MoverRow[], stats: MoversStats }
```

If the batch endpoint is too complex initially, the Stats agent can start with
client-side parallel fetches (10-20 at a time) with a loading progress indicator,
then optimize later.

---

## Shared Infrastructure (already created)

### `src/terminal/types.ts`

Contains all types used by both agents:
- `OhlcBar`, `LevelLine`, `LevelsResponse`, `SymbolEntry`
- `QuarterRange`, `ModelKey`, `OutcomeKey`
- `LevelSegment`, `PriceBox`, `MidBand`, `ChartLabel`
- `QuarterLevels`, `PanelId`, `PanelLayout`, `PanelState`
- `MoverRow`, `MoversStats`

### `src/terminal/theme.ts`

Contains:
- `T` — color constants object (bg, text, green, red, amber, blue, purple, etc.)
- `FONT` — font family strings
- `FONT_SIZE` — pixel sizes
- `LAYOUT` — spacing, dimensions
- `hexA()` — hex to rgba helper
- `darken()` — color darkening helper

### Reused from existing codebase

- `src/utils/quarters.ts` — `findQuarterRanges()` works on any bar array
  (currently typed with UTCTimestamp but the underlying math is number-based)
- `src/utils/normalize.ts` — `normalizeBars()` for API response normalization
- All API routes (`/api/ohlcv`, `/api/levels`, `/api/symbols`) — unchanged

### Note on UTCTimestamp

The current `quarters.ts` uses `UTCTimestamp` from lightweight-charts, which is
just a branded `number`. The new terminal types use plain `number` for time.
Both agents should cast as needed:
```ts
const ranges = findQuarterRanges(bars as any);
// ranges[i].startTime is UTCTimestamp but numerically identical to number
```

Eventually `quarters.ts` should be updated to use plain `number` and remove the
lightweight-charts import, but that's a follow-up cleanup task.

---

## Implementation Order

### Phase 1: Terminal Agent

1. `src/utils/levels-parser.ts` — Extract level parsing from ChartPanel
2. `src/components/terminal/canvas/viewport.ts` — Coordinate math
3. `src/components/terminal/canvas/scale.ts` — Price/time scale utilities
4. `src/components/terminal/canvas/renderers/` — All renderers
5. `src/components/terminal/canvas/interaction.ts` — Mouse/keyboard
6. `src/components/terminal/canvas/CanvasChart.ts` — Orchestrator
7. `src/components/terminal/TerminalChart.tsx` — React wrapper
8. `src/components/terminal/PanelHeader.tsx`
9. `src/components/terminal/TerminalToolbar.tsx`
10. `src/components/terminal/TerminalSidebar.tsx`
11. `src/components/terminal/TerminalShell.tsx` — Multi-panel layout
12. Update `src/app/(app)/app/page.tsx` — Swap to TerminalShell
13. Update `src/app/demo/page.tsx` — Swap to single TerminalChart

### Phase 2: Stats Agent

1. `src/app/api/movers/route.ts` — Batch movers endpoint
2. `src/components/movers/MoversHeader.tsx`
3. `src/components/movers/MoversStats.tsx`
4. `src/components/movers/MoverRow.tsx`
5. `src/components/movers/MoversTable.tsx`
6. `src/app/(app)/movers/page.tsx` — Wire it up

### Phase 3: Cleanup

- Remove `lightweight-charts` from package.json
- Delete old `ChartPanel.tsx`, `ChartPanel(OLD).tsx`, `ChartPanel(current).tsx`
- Update `quarters.ts` to remove UTCTimestamp dependency
- Update `types/index.ts` to re-export from `terminal/types.ts`

---

## CSS Strategy

The terminal components use **inline styles** referencing theme constants from
`@/terminal/theme`, not CSS classes. This keeps the dark theme self-contained
and avoids conflicts with the existing light marketing pages.

For the tiling layout grid, use a small amount of CSS-in-JS or a dedicated
CSS module at `src/components/terminal/terminal.module.css` if needed.

The existing `globals.css` is NOT modified — the marketing pages keep their
light theme.

---

## Critical Constraints

1. **No external charting libraries** — the canvas chart is 100% custom
2. **Keep existing API routes unchanged** — same fetch URLs, same response shapes
3. **Keep marketing pages unchanged** — only (app) routes get the terminal look
4. **Backward compatibility** — ChartPanel.tsx stays until both agents are done
5. **Performance** — the canvas chart must handle 2+ years of daily bars smoothly
   with 10+ level lines per quarter (potentially hundreds of line segments)
6. **No scrolling on app pages** — everything fits in viewport via the grid layout

---

## Visual Reference

```
+------------------------------------------------------------------+
| [SYMBOL INPUT]  [LOAD]  Daily EOD  |  1x1  1x2  2x2  |  MOVERS  |  ← toolbar
+------------------------------+-----------------------------------+
|  AAPL  $234.56  +1.2%        |  NQ  $22,456  -0.3%              |  ← panel headers
+------------------------------+-----------------------------------+
|                              |                                   |
|    ████ candlesticks ████    |    ████ candlesticks ████        |
|    ════ level lines  ════    |    ════ level lines  ════        |
|    ░░░░ prob boxes   ░░░░    |    ░░░░ prob boxes   ░░░░        |
|    ── mid band ──            |    ── mid band ──                |
|         20%  50%  80%        |         20%  50%  80%            |  ← two chart panels
|                              |                                   |
|                              |                                   |
|          $234.56 |           |          $22,456 |               |  ← price axis
+------------------------------+-----------------------------------+
| Jan  Feb  Mar  Apr  May      | Jan  Feb  Mar  Apr  May          |  ← time axis
+------------------------------------------------------------------+
| SPX $5,892  +0.4% | Model: Simple | Q2 2026 | Levels: ...       |  ← status bar
+------------------------------------------------------------------+
```

All on black background (#0a0a0a) with green/white/amber monospace text.

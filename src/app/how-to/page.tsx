export default function HowTo() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose dark:prose-invert">
      <h1>How to Use</h1>
      <ol>
        <li>Search or pick a symbol (e.g., SPY, ES, BTC).</li>
        <li>Toggle overlays to show quarterly pivots and model levels.</li>
        <li>Hover the chart to see distance-to-level in the tooltip.</li>
      </ol>
      <p>Levels are recalculated nightly; “Model rev” updates quarterly.</p>
    </main>
  );
}


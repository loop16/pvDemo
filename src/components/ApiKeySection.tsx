"use client";

import { useState } from "react";

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

export default function ApiKeySection({ initialKey }: { initialKey: string | null }) {
  const [apiKey, setApiKey] = useState<string | null>(initialKey);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/generate-key", { method: "POST" });
      const data = await res.json();
      if (data.apiKey) {
        setApiKey(data.apiKey);
        setRevealed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const masked = apiKey ? apiKey.slice(0, 6) + "••••••••••••••••••••••••••••••••••" : null;
  const display = revealed ? apiKey : masked;

  return (
    <div className="mt-8 border border-neutral-200 p-6" style={{ background: "rgba(255,255,255,0.4)" }}>
      <p className="label mb-1">API Access</p>
      <p className="text-sm text-neutral-500 mb-4">
        Use your API key to access Pricevault data programmatically — from Python, a terminal, or any HTTP client.
      </p>

      {apiKey ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <code
              style={{
                fontFamily: MONO,
                fontSize: 12,
                background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.08)",
                padding: "8px 12px",
                flex: 1,
                wordBreak: "break-all",
                color: "#111827",
              }}
            >
              {display}
            </code>
            <button
              onClick={() => setRevealed(r => !r)}
              style={{ fontFamily: MONO, fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {revealed ? "Hide" : "Show"}
            </button>
            <button
              onClick={copy}
              style={{ fontFamily: MONO, fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: "#6b7280",
              background: "none",
              border: "1px solid rgba(0,0,0,0.12)",
              padding: "6px 14px",
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Rotating..." : "Rotate key"}
          </button>
          <p className="text-xs text-neutral-400 mono">Rotating generates a new key and immediately invalidates the old one.</p>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          style={{
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "#ffffff",
            background: "#111827",
            border: "1px solid #111827",
            padding: "8px 18px",
            cursor: "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Generating..." : "Generate API key"}
        </button>
      )}

      <div className="mt-5 pt-5 border-t border-neutral-100">
        <p className="label mb-2">Quick start</p>
        <pre style={{ fontFamily: MONO, fontSize: 11, color: "#374151", background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)", padding: "12px", overflowX: "auto", margin: 0 }}>{`# Terminal
curl -H "x-api-key: YOUR_KEY" \\
  "https://price-vault.com/api/v1/movers?model=pro"

# Python
import requests
r = requests.get(
    "https://price-vault.com/api/v1/movers",
    headers={"x-api-key": "YOUR_KEY"},
    params={"model": "pro"}
)
df = pd.DataFrame(r.json()["movers"])`}</pre>
        <p className="text-xs text-neutral-400 mono mt-2">
          Optional params: <code>model=pro|simple|beta</code> · <code>class=equity|futures|crypto|fx</code> · <code>direction=above|below</code> · <code>limit=N</code>
        </p>
      </div>
    </div>
  );
}

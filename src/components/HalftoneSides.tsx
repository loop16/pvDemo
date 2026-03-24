"use client";

import { useEffect, useRef } from "react";

function ema(data: number[], alpha: number): number[] {
  const out = new Array(data.length);
  out[0] = data[0];
  for (let i = 1; i < data.length; i++) out[i] = alpha * data[i] + (1 - alpha) * out[i - 1];
  return out;
}
function rema(data: number[], alpha: number): number[] {
  const out = new Array(data.length);
  out[data.length - 1] = data[data.length - 1];
  for (let i = data.length - 2; i >= 0; i--) out[i] = alpha * data[i] + (1 - alpha) * out[i + 1];
  return out;
}
function interpAt(arr: number[], nx: number) {
  const N = arr.length;
  const idx = nx * (N - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, N - 1);
  const t = idx - lo;
  return arr[lo] * (1 - t) + arr[hi] * t;
}

export default function HalftoneSides({ prices }: { prices: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = prices.length;
    const ema200 = ema(prices, 2 / 201);
    const ema100 = ema(prices, 2 / 101);
    const ema50 = ema(prices, 2 / 51);
    const ema20 = ema(prices, 2 / 21);
    const rema200 = rema(prices, 2 / 201);

    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const range = rawMax - rawMin;
    const priceMin = rawMin - range * 0.35;
    const priceMax = rawMax + range * 0.15;

    const GRID = 5;
    const MAX_R = 2.4;

    const layers: [number[], number, number, number, number][] = [
      [ema200, 0.90, range * 0.08, 0.12, 300],
      [ema100, 0.94, range * 0.05, 0.18, 220],
      [ema50,  0.97, range * 0.03, 0.25, 160],
      [ema20,  0.99, range * 0.01, 0.30, 110],
      [rema200, 0.91, range * 0.07, 0.12, 300],
      [prices, 1.0, 0, 0.40, 70],
      [prices, 1.04, -range * 0.03, 0.30, 120],
      [prices, 1.10, -range * 0.07, 0.45, 180],
    ];

    function priceToScreenY(p: number, h: number) {
      return (1 - (p - priceMin) / (priceMax - priceMin)) * h + h * 0.05;
    }

    function render() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      // Setup both canvases
      const centerCanvas = centerRef.current;
      const centerCtx = centerCanvas?.getContext("2d");

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.fillStyle = "#000";

      if (centerCanvas && centerCtx) {
        centerCanvas.width = w * dpr;
        centerCanvas.height = h * dpr;
        centerCanvas.style.width = w + "px";
        centerCanvas.style.height = h + "px";
        centerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        centerCtx.clearRect(0, 0, w, h);
        centerCtx.fillStyle = "#000";
      }

      // Grid line boundaries
      const containerLeft = Math.max((w - 1280) / 2, 0);
      const leftLine = containerLeft - 20;
      const rightLine = Math.min(w, containerLeft + 1280) + 20;

      const cols = Math.ceil(w / GRID) + 1;
      const rows = Math.ceil(h / GRID) + 1;

      for (let row = 0; row < rows; row++) {
        const cy = row * GRID;
        const ny = cy / h;

        for (let col = 0; col < cols; col++) {
          const cx = col * GRID;
          const nx = cx / w;

          let intensity = 0;

          for (let li = 0; li < layers.length; li++) {
            const [arr, scale, off, peak, fadeH] = layers[li];
            const price = interpAt(arr, nx) * scale + off;
            const ridgeY = priceToScreenY(price, h);
            const depth = cy - ridgeY;
            if (depth > 0) {
              const t = Math.min(depth / fadeH, 1);
              intensity += peak * (1 - t * 0.6);
            }
          }

          // Bottom ramp
          if (ny > 0.82) {
            const bottomRamp = (ny - 0.82) / 0.18;
            intensity = intensity + (1 - intensity) * bottomRamp;
          }

          // Outer edge darkening
          const edgeDist = Math.min(nx, 1 - nx);
          if (edgeDist < 0.05) {
            intensity = Math.max(intensity, (1 - edgeDist / 0.05) * ny * 0.7);
          }

          intensity = Math.max(0, Math.min(1, intensity));
          if (intensity < 0.02) continue;

          const r = intensity * MAX_R;
          if (r < 0.25) continue;

          // Draw to the appropriate canvas
          const isCenter = cx >= leftLine && cx <= rightLine;
          const target = isCenter && centerCtx ? centerCtx : ctx!;
          target.beginPath();
          target.arc(cx, cy, r, 0, Math.PI * 2);
          target.fill();
        }
      }
    }

    render();
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [prices]);

  const centerRef = useRef<HTMLCanvasElement>(null);

  return (
    <>
      {/* Margins — light blur */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0"
        style={{ pointerEvents: "none", zIndex: 0, filter: "blur(1px)", opacity: 0.35 }}
      />
      {/* Center content area — heavy blur */}
      <canvas
        ref={centerRef}
        className="fixed top-0 left-0"
        style={{ pointerEvents: "none", zIndex: 0, filter: "blur(10px)", opacity: 0.18 }}
      />
    </>
  );
}

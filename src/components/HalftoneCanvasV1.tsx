"use client";

import { useEffect, useRef } from "react";

const PRICES = [99.90, 100.49, 99.74, 99.25, 98.92, 98.73, 98.86, 99.06, 98.78, 99.07, 98.55, 97.65, 97.78, 97.64, 97.88, 97.70, 97.79, 97.82, 97.69, 97.11, 97.10, 96.88, 96.92, 96.91, 96.89, 96.87, 97.68, 97.95, 97.64, 97.38, 97.60, 97.15, 96.16, 96.34, 95.82, 97.06, 97.46, 98.27, 98.79, 98.56, 99.05, 99.38, 99.35, 99.06, 99.17, 98.89, 99.14, 98.84, 98.73, 98.59, 98.36, 98.43, 98.28, 98.22, 98.01, 98.05, 97.95, 97.88, 98.24, 98.72, 98.42, 98.39, 98.21, 98.25, 98.39, 98.33, 98.63, 99.24, 99.10, 98.99, 99.07, 98.87, 99.32, 99.41, 99.48, 99.53, 99.56, 99.79, 100.19, 100.20, 100.21, 100.11, 99.60, 99.53, 99.27, 99.23, 99.47, 99.46, 99.62, 99.56, 99.70, 100.16, 100.20, 99.88, 99.72, 99.52, 99.14, 98.73, 98.80, 98.94, 98.91, 98.88, 98.96, 98.59, 98.54, 98.34, 98.67, 99.03, 99.25, 98.85, 99.40, 98.82, 98.58, 98.11, 97.71, 97.86, 97.70, 97.79, 97.94, 98.18, 98.45, 97.84, 97.22, 97.30, 97.65, 97.36, 97.02, 96.66, 97.34, 97.61, 97.50, 97.81, 97.74, 97.44, 97.74, 98.27, 98.15, 98.31, 97.69, 97.86, 97.90, 98.18, 98.21, 98.43, 97.73, 98.62, 98.22, 98.28, 98.13, 97.84, 98.19, 97.79, 98.05, 98.50, 98.26, 98.05, 98.19, 98.76, 98.73, 98.68, 100.05, 99.89, 98.90, 98.66, 97.67, 97.52, 97.21, 97.40, 97.85, 98.46, 98.61, 98.28, 98.64, 98.10, 97.87, 97.58, 97.47, 97.51, 97.52, 96.98, 97.13, 96.77, 96.65, 96.78, 97.25, 97.35, 97.71, 97.97, 98.35, 98.77, 98.78, 98.85, 98.82, 98.14, 98.14, 97.84, 98.58, 99.04, 99.00, 99.20, 98.71, 98.82, 99.25, 98.71, 99.44, 99.33, 99.88, 99.56, 98.93, 99.10, 99.90, 99.69, 100.01, 100.38, 100.98, 100.81, 101.02, 100.93, 101.78, 100.42, 100.64, 99.87, 99.39, 99.78, 100.04, 100.18, 99.64, 99.19, 98.94, 99.59, 99.29, 99.78, 99.64, 98.32, 99.40, 99.28, 100.10, 99.64, 99.78, 100.91, 102.91, 102.91, 103.47, 102.89, 101.94, 103.69, 104.20, 104.18, 104.01, 104.28, 104.67, 104.22, 104.31, 104.15, 103.80, 103.46, 103.24, 103.41, 103.73, 103.83, 103.57, 103.42, 103.90, 103.91, 104.14, 104.27, 105.53, 106.56, 107.56, 107.29, 106.47, 106.28, 106.70, 106.64, 106.33, 107.16, 107.02, 106.74, 106.79, 107.07, 107.97, 107.92, 108.33, 108.10, 107.70, 107.62, 108.00, 108.42, 108.50, 108.18, 107.94, 107.92, 107.43, 107.47, 108.11, 108.28, 108.08, 108.07, 109.41, 108.96];
const N = PRICES.length;

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

const EMA400 = ema(PRICES, 2 / 401);
const EMA200 = ema(PRICES, 2 / 201);
const EMA100 = ema(PRICES, 2 / 101);
const EMA50 = ema(PRICES, 2 / 51);
const EMA20 = ema(PRICES, 2 / 21);
const REMA400 = rema(PRICES, 2 / 401);
const REMA200 = rema(PRICES, 2 / 201);

// Main halftone layers — EMA50 is NOT here, it has its own separate pass
const LAYERS: [number[], number, number, number, number][] = [
  [EMA400, 0.87, 15, 0.10, 350],
  [EMA200, 0.90, 12, 0.15, 300],
  [EMA100, 0.94, 7, 0.22, 220],
  [EMA20, 0.99, 1, 0.35, 110],
  [REMA400, 0.88, 14, 0.10, 350],
  [REMA200, 0.91, 11, 0.15, 300],
  [PRICES, 1.0, 0, 0.45, 70],
  [PRICES, 1.04, -4, 0.35, 120],
  [PRICES, 1.10, -10, 0.50, 180],
];

const LEFT_DARK_PRICES = ema(PRICES, 0.008);

function interpAt(arr: number[], nx: number) {
  const idx = nx * (N - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, N - 1);
  const t = idx - lo;
  return arr[lo] * (1 - t) + arr[hi] * t;
}

export default function HalftoneCanvas({ inverted = false }: { inverted?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GRID = 5;
    const MAX_R = 2.4;
    const priceMin = 95;
    const priceMax = 110;

    function priceToScreenY(p: number, h: number) {
      return (1 - (p - priceMin) / (priceMax - priceMin)) * h + h * 0.05;
    }

    // Offscreen canvas for static halftone dots
    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d")!;
    let lastW = 0, lastH = 0;

    function renderHalftone(w: number, h: number, dpr: number) {
      offscreen.width = w * dpr;
      offscreen.height = h * dpr;
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offCtx.clearRect(0, 0, w, h);
      if (inverted) {
        offCtx.fillStyle = "#000";
        offCtx.fillRect(0, 0, w, h);
        offCtx.fillStyle = "#fff";
      } else {
        offCtx.fillStyle = "#000";
      }

      const cols = Math.ceil(w / GRID) + 1;
      const rows = Math.ceil(h / GRID) + 1;

      for (let row = 0; row < rows; row++) {
        const cy = row * GRID;
        const ny = cy / h;

        for (let col = 0; col < cols; col++) {
          const cx = col * GRID;
          const nx = cx / w;

          let intensity = 0;

          for (let li = 0; li < LAYERS.length; li++) {
            const [arr, scale, off, peak, fadeH] = LAYERS[li];
            const price = interpAt(arr, nx) * scale + off;
            const ridgeY = priceToScreenY(price, h);
            const depth = cy - ridgeY;
            if (depth > 0) {
              const t = Math.min(depth / fadeH, 1);
              intensity += peak * (1 - t * 0.6);
            }
          }

          if (nx < 0.25) {
            const leftFade = 1 - nx / 0.25;
            const leftPrice = interpAt(LEFT_DARK_PRICES, nx);
            const leftY = priceToScreenY(leftPrice * 0.95 + 6, h);
            if (cy > leftY) intensity += leftFade * 0.5;
          }

          if (ny > 0.82) {
            const bottomRamp = (ny - 0.82) / 0.18;
            intensity = intensity + (1 - intensity) * bottomRamp;
          }

          const edgeDist = Math.min(nx, 1 - nx);
          if (edgeDist < 0.05) {
            intensity = Math.max(intensity, (1 - edgeDist / 0.05) * ny * 0.7);
          }

          intensity = Math.max(0, Math.min(1, intensity));
          if (intensity < 0.02) continue;

          const r = intensity * MAX_R;
          if (r < 0.25) continue;

          offCtx.beginPath();
          offCtx.arc(cx, cy, r, 0, Math.PI * 2);
          offCtx.fill();
        }
      }

      // ─── Separate EMA50 layer ───
      // Pure black squares below the ridge, hard border at the EMA50 curve
      // Cuts off at 2/3 viewport width
      const EMA50_SQ = 3;          // square size
      const EMA50_OFFSET = -2.35;  // price offset

      for (let y = 0; y < h; y += EMA50_SQ) {
        for (let x = 0; x < w; x += EMA50_SQ) {
          const nx = x / w;
          if (nx > 0.63) continue;

          const price = interpAt(EMA50, nx) + EMA50_OFFSET;
          const ridgeY = priceToScreenY(price, h);
          if (y < ridgeY) continue;

          offCtx.fillRect(x, y, EMA50_SQ, EMA50_SQ);
        }
      }
    }

    function render() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      renderHalftone(w, h, dpr);
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.drawImage(offscreen, 0, 0);
    }

    render();
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

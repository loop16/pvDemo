"use client";

import { useEffect, useRef } from "react";
import { USDJPY } from "@/data/page-prices";

// Use a shorter slice for broader, more zoomed-in waves
const RAW_PRICES = USDJPY.slice(Math.floor(USDJPY.length * 0.4));

// ─── EMA helpers ───
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

const PRICES = RAW_PRICES;
const N = PRICES.length;

// Moving averages
const EMA400 = ema(PRICES, 2 / 401);
const EMA200 = ema(PRICES, 2 / 201);
const EMA100 = ema(PRICES, 2 / 101);
const EMA50 = ema(PRICES, 2 / 51);
const EMA20 = ema(PRICES, 2 / 21);
const REMA400 = rema(PRICES, 2 / 401);
const REMA200 = rema(PRICES, 2 / 201);
const REMA100 = rema(PRICES, 2 / 101);

function interpAt(arr: number[], nx: number) {
  const idx = nx * (N - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, N - 1);
  const t = idx - lo;
  return arr[lo] * (1 - t) + arr[hi] * t;
}

// Deterministic hash for subtle noise
function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// ─── LAYERS ───
// [data[], scaleY, offsetY, peakIntensity, fadeH]
// TOP layers (inverted — dark comes from above)
const TOP_LAYERS: [number[], number, number, number, number][] = [
  [REMA400, 1.13, -15, 0.08, 400],
  [REMA200, 1.10, -12, 0.12, 350],
  [REMA100, 1.06, -7, 0.18, 280],
  [EMA400, 1.12, -14, 0.08, 400],
  [EMA200, 1.09, -11, 0.12, 350],
];

// BOTTOM layers (normal — dark comes from below, same as V1 style)
const BOT_LAYERS: [number[], number, number, number, number][] = [
  [EMA400, 0.87, 15, 0.08, 400],
  [EMA200, 0.90, 12, 0.12, 350],
  [EMA100, 0.94, 7, 0.18, 280],
  [EMA50, 0.97, 4, 0.25, 200],
  [EMA20, 0.99, 1, 0.30, 140],
  [REMA400, 0.88, 14, 0.08, 400],
  [REMA200, 0.91, 11, 0.12, 350],
  [PRICES, 1.0, 0, 0.40, 90],
  [PRICES, 1.04, -4, 0.30, 140],
  [PRICES, 1.10, -10, 0.45, 200],
];

export default function HalftoneWaves({ inverted = false }: { inverted?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GRID = 5;
    const MAX_R = 2.4;
    const priceMin = Math.min(...PRICES) - 5;
    const priceMax = Math.max(...PRICES) + 5;

    function priceToScreenY(p: number, h: number) {
      return (1 - (p - priceMin) / (priceMax - priceMin)) * h + h * 0.05;
    }

    // Inverted: price maps to TOP of screen
    function priceToScreenYTop(p: number, h: number) {
      return ((p - priceMin) / (priceMax - priceMin)) * h * 0.4;
    }

    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d")!;

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

          // ── TOP darkness: EMA contours coming down from the top ──
          for (let li = 0; li < TOP_LAYERS.length; li++) {
            const [arr, scale, off, peak, fadeH] = TOP_LAYERS[li];
            const price = interpAt(arr, nx) * scale + off;
            const ridgeY = priceToScreenYTop(price, h);
            const depth = ridgeY - cy; // inverted: dark ABOVE the ridge
            if (depth > 0) {
              const t = Math.min(depth / fadeH, 1);
              intensity += peak * (1 - t * 0.6);
            }
          }

          // ── BOTTOM darkness: EMA contours rising from the bottom ──
          for (let li = 0; li < BOT_LAYERS.length; li++) {
            const [arr, scale, off, peak, fadeH] = BOT_LAYERS[li];
            const price = interpAt(arr, nx) * scale + off;
            const ridgeY = priceToScreenY(price, h);
            const depth = cy - ridgeY;
            if (depth > 0) {
              const t = Math.min(depth / fadeH, 1);
              intensity += peak * (1 - t * 0.6);
            }
          }

          // ── Top ramp to solid ──
          if (ny < 0.08) {
            const topRamp = (0.08 - ny) / 0.08;
            intensity = intensity + (1 - intensity) * topRamp * 0.7;
          }

          // ── Bottom ramp to solid ──
          if (ny > 0.85) {
            const bottomRamp = (ny - 0.85) / 0.15;
            intensity = intensity + (1 - intensity) * bottomRamp;
          }

          // ── Side edges ──
          const edgeDist = Math.min(nx, 1 - nx);
          if (edgeDist < 0.05) {
            intensity = Math.max(intensity, (1 - edgeDist / 0.05) * 0.5);
          }

          // ── Top-right extra density ──
          if (nx > 0.5 && ny < 0.4) {
            const trFade = ((nx - 0.5) / 0.5) * ((0.4 - ny) / 0.4);
            intensity += trFade * 0.25;
          }

          // ── Random gradient noise for organic texture ──
          const noise = (hash(col, row) - 0.5) * 0.04;
          intensity += noise;

          // ── Subtle sine-based gradient bands for depth ──
          const band1 = Math.sin(ny * 12 + nx * 3) * 0.02;
          const band2 = Math.sin(ny * 7 - nx * 5 + 2.1) * 0.015;
          intensity += band1 + band2;

          intensity = Math.max(0, Math.min(1, intensity));
          if (intensity < 0.02) continue;

          const r = intensity * MAX_R;
          if (r < 0.25) continue;

          offCtx.beginPath();
          offCtx.arc(cx, cy, r, 0, Math.PI * 2);
          offCtx.fill();
        }
      }
    }

    function render() {
      const w = canvas!.parentElement?.clientWidth ?? window.innerWidth;
      const h = canvas!.parentElement?.clientHeight ?? window.innerHeight;
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

    const parent = canvas.parentElement;
    let ro: ResizeObserver | undefined;
    if (parent) {
      ro = new ResizeObserver(() => render());
      ro.observe(parent);
    }
    const onResize = () => render();
    window.addEventListener("resize", onResize);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [inverted]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

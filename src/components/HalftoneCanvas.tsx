"use client";

import { useEffect, useRef } from "react";

// ─── Perlin-style gradient noise ───
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grads = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const dot = (g: number[], x: number, y: number) => g[0] * x + g[1] * y;

  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = grads[perm[perm[X] + Y] & 7];
    const ba = grads[perm[perm[X + 1] + Y] & 7];
    const ab = grads[perm[perm[X] + Y + 1] & 7];
    const bb = grads[perm[perm[X + 1] + Y + 1] & 7];
    return lerp(
      lerp(dot(aa, xf, yf), dot(ba, xf - 1, yf), u),
      lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u),
      v,
    );
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number, oct: number): number {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < oct; i++) {
    val += n(x * freq, y * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

const noise = makeNoise(42);

// ─── Ridge layers: back (subtle) → front (heavy) ───
const RIDGES = [
  // Far background — barely visible wisps
  { baseY: 0.28, freq: 3.0, amp: 0.09, peak: 0.05, fade: 500, seed: 10 },
  { baseY: 0.36, freq: 2.5, amp: 0.07, peak: 0.08, fade: 420, seed: 55 },
  // Mid background
  { baseY: 0.46, freq: 3.5, amp: 0.08, peak: 0.12, fade: 350, seed: 130 },
  { baseY: 0.54, freq: 2.0, amp: 0.11, peak: 0.16, fade: 280, seed: 210 },
  // Mid foreground
  { baseY: 0.63, freq: 2.8, amp: 0.09, peak: 0.22, fade: 220, seed: 320 },
  // Foreground — darker
  { baseY: 0.73, freq: 2.2, amp: 0.13, peak: 0.32, fade: 160, seed: 430 },
  // Near foreground — heavy
  { baseY: 0.82, freq: 1.8, amp: 0.08, peak: 0.45, fade: 110, seed: 560 },
  // Bottom mass
  { baseY: 0.90, freq: 1.5, amp: 0.05, peak: 0.55, fade: 80, seed: 680 },
];

export default function HalftoneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GRID = 5;
    const MAX_R = 2.4;

    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d")!;
    let lastW = 0, lastH = 0;
    let lastRenderTime = 0;
    let time = 0;
    let animId = 0;

    function renderTerrain(w: number, h: number, dpr: number) {
      offscreen.width = w * dpr;
      offscreen.height = h * dpr;
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offCtx.clearRect(0, 0, w, h);
      offCtx.fillStyle = "#000";

      const cols = Math.ceil(w / GRID) + 1;
      const rows = Math.ceil(h / GRID) + 1;

      // Precompute ridge heights per column (1D noise along x)
      const ridgeHeights = RIDGES.map(ridge => {
        const heights = new Float32Array(cols);
        for (let col = 0; col < cols; col++) {
          const nx = (col * GRID) / w;
          const n = fbm(noise, nx * ridge.freq * 4 + ridge.seed + time * 0.05, ridge.seed * 0.1, 4);
          heights[col] = ridge.baseY * h + n * ridge.amp * h;
        }
        return heights;
      });

      for (let row = 0; row < rows; row++) {
        const cy = row * GRID;
        const ny = cy / h;

        for (let col = 0; col < cols; col++) {
          const cx = col * GRID;
          const nx = cx / w;

          let intensity = 0;

          // Sum ridge contributions
          for (let ri = 0; ri < RIDGES.length; ri++) {
            const depth = cy - ridgeHeights[ri][col];
            if (depth > 0) {
              const t = Math.min(depth / RIDGES[ri].fade, 1);
              intensity += RIDGES[ri].peak * (0.5 + 0.5 * t);
            }
          }

          // Subtle hash texture for organic grain
          const tex = (((col * 374761393 + row * 668265263) >>> 0) % 100) / 100;
          intensity += (tex - 0.5) * 0.03;

          // Bottom ramp to solid black
          if (ny > 0.85) {
            const ramp = (ny - 0.85) / 0.15;
            intensity = intensity + (1 - intensity) * ramp;
          }

          // Side edge darkening
          const edgeDist = Math.min(nx, 1 - nx);
          if (edgeDist < 0.04) {
            intensity = Math.max(intensity, (1 - edgeDist / 0.04) * ny * 0.6);
          }

          // Text-safe zone — open negative space upper-left
          const textMask = Math.min(1, Math.max(0, nx * 1.8 + ny * 1.2 - 0.35));
          intensity *= textMask;

          intensity = Math.max(0, Math.min(1, intensity));
          if (intensity < 0.02) continue;

          // Solid black mass where intensity saturates
          if (intensity > 0.88) {
            const half = GRID * 0.5;
            offCtx.fillRect(cx - half, cy - half, GRID, GRID);
          } else {
            const r = intensity * MAX_R;
            if (r < 0.25) continue;
            offCtx.beginPath();
            offCtx.arc(cx, cy, r, 0, Math.PI * 2);
            offCtx.fill();
          }
        }
      }
    }

    function animate(timestamp: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        canvas!.style.width = w + "px";
        canvas!.style.height = h + "px";
        renderTerrain(w, h, dpr);
        lastRenderTime = timestamp;
      }

      // Re-render terrain at ~12fps for slow animation
      if (timestamp - lastRenderTime > 80) {
        time += 0.004;
        renderTerrain(w, h, dpr);
        lastRenderTime = timestamp;
      }

      // Copy offscreen to visible canvas
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.drawImage(offscreen, 0, 0);

      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

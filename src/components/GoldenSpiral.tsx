"use client";
import { useEffect, useState } from "react";

export default function GoldenSpiral() {
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () =>
      setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!dims.w) return null;

  const { w, h } = dims;

  // Grid intersection: left vertical line × horizontal rule
  const ix = Math.max((w - 1280) / 2, 0) - 20;
  const iy = 110;

  // Right triangle rotated 90° CW from original
  // Original: hypotenuse / (bottom-left → top-right)
  // Rotated:  hypotenuse \ (top-left → bottom-right)
  // Right-angle vertex stays at grid intersection
  const triPath = `M 0,0 L ${ix},${iy} L ${w},${h}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
    >
      <path
        d={triPath}
        fill="none"
        stroke="#003087"
        strokeWidth="1"
        opacity="0.15"
      />
    </svg>
  );
}

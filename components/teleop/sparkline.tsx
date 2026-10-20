'use client';

import { useEffect, useRef } from 'react';

// A small line of recent values. Redraws when values change; no chart library.
export function Sparkline({ values, max, color = '#989fb7', label }: { values: number[]; max?: number; color?: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgb(209 190 177 / 18%)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, h - .5); g.lineTo(w, h - .5); g.stroke();
    if (values.length < 2) return;
    const top = max ?? Math.max(...values) * 1.15;
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.lineJoin = 'round';
    g.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - Math.min(1, v / top) * (h - 4);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  }, [values, max, color]);
  return <canvas ref={ref} role="img" aria-label={label} className="block h-10 w-full" />;
}

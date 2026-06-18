'use client';

import { useEffect, useRef } from 'react';

// Celestial Codex ambient starfield — a full-bleed fixed canvas behind all
// content. ~200 stars, ~18% gold-tinted, each with its own sine-wave twinkle.
// Larger stars get a soft halo. Honors prefers-reduced-motion (freezes the
// twinkle to a static field). Sits at z-index 0 above the body radial washes.
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type Star = {
      x: number; y: number; r: number; base: number;
      speed: number; phase: number; gold: boolean;
    };
    let stars: Star[] = [];
    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const build = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with viewport area, capped around ~200 on a laptop.
      const count = Math.min(260, Math.round((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.3 + Math.random() * 1.4,
        base: 0.2 + Math.random() * 0.6,
        speed: 0.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        gold: Math.random() < 0.18,
      }));
    };

    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
        const a = Math.max(0, Math.min(1, s.base * tw));
        const rgb = s.gold ? '227,194,126' : '214,224,245';
        // soft halo for the larger stars
        if (s.r > 1) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(${rgb},${a * 0.12})`;
          ctx.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };

    build();
    if (reduceMotion) {
      draw(0); // single static frame
    } else {
      raf = requestAnimationFrame(draw);
    }

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        build();
        if (reduceMotion) draw(0);
      }, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

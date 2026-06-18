"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Heart, Sparkles } from 'lucide-react';

/**
 * Capsule Catch — a tiny canvas mini-game shown in the Infusion Copilot output
 * panel while the consult brief is being generated, to pass the wait. Catch the
 * falling gold/teal capsules with the tray; dodge the red hazard capsules.
 *
 * Self-contained: owns its own rAF loop, input handling, and high-score
 * persistence. Pauses automatically when `active` goes false (i.e. the brief
 * arrived) so it never competes for the CPU once real content streams in.
 */

type Phase = 'idle' | 'playing' | 'over';

type Capsule = {
  x: number;        // center x (logical px)
  y: number;        // center y
  vy: number;       // fall speed px/s
  r: number;        // radius-ish (half-width)
  kind: 'good' | 'hazard';
  hue: 'gold' | 'teal' | 'violet';
  rot: number;
  spin: number;
};

const HS_KEY = 'infusion-capsule-catch-hs';

export function WaitGame({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);

  // Mutable game state lives in a ref so the rAF loop reads fresh values
  // without re-subscribing every render.
  const game = useRef({
    phase: 'idle' as Phase,
    score: 0,
    lives: 3,
    trayX: 0.5,        // 0..1 fraction of width
    trayTargetX: 0.5,
    capsules: [] as Capsule[],
    spawnTimer: 0,
    elapsed: 0,
    lastT: 0,
    w: 600,
    h: 280,
    keys: { left: false, right: false },
  });

  useEffect(() => {
    try {
      const hs = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
      if (!isNaN(hs)) setHighScore(hs);
    } catch {}
  }, []);

  const start = useCallback(() => {
    const g = game.current;
    g.phase = 'playing';
    g.score = 0;
    g.lives = 3;
    g.capsules = [];
    g.spawnTimer = 0;
    g.elapsed = 0;
    g.trayX = 0.5;
    g.trayTargetX = 0.5;
    setScore(0);
    setLives(3);
    setPhase('playing');
  }, []);

  const endGame = useCallback(() => {
    const g = game.current;
    g.phase = 'over';
    setPhase('over');
    setHighScore(prev => {
      const next = Math.max(prev, g.score);
      try { localStorage.setItem(HS_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // ── Input ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setTargetFromClientX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const frac = (clientX - rect.left) / rect.width;
      game.current.trayTargetX = Math.max(0, Math.min(1, frac));
    };

    const onMove = (e: PointerEvent) => {
      if (game.current.phase !== 'playing') return;
      setTargetFromClientX(e.clientX);
    };
    const onDown = (e: PointerEvent) => {
      setTargetFromClientX(e.clientX);
    };

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') game.current.keys.left = down;
      else if (e.key === 'ArrowRight') game.current.keys.right = down;
      else return;
      // Only swallow the arrow keys while the game has focus/visible
      if (game.current.phase === 'playing') e.preventDefault();
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, []);

  // ── Render + game loop ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = game.current.h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      game.current.w = w;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const hueColor: Record<Capsule['hue'], [string, string]> = {
      gold:   ['#e3c27e', '#f6efda'],
      teal:   ['#5fa8a2', '#9fd6d0'],
      violet: ['#9a6cff', '#c4adff'],
    };

    const drawCapsule = (c: Capsule) => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      const len = c.r * 2.1;
      const rad = c.r * 0.78;
      if (c.kind === 'hazard') {
        ctx.fillStyle = '#e0556b';
        ctx.strokeStyle = 'rgba(255,150,165,0.7)';
      } else {
        const [a, b] = hueColor[c.hue];
        const grad = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
        grad.addColorStop(0, a);
        grad.addColorStop(1, b);
        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      }
      ctx.lineWidth = 1;
      // rounded capsule
      ctx.beginPath();
      ctx.moveTo(-len / 2 + rad, -rad);
      ctx.lineTo(len / 2 - rad, -rad);
      ctx.arc(len / 2 - rad, 0, rad, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-len / 2 + rad, rad);
      ctx.arc(-len / 2 + rad, 0, rad, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // dividing line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.moveTo(0, -rad);
      ctx.lineTo(0, rad);
      ctx.stroke();
      if (c.kind === 'hazard') {
        // little cross mark
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.6;
        const s = c.r * 0.4;
        ctx.beginPath();
        ctx.moveTo(-s, -s); ctx.lineTo(s, s);
        ctx.moveTo(s, -s); ctx.lineTo(-s, s);
        ctx.stroke();
      }
      ctx.restore();
    };

    const loop = (t: number) => {
      const g = game.current;
      if (!g.lastT) g.lastT = t;
      const dt = Math.min(0.05, (t - g.lastT) / 1000);
      g.lastT = t;

      const w = g.w;
      const h = g.h;
      ctx.clearRect(0, 0, w, h);

      // backdrop grid-ish glow
      ctx.fillStyle = 'rgba(227,194,126,0.025)';
      ctx.fillRect(0, 0, w, h);

      const trayW = Math.max(70, w * 0.16);
      const trayH = 12;
      const trayY = h - 26;

      if (g.phase === 'playing') {
        g.elapsed += dt;

        // keyboard steering nudges the target
        const kbSpeed = 1.4 * dt;
        if (g.keys.left) g.trayTargetX -= kbSpeed;
        if (g.keys.right) g.trayTargetX += kbSpeed;
        g.trayTargetX = Math.max(0, Math.min(1, g.trayTargetX));
        // ease tray toward target
        g.trayX += (g.trayTargetX - g.trayX) * Math.min(1, dt * 14);

        // spawn capsules; rate + speed ramp gently with elapsed time
        g.spawnTimer -= dt;
        const spawnEvery = Math.max(0.45, 1.0 - g.elapsed * 0.012);
        if (g.spawnTimer <= 0) {
          g.spawnTimer = spawnEvery;
          const isHazard = Math.random() < 0.22;
          const hues: Capsule['hue'][] = ['gold', 'teal', 'violet'];
          const r = 9 + Math.random() * 3;
          g.capsules.push({
            x: r * 2 + Math.random() * (w - r * 4),
            y: -r,
            vy: 80 + Math.random() * 60 + g.elapsed * 4,
            r,
            kind: isHazard ? 'hazard' : 'good',
            hue: hues[Math.floor(Math.random() * hues.length)],
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 1.5,
          });
        }

        const trayCx = g.trayX * w;
        const trayLeft = trayCx - trayW / 2;
        const trayRight = trayCx + trayW / 2;

        // update + collide
        for (let i = g.capsules.length - 1; i >= 0; i--) {
          const c = g.capsules[i];
          c.y += c.vy * dt;
          c.rot += c.spin * dt;

          // caught?
          if (c.y + c.r >= trayY && c.y - c.r <= trayY + trayH) {
            if (c.x >= trayLeft - c.r && c.x <= trayRight + c.r) {
              g.capsules.splice(i, 1);
              if (c.kind === 'good') {
                g.score += 10;
                setScore(g.score);
              } else {
                g.lives -= 1;
                setLives(g.lives);
                if (g.lives <= 0) { endGame(); }
              }
              continue;
            }
          }
          // off bottom
          if (c.y - c.r > h) {
            g.capsules.splice(i, 1);
          }
        }

        // draw capsules
        for (const c of g.capsules) drawCapsule(c);

        // draw tray
        ctx.fillStyle = 'rgba(227,194,126,0.9)';
        ctx.strokeStyle = 'rgba(246,239,218,0.9)';
        ctx.lineWidth = 1;
        const rr = 6;
        ctx.beginPath();
        ctx.moveTo(trayLeft + rr, trayY);
        ctx.lineTo(trayRight - rr, trayY);
        ctx.arcTo(trayRight, trayY, trayRight, trayY + rr, rr);
        ctx.lineTo(trayRight, trayY + trayH - rr);
        ctx.arcTo(trayRight, trayY + trayH, trayRight - rr, trayY + trayH, rr);
        ctx.lineTo(trayLeft + rr, trayY + trayH);
        ctx.arcTo(trayLeft, trayY + trayH, trayLeft, trayY + trayH - rr, rr);
        ctx.lineTo(trayLeft, trayY + rr);
        ctx.arcTo(trayLeft, trayY, trayLeft + rr, trayY, rr);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // tray glow
        ctx.fillStyle = 'rgba(227,194,126,0.18)';
        ctx.fillRect(trayLeft, trayY + trayH, trayW, 5);
      } else {
        // idle / over: draw a faint resting tray
        const trayCx = 0.5 * w;
        ctx.fillStyle = 'rgba(227,194,126,0.35)';
        ctx.fillRect(trayCx - trayW / 2, trayY, trayW, trayH);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [endGame]);

  // When the brief arrives (active flips false), gently stop play.
  useEffect(() => {
    if (!active && game.current.phase === 'playing') {
      game.current.phase = 'over';
      setPhase('over');
    }
  }, [active]);

  return (
    <div className="w-full max-w-xl mx-auto select-none" ref={wrapRef}>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
          <Sparkles size={12} className="text-amber-300/80" />
          <span className="font-medium text-slate-300">Capsule Catch</span>
          <span className="text-slate-500">— pass the time while the brief generates</span>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-slate-400">Score <span className="text-amber-300 font-semibold tabular-nums">{score}</span></span>
          <span className="flex items-center gap-0.5">
            {[0, 1, 2].map(i => (
              <Heart
                key={i}
                size={12}
                className={i < lives ? 'text-rose-400 fill-rose-400' : 'text-slate-600'}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30">
        <canvas ref={canvasRef} className="block w-full touch-none cursor-pointer" />

        {/* Overlays */}
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-[1px] text-center px-6">
            {phase === 'idle' ? (
              <>
                <p className="text-[14px] text-slate-200 font-medium">Catch the capsules, dodge the red ones</p>
                <p className="text-[12px] text-slate-400 -mt-1">Move with your mouse, finger, or ← → keys</p>
                <button
                  onClick={start}
                  className="mt-1 inline-flex items-center gap-2 bg-amber-500/90 hover:bg-amber-400 text-black text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <Play size={15} /> Play while you wait
                </button>
              </>
            ) : (
              <>
                <p className="text-[14px] text-slate-200 font-medium">
                  {active ? 'Game over' : 'Brief is ready!'}
                </p>
                <p className="text-[13px] text-slate-300">
                  Score <span className="text-amber-300 font-semibold">{score}</span>
                  <span className="text-slate-500 mx-1.5">·</span>
                  Best <span className="text-amber-300 font-semibold">{highScore}</span>
                </p>
                {active && (
                  <button
                    onClick={start}
                    className="mt-1 inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-slate-100 text-[13px] font-medium px-4 py-2 rounded-lg transition-colors border border-white/15"
                  >
                    <RotateCcw size={14} /> Play again
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

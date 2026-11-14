'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Play, RotateCcw, Star, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  LEVEL, TILE, newGame, parseLevel, step,
  type Game, type GameEvent, type Input,
} from '@/lib/break-room/corridor-dash';

// Corridor Dash: the Break Room's quick side-scrolling run. The rules live in lib/break-room/corridor-dash.ts;
// this component reads the keys, runs the loop, and draws the corridor on a canvas in the app's theme colours.

const LEVEL_DATA = parseLevel(LEVEL);
const VIEW_H = LEVEL_DATA.rows * TILE;
const TOTAL_STARS = LEVEL_DATA.stars.length;
const BEST_KEY = 'br-dash-best';

type Phase = 'idle' | 'playing' | 'won' | 'lost';
type Hud = { hearts: number; stars: number; tenths: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
};
const NO_INPUT: Input = { left: false, right: false, jump: false };

const fmt = (seconds: number) => `${seconds.toFixed(1)}s`;

function readBest(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v ? parseInt(v, 10) / 1000 : null;
  } catch {
    return null;
  }
}

// ── Colours ────────────────────────────────────────────────────────────────
// Read from the theme's CSS variables, so the corridor follows light and dark mode.

type Palette = {
  gold: string; goldWarm: string; violet: string; violetLight: string; teal: string; tealLight: string;
  body: string; muted: string; bright: string; light: boolean;
};

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    gold: v('--cc-gold', '#e3c27e'), goldWarm: v('--cc-gold-warm', '#f6efda'),
    violet: v('--cc-violet', '#9a6cff'), violetLight: v('--cc-violet-light', '#b79bff'),
    teal: v('--cc-teal', '#5fa8a2'), tealLight: v('--cc-teal-light', '#6fc4bd'),
    body: v('--cc-body', '#b3bcd4'), muted: v('--cc-muted', '#9aa4be'), bright: v('--cc-bright', '#dfe6f5'),
    light: document.documentElement.classList.contains('light'),
  };
}

/** `#rrggbb` at an alpha. Anything else is returned as it is. */
function alpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : hex;
}

// ── Drawing ────────────────────────────────────────────────────────────────

type Fx = { particles: Particle[]; squash: Map<number, number>; land: number };

function drawScene(ctx: CanvasRenderingContext2D, g: Game, pal: Palette, w: number, time: number, fx: Fx) {
  const { level, player: p } = g;
  const worldW = level.cols * TILE;
  const camX = Math.round(Math.max(0, Math.min(p.x + p.w / 2 - w * 0.4, worldW - w)));
  ctx.clearRect(0, 0, w, VIEW_H);

  // The corridor wall, scrolling at half speed: windows onto the night sky and a handrail.
  ctx.save();
  ctx.translate(-camX * 0.5, 0);
  const span = 320;
  for (let i = Math.floor((camX * 0.5) / span) - 1; i <= Math.ceil((camX * 0.5 + w) / span); i++) {
    const x = i * span + 60;
    ctx.fillStyle = alpha(pal.violet, pal.light ? 0.08 : 0.12);
    ctx.strokeStyle = alpha(pal.gold, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, 70, 120, 90, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = alpha(pal.goldWarm, pal.light ? 0.35 : 0.6);
    for (let s = 0; s < 4; s++) {
      const sx = x + 14 + ((i * 37 + s * 29) % 92);
      const sy = 82 + ((i * 53 + s * 23) % 64);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
  ctx.strokeStyle = alpha(pal.gold, 0.25);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(camX * 0.5 - 10, 236);
  ctx.lineTo(camX * 0.5 + w + 10, 236);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(-camX, 0);
  const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const c1 = Math.min(level.cols - 1, Math.ceil((camX + w) / TILE) + 1);

  // Walls, floors and shelves, with a lit top edge where the player can stand.
  for (let r = 0; r < level.rows; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = level.map[r][c];
      if (ch !== '#' && ch !== '=') continue;
      const x = c * TILE, y = r * TILE;
      const open = r === 0 || (level.map[r - 1][c] !== '#' && level.map[r - 1][c] !== '=');
      if (ch === '#') {
        ctx.fillStyle = alpha(pal.gold, pal.light ? 0.1 : 0.07);
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = alpha(pal.gold, 0.12);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (open) { ctx.fillStyle = alpha(pal.gold, 0.7); ctx.fillRect(x, y, TILE, 2); }
      } else {
        ctx.fillStyle = alpha(pal.violet, pal.light ? 0.18 : 0.28);
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 2, TILE - 2, TILE - 10, 4);
        ctx.fill();
        if (open) { ctx.fillStyle = pal.violetLight; ctx.fillRect(x + 1, y + 2, TILE - 2, 2); }
      }
    }
  }

  // Sharps: three needles to a cell.
  for (const s of level.sharps) {
    if (s.col < c0 || s.col > c1) continue;
    const baseY = (s.row + 1) * TILE;
    for (let k = 0; k < 3; k++) {
      const nx = s.col * TILE + 7 + k * 9;
      ctx.fillStyle = pal.muted;
      ctx.fillRect(nx - 2, baseY - 6, 5, 6);
      ctx.fillStyle = pal.bright;
      ctx.beginPath();
      ctx.moveTo(nx - 1, baseY - 6);
      ctx.lineTo(nx + 0.5, baseY - 17);
      ctx.lineTo(nx + 2, baseY - 6);
      ctx.fill();
    }
  }

  // Checkpoints: a hand-sanitizer station that lights up once touched.
  level.checkpoints.forEach((c, i) => {
    if (c.col < c0 || c.col > c1) return;
    const x = c.col * TILE + 9, base = (c.row + 1) * TILE;
    const lit = g.reached[i];
    ctx.fillStyle = alpha(pal.teal, lit ? 0.9 : 0.45);
    ctx.beginPath();
    ctx.roundRect(x, base - 20, 14, 20, 3);
    ctx.fill();
    ctx.fillRect(x + 5, base - 26, 4, 6);
    ctx.fillRect(x + 5, base - 26, 9, 2);
    if (lit) {
      ctx.fillStyle = alpha(pal.tealLight, 0.25 + 0.15 * Math.sin(time * 4));
      ctx.beginPath();
      ctx.arc(x + 7, base - 12, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // The exit door, with its sign.
  {
    const d = level.door;
    const x = d.col * TILE + 2, top = (d.row - 1) * TILE + 4, h = 2 * TILE - 4;
    ctx.fillStyle = alpha(pal.teal, 0.28);
    ctx.strokeStyle = pal.tealLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, top, TILE - 4, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.goldWarm;
    ctx.beginPath();
    ctx.arc(x + TILE - 11, top + h / 2 + 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.tealLight;
    ctx.fillText('EXIT', x + (TILE - 4) / 2, top - 8);
  }

  // Stars, bobbing and turning.
  for (const s of g.stars) {
    if (s.taken || s.col < c0 || s.col > c1) continue;
    const cx = s.col * TILE + TILE / 2;
    const cy = s.row * TILE + TILE / 2 + Math.sin(time * 3 + s.col) * 3;
    drawStar(ctx, cx, cy, 9, 4, time * 1.5 + s.col, pal.gold);
  }

  // Germs, and the squash of a stomped one.
  g.germs.forEach((germ, i) => {
    const sq = fx.squash.get(i);
    if (!germ.alive && (sq === undefined || sq > 0.35)) return;
    const cx = germ.x + germ.w / 2, base = germ.y + germ.h;
    const flat = sq === undefined ? 1 : Math.max(0.2, 1 - sq * 3);
    const r = 11;
    const green = pal.light ? '#5e7f1c' : '#a3c95a';
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(1 + (1 - flat) * 0.6, flat);
    ctx.globalAlpha = sq === undefined ? 1 : Math.max(0, 1 - sq * 2.5);
    const wobble = Math.sin(time * 8 + i) * 1.2;
    ctx.fillStyle = green;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + time * 0.8;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (r + 2), -r + Math.sin(a) * (r + 2), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, -r, r + wobble * 0.3, r - wobble * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    const look = germ.vx < 0 ? -2.5 : 2.5;
    ctx.fillStyle = pal.light ? '#fffdf5' : '#0b0d18';
    ctx.beginPath(); ctx.arc(-4 + look, -r - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4 + look, -r - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // The capsule: gold over violet, eyes toward where it's heading, stretched in a jump, squashed on landing.
  {
    const blink = p.grace > 0 && Math.floor(time * 12) % 2 === 0;
    if (!blink) {
      const stretch = p.onGround ? 1 - fx.land * 1.2 : p.vy < 0 ? 1.08 : 1;
      const bob = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(time * 22) * 1 : 0;
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h + bob);
      ctx.scale(2 - stretch, stretch);
      ctx.beginPath();
      ctx.roundRect(-p.w / 2, -p.h, p.w, p.h, p.w / 2);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = pal.gold;
      ctx.fillRect(-p.w / 2, -p.h, p.w, p.h / 2);
      ctx.fillStyle = pal.violet;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-p.w / 2 + 4, -p.h + 5, 3, p.h - 10);
      ctx.restore();
      ctx.strokeStyle = alpha(pal.goldWarm, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#0b0d18';
      const look = p.facing * 3;
      ctx.beginPath(); ctx.arc(-3.5 + look, -p.h + 10, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5 + look, -p.h + 10, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  for (const pt of fx.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, turn: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.cos(turn) * 0.35 + 0.65, 1);
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function burst(list: Particle[], x: number, y: number, n: number, color: string, speed: number, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    const life = 0.35 + Math.random() * 0.25;
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life, max: life, color, size });
  }
}

// ── The game ───────────────────────────────────────────────────────────────

export function CorridorDash() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(newGame(LEVEL_DATA));
  const inputRef = useRef<Input>(NO_INPUT);
  const phaseRef = useRef<Phase>('idle');
  const [phase, setPhase] = useState<Phase>('idle');
  const [hud, setHud] = useState<Hud>({ hearts: 3, stars: 0, tenths: 0 });
  const [best, setBest] = useState<number | null>(readBest);
  const [newBest, setNewBest] = useState(false);

  const start = useCallback(() => {
    gameRef.current = newGame(LEVEL_DATA);
    inputRef.current = NO_INPUT;
    phaseRef.current = 'playing';
    setPhase('playing');
    setHud({ hearts: 3, stars: 0, tenths: 0 });
    setNewBest(false);
  }, []);

  const finish = useCallback((result: 'won' | 'lost') => {
    const g = gameRef.current;
    phaseRef.current = result;
    setPhase(result);
    setHud({ hearts: g.hearts, stars: g.starsTaken, tenths: Math.floor(g.time * 10) });
    if (result !== 'won') return;
    const previous = readBest();
    if (previous === null || g.time < previous) {
      try { localStorage.setItem(BEST_KEY, String(Math.round(g.time * 1000))); } catch {}
      setBest(g.time);
      setNewBest(true);
    }
  }, []);

  // Keys: arrows or A/D to move, Space, W or ↑ to jump. While a run is on, they don't scroll the page.
  // Between runs, Enter or Space starts one. Shortcuts with ⌘, Ctrl or Alt, and typing in a field, pass through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const key = KEYS[e.code];
      if (phaseRef.current === 'playing') {
        if (!key) return;
        e.preventDefault();
        inputRef.current = { ...inputRef.current, [key]: e.type === 'keydown' };
      } else if (e.type === 'keydown' && (e.code === 'Enter' || e.code === 'Space') && el?.tagName !== 'BUTTON') {
        e.preventDefault();
        start();
      }
    };
    const release = () => { inputRef.current = NO_INPUT; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', release);
    };
  }, [start]);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, last = 0, width = 600, dpr = 1;
    let palette = readPalette();
    let seen: Game | null = null;
    let hudKey = '';
    const fx: Fx = { particles: [], squash: new Map(), land: 0 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = wrap.clientWidth;
      canvas.width = width * dpr;
      canvas.height = VIEW_H * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${VIEW_H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const mo = new MutationObserver(() => { palette = readPalette(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const react = (e: GameEvent, g: Game) => {
      const p = g.player;
      const feetX = p.x + p.w / 2, feetY = p.y + p.h;
      if (e === 'jump' || e === 'land') burst(fx.particles, feetX, feetY, 6, alpha(palette.body, 0.7), 60, 2);
      if (e === 'land') fx.land = 0.1;
      if (e === 'star') burst(fx.particles, feetX, p.y, 12, palette.gold, 140);
      if (e === 'checkpoint') burst(fx.particles, feetX, p.y, 14, palette.tealLight, 120);
      if (e === 'hurt') burst(fx.particles, feetX, p.y + p.h / 2, 10, '#f87171', 150);
      if (e === 'stomp') {
        g.germs.forEach((germ, i) => { if (!germ.alive && !fx.squash.has(i)) fx.squash.set(i, 0); });
        burst(fx.particles, feetX, feetY, 10, palette.light ? '#5e7f1c' : '#a3c95a', 130);
      }
    };

    const loop = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const g = gameRef.current;
      if (g !== seen) { seen = g; fx.particles.length = 0; fx.squash.clear(); fx.land = 0; }
      if (phaseRef.current === 'playing') {
        for (const e of step(g, inputRef.current, dt)) react(e, g);
        const key = `${g.hearts}|${g.starsTaken}|${Math.floor(g.time * 10)}`;
        if (key !== hudKey) {
          hudKey = key;
          setHud({ hearts: g.hearts, stars: g.starsTaken, tenths: Math.floor(g.time * 10) });
        }
        if (g.status !== 'playing') finish(g.status);
      }
      for (let i = fx.particles.length - 1; i >= 0; i--) {
        const pt = fx.particles[i];
        pt.life -= dt;
        if (pt.life <= 0) { fx.particles.splice(i, 1); continue; }
        pt.vy += 500 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
      for (const [i, s] of fx.squash) fx.squash.set(i, s + dt);
      fx.land = Math.max(0, fx.land - dt);
      drawScene(ctx, g, palette, width, t / 1000, fx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); };
  }, [finish]);

  const time = hud.tenths / 10;
  return (
    <div className="flex flex-col items-center" ref={wrapRef}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--cc-gold-warm)' }}>Corridor Dash</h3>
      <div className="flex items-center gap-4 text-[13px] text-slate-400 mb-4">
        <span className="flex items-center gap-0.5" aria-label={`${hud.hearts} hearts left`}>
          {[0, 1, 2].map(i => (
            <Heart
              key={i}
              size={14}
              aria-hidden="true"
              style={{ color: 'var(--cc-gold)', fill: i < hud.hearts ? 'var(--cc-gold)' : 'transparent' }}
            />
          ))}
        </span>
        <span className="flex items-center gap-1">
          <Star size={13} aria-hidden="true" style={{ color: 'var(--cc-gold)' }} />
          <span className="tabular-nums text-slate-300">{hud.stars}/{TOTAL_STARS}</span>
        </span>
        <span>Time: <span className="tabular-nums text-slate-300">{fmt(time)}</span></span>
        <span className="flex items-center gap-1">
          <Trophy size={13} aria-hidden="true" style={{ color: 'var(--cc-gold)' }} />
          <span className="tabular-nums text-slate-300">{best === null ? '—' : fmt(best)}</span>
        </span>
      </div>

      <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black/20">
        <canvas
          ref={canvasRef}
          className="block w-full select-none"
          role="img"
          aria-label="Corridor Dash: a capsule runs a hospital corridor to the exit door"
        />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[1px] text-center px-6">
            {phase === 'idle' && (
              <>
                <p className="text-[15px] text-slate-200 font-medium">Run the corridor to the exit</p>
                <p className="text-[13px] text-slate-300 max-w-md">
                  Stomp the germs, jump the sharps and the gaps, and grab the stars. Three hearts; touch a sanitizer
                  station to restart there after a fall.
                </p>
                <p className="text-[13px] text-slate-400">← → or A D to move · Space, ↑ or W to jump</p>
                <Button variant="primary" onClick={start} className="mt-1">
                  <Play size={15} /> Start
                </Button>
              </>
            )}
            {phase === 'won' && (
              <>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--cc-gold-warm)' }}>
                  Made it in {fmt(time)}{newBest ? ' — a new best!' : ''}
                </p>
                <p className="text-[13px] text-slate-300">
                  Stars: <span className="font-semibold" style={{ color: 'var(--cc-gold)' }}>{hud.stars}/{TOTAL_STARS}</span>
                  {best !== null && !newBest && <> · Best: <span className="font-semibold" style={{ color: 'var(--cc-gold)' }}>{fmt(best)}</span></>}
                </p>
                <Button variant="primary" onClick={start} className="mt-1">
                  <RotateCcw size={14} /> Again
                </Button>
              </>
            )}
            {phase === 'lost' && (
              <>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--cc-gold-warm)' }}>Out of hearts</p>
                <p className="text-[13px] text-slate-300">
                  You got <span className="font-semibold" style={{ color: 'var(--cc-gold)' }}>{hud.stars}/{TOTAL_STARS}</span> stars in {fmt(time)}.
                </p>
                <Button variant="primary" onClick={start} className="mt-1">
                  <RotateCcw size={14} /> Again
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

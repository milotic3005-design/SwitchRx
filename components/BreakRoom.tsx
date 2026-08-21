"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Wind, Zap, Sparkles, ArrowLeft, Play, RotateCcw, Trophy, Target,
  Heart, Coffee, Spade,
} from 'lucide-react';

/**
 * The Break Room — a small arcade of quick, self-contained destress games for
 * healthcare staff to reset between cases. Each is a ~30–90s session:
 *   • Pulse          — precision-timing "perfect hit" combo game. Built on the
 *                      dopamine-reward loop: anticipation (the closing ring),
 *                      reward-prediction-error (unpredictable 2x golden pulses),
 *                      and escalating combos. Skill-based, not gambling.
 *   • Box Breathing  — guided 4-4-4-4 breathing (calming, clinically used)
 *   • Reflex Test    — tap-when-green reaction timer
 *   • Pill Pop       — 30-second tap-to-pop stress reliever (canvas)
 *   • Solitaire      — Klondike, click-to-move. The long game of the set: no
 *                      timer pressure, undo, and an auto-finish payoff.
 * Everything is local, themed to the Celestial Codex aesthetic, and light/dark
 * aware via the app's CSS variables. High scores persist in localStorage.
 */

type GameId = 'menu' | 'pulse' | 'breathing' | 'reflex' | 'pop' | 'solitaire';

const GAMES: Array<{
  id: GameId; title: string; blurb: string; tag: string; Icon: any; accent: string;
}> = [
  { id: 'pulse', title: 'Pulse', blurb: 'Tap the instant the ring snaps to the mark. Chain perfect beats and chase the golden pulse.', tag: '45 sec', Icon: Target, accent: 'var(--cc-gold)' },
  { id: 'breathing', title: 'Box Breathing', blurb: 'Guided 4-4-4-4 breaths to slow the heart rate and reset focus.', tag: '60 sec', Icon: Wind, accent: 'var(--cc-teal)' },
  { id: 'reflex', title: 'Reflex Test', blurb: 'Tap the instant it turns green. Chase your fastest reaction time.', tag: '20 sec', Icon: Zap, accent: 'var(--cc-gold)' },
{ id: 'pop', title: 'Pill Pop', blurb: 'Pop the rising capsules for 30 seconds. Pure, satisfying catharsis.', tag: '30 sec', Icon: Sparkles, accent: 'var(--cc-gold)' },
  { id: 'solitaire', title: 'Solitaire', blurb: 'Klondike, tap to move. No clock pressure — undo freely and let it auto-finish.', tag: 'Unhurried', Icon: Spade, accent: 'var(--cc-violet-light)' },
];

export function BreakRoom() {
  const [game, setGame] = useState<GameId>('menu');
  const back = useCallback(() => setGame('menu'), []);

  return (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <div className="cc-eyebrow mb-3">Recharge</div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--cc-gold-warm)' }}>
          <Coffee size={28} className="text-slate-400" strokeWidth={1.5} />
          The Break Room
        </h1>
        <p className="text-[15px] text-slate-400 mt-3">
          A 60-second reset between cases. Step away, breathe, play — then back to it.
        </p>
      </div>

      {game === 'menu' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAMES.map(g => (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className="glass-card text-left p-5 flex items-start gap-4 hover:bg-white/5 transition-all group"
            >
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border"
                style={{ background: 'rgba(227,194,126,0.08)', borderColor: 'var(--cc-hairline)' }}
              >
                <g.Icon size={22} strokeWidth={1.6} style={{ color: g.accent }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-semibold" style={{ color: 'var(--cc-gold-warm)' }}>{g.title}</h3>
                  <span className="cc-eyebrow" style={{ fontSize: 9, letterSpacing: 2, color: 'var(--cc-faint)' }}>{g.tag}</span>
                </div>
                <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">{g.blurb}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-5 sm:p-6">
          <button
            onClick={back}
            className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-slate-200 transition-colors mb-4"
          >
            <ArrowLeft size={15} /> All games
          </button>
          {game === 'pulse' && <PulseGame />}
          {game === 'breathing' && <BoxBreathing />}
          {game === 'reflex' && <ReflexTest />}
{game === 'pop' && <PillPop />}
          {game === 'solitaire' && <Solitaire />}
        </div>
      )}

      <p className="text-[11px] text-slate-500 text-center mt-6 italic">
        For a quick mental reset only — not a substitute for real rest or breaks.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Pulse — precision-timing combo game (the dopamine-reward loop)
//
// Design grounded in reward-prediction-error research: a ring contracts toward
// a fixed mark (ANTICIPATION); the player taps at the perfect instant (RELEASE);
// perfect hits CHAIN into an escalating combo multiplier; and an unpredictable
// ~18% "golden" pulse pays 2x (REWARD PREDICTION ERROR — the surprise bonus is
// what spikes dopamine hardest). Skill-based, not gambling: agency drives every
// point. Three misses ends the run.
// ─────────────────────────────────────────────────────────────────────────
const PULSE_HS = 'br-pulse-best';
function PulseGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [best, setBest] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);

  // Geometry (logical px): ring shrinks from R0 to 0; the mark sits at RT.
  const R0 = 140, RT = 50, PERFECT = 8, GOOD = 22;

  const g = useRef({
    phase: 'idle' as 'idle' | 'playing' | 'over',
    ringActive: false,
    ringR: R0,
    elapsed: 0,
    dur: 1.5,
    golden: false,
    score: 0, combo: 0, misses: 0, bestCombo: 0,
    nextDelay: 0,
    bursts: [] as Array<{ x: number; y: number; r: number; max: number; life: number; hue: string }>,
    flash: null as null | { text: string; sub: string; life: number; color: string },
    w: 600, h: 360,
  });

  useEffect(() => {
    try {
      const b = localStorage.getItem(PULSE_HS); if (b) setBest(parseInt(b, 10));
      const bc = localStorage.getItem(PULSE_HS + '-combo'); if (bc) setBestCombo(parseInt(bc, 10));
    } catch {}
  }, []);

  const start = useCallback(() => {
    const s = g.current;
    s.phase = 'playing'; s.ringActive = false; s.ringR = R0; s.elapsed = 0;
    s.dur = 1.5; s.golden = false; s.score = 0; s.combo = 0; s.misses = 0;
    s.bestCombo = 0; s.nextDelay = 0.5; s.bursts = []; s.flash = null;
    setScore(0); setCombo(0); setMisses(0); setPhase('playing');
  }, []);

  const endGame = useCallback(() => {
    const s = g.current;
    s.phase = 'over'; setPhase('over');
    setBest(prev => { const nb = Math.max(prev, s.score); try { localStorage.setItem(PULSE_HS, String(nb)); } catch {} return nb; });
    setBestCombo(prev => { const nb = Math.max(prev, s.bestCombo); try { localStorage.setItem(PULSE_HS + '-combo', String(nb)); } catch {} return nb; });
  }, []);

  const resolve = useCallback((result: 'perfect' | 'good' | 'miss', cx: number, cy: number) => {
    const s = g.current;
    const mult = s.golden ? 2 : 1;
    if (result === 'perfect') {
      s.combo += 1;
      const pts = Math.round((100 + (s.combo - 1) * 25) * mult);
      s.score += pts;
      s.flash = { text: s.golden ? `GOLDEN! +${pts}` : `PERFECT +${pts}`, sub: s.combo > 1 ? `${s.combo}x combo` : '', life: 0, color: s.golden ? '#f6d680' : '#e3c27e' };
      for (let i = 0; i < 2; i++) s.bursts.push({ x: cx, y: cy, r: RT - 6 + i * 8, max: 110 + i * 30, life: 0, hue: s.golden ? '246,214,128' : '227,194,126' });
    } else if (result === 'good') {
      s.combo += 1;
      const pts = Math.round(40 * mult);
      s.score += pts;
      s.flash = { text: `GOOD +${pts}`, sub: '', life: 0, color: '#5fa8a2' };
      s.bursts.push({ x: cx, y: cy, r: RT, max: 90, life: 0, hue: '95,168,162' });
    } else {
      s.misses += 1; s.combo = 0;
      s.flash = { text: 'MISS', sub: `${3 - s.misses} left`, life: 0, color: '#9aa4be' };
    }
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    setScore(s.score); setCombo(s.combo); setMisses(s.misses);
    s.ringActive = false; s.golden = false; s.nextDelay = 0.32;
    // difficulty ramps gently with score
    s.dur = Math.max(0.78, 1.5 - s.score * 0.00035);
    if (s.misses >= 3) endGame();
  }, [endGame]);

  // render + loop
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), last = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth, h = g.current.h;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.current.w = w;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    const loop = (t: number) => {
      const s = g.current;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const w = s.w, h = s.h, cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      if (s.phase === 'playing') {
        if (s.ringActive) {
          s.elapsed += dt;
          s.ringR = R0 * (1 - s.elapsed / s.dur);
          if (s.ringR <= RT - GOOD) resolve('miss', cx, cy); // passed the mark untapped
        } else {
          s.nextDelay -= dt;
          if (s.nextDelay <= 0) {
            s.ringActive = true; s.elapsed = 0; s.ringR = R0;
            s.golden = Math.random() < 0.18;
          }
        }
      }

      // bursts
      for (let i = s.bursts.length - 1; i >= 0; i--) {
        const b = s.bursts[i]; b.life += dt * 2.2;
        if (b.life >= 1) s.bursts.splice(i, 1);
      }
      if (s.flash) { s.flash.life += dt; if (s.flash.life > 0.9) s.flash = null; }

      // ── draw mark (target) ──
      ctx.beginPath(); ctx.arc(cx, cy, RT, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(227,194,126,0.55)'; ctx.lineWidth = 2; ctx.stroke();
      // perfect-zone hint
      ctx.beginPath(); ctx.arc(cx, cy, RT, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(227,194,126,0.12)'; ctx.lineWidth = PERFECT * 2; ctx.stroke();
      // center dot
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(227,194,126,0.7)'; ctx.fill();

      // ── draw shrinking ring ──
      if (s.phase === 'playing' && s.ringActive && s.ringR > 0) {
        const near = Math.abs(s.ringR - RT) < GOOD;
        const hue = s.golden ? '246,214,128' : '154,108,255';
        ctx.beginPath(); ctx.arc(cx, cy, s.ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${hue},${near ? 1 : 0.8})`;
        ctx.lineWidth = s.golden ? 5 : 4;
        if (near) { ctx.shadowColor = `rgba(${hue},0.9)`; ctx.shadowBlur = 18; }
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      // ── bursts (expanding rings) ──
      for (const b of s.bursts) {
        const r = b.r + (b.max - b.r) * b.life;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${b.hue},${(1 - b.life) * 0.7})`;
        ctx.lineWidth = 3 * (1 - b.life) + 0.5; ctx.stroke();
      }

      // ── combo (big, faint, center) ──
      if (s.phase === 'playing' && s.combo >= 2) {
        ctx.globalAlpha = 0.16; ctx.fillStyle = '#e3c27e';
        ctx.font = '700 64px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${s.combo}x`, cx, cy); ctx.globalAlpha = 1;
      }

      // ── flash text ──
      if (s.flash) {
        const a = Math.max(0, 1 - s.flash.life / 0.9);
        const yOff = -RT - 26 - s.flash.life * 18;
        ctx.globalAlpha = a; ctx.fillStyle = s.flash.color;
        ctx.font = '600 22px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.flash.text, cx, cy + yOff);
        if (s.flash.sub) { ctx.font = '500 13px sans-serif'; ctx.fillStyle = 'rgba(180,190,210,1)'; ctx.fillText(s.flash.sub, cx, cy + yOff + 20); }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [resolve]);

  const onTap = () => {
    const s = g.current;
    if (s.phase !== 'playing' || !s.ringActive) return;
    const cx = s.w / 2, cy = s.h / 2;
    const diff = Math.abs(s.ringR - RT);
    if (diff <= PERFECT) resolve('perfect', cx, cy);
    else if (diff <= GOOD) resolve('good', cx, cy);
    else resolve('miss', cx, cy);
  };

  return (
    <div className="flex flex-col items-center" ref={wrapRef}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--cc-gold-warm)' }}>Pulse</h3>
      <div className="flex items-center gap-4 text-[12px] text-slate-400 mb-4">
        <span>Score: <span className="tabular-nums text-amber-300 font-semibold">{score}</span></span>
        <span>Combo: <span className="tabular-nums text-slate-300">{combo}x</span></span>
        <span className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <Heart key={i} size={11} className={i < 3 - misses ? 'text-rose-400 fill-rose-400' : 'text-slate-600'} />
          ))}
        </span>
        <span className="flex items-center gap-1"><Trophy size={12} className="text-amber-300/80" /> <span className="tabular-nums text-slate-300">{best}</span></span>
      </div>

      <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black/20">
        <canvas ref={canvasRef} className="block w-full touch-none cursor-pointer select-none" onPointerDown={onTap} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[1px] text-center px-6">
            {phase === 'idle' ? (
              <>
                <p className="text-[14px] text-slate-200 font-medium">Tap when the ring meets the mark</p>
                <p className="text-[12px] text-slate-400 -mt-1">Nail it perfectly to build your combo. Gold rings pay double. 3 misses ends it.</p>
                <button onClick={start} className="btn-premium px-6 py-2.5 rounded-full inline-flex items-center gap-2 mt-1">
                  <Play size={15} /> Start
                </button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--cc-gold-warm)' }}>Score {score}</p>
                <p className="text-[12px] text-slate-300">Best combo this run: <span className="text-amber-300 font-semibold">{g.current.bestCombo}x</span> · Best score: <span className="text-amber-300 font-semibold">{best}</span></p>
                <button onClick={start} className="btn-premium px-5 py-2 rounded-full inline-flex items-center gap-2 mt-1">
                  <RotateCcw size={14} /> Again
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">Best combo ever: <span className="tabular-nums text-slate-300">{bestCombo}x</span></p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Box Breathing
// ─────────────────────────────────────────────────────────────────────────
function BoxBreathing() {
  const PHASES = useMemo(
    () => [
      { name: 'Breathe In', dur: 4 },
      { name: 'Hold', dur: 4 },
      { name: 'Breathe Out', dur: 4 },
      { name: 'Hold', dur: 4 },
    ],
    [],
  );
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(4);
  const [cycles, setCycles] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let secs = PHASES[phaseRef.current].dur;
    setCount(secs);
    const id = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        phaseRef.current = (phaseRef.current + 1) % PHASES.length;
        if (phaseRef.current === 0) setCycles(c => c + 1);
        setPhase(phaseRef.current);
        secs = PHASES[phaseRef.current].dur;
      }
      setCount(secs);
    }, 1000);
    return () => clearInterval(id);
  }, [running, PHASES]);

  const start = () => { phaseRef.current = 0; setPhase(0); setCount(4); setCycles(0); setRunning(true); };
  const stop = () => setRunning(false);

  // Big after inhale (phase 0) through the first hold (phase 1); small otherwise.
  const big = running && (phase === 0 || phase === 1);
  const scale = big ? 1 : 0.5;
  // Animate only during the in/out phases; holds snap.
  const transition = running && (phase === 0 || phase === 2) ? 'transform 4s linear' : 'transform 0.3s ease';

  return (
    <div className="flex flex-col items-center text-center">
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--cc-gold-warm)' }}>Box Breathing</h3>
      <p className="text-[12px] text-slate-400 mb-6">Follow the circle. In for 4, hold 4, out for 4, hold 4.</p>

      <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
        {/* outer guide ring */}
        <div className="absolute rounded-full" style={{ width: 240, height: 240, border: '1px solid var(--cc-hairline)' }} />
        {/* breathing orb */}
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 200, height: 200,
            transform: `scale(${scale})`,
            transition,
            background: 'radial-gradient(circle at 50% 40%, rgba(95,168,162,0.35), rgba(154,108,255,0.18))',
            border: '1px solid rgba(95,168,162,0.5)',
            boxShadow: '0 0 40px rgba(95,168,162,0.25)',
          }}
        >
          <div>
            <div className="text-[18px] font-medium" style={{ color: 'var(--cc-gold-warm)', fontFamily: 'var(--font-heading)' }}>
              {running ? PHASES[phase].name : 'Ready'}
            </div>
            {running && <div className="text-[28px] tabular-nums mt-1" style={{ color: 'var(--cc-gold)' }}>{count}</div>}
          </div>
        </div>
      </div>

      <div className="mt-7 flex items-center gap-3">
        {!running ? (
          <button onClick={start} className="btn-premium px-6 py-2.5 rounded-full inline-flex items-center gap-2">
            <Play size={15} /> Begin
          </button>
        ) : (
          <button onClick={stop} className="glass-card px-6 py-2.5 rounded-full inline-flex items-center gap-2 border border-white/10 text-slate-200 hover:bg-white/5">
            Finish
          </button>
        )}
      </div>
      <p className="text-[12px] text-slate-500 mt-4">Completed breaths: <span className="text-slate-300 tabular-nums">{cycles}</span></p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reflex Test
// ─────────────────────────────────────────────────────────────────────────
type ReflexState = 'idle' | 'waiting' | 'go' | 'result' | 'early';
function ReflexTest() {
  const [state, setState] = useState<ReflexState>('idle');
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    try { const b = localStorage.getItem('br-reflex-best'); if (b) setBest(parseInt(b, 10)); } catch {}
  }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const arm = () => {
    setState('waiting');
    const delay = 1500 + Math.random() * 3000;
    timerRef.current = window.setTimeout(() => {
      startRef.current = performance.now();
      setState('go');
    }, delay);
  };

  const handle = () => {
    if (state === 'idle' || state === 'result' || state === 'early') { arm(); return; }
    if (state === 'waiting') { if (timerRef.current) clearTimeout(timerRef.current); setState('early'); return; }
    if (state === 'go') {
      const t = Math.round(performance.now() - startRef.current);
      setMs(t);
      setBest(prev => {
        const nb = prev == null ? t : Math.min(prev, t);
        try { localStorage.setItem('br-reflex-best', String(nb)); } catch {}
        return nb;
      });
      setState('result');
    }
  };

  const panel = {
    idle:    { bg: 'rgba(154,108,255,0.12)', border: 'rgba(154,108,255,0.4)', title: 'Reflex Test', sub: 'Tap to start, then tap the moment it turns green.' },
    waiting: { bg: 'rgba(154,108,255,0.14)', border: 'rgba(154,108,255,0.45)', title: 'Wait for it…', sub: 'Tap as soon as it turns green.' },
    go:      { bg: 'rgba(95,168,162,0.30)',  border: 'rgba(95,168,162,0.8)',  title: 'TAP!', sub: '' },
    result:  { bg: 'rgba(227,194,126,0.12)', border: 'rgba(227,194,126,0.45)', title: `${ms} ms`, sub: 'Tap to try again.' },
    early:   { bg: 'rgba(120,130,160,0.15)', border: 'var(--cc-hairline)', title: 'Too soon!', sub: 'Wait for green. Tap to retry.' },
  }[state];

  const rate = ms > 0 ? (ms < 250 ? 'Lightning reflexes' : ms < 350 ? 'Sharp' : ms < 500 ? 'Solid' : 'Take a breath, try again') : '';

  return (
    <div className="flex flex-col items-center text-center">
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--cc-gold-warm)' }}>Reflex Test</h3>
      <p className="text-[12px] text-slate-400 mb-5 flex items-center gap-1.5">
        <Trophy size={12} className="text-amber-300/80" /> Best: <span className="tabular-nums text-slate-300">{best != null ? `${best} ms` : '—'}</span>
      </p>
      <button
        onClick={handle}
        className="w-full rounded-2xl flex flex-col items-center justify-center transition-colors duration-150 select-none"
        style={{ height: 260, background: panel.bg, border: `1px solid ${panel.border}` }}
      >
        <div className="text-[26px] font-semibold tabular-nums" style={{ color: 'var(--cc-gold-warm)', fontFamily: 'var(--font-heading)' }}>
          {panel.title}
        </div>
        {panel.sub && <div className="text-[13px] text-slate-300/90 mt-2 px-6">{panel.sub}</div>}
        {state === 'result' && rate && <div className="text-[12px] mt-2" style={{ color: 'var(--cc-teal-light)' }}>{rate}</div>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Pill Pop (canvas)
// ─────────────────────────────────────────────────────────────────────────
type Bubble = { x: number; y: number; r: number; vy: number; drift: number; hue: string; phase: number; pop: number };
const POP_HS = 'br-pop-best';

function PillPop() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [best, setBest] = useState(0);

  const state = useRef({
    phase: 'idle' as 'idle' | 'playing' | 'over',
    bubbles: [] as Bubble[],
    score: 0,
    spawn: 0,
    w: 600, h: 360,
  });

  useEffect(() => {
    try { const b = localStorage.getItem(POP_HS); if (b) setBest(parseInt(b, 10)); } catch {}
  }, []);

  const start = useCallback(() => {
    const s = state.current;
    s.phase = 'playing'; s.bubbles = []; s.score = 0; s.spawn = 0;
    setScore(0); setTime(30); setPhase('playing');
  }, []);

  // countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      setTime(t => {
        if (t <= 1) {
          clearInterval(id);
          state.current.phase = 'over';
          setPhase('over');
          setBest(prev => {
            const nb = Math.max(prev, state.current.score);
            try { localStorage.setItem(POP_HS, String(nb)); } catch {}
            return nb;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // render + game loop
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), last = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth, h = state.current.h;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.current.w = w;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const hues = ['227,194,126', '95,168,162', '154,108,255'];

    const loop = (t: number) => {
      const s = state.current;
      if (!last) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const w = s.w, h = s.h;
      ctx.clearRect(0, 0, w, h);

      if (s.phase === 'playing') {
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.spawn = 0.42 + Math.random() * 0.35;
          const r = 16 + Math.random() * 14;
          s.bubbles.push({
            x: r + Math.random() * (w - r * 2),
            y: h + r,
            r,
            vy: 45 + Math.random() * 45,
            drift: (Math.random() - 0.5) * 20,
            hue: hues[Math.floor(Math.random() * hues.length)],
            phase: Math.random() * Math.PI * 2,
            pop: 0,
          });
        }
        for (let i = s.bubbles.length - 1; i >= 0; i--) {
          const b = s.bubbles[i];
          if (b.pop > 0) { b.pop += dt * 4; if (b.pop > 1) s.bubbles.splice(i, 1); continue; }
          b.y -= b.vy * dt;
          b.x += Math.sin(t * 0.001 + b.phase) * b.drift * dt;
          if (b.y + b.r < -10) s.bubbles.splice(i, 1);
        }
      }

      for (const b of s.bubbles) {
        const popping = b.pop > 0;
        const rr = popping ? b.r * (1 + b.pop * 0.6) : b.r;
        const a = popping ? Math.max(0, 1 - b.pop) : 0.9;
        // capsule body
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.globalAlpha = a;
        const grad = ctx.createRadialGradient(-rr * 0.3, -rr * 0.3, rr * 0.2, 0, 0, rr);
        grad.addColorStop(0, `rgba(${b.hue},0.95)`);
        grad.addColorStop(1, `rgba(${b.hue},0.55)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${0.4 * a})`;
        ctx.lineWidth = 1; ctx.stroke();
        // highlight
        if (!popping) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath(); ctx.arc(-rr * 0.32, -rr * 0.32, rr * 0.22, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const onPop = (e: React.PointerEvent) => {
    const s = state.current;
    if (s.phase !== 'playing') return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    // pop the topmost bubble under the pointer
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i];
      if (b.pop > 0) continue;
      if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + 6) ** 2) {
        b.pop = 0.001;
        s.score += 1;
        setScore(s.score);
        return;
      }
    }
  };

  return (
    <div className="flex flex-col items-center" ref={wrapRef}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--cc-gold-warm)' }}>Pill Pop</h3>
      <div className="flex items-center gap-4 text-[12px] text-slate-400 mb-4">
        <span>Score: <span className="tabular-nums text-amber-300 font-semibold">{score}</span></span>
        <span>Time: <span className="tabular-nums text-slate-300">{time}s</span></span>
        <span className="flex items-center gap-1"><Trophy size={12} className="text-amber-300/80" /> <span className="tabular-nums text-slate-300">{best}</span></span>
      </div>

      <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black/20">
        <canvas ref={canvasRef} className="block w-full touch-none cursor-pointer" onPointerDown={onPop} />
        {phase !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[1px] text-center px-6">
            {phase === 'idle' ? (
              <>
                <p className="text-[14px] text-slate-200 font-medium">Pop as many capsules as you can in 30 seconds</p>
                <button onClick={start} className="btn-premium px-6 py-2.5 rounded-full inline-flex items-center gap-2">
                  <Play size={15} /> Start
                </button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--cc-gold-warm)' }}>Time! You popped {score}.</p>
                <p className="text-[12px] text-slate-300">Best: <span className="text-amber-300 font-semibold">{best}</span></p>
                <button onClick={start} className="btn-premium px-5 py-2 rounded-full inline-flex items-center gap-2 mt-1">
                  <RotateCcw size={14} /> Again
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Solitaire (Klondike)
//
// Click-to-move rather than drag-and-drop. Dragging is fiddly on a phone and on
// a trackpad, and the point of this tab is a low-friction reset — so: click a
// card to pick it up (with every card stacked below it), click a destination to
// drop it. Clicking an already-picked card sends it to a foundation if it will
// go, which makes the most common move a single extra tap.
//
// Board geometry hangs off one CSS variable (--cw). Every width, height and
// stack offset is a calc() from it, so the board scales from a 360px phone to
// the desktop panel with no resize listener and no layout measurement.
// ─────────────────────────────────────────────────────────────────────────
type Suit = 'S' | 'H' | 'D' | 'C';
export type SCard = { id: string; suit: Suit; rank: number; up: boolean };
type SPile = SCard[];
export type SolState = { stock: SPile; waste: SPile; found: SPile[]; tab: SPile[] };
/** What the player has picked up. `idx` is the position within its pile. */
type Sel = { zone: 'waste' | 'tab'; pile: number; idx: number } | null;

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const isRed = (s: Suit) => s === 'H' || s === 'D';

const SOL_TIME = 'br-solitaire-best-time';
const SOL_MOVES = 'br-solitaire-best-moves';
const SOL_WINS = 'br-solitaire-wins';

// Read on first render rather than in an effect. Safe because the game only
// mounts after the player clicks into it, so this never runs during SSR.
const readNum = (key: string): number | null => {
  if (typeof window === 'undefined') return null;
  try { const v = localStorage.getItem(key); return v ? parseInt(v, 10) : null; } catch { return null; }
};
const writeNum = (key: string, v: number) => { try { localStorage.setItem(key, String(v)); } catch {} };

export function freshDeal(): SolState {
  const deck: SCard[] = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ id: `${s}${r}`, suit: s, rank: r, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tab: SPile[] = [];
  let k = 0;
  for (let c = 0; c < 7; c++) {
    const pile: SPile = [];
    for (let n = 0; n <= c; n++) { const card = deck[k++]; card.up = n === c; pile.push(card); }
    tab.push(pile);
  }
  return { stock: deck.slice(k), waste: [], found: [[], [], [], []], tab };
}

export const cloneState = (s: SolState): SolState => ({
  stock: s.stock.map(c => ({ ...c })),
  waste: s.waste.map(c => ({ ...c })),
  found: s.found.map(p => p.map(c => ({ ...c }))),
  tab: s.tab.map(p => p.map(c => ({ ...c }))),
});

export const isWon = (s: SolState) => s.found.reduce((n, p) => n + p.length, 0) === 52;
const top = (p: SPile): SCard | undefined => p[p.length - 1];
/** Tableau accepts a King on an empty pile, else one rank down in the other colour. */
export const fitsTab = (card: SCard, dest: SPile) => {
  const t = top(dest);
  return t ? t.up && t.rank === card.rank + 1 && isRed(t.suit) !== isRed(card.suit) : card.rank === 13;
};
/** Foundations build up by suit from the ace. */
export const fitsFound = (card: SCard, f: SPile) => {
  const t = top(f);
  return t ? t.suit === card.suit && t.rank === card.rank - 1 : card.rank === 1;
};
/** A tableau pile's exposed card is turned over once whatever covered it leaves. */
const flipExposed = (pile: SPile) => { const t = top(pile); if (t && !t.up) t.up = true; };

/**
 * One step of the auto-finish walk, mutating `s`.
 *   'found' — a card went to a foundation (real progress)
 *   'cycle' — only drew or recycled the stock (no progress)
 *   'none'  — nothing left to do
 */
function autoStep(s: SolState): 'found' | 'cycle' | 'none' {
  const send = (card: SCard, take: () => void) => {
    const fi = SUITS.indexOf(card.suit);
    if (!fitsFound(card, s.found[fi])) return false;
    take(); s.found[fi].push(card); return true;
  };
  const w = top(s.waste);
  if (w && send(w, () => s.waste.pop())) return 'found';
  for (const pile of s.tab) {
    const t = top(pile);
    if (t && t.up && send(t, () => { pile.pop(); flipExposed(pile); })) return 'found';
  }
  if (s.stock.length) { const c = s.stock.pop()!; c.up = true; s.waste.push(c); return 'cycle'; }
  if (s.waste.length) { s.stock = s.waste.reverse().map(c => ({ ...c, up: false })); s.waste = []; return 'cycle'; }
  return 'none';
}

/**
 * Advance auto-finish by one step, or return null to stop.
 *
 * The stall guard is the whole point: drawing and recycling always "succeed",
 * so a board where nothing is playable would alternate draw/recycle forever and
 * spin the move counter. `idle` counts steps since the last foundation move; one
 * full pass through the stock without progress means there is nothing to find.
 * Exported so that guard can be tested directly — it is the part that would hang.
 */
export function autoAdvance(state: SolState, idle: number): { next: SolState; idle: number } | null {
  const next = cloneState(state);
  const result = autoStep(next);
  if (result === 'none') return null;
  if (result === 'found') return { next, idle: 0 };
  if (idle + 1 > next.stock.length + next.waste.length + 1) return null;
  return { next, idle: idle + 1 };
}

const fmtClock = (ms: number) => {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function Solitaire() {
  const [state, setState] = useState<SolState>(freshDeal);
  // Each entry carries the move count too, so undo restores the counter exactly
  // rather than assuming every undo is worth one move (auto-finish moves are
  // deliberately not recorded, so a blind decrement would drift).
  const [history, setHistory] = useState<{ s: SolState; moves: number }[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [moves, setMoves] = useState(0);
  const [drawThree, setDrawThree] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [auto, setAuto] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(() => readNum(SOL_TIME));
  const [bestMoves, setBestMoves] = useState<number | null>(() => readNum(SOL_MOVES));
  const [wins, setWins] = useState<number>(() => readNum(SOL_WINS) ?? 0);

  const won = isWon(state);
  const elapsed = startedAt == null ? 0 : (won ? now : Math.max(now, startedAt)) - startedAt;

  // Clock ticks off an interval, so setState happens in the callback, not in the
  // effect body — no cascading render on every tick.
  useEffect(() => {
    if (startedAt == null || won) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt, won]);

  // Banked at the moment the winning move lands, not from an effect watching
  // `won` — deriving it in an effect would re-render just to record a score.
  const bankedRef = useRef(false);
  const bankWin = useCallback((finalMoves: number, startMs: number | null) => {
    if (bankedRef.current) return;
    bankedRef.current = true;
    setAuto(false);
    const secs = Math.floor((startMs ? Date.now() - startMs : 0) / 1000);
    setBestTime(p => { const n = p == null ? secs : Math.min(p, secs); writeNum(SOL_TIME, n); return n; });
    setBestMoves(p => { const n = p == null ? finalMoves : Math.min(p, finalMoves); writeNum(SOL_MOVES, n); return n; });
    setWins(p => { const n = p + 1; writeNum(SOL_WINS, n); return n; });
  }, []);

  // Auto-finish walks one card per tick so the payoff is visible rather than instant.
  const idleRef = useRef(0);
  useEffect(() => {
    if (!auto || won) return;
    const id = window.setTimeout(() => {
      const step = autoAdvance(state, idleRef.current);
      if (!step) { setAuto(false); return; }
      idleRef.current = step.idle;
      setState(step.next);
      setMoves(m => m + 1);
      setNow(Date.now());
      if (isWon(step.next)) bankWin(moves + 1, startedAt);
    }, 55);
    return () => window.clearTimeout(id);
  }, [auto, state, won, moves, startedAt, bankWin]);

  /** Apply a mutation, recording it for undo. No-ops if the move is illegal. */
  const commit = useCallback((mutate: (s: SolState) => boolean) => {
    const next = cloneState(state);
    if (!mutate(next)) { setSel(null); return; }
    setHistory(h => [...h.slice(-79), { s: state, moves }]);
    setState(next);
    setSel(null);
    setMoves(m => m + 1);
    const startMs = startedAt ?? Date.now();
    setStartedAt(startMs);
    setNow(Date.now());
    if (isWon(next)) bankWin(moves + 1, startMs);
  }, [state, startedAt, moves, bankWin]);

  const newGame = useCallback(() => {
    bankedRef.current = false;
    setState(freshDeal()); setHistory([]); setSel(null);
    setMoves(0); setStartedAt(null); setNow(0); setAuto(false); idleRef.current = 0;
  }, []);

  // Read history directly rather than nesting setState calls inside a setHistory
  // updater — updaters must stay pure, since React may invoke them twice.
  const undo = useCallback(() => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setState(prev.s);
    setMoves(prev.moves);
    setHistory(h => h.slice(0, -1));
    setSel(null);
    setAuto(false);
  }, [history]);

  const drawStock = () => commit(s => {
    if (s.stock.length) {
      for (let i = 0; i < (drawThree ? 3 : 1) && s.stock.length; i++) {
        const c = s.stock.pop()!; c.up = true; s.waste.push(c);
      }
      return true;
    }
    if (!s.waste.length) return false;
    s.stock = s.waste.reverse().map(c => ({ ...c, up: false }));
    s.waste = [];
    return true;
  });

  /** Lift the selected run out of its pile. */
  const lift = (s: SolState, sl: Sel): SPile => {
    if (!sl) return [];
    if (sl.zone === 'waste') return s.waste.splice(sl.idx, 1);
    const moved = s.tab[sl.pile].splice(sl.idx);
    flipExposed(s.tab[sl.pile]);
    return moved;
  };

  const selectedCard = (s: SolState, sl: Sel): SCard | undefined =>
    !sl ? undefined : sl.zone === 'waste' ? s.waste[sl.idx] : s.tab[sl.pile][sl.idx];

  const sendToFoundation = (sl: Sel) => commit(s => {
    const card = selectedCard(s, sl);
    if (!card) return false;
    // Only a lone top card can go to a foundation, never a run.
    const isTop = sl!.zone === 'waste' ? sl!.idx === s.waste.length - 1 : sl!.idx === s.tab[sl!.pile].length - 1;
    if (!isTop) return false;
    const fi = SUITS.indexOf(card.suit);
    if (!fitsFound(card, s.found[fi])) return false;
    s.found[fi].push(lift(s, sl)[0]);
    return true;
  });

  const clickCard = (zone: 'waste' | 'tab', pile: number, idx: number) => {
    const card = zone === 'waste' ? state.waste[idx] : state.tab[pile][idx];
    if (!card?.up) return;
    // Tapping the picked-up card again is the shortcut to its foundation.
    if (sel && sel.zone === zone && sel.pile === pile && sel.idx === idx) { sendToFoundation(sel); return; }
    if (sel) {
      // A pick-up already in hand + a click on a tableau card means "drop onto that pile".
      if (zone === 'tab') { dropOnTab(pile); return; }
      setSel({ zone, pile, idx });
      return;
    }
    setSel({ zone, pile, idx });
  };

  const dropOnTab = (pile: number) => {
    if (!sel) return;
    commit(s => {
      const card = selectedCard(s, sel);
      if (!card || !card.up) return false;
      if (sel.zone === 'tab' && sel.pile === pile) return false;
      if (!fitsTab(card, s.tab[pile])) return false;
      s.tab[pile].push(...lift(s, sel));
      return true;
    });
  };

  const dropOnFoundation = (fi: number) => {
    if (!sel) { return; }
    commit(s => {
      const card = selectedCard(s, sel);
      if (!card) return false;
      const isTop = sel.zone === 'waste' ? sel.idx === s.waste.length - 1 : sel.idx === s.tab[sel.pile].length - 1;
      if (!isTop || SUITS.indexOf(card.suit) !== fi || !fitsFound(card, s.found[fi])) return false;
      s.found[fi].push(lift(s, sel)[0]);
      return true;
    });
  };

  const canAuto = !won && !auto && state.tab.every(p => p.every(c => c.up));

  // ── presentation ──────────────────────────────────────────────────────
  const CW = 'var(--cw)';
  const H = `calc(${CW} * 1.42)`;
  const slotBase: React.CSSProperties = {
    width: CW, height: H, borderRadius: `calc(${CW} * 0.11)`, boxSizing: 'border-box',
  };
  const cardBase: React.CSSProperties = { ...slotBase, position: 'absolute', left: 0, cursor: 'pointer' };

  const faceStyle = (c: SCard, picked: boolean): React.CSSProperties => ({
    ...cardBase,
    background: '#f5f0e5',
    border: picked ? '2px solid var(--cc-gold)' : '1px solid rgba(20,16,32,0.28)',
    boxShadow: picked ? '0 0 0 3px rgba(227,194,126,0.25), 0 6px 16px rgba(0,0,0,0.35)' : '0 1px 3px rgba(0,0,0,0.28)',
    color: isRed(c.suit) ? '#b3384a' : '#1b1526',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  });
  const backStyle: React.CSSProperties = {
    ...cardBase,
    background: 'linear-gradient(145deg, rgba(154,108,255,0.55), rgba(52,36,96,0.85))',
    border: '1px solid rgba(227,194,126,0.3)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  };
  const emptyStyle: React.CSSProperties = {
    ...slotBase, border: '1px dashed var(--cc-hairline)', background: 'rgba(255,255,255,0.02)',
  };

  const Face = ({ c, picked }: { c: SCard; picked: boolean }) => (
    <>
      <span style={{ fontSize: `calc(${CW} * 0.34)`, fontWeight: 700 }}>{RANKS[c.rank]}</span>
      <span style={{ fontSize: `calc(${CW} * 0.36)`, marginTop: `calc(${CW} * 0.04)` }}>{GLYPH[c.suit]}</span>
      {picked && null}
    </>
  );

  const grid: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: `repeat(7, ${CW})`,
    gap: `calc(${CW} * 0.11)`, justifyContent: 'center',
  };

  const isPicked = (zone: 'waste' | 'tab', pile: number, idx: number) =>
    !!sel && sel.zone === zone && sel.pile === pile && (zone === 'waste' ? sel.idx === idx : idx >= sel.idx);

  // Fan the last few waste cards; only the top one is playable.
  const wasteShown = state.waste.slice(Math.max(0, state.waste.length - (drawThree ? 3 : 1)));

  return (
    <div
      className="flex flex-col items-center"
      style={{ ['--cw' as string]: 'clamp(30px, 9.4vw, 78px)' } as React.CSSProperties}
    >
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--cc-gold-warm)' }}>Solitaire</h3>
      <p className="text-[12px] text-slate-400 mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="tabular-nums">{fmtClock(elapsed)}</span>
        <span className="text-slate-600">·</span>
        <span className="tabular-nums">{moves} moves</span>
        <span className="text-slate-600">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Trophy size={12} className="text-amber-300/80" />
          <span className="tabular-nums text-slate-300">
            {bestTime != null ? fmtClock(bestTime * 1000) : '—'}
          </span>
          {wins > 0 && <span className="text-slate-500">({wins}W)</span>}
        </span>
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <button onClick={newGame} className="px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--cc-hairline)', color: 'var(--cc-body)' }}>
          <RotateCcw size={12} className="inline mr-1.5 -mt-0.5" />New game
        </button>
        <button onClick={undo} disabled={!history.length}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors hover:bg-white/5 disabled:opacity-35 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--cc-hairline)', color: 'var(--cc-body)' }}>
          Undo
        </button>
        <button onClick={() => { setDrawThree(d => !d); newGame(); }}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--cc-hairline)', color: 'var(--cc-body)' }}>
          Draw {drawThree ? 3 : 1}
        </button>
        {canAuto && (
          <button onClick={() => { idleRef.current = 0; setAuto(true); }} className="btn-premium px-4 py-1.5 rounded-full text-[12px]">
            Auto-finish
          </button>
        )}
      </div>

      {/* Stock · waste · foundations, aligned to the same 7 columns as the tableau */}
      <div style={{ ...grid, marginBottom: `calc(${CW} * 0.28)` }}>
        <div onClick={drawStock} style={{ position: 'relative', ...slotBase, cursor: 'pointer' }}>
          {state.stock.length
            ? <div style={backStyle} />
            : <div style={{ ...emptyStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={14} style={{ color: 'var(--cc-faint)' }} />
              </div>}
        </div>

        <div style={{ position: 'relative', ...slotBase, overflow: 'visible' }}>
          {wasteShown.length === 0 && <div style={emptyStyle} />}
          {wasteShown.map((c, i) => {
            const realIdx = state.waste.length - wasteShown.length + i;
            const isTopCard = i === wasteShown.length - 1;
            return (
              <div key={c.id}
                onClick={isTopCard ? () => clickCard('waste', 0, realIdx) : undefined}
                style={{
                  ...faceStyle(c, isPicked('waste', 0, realIdx)),
                  left: `calc(${CW} * ${(i * 0.24).toFixed(2)})`,
                  zIndex: i,
                  cursor: isTopCard ? 'pointer' : 'default',
                }}>
                <Face c={c} picked={false} />
              </div>
            );
          })}
        </div>

        <div />

        {state.found.map((f, fi) => {
          const t = top(f);
          return (
            <div key={fi} onClick={() => dropOnFoundation(fi)} style={{ position: 'relative', ...slotBase, cursor: 'pointer' }}>
              {t ? <div style={faceStyle(t, false)}><Face c={t} picked={false} /></div>
                 : <div style={{ ...emptyStyle, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 color: 'var(--cc-faint)', fontSize: `calc(${CW} * 0.36)` }}>
                     {GLYPH[SUITS[fi]]}
                   </div>}
            </div>
          );
        })}
      </div>

      {/* Tableau */}
      <div style={grid}>
        {state.tab.map((pile, pi) => {
          // Offsets accumulate in units of card width: face-down cards sit tighter.
          let acc = 0;
          const tops = pile.map(c => { const t = acc; acc += c.up ? 0.38 : 0.16; return t; });
          const heightUnits = (pile.length ? tops[tops.length - 1] : 0) + 1.42;
          return (
            <div key={pi} onClick={() => { if (sel) dropOnTab(pi); }}
              style={{ position: 'relative', width: CW, minHeight: `calc(${CW} * ${Math.max(heightUnits, 1.42).toFixed(2)})`, cursor: sel ? 'pointer' : 'default' }}>
              {pile.length === 0 && <div style={emptyStyle} />}
              {pile.map((c, ci) => (
                <div key={c.id}
                  onClick={e => { if (c.up) { e.stopPropagation(); clickCard('tab', pi, ci); } }}
                  style={{
                    ...(c.up ? faceStyle(c, isPicked('tab', pi, ci)) : backStyle),
                    top: `calc(${CW} * ${tops[ci].toFixed(2)})`,
                    zIndex: ci,
                    cursor: c.up ? 'pointer' : 'default',
                  }}>
                  {c.up && <Face c={c} picked={isPicked('tab', pi, ci)} />}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {won && (
        <div className="mt-5 text-center rounded-2xl px-6 py-4"
          style={{ background: 'rgba(227,194,126,0.1)', border: '1px solid rgba(227,194,126,0.4)' }}>
          <div className="text-[20px] font-semibold" style={{ color: 'var(--cc-gold-warm)', fontFamily: 'var(--font-heading)' }}>
            Solved
          </div>
          <div className="text-[13px] text-slate-300 mt-1 tabular-nums">
            {fmtClock(elapsed)} · {moves} moves
          </div>
          <button onClick={newGame} className="btn-premium px-5 py-2 rounded-full inline-flex items-center gap-2 mt-3">
            <Play size={14} /> Deal again
          </button>
        </div>
      )}

      {!won && (
        <p className="text-[11px] text-slate-500 mt-4 text-center max-w-sm">
          Tap a card to pick it up, tap where it goes. Tap it again to send it to a foundation.
        </p>
      )}
    </div>
  );
}

import { describe, it, expect } from 'vitest';
import { LEVEL, PHYS, TILE, isSolid, newGame, parseLevel, step, type Game, type GameEvent, type Input } from './corridor-dash';

const NONE: Input = { left: false, right: false, jump: false };
const RIGHT: Input = { ...NONE, right: true };
const LEFT: Input = { ...NONE, left: true };
const JUMP: Input = { ...NONE, jump: true };
const FRAME = 1 / 60;

/** Steps `frames` frames with the same input and returns every event. */
function run(game: Game, input: Input, frames: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...step(game, input, FRAME));
  return events;
}

/**
 * A 40 x 8 test room: walls in columns 0 and 39, floor on rows 6–7, the player at column 2 and the door at
 * column 37. `edit` changes cells before parsing.
 */
function room(edit?: (g: string[][]) => void) {
  const g: string[][] = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 40 }, (_, c) => (c === 0 || c === 39 || r >= 6 ? '#' : ' ')),
  );
  g[5][2] = 'P';
  g[5][37] = 'D';
  edit?.(g);
  return parseLevel(g.map(row => row.join('')));
}

const pit = (c0: number, c1: number) => (g: string[][]) => {
  for (let c = c0; c <= c1; c++) g[6][c] = g[7][c] = ' ';
};
const floorTop = 6 * TILE;

describe('parseLevel', () => {
  it('finds the start, door, stars, germs, checkpoints and sharps', () => {
    const level = room(g => {
      g[5][5] = '*';
      g[5][9] = 'g';
      g[5][12] = 'C';
      g[5][15] = '^';
    });
    expect(level.cols).toBe(40);
    expect(level.rows).toBe(8);
    expect(level.start).toEqual({ col: 2, row: 5 });
    expect(level.door).toEqual({ col: 37, row: 5 });
    expect(level.stars).toEqual([{ col: 5, row: 5 }]);
    expect(level.germs).toEqual([{ col: 9, row: 5 }]);
    expect(level.checkpoints).toEqual([{ col: 12, row: 5 }]);
    expect(level.sharps).toEqual([{ col: 15, row: 5 }]);
  });

  it('rejects a map with no start or no door, or with rows of different lengths', () => {
    expect(() => parseLevel(['#  D#', '#####'])).toThrow(/start/);
    expect(() => parseLevel(['# P #', '#####'])).toThrow(/door/);
    expect(() => parseLevel(['# P D#', '#####'])).toThrow(/same length/);
  });
});

describe('moving and jumping', () => {
  it('starts standing on the floor', () => {
    const game = newGame(room());
    expect(game.player.onGround).toBe(true);
    expect(run(game, NONE, 1)).not.toContain('land');
  });

  it('falls onto the floor and stands on it', () => {
    const game = newGame(room());
    game.player.y -= 64;
    run(game, NONE, 60);
    expect(game.player.onGround).toBe(true);
    expect(game.player.y + game.player.h).toBe(floorTop);
  });

  it('runs up to its top speed and stops at a wall', () => {
    const game = newGame(room());
    run(game, RIGHT, 30);
    expect(game.player.vx).toBeCloseTo(PHYS.runSpeed, 5);
    run(game, LEFT, 120);
    expect(game.player.x).toBe(TILE); // flush against the wall in column 0
    expect(game.player.vx).toBe(0);
  });

  it('a held jump rises about four tiles, and there is no second jump in the air', () => {
    const game = newGame(room());
    const groundY = game.player.y;
    let peak = 0;
    const events: GameEvent[] = [];
    for (let i = 0; i < 20; i++) {
      events.push(...step(game, JUMP, FRAME));
      peak = Math.max(peak, groundY - game.player.y);
    }
    events.push(...step(game, NONE, FRAME));
    for (let i = 0; i < 40; i++) {
      events.push(...step(game, JUMP, FRAME));
      peak = Math.max(peak, groundY - game.player.y);
    }
    expect(peak).toBeGreaterThan(115);
    expect(peak).toBeLessThan(140);
    expect(events.filter(e => e === 'jump')).toHaveLength(1);
  });

  it('letting go of jump early gives a lower jump', () => {
    const peakFor = (holdFrames: number) => {
      const game = newGame(room());
      const groundY = game.player.y;
      let peak = 0;
      for (let i = 0; i < 60; i++) {
        step(game, i < holdFrames ? JUMP : NONE, FRAME);
        peak = Math.max(peak, groundY - game.player.y);
      }
      return peak;
    };
    expect(peakFor(4)).toBeLessThan(peakFor(40) * 0.7);
  });

  it('still jumps just after running off a ledge, but not well after', () => {
    const offLedge = (lateFrames: number) => {
      const game = newGame(room(pit(6, 30)));
      while (game.player.onGround) step(game, RIGHT, FRAME);
      run(game, RIGHT, lateFrames);
      return run(game, { ...RIGHT, jump: true }, 1).includes('jump');
    };
    expect(offLedge(3)).toBe(true);
    expect(offLedge(15)).toBe(false);
  });

  it('a jump pressed just before landing happens on landing', () => {
    const game = newGame(room());
    game.player.y -= 150;
    while (floorTop - (game.player.y + game.player.h) > 20) step(game, NONE, FRAME);
    const events = run(game, JUMP, 12);
    expect(events).toContain('land');
    expect(events).toContain('jump');
    expect(events.indexOf('jump')).toBeGreaterThan(events.indexOf('land'));
  });
});

describe('germs', () => {
  it('walk, and turn at walls instead of entering them', () => {
    const game = newGame(room(g => (g[5][3] = 'g')));
    game.player.x = 30 * TILE; // out of the way
    const germ = game.germs[0];
    run(game, NONE, 120);
    expect(germ.x).toBeGreaterThanOrEqual(TILE);
    expect(germ.vx).toBeGreaterThan(0);
  });

  it('turn at a ledge instead of walking off it', () => {
    const game = newGame(room(g => { pit(20, 24)(g); g[5][27] = 'g'; }));
    const germ = game.germs[0];
    const y = germ.y;
    let minX = germ.x;
    for (let i = 0; i < 300; i++) { step(game, NONE, FRAME); minX = Math.min(minX, germ.x); }
    expect(minX).toBeGreaterThanOrEqual(25 * TILE - 1);
    expect(germ.y).toBe(y);
  });

  it('a stomp from above defeats the germ and bounces the player', () => {
    const game = newGame(room(g => (g[5][10] = 'g')));
    const germ = game.germs[0];
    germ.vx = 0;
    game.player.x = germ.x;
    game.player.y = germ.y - 100;
    const events = run(game, NONE, 40);
    expect(events).toContain('stomp');
    expect(germ.alive).toBe(false);
    expect(game.hearts).toBe(3);
  });

  it('touching one from the side costs one heart, then gives a short grace period', () => {
    const game = newGame(room(g => (g[5][6] = 'g')));
    game.germs[0].vx = 0;
    const events = run(game, RIGHT, 45);
    expect(events.filter(e => e === 'hurt')).toHaveLength(1);
    expect(game.hearts).toBe(2);
  });
});

describe('stars, hazards and the end of a run', () => {
  it('collects a star once', () => {
    const game = newGame(room(g => (g[5][5] = '*')));
    const events = run(game, RIGHT, 60);
    expect(events.filter(e => e === 'star')).toHaveLength(1);
    expect(game.starsTaken).toBe(1);
  });

  it('a fall costs a heart and returns the player to the last checkpoint', () => {
    const game = newGame(room(g => { g[5][8] = 'C'; pit(15, 18)(g); }));
    const events: GameEvent[] = [];
    for (let i = 0; i < 400 && !events.includes('fall'); i++) events.push(...step(game, RIGHT, FRAME));
    expect(events).toContain('checkpoint');
    expect(events).toContain('fall');
    expect(game.hearts).toBe(2);
    expect(Math.abs(game.player.x - (8 * TILE + (TILE - game.player.w) / 2))).toBeLessThan(2); // back on the checkpoint
    expect(game.player.grace).toBeGreaterThan(0);
  });

  it('sharps cost a heart', () => {
    const game = newGame(room(g => (g[5][6] = '^')));
    const events = run(game, RIGHT, 40);
    expect(events).toContain('hurt');
    expect(game.hearts).toBe(2);
  });

  it('losing the last heart ends the run and stops the clock', () => {
    const game = newGame(room(g => (g[5][6] = '^')), 1);
    const events = run(game, RIGHT, 40);
    expect(events).toContain('lost');
    expect(game.status).toBe('lost');
    const time = game.time;
    expect(run(game, RIGHT, 10)).toEqual([]);
    expect(game.time).toBe(time);
  });

  it('reaching the door wins and stops the clock', () => {
    const game = newGame(room());
    const events = run(game, RIGHT, 600);
    expect(events).toContain('won');
    expect(game.status).toBe('won');
    expect(game.time).toBeGreaterThan(4);
    expect(game.time).toBeLessThan(10);
  });
});

describe('the shipped level', () => {
  it('parses, and its exit can be reached with the jump the physics allow', () => {
    const level = parseLevel(LEVEL);
    // The jump envelope in whole tiles, keeping half a tile in hand so no required jump is pixel-perfect.
    const peak = PHYS.jumpVelocity ** 2 / (2 * PHYS.gravity);
    const reach = (PHYS.runSpeed * 2 * -PHYS.jumpVelocity) / PHYS.gravity;
    const rise = Math.floor((peak - TILE / 2) / TILE);
    const across = Math.floor((reach - TILE / 2) / TILE);
    expect(rise).toBe(3);
    expect(across).toBe(4);
    const solid = (r: number, c: number) => '#='.includes(level.map[r]?.[c] ?? ' ') && level.map[r]?.[c] !== undefined;
    const stand: [number, number][] = [];
    for (let r = 0; r < level.rows - 1; r++)
      for (let c = 0; c < level.cols; c++)
        if (!solid(r, c) && level.map[r][c] !== '^' && solid(r + 1, c)) stand.push([r, c]);
    const key = (r: number, c: number) => `${r},${c}`;
    const seen = new Set([key(level.start.row, level.start.col)]);
    const todo: [number, number][] = [[level.start.row, level.start.col]];
    while (todo.length) {
      const [r, c] = todo.pop()!;
      for (const [r2, c2] of stand) {
        if (seen.has(key(r2, c2)) || Math.abs(c2 - c) > across || r - r2 > rise) continue;
        seen.add(key(r2, c2));
        todo.push([r2, c2]);
      }
    }
    expect(seen.has(key(level.door.row, level.door.col))).toBe(true);
    // Every star sits on or within a jump above some reachable standing spot.
    const reachable = [...seen].map(k => k.split(',').map(Number));
    for (const { row, col } of level.stars)
      expect(reachable.some(([r, c]) => Math.abs(c - col) <= 1 && r - row >= 0 && r - row <= rise), `star ${row},${col}`).toBe(true);
    // Sharps never sit under a shelf: a jump from the floor would hit its head and drop onto them.
    for (const { row, col } of level.sharps)
      for (let k = 1; k <= 4; k++) expect(solid(row - k, col), `sharps at ${row},${col} under a shelf`).toBe(false);
    expect(level.stars.length).toBeGreaterThanOrEqual(15);
    expect(level.germs.length).toBeGreaterThanOrEqual(5);
  });

  it('can be finished by a simple player who holds right and jumps at gaps, steps, sharps and germs', () => {
    const level = parseLevel(LEVEL);
    const game = newGame(level);
    let holding = false;
    for (let frame = 0; frame < 120 * 60 && game.status === 'playing'; frame++) {
      const p = game.player;
      const feet = Math.floor((p.y + p.h - 1) / TILE);
      const ahead = Math.floor((p.x + p.w + 20) / TILE);
      const germNear = game.germs.some(g => g.alive && g.x > p.x && g.x - (p.x + p.w) < 60 && Math.abs(g.y + g.h - (p.y + p.h)) < 20);
      const want = p.onGround && (
        !isSolid(level, ahead, feet + 1) || isSolid(level, ahead, feet) || level.map[feet]?.[ahead] === '^' || germNear
      );
      // Press for a fresh jump, keep holding while rising, let go otherwise.
      const jump: boolean = want ? !holding : holding && p.vy < 0;
      holding = jump;
      step(game, { left: false, right: true, jump }, FRAME);
    }
    expect(game.status).toBe('won');
    expect(game.time).toBeLessThan(60);
  });
});

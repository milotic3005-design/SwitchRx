// Corridor Dash: the Break Room's quick side-scrolling run. A capsule runs a hospital corridor, jumps the gaps,
// stomps germs, picks up stars and reaches the exit door, in about a minute. Everything here is pure game logic
// (no DOM, no canvas) so it can be tested; components/break-room/CorridorDash.tsx draws it and reads the keys.
//
// Units are pixels and seconds. The level is a grid of TILE-sized cells written as text:
//   #  wall or floor      =  shelf (also solid)    P  start     D  exit door
//   *  star               g  germ                  C  checkpoint ^  sharps

export const TILE = 32;

export const PHYS = {
  gravity: 1800,
  maxFall: 900,
  runSpeed: 220,
  groundAccel: 1800,
  airAccel: 1200,
  friction: 2200,
  /** About four tiles high and five across at full speed. */
  jumpVelocity: -680,
  /** Letting go of jump while rising keeps this share of the upward speed, for short hops. */
  jumpCut: 0.45,
  /** A jump still works this long after running off a ledge. */
  coyote: 0.1,
  /** A jump pressed this long before landing happens on landing. */
  buffer: 0.12,
  stompBounce: -460,
  hurtBounce: -360,
  knockback: 180,
  /** After a hit, no further hit for this long. */
  grace: 1.2,
  germSpeed: 55,
} as const;

export type Cell = { col: number; row: number };

export interface Level {
  cols: number;
  rows: number;
  map: readonly string[];
  start: Cell;
  door: Cell;
  stars: Cell[];
  germs: Cell[];
  checkpoints: Cell[];
  sharps: Cell[];
}

export interface Player {
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  onGround: boolean;
  facing: 1 | -1;
  /** Time left to jump after leaving the ground. */
  coyote: number;
  /** Time left on a jump pressed in the air. */
  buffer: number;
  jumpHeld: boolean;
  /** Time left before another hit can land. */
  grace: number;
}

export interface Germ { x: number; y: number; vx: number; w: number; h: number; alive: boolean }

export interface Game {
  level: Level;
  player: Player;
  germs: Germ[];
  stars: (Cell & { taken: boolean })[];
  /** Which checkpoints have been touched, by index into level.checkpoints. */
  reached: boolean[];
  respawn: { x: number; y: number };
  hearts: number;
  starsTaken: number;
  /** Seconds since the start, frozen when the run ends. */
  time: number;
  status: 'playing' | 'won' | 'lost';
}

export type Input = { left: boolean; right: boolean; jump: boolean };
export type GameEvent = 'jump' | 'land' | 'stomp' | 'star' | 'hurt' | 'fall' | 'checkpoint' | 'won' | 'lost';

const PLAYER_W = 22;
const PLAYER_H = 28;
const GERM_W = 26;
const GERM_H = 22;

/** Reads a level written as text rows. Throws if the rows differ in length or there is no start or door. */
export function parseLevel(map: readonly string[]): Level {
  const cols = map[0]?.length ?? 0;
  if (map.some(row => row.length !== cols)) throw new Error('Every row of the level must be the same length');
  const all = (ch: string): Cell[] =>
    map.flatMap((row, r) => [...row].flatMap((c, col) => (c === ch ? [{ col, row: r }] : [])));
  const [start] = all('P');
  const [door] = all('D');
  if (!start) throw new Error('The level has no start (P)');
  if (!door) throw new Error('The level has no door (D)');
  return {
    cols, rows: map.length, map, start, door,
    stars: all('*'), germs: all('g'), checkpoints: all('C'), sharps: all('^'),
  };
}

/** Walls and shelves. Beyond the left and right edges counts as wall; above and below the map is open. */
export function isSolid(level: Level, col: number, row: number): boolean {
  if (col < 0 || col >= level.cols) return true;
  if (row < 0 || row >= level.rows) return false;
  const ch = level.map[row][col];
  return ch === '#' || ch === '=';
}

const isSharps = (level: Level, col: number, row: number) => level.map[row]?.[col] === '^';

/** Where the player stands when placed on a cell. */
const spawnAt = (cell: Cell) => ({ x: cell.col * TILE + (TILE - PLAYER_W) / 2, y: (cell.row + 1) * TILE - PLAYER_H });

export function newGame(level: Level, hearts = 3): Game {
  const spawn = spawnAt(level.start);
  const grounded = isSolid(level, level.start.col, level.start.row + 1);
  return {
    level,
    player: {
      ...spawn, vx: 0, vy: 0, w: PLAYER_W, h: PLAYER_H,
      onGround: grounded, facing: 1, coyote: grounded ? PHYS.coyote : 0, buffer: 0, jumpHeld: false, grace: 0,
    },
    germs: level.germs.map(g => ({
      x: g.col * TILE + (TILE - GERM_W) / 2, y: (g.row + 1) * TILE - GERM_H,
      vx: -PHYS.germSpeed, w: GERM_W, h: GERM_H, alive: true,
    })),
    stars: level.stars.map(s => ({ ...s, taken: false })),
    reached: level.checkpoints.map(() => false),
    respawn: spawn,
    hearts,
    starsTaken: 0,
    time: 0,
    status: 'playing',
  };
}

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const approach = (v: number, target: number, by: number) => (v < target ? Math.min(v + by, target) : Math.max(v - by, target));

/** Advances the game by `dt` seconds with the keys in `input` held, and returns what happened. */
export function step(game: Game, input: Input, dt: number): GameEvent[] {
  if (game.status !== 'playing') return [];
  const events: GameEvent[] = [];
  const p = game.player;
  // Presses and releases are read once per frame; the physics then runs in small steps so nothing tunnels.
  if (input.jump && !p.jumpHeld) p.buffer = PHYS.buffer;
  if (!input.jump && p.jumpHeld && p.vy < 0) p.vy *= PHYS.jumpCut;
  p.jumpHeld = input.jump;
  const frame = Math.min(dt, 1 / 20);
  const n = Math.max(1, Math.ceil(frame / (1 / 120)));
  for (let i = 0; i < n && game.status === 'playing'; i++) subStep(game, input, frame / n, events);
  return events;
}

function subStep(game: Game, input: Input, dt: number, events: GameEvent[]) {
  const { level, player: p } = game;
  game.time += dt;
  p.grace = Math.max(0, p.grace - dt);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.facing = dir > 0 ? 1 : -1;
    p.vx = approach(p.vx, dir * PHYS.runSpeed, (p.onGround ? PHYS.groundAccel : PHYS.airAccel) * dt);
  } else {
    p.vx = approach(p.vx, 0, (p.onGround ? PHYS.friction : PHYS.airAccel / 2) * dt);
  }

  p.coyote = p.onGround ? PHYS.coyote : p.coyote - dt;
  p.buffer -= dt;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = PHYS.jumpVelocity;
    p.buffer = 0;
    p.coyote = 0;
    p.onGround = false;
    events.push('jump');
  }
  p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.maxFall);

  // Move across, then up or down, settling against walls and floors after each.
  p.x += p.vx * dt;
  forEachSolid(level, p, (col) => {
    if (p.vx > 0) p.x = col * TILE - p.w;
    else if (p.vx < 0) p.x = (col + 1) * TILE;
    p.vx = 0;
  });
  const prevBottom = p.y + p.h;
  const wasOnGround = p.onGround;
  p.onGround = false;
  p.y += p.vy * dt;
  forEachSolid(level, p, (_col, row) => {
    if (p.vy > 0) { p.y = row * TILE - p.h; p.onGround = true; }
    else if (p.vy < 0) p.y = (row + 1) * TILE;
    p.vy = 0;
  });
  if (p.onGround && !wasOnGround) events.push('land');

  for (const g of game.germs) if (g.alive) moveGerm(level, g, dt);

  // Germs: a stomp from above defeats one; any other touch hurts.
  for (const g of game.germs) {
    if (!g.alive || !overlaps(p, g)) continue;
    if (p.vy > 0 && prevBottom <= g.y + 8) {
      g.alive = false;
      p.vy = PHYS.stompBounce;
      events.push('stomp');
    } else {
      hurt(game, events);
    }
  }

  for (const s of level.sharps) {
    if (overlaps(p, { x: s.col * TILE + 4, y: s.row * TILE + TILE / 2, w: TILE - 8, h: TILE / 2 })) hurt(game, events);
  }

  for (const s of game.stars) {
    if (!s.taken && overlaps(p, { x: s.col * TILE + 6, y: s.row * TILE + 6, w: 20, h: 20 })) {
      s.taken = true;
      game.starsTaken += 1;
      events.push('star');
    }
  }

  level.checkpoints.forEach((c, i) => {
    if (!game.reached[i] && overlaps(p, { x: c.col * TILE, y: c.row * TILE, w: TILE, h: TILE })) {
      game.reached[i] = true;
      game.respawn = spawnAt(c);
      events.push('checkpoint');
    }
  });

  if (game.status !== 'playing') return;
  const d = level.door;
  if (overlaps(p, { x: d.col * TILE, y: (d.row - 1) * TILE, w: TILE, h: 2 * TILE })) {
    game.status = 'won';
    events.push('won');
    return;
  }

  if (p.y > level.rows * TILE + 64) {
    events.push('fall');
    loseHeart(game, events);
    if (game.status === 'playing') {
      Object.assign(p, { ...game.respawn, vx: 0, vy: 0, onGround: false, grace: PHYS.grace });
    }
  }
}

/** Calls `hit` for each solid cell the box overlaps. */
function forEachSolid(level: Level, b: Box, hit: (col: number, row: number) => void) {
  const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.001) / TILE);
  const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (isSolid(level, c, r)) { hit(c, r); return; }
}

/** Germs pace back and forth, turning at walls, sharps and ledges. */
function moveGerm(level: Level, g: Germ, dt: number) {
  g.x += g.vx * dt;
  const col = Math.floor((g.vx < 0 ? g.x : g.x + g.w - 0.001) / TILE);
  const row = Math.floor((g.y + g.h - 0.001) / TILE);
  if (isSolid(level, col, row) || isSharps(level, col, row) || !isSolid(level, col, row + 1)) {
    g.x = g.vx < 0 ? (col + 1) * TILE : col * TILE - g.w;
    g.vx = -g.vx;
  }
}

function hurt(game: Game, events: GameEvent[]) {
  const p = game.player;
  if (p.grace > 0 || game.status !== 'playing') return;
  events.push('hurt');
  loseHeart(game, events);
  p.grace = PHYS.grace;
  p.vy = PHYS.hurtBounce;
  p.vx = -p.facing * PHYS.knockback;
}

function loseHeart(game: Game, events: GameEvent[]) {
  game.hearts -= 1;
  if (game.hearts <= 0) {
    game.hearts = 0;
    game.status = 'lost';
    events.push('lost');
  }
}

/** The shipped level: 132 columns, about a minute at a steady pace. */
export const LEVEL: readonly string[] = [
  '#                                                                                                                                  #',
  '#                                                                                                                                  #',
  '#                                                                                                                                  #',
  '#                                                                                                                                  #',
  '#                                                                                       *                                          #',
  '#                                                              ***                     ===                                         #',
  '#          *           **                             **      #####                            *        ***                        #',
  '#         ===         ====                            ==     ######                ===        ===      =====                       #',
  '#                                                           #######                                                                #',
  '# P   ***                 g   #####     C    ^^   g        ########  g  g      C     ^^^             g      g  ^^ g         ** D   #',
  '################   ################   ###############    ##################   ###############     #####################   ##########',
  '################   ################   ###############    ##################   ###############     #####################   ##########',
];

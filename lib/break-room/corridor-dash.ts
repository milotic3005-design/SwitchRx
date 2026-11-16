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
} as const;

// ── Difficulty ───────────────────────────────────────────────────────────────
// Two levers, chosen because the obvious one does not work.
//
// Germ speed is the obvious one, and raising it is a trap: germs patrol the same
// narrow platforms the player jumps between, so a fast one tends to be standing on
// the landing edge. Stomping it mid-gap gives the stomp bounce (-460), which is
// weaker than a jump (-680), so the player lands short and falls in the pit. Past
// about 60 px/s a bot that otherwise clears the level dies to falls it could not
// avoid. Patrol speed therefore moves very little between shifts.
//
// What does work:
//   • The charge. Germs on the harder shifts notice the player and come at them,
//     so each one is a decision (stomp it, or commit to outrunning it?) instead of
//     scenery you stroll around. Directional, so it does not litter the ledges.
//   • The star gate. The door stays shut until enough stars are in hand. The stars
//     sit on the shelves above the corridor, so a gate turns "hold right along the
//     floor" into a route you have to climb and plan. It can never kill anyone —
//     it lengthens the run instead — which is exactly what a fair hard mode needs.

export interface Difficulty {
  id: 'day' | 'swing' | 'night';
  label: string;
  /** One line for the picker. */
  blurb: string;
  hearts: number;
  /** After a hit, no further hit for this long. */
  grace: number;
  /** Pacing speed, px/s. */
  germSpeed: number;
  /** Speed while charging, px/s. 0 means this shift's germs never charge. */
  chaseSpeed: number;
  /** How far ahead or behind a germ spots the player, px. 0 means it never does. */
  noticeX: number;
  /** A germ keeps charging this long after losing sight, so a jump overhead does not shake it off. */
  alertMemory: number;
  /** Stars needed before the exit door opens. 0 leaves it open from the start. */
  starsToOpen: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'day', label: 'Day Shift',
    blurb: 'Germs keep to their own patch. Three hearts and a long grace period.',
    hearts: 3, grace: 1.2, germSpeed: 55, chaseSpeed: 0, noticeX: 0, alertMemory: 0, starsToOpen: 0,
  },
  {
    id: 'swing', label: 'Swing Shift',
    blurb: 'Germs notice you and charge. The door wants 10 stars, so mind the shelves.',
    hearts: 3, grace: 1.0, germSpeed: 60, chaseSpeed: 150, noticeX: 150, alertMemory: 1.2, starsToOpen: 10,
  },
  {
    id: 'night', label: 'Night Shift',
    blurb: 'They spot you down the corridor and charge hard. 14 stars, and little grace.',
    hearts: 3, grace: 0.8, germSpeed: 60, chaseSpeed: 210, noticeX: 230, alertMemory: 1.8, starsToOpen: 14,
  },
] as const;

export const DEFAULT_DIFFICULTY = DIFFICULTIES[0];

/** The shift with this id, or Day Shift for anything unrecognised (a stale saved choice). */
export const difficultyById = (id: string | null | undefined): Difficulty =>
  DIFFICULTIES.find(d => d.id === id) ?? DEFAULT_DIFFICULTY;

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

export interface Germ {
  x: number; y: number; vx: number; w: number; h: number; alive: boolean;
  /** Seconds of charge left. 0 means it is pacing. */
  alert: number;
}

export interface Game {
  level: Level;
  difficulty: Difficulty;
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
  /** True while the player is standing at a shut door, so it is only reported once. */
  nudged: boolean;
}

/** Whether the exit will let the player through yet. */
export const doorOpen = (game: Game): boolean => game.starsTaken >= game.difficulty.starsToOpen;

/** Stars still needed before the door opens. */
export const starsNeeded = (game: Game): number =>
  Math.max(0, game.difficulty.starsToOpen - game.starsTaken);

export type Input = { left: boolean; right: boolean; jump: boolean };
export type GameEvent = 'jump' | 'land' | 'stomp' | 'star' | 'hurt' | 'fall' | 'checkpoint' | 'won' | 'lost' | 'locked';

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

export function newGame(level: Level, difficulty: Difficulty = DEFAULT_DIFFICULTY): Game {
  const spawn = spawnAt(level.start);
  const grounded = isSolid(level, level.start.col, level.start.row + 1);
  return {
    level,
    difficulty,
    player: {
      ...spawn, vx: 0, vy: 0, w: PLAYER_W, h: PLAYER_H,
      onGround: grounded, facing: 1, coyote: grounded ? PHYS.coyote : 0, buffer: 0, jumpHeld: false, grace: 0,
    },
    germs: level.germs.map(g => ({
      x: g.col * TILE + (TILE - GERM_W) / 2, y: (g.row + 1) * TILE - GERM_H,
      vx: -difficulty.germSpeed, w: GERM_W, h: GERM_H, alive: true, alert: 0,
    })),
    stars: level.stars.map(s => ({ ...s, taken: false })),
    reached: level.checkpoints.map(() => false),
    respawn: spawn,
    hearts: difficulty.hearts,
    starsTaken: 0,
    time: 0,
    status: 'playing',
    nudged: false,
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

  for (const g of game.germs) if (g.alive) moveGerm(level, g, dt, p, game.difficulty);

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
    if (doorOpen(game)) {
      game.status = 'won';
      events.push('won');
      return;
    }
    // Shut: say so once per approach rather than every frame the player stands there.
    if (!game.nudged) { game.nudged = true; events.push('locked'); }
  } else {
    game.nudged = false;
  }

  if (p.y > level.rows * TILE + 64) {
    events.push('fall');
    loseHeart(game, events);
    if (game.status === 'playing') {
      Object.assign(p, { ...game.respawn, vx: 0, vy: 0, onGround: false, grace: game.difficulty.grace });
    }
  }
}

/** Calls `hit` for each solid cell the box overlaps. */
function forEachSolid(level: Level, b: Box, hit: (col: number, row: number) => void) {
  const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.001) / TILE);
  const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (isSolid(level, c, r)) { hit(c, r); return; }
}

/**
 * Germs pace back and forth, turning at walls, sharps and ledges. On a shift where they
 * charge, one that has the player in range heads straight at them instead.
 */
function moveGerm(level: Level, g: Germ, dt: number, p: Player, d: Difficulty) {
  // Spotted only on the same storey, so a germ below a shelf ignores someone running over it.
  const dx = p.x + p.w / 2 - (g.x + g.w / 2);
  const sameStorey = Math.abs(p.y + p.h - (g.y + g.h)) < TILE;
  const spots = d.noticeX > 0 && d.chaseSpeed > 0 && sameStorey && Math.abs(dx) <= d.noticeX;
  // The memory matters: without it a jump overhead breaks the same-storey test for a few
  // frames and the germ would flick between charging and pacing.
  g.alert = spots ? d.alertMemory : Math.max(0, g.alert - dt);

  const charging = g.alert > 0;
  if (charging) g.vx = (dx === 0 ? Math.sign(g.vx) || -1 : Math.sign(dx)) * d.chaseSpeed;
  else if (Math.abs(g.vx) !== d.germSpeed) g.vx = (Math.sign(g.vx) || -1) * d.germSpeed;

  g.x += g.vx * dt;
  const col = Math.floor((g.vx < 0 ? g.x : g.x + g.w - 0.001) / TILE);
  const row = Math.floor((g.y + g.h - 0.001) / TILE);
  if (isSolid(level, col, row) || isSharps(level, col, row) || !isSolid(level, col, row + 1)) {
    g.x = g.vx < 0 ? (col + 1) * TILE : col * TILE - g.w;
    // A pacing germ turns around. A charging one holds the edge rather than turning away,
    // so it guards the gap instead of jittering while the player waits just out of reach.
    g.vx = charging ? 0 : -g.vx;
  }
}

function hurt(game: Game, events: GameEvent[]) {
  const p = game.player;
  if (p.grace > 0 || game.status !== 'playing') return;
  events.push('hurt');
  loseHeart(game, events);
  p.grace = game.difficulty.grace;
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
  '#                                                                                      *                                           #',
  '#                                                              ***                    ===                                          #',
  '#          *           **                             **      #####                              *      ***                        #',
  '#         ===         ====                            ==     ######               ===            ==    =====                       #',
  '#                                                           #######                                                                #',
  '# P   ***                 g   #####     C    ^^   g        ########  g  g      C          ^^          g     g  ^^           ** D   #',
  '################   ################   ###############    ##################   ##################    ###################   ##########',
  '################   ################   ###############    ##################   ##################    ###################   ##########',
];

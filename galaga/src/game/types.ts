// The Galaga state contract (load-bearing). `window.__galaga` mirrors
// `GameState`, and galaga/e2e/galaga.spec.ts asserts on it — that's how we
// verify the game *plays*, not just compiles (the same "CI for gameplay"
// gate Pac-Man uses, see ../../README.md + docs/ARCHITECTURE.md).
//
// This file is intentionally the WHOLE contract for the full-classic scope
// (formations, diving, capture-beam, dual-fighter, stages) even though the
// scaffold only fills in the boot/loop fields. Backlog slices flesh out the
// behavior behind these fields; they must NEVER remove a field a test depends
// on — add fields as mechanics land, deprecate by leaving them stable.

/** High-level lifecycle. Boots to 'ready'; first input flips to 'playing'. */
export type GameStatus = "ready" | "playing" | "won" | "lost" | "gameover";

/** The player's fighter. Galaga uses pixel coords (not a tile grid like
 *  Pac-Man) — the ship glides horizontally along the bottom. */
export interface PlayerState {
  /** Canvas-x of the (primary) fighter's center, in CSS px of the native
   *  canvas (0..WIDTH). */
  x: number;
  /** Canvas-y of the fighter's center (near the bottom, ~constant). */
  y: number;
  /** False during the death animation / between-life respawn. */
  alive: boolean;
  /** True while held in a boss Galaga's tractor beam (capture mechanic). */
  captured: boolean;
  /** True once a captured fighter has been rescued → twin side-by-side ships
   *  fire together (the dual-fighter mechanic). */
  dual: boolean;
}

/** Galaga's three enemy archetypes. */
export type EnemyKind = "bee" | "butterfly" | "boss";

/** Where an enemy is in its lifecycle. 'entering' = flying the entrance
 *  choreography into the grid; 'formation' = parked + breathing in the grid;
 *  'diving' = peeled off on an attack run; 'capturing' = a boss descending
 *  with its tractor beam armed; 'escort' = a captured player fighter flown in
 *  formation above the boss (shoot the boss to free it). */
export type EnemyState =
  | "entering"
  | "formation"
  | "diving"
  | "capturing"
  | "escort";

export interface Enemy {
  /** Stable per-spawn id (lets the renderer + tests track an individual). */
  id: number;
  kind: EnemyKind;
  /** Canvas-px center. */
  x: number;
  y: number;
  state: EnemyState;
}

/** A shot in flight. `from` distinguishes the player's bullets (travel up)
 *  from enemy fire (travels down). */
export interface Bullet {
  x: number;
  y: number;
  from: "player" | "enemy";
}

export interface GameState {
  /** Lifecycle. Boots to 'ready'. */
  status: GameStatus;
  /** Fixed-timestep counter. Increments once per `update()` while playing. */
  tick: number;
  /** Player score. */
  score: number;
  /** Fighters in reserve (classic Galaga starts with 3, one in play). */
  lives: number;
  /** Current stage number (Galaga's "STAGE N"). Starts at 1. */
  stage: number;
  /** Native canvas dimensions, published so HUD/test code can read the
   *  playfield shape without importing the renderer. */
  field: { width: number; height: number };
  /** The player fighter. */
  player: PlayerState;
  /** Live enemy roster (formation + divers + bosses). The e2e contract reads
   *  this; empty in the scaffold until the formation slice lands. */
  enemies: Enemy[];
  /** Shots in flight (player + enemy). Empty until the firing slice lands. */
  bullets: Bullet[];
  /** True while a boss Galaga's tractor beam is on screen (capture mechanic).
   *  Surfaced for the capture/rescue tests + HUD cues. */
  captureBeamActive: boolean;
}

/** Test-only escape hatch. The e2e harness can force a deterministic
 *  collision outcome (kill an enemy, or kill the player) without having to
 *  align bullet/enemy positions through the simulation. Exposed on `window`
 *  alongside `__galaga` so Playwright can drive it from page.evaluate.
 *
 *  Intentionally tiny: one method, two targets. If `target` is 'enemy', the
 *  first enemy (or `enemyId` if given) is treated as if a player bullet just
 *  hit it — removed + scored. If `target` is 'player', the fighter takes a
 *  hit (alive=false, lives--, respawn timer armed; at 0 lives → status='lost'). */
export interface GalagaInternals {
  forceHit(opts: { target: "enemy" | "player"; enemyId?: number }): void;
}

declare global {
  interface Window {
    /** Test contract. See galaga/docs/ARCHITECTURE.md. */
    __galaga?: GameState;
    /** Test-only collision hook — see `GalagaInternals`. */
    __galagaInternals?: GalagaInternals;
  }
}

/** Point values per archetype. Galaga's formation values; close-enough for
 *  our condensed roster (bonus diving values are a follow-up backlog item). */
export const SCORE_BY_KIND: Record<EnemyKind, number> = {
  bee: 50,
  butterfly: 80,
  boss: 150,
};

/** Squared hit radius for player-bullet vs enemy. The enemy diamond sprite
 *  is ~12px wide; bullets are 2x8 — an 8px center-to-center radius matches
 *  the visible silhouette without being punitively generous. */
export const ENEMY_HIT_RADIUS = 8;
/** Squared hit radius for enemy-shot / diving-enemy vs the player fighter.
 *  The fighter triangle is ~14px wide; 9px keeps grazes survivable. */
export const PLAYER_HIT_RADIUS = 9;
/** Ticks the fighter stays off-screen between lives. ~1s at 60Hz. */
export const RESPAWN_TICKS = 60;

/** Native playfield size — portrait, mobile-first (Galaga is a vertical
 *  shooter). Kept here so engine + index.html + tests share one source. */
export const WIDTH = 320;
export const HEIGHT = 448;

/** Canonical initial state. The engine seeds `window.__galaga` from this. */
export function initialState(): GameState {
  return {
    status: "ready",
    tick: 0,
    score: 0,
    lives: 3,
    stage: 1,
    field: { width: WIDTH, height: HEIGHT },
    player: {
      x: WIDTH / 2,
      y: HEIGHT - 40,
      alive: true,
      captured: false,
      dual: false,
    },
    enemies: [],
    bullets: [],
    captureBeamActive: false,
  };
}

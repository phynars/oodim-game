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
  /** Player-death juice (#160): respawn fade-in alpha multiplier. The engine
   *  writes this for `RESPAWN_FADE_TICKS` after the fighter respawns —
   *  monotonically increasing from 1/N toward 1.0 over the fade window, then
   *  stays at 1.0. Renderer multiplies into the fighter's draw alpha so the
   *  next life eases in instead of snapping. Undefined when not in a
   *  fade-in window (fully visible). Surfaced on the contract so the e2e
   *  harness can assert the renderer-side easing without canvas pixel reads. */
  respawnFadeAlpha?: number;
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
  /** Boss two-hit armor (#68). A boss Galaga survives its FIRST player-bullet
   *  hit — `damaged` flips false→true, NO score is awarded, and the boss
   *  STAYS in the roster (so it keeps blocking stage-advance until it dies).
   *  The SECOND hit on a `damaged===true` boss removes it + scores via
   *  `scoreFor`. Only bosses ever set this; bees/butterflies die on the first
   *  hit and never carry the flag (it stays `undefined` for them). Surfaced on
   *  the public contract so the renderer can paint a damaged boss a different
   *  color and the e2e harness can assert the mid-armor state. */
  damaged?: boolean;
}

/** A shot in flight. `from` distinguishes the player's bullets (travel up)
 *  from enemy fire (travels down). */
export interface Bullet {
  x: number;
  y: number;
  from: "player" | "enemy";
}

/** Short-lived particle burst spawned on enemy death. */
export interface Explosion {
  /** Center of the burst, canvas-px. */
  x: number;
  y: number;
  /** Fixed-step ticks since spawn. Engine increments each update; culled
   *  once `age >= EXPLOSION_TICKS`. */
  age: number;
}

/** Floating "+N" score popup spawned alongside an explosion. */
export interface ScorePopup {
  x: number;
  y: number;
  /** Score amount displayed, e.g. 50 for a bee. */
  value: number;
  age: number;
}

/** Per-tick juice spark spawned at a bullet→enemy hit (#133). Lives on the
 *  public contract so the renderer (and any e2e assertion) can read the
 *  particle burst without reaching into engine internals. Velocities are
 *  px/tick (already multiplied each tick); `ageTicks` is incremented by
 *  the engine and the spark is culled when `ageTicks >= lifetimeTicks`.
 *
 *  Per-spark `lifetimeTicks` (rather than a single global ceiling) means a
 *  damage-hit spark — which spawns 4 at half the lifetime of a kill burst —
 *  records its OWN ceiling instead of bucket-sharing the kill ceiling via
 *  a pre-aged `ageTicks`. Renderers reading `ageTicks/lifetimeTicks` as a
 *  normalized 0..1 freshness value (for alpha/scale fades) get the right
 *  answer in both buckets. */
export interface FeedbackSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageTicks: number;
  lifetimeTicks: number;
}

/** Floating "+N" hit popup spawned on a kill (#133). Distinct from the
 *  legacy `ScorePopup` (which the explosion VFX in `killEnemy` already
 *  drives) — this one lives on the juice `FeedbackChannel` so the channel
 *  is self-contained and the e2e contract can assert the hit-juice slot
 *  independently. Renderer eases upward + fades. */
export interface FeedbackPopup {
  x: number;
  y: number;
  /** Score amount displayed at spawn. */
  value: number;
  ageTicks: number;
}

/** Bullet→enemy hit juice (#133). Pure-data channel on `GameState`: the
 *  engine writes (on kills and boss-damage events), the renderer reads
 *  (applies shake transform + draws sparks/popups). Decays each tick.
 *
 *  Hitstop semantics: while `hitstopTicks > 0`, the engine's per-tick
 *  simulation update is SKIPPED — enemies/bullets stay byte-identical to
 *  the prior tick — but the renderer still draws and the hitstop counter
 *  itself decrements. That's the "frozen frame on the hit" beat.
 *
 *  Decay (per tick, when sim is NOT frozen):
 *    shakeAmplitude *= SHAKE_DECAY_PER_TICK  (~τ 60ms at 60Hz)
 *    sparks: position += velocity, ageTicks++, cull at SPARK_LIFETIME_TICKS
 *    popups: ageTicks++, cull at POPUP_LIFETIME_TICKS
 *    hitstopTicks: -- (one per tick, floored at 0) */
export interface FeedbackChannel {
  /** Decaying screen-shake amplitude in px. Renderer applies as a small
   *  random xy translate on the canvas; decays toward 0 each tick. */
  shakeAmplitude: number;
  /** Remaining hitstop ticks. While >0, the engine SKIPS its per-tick
   *  simulation update; renderer still draws; input still buffers. */
  hitstopTicks: number;
  /** Transient spark bursts spawned on hits/kills. Engine ages + prunes. */
  sparks: FeedbackSpark[];
  /** Floating "+N" hit popups. Renderer eases upward and fades. */
  popups: FeedbackPopup[];
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
  /** Active explosion VFX. Each entry is a short-lived particle burst spawned
   *  when an enemy dies; the engine ticks `age` up per fixed-step and culls
   *  once `age >= EXPLOSION_TICKS`. Surfaced on the contract so the e2e
   *  harness can prove a polish-state flag landed (and so future renderers
   *  or HUD overlays can read VFX without reaching into the engine). */
  explosions: Explosion[];
  /** Floating "+N" score popups spawned alongside an explosion. Drift upward
   *  and fade; same lifecycle shape as explosions. */
  scorePopups: ScorePopup[];
  /** Bullet→enemy hit juice channel (#133). Engine writes on hits/kills,
   *  decays each tick; renderer reads. Initial values all zero/empty. */
  feedback: FeedbackChannel;
  /** Player bullets fired during the current non-challenging stage. Reset to
   *  0 at the start of each new normal stage; the hit-miss accuracy bonus
   *  (#65) is computed from `stageHits / stageShotsFired` at stage-advance.
   *  `forceHit({target:'enemy'})` MUST bump this in lockstep with `stageHits`
   *  so the e2e harness can simulate any accuracy ratio deterministically
   *  (forceHit bypasses bullet spawn). Challenging stages do not advance
   *  this counter — the bonus path is skipped on challenging clears. */
  stageShotsFired: number;
  /** Player-bullet kills landed during the current non-challenging stage.
   *  Pairs with `stageShotsFired` to compute the post-stage hit-miss ratio
   *  bonus (#65). Reset to 0 alongside `stageShotsFired` at stage-advance. */
  stageHits: number;
  /** True while a Challenging (bonus) stage is in flight. During a challenging
   *  stage the contract guarantees: NO `from:'enemy'` bullets spawn, no contact
   *  damage from divers, and a perfect clear (every enemy that flew through
   *  was destroyed) awards `CHALLENGING_PERFECT_BONUS` to `score`. The stage
   *  ends — and the flag flips back to false — once every wave has flown off
   *  the bottom of the field (or been destroyed). */
  challenging: boolean;
}

/** Input-latency probe (#168). Returned by `__galagaInternals.fireProbe()` —
 *  a read-only snapshot of the engine ticks at which the most recent fire
 *  press was observed and the projectile actually entered the bullet array.
 *  The merge gate at `galaga/e2e/feel/input-latency.spec.ts` asserts that
 *  `deltaTicks <= 1` at p50/p99 across 30 fires.
 *
 *  - `lastKeydownTick`: the engine tick on which `consumeFire()` returned
 *    true (i.e. the fixed-step update that observed the Space keydown
 *    edge). Edge-triggered semantics mean each press surfaces on at most
 *    one tick, so this strictly monotonically increases across presses.
 *  - `lastProjectileSpawnTick`: the engine tick on which a player bullet
 *    was actually pushed into `state.bullets`. A press denied by the
 *    MAX_PLAYER_BULLETS cap (or fired while !canAct) does NOT advance
 *    this — the probe reports the prior spawn tick paired with the new
 *    keydown tick, and the spec is expected to wait for the cap to clear
 *    before pressing again.
 *  - `deltaTicks`: `lastProjectileSpawnTick - lastKeydownTick`. In the
 *    arcade-correct world this is 0 (same tick that consumed the press
 *    also pushed the bullet) or 1 if the spawn rolls to the next tick.
 *    A median ≥ 2 signals a structural deferral and fails the gate. */
export interface FireProbe {
  lastKeydownTick: number;
  lastProjectileSpawnTick: number;
  deltaTicks: number;
}

/** Test-only escape hatch. The e2e harness can force a deterministic
 *  collision outcome (kill an enemy, or kill the player) without having to
 *  align bullet/enemy positions through the simulation. Exposed on `window`
 *  alongside `__galaga` so Playwright can drive it from page.evaluate.
 *
 *  Intentionally tiny: one method, two targets. If `target` is 'enemy', the
 *  first enemy (or `enemyId` if given) is treated as if a player bullet just
 *  hit it — removed + scored. If `target` is 'player', the fighter takes a
 *  hit (alive=false, lives--, respawn timer armed; at 0 lives → status='lost').
 *
 *  `triggerBossCapture` arms a boss tractor beam directly over the player so
 *  the capture mechanic (#37) can be asserted deterministically without
 *  waiting for the dive scheduler to roll a boss into range. The hook picks
 *  the first available boss in the roster (or the one matching `bossId`),
 *  places it above the player, and flips `captureBeamActive=true`. The
 *  engine's per-tick capture check then closes the loop on its own. */
export interface GalagaInternals {
  /** Force a deterministic collision outcome. `juice` (default `false`) opts
   *  into the bullet→enemy hit-juice writes (#133): when true, a successful
   *  enemy kill writes hitstop/shake/sparks/popup to `state.feedback`; when
   *  false, the kill is bookkeeping-only (no hitstop freeze of the sim).
   *
   *  The default is `false` so the EXISTING mass-kill test patterns
   *  (perfect-stage, challenging-stage, formation-clear) — which call
   *  `forceHit` dozens of times across rAF yields — don't keep `hitstopTicks`
   *  pinned > 0 and starve the spawn scheduler / `maybeAdvanceStage` of
   *  simulation ticks. The new hit-juice spec (galaga/e2e/hit-juice.spec.ts)
   *  passes `juice: true` to OBSERVE the channel; real bullet→enemy
   *  collisions in `resolveCollisions` always write the juice regardless. */
  forceHit(opts: {
    target: "enemy" | "player";
    enemyId?: number;
    juice?: boolean;
  }): void;
  triggerBossCapture(opts?: { bossId?: number }): void;
  /** Force the engine to start a Challenging (bonus) stage now, replacing the
   *  current formation with a set-pattern flythrough wave. While active,
   *  `state.challenging===true`, no `from:'enemy'` bullets spawn, divers don't
   *  damage the player on contact, and a perfect clear awards a bonus. The
   *  hook keeps the harness deterministic — no need to advance through N
   *  normal stages to land on a challenging one. */
  startChallengingStage(): void;
  /** Force the dual-fighter mode on/off without driving through the capture
   *  + rescue choreography. The rescue chain is multi-second (boss arms beam
   *  → capture → kill captor); for an e2e assertion that only cares about
   *  the FIRING behavior in dual mode (#63), this hook lets the harness
   *  flip `player.dual` directly. No side effects on lives/enemies — purely
   *  a flag flip on the public contract. */
  forceDual(value: boolean): void;
  /** Input-latency probe (#168). Returns the most recent
   *  keydown→projectile-spawn delta in engine ticks, or `null` if no fire
   *  press has been observed yet. Test-only — does not affect gameplay.
   *  See `FireProbe` for the field semantics + how to read the result. */
  fireProbe(): FireProbe | null;
}

declare global {
  interface Window {
    /** Test contract. See galaga/docs/ARCHITECTURE.md. */
    __galaga?: GameState;
    /** Test-only collision hook — see `GalagaInternals`. */
    __galagaInternals?: GalagaInternals;
  }
}

/** Formation-state point values per archetype. Galaga's "parked" values.
 *  Diving / capturing kills score the higher per-state value via `scoreFor`
 *  (#71). Kept as a flat lookup for back-compat with callers that don't
 *  know the enemy's state — gameplay code should prefer `scoreFor`. */
export const SCORE_BY_KIND: Record<EnemyKind, number> = {
  bee: 50,
  butterfly: 80,
  boss: 150,
};

/** Diving-state point values per archetype (arcade-faithful 2× formation,
 *  rounded to the classic table). `capturing` bosses score the diving
 *  value — they're mid-attack with the tractor beam armed. `escort` is
 *  scored separately on rescue (1000) and not represented here; if an
 *  escort is ever killed in-flight (out of scope today), it falls back to
 *  the formation value. */
export const SCORE_BY_KIND_DIVING: Record<EnemyKind, number> = {
  bee: 100,
  butterfly: 160,
  boss: 400,
};

/** Per-state score helper (#71). Galaga's signature risk/reward — shoot
 *  enemies WHILE they dive, score more. Centralized so the engine's
 *  `killEnemy` call site AND the floating "+N" popup take the same value.
 *
 *  Rules:
 *   - `diving` and `capturing` → diving table (mid-attack).
 *   - `formation`, `entering`, `escort` → formation table.
 *
 *  Boss values (150 / 400) must match #68's per-state scoring. */
export function scoreFor(kind: EnemyKind, state: EnemyState): number {
  if (state === "diving" || state === "capturing") {
    return SCORE_BY_KIND_DIVING[kind];
  }
  return SCORE_BY_KIND[kind];
}

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
    challenging: false,
    stageShotsFired: 0,
    stageHits: 0,
    explosions: [],
    scorePopups: [],
    feedback: {
      shakeAmplitude: 0,
      hitstopTicks: 0,
      sparks: [],
      popups: [],
    },
  };
}

// ---- Bullet→enemy hit juice constants (#133) -----------------------------

/** Hitstop frames on a NON-BOSS kill (bee / butterfly) or a boss's SECOND
 *  hit. 2 frames at 60Hz ≈ 33ms — long enough to register the impact,
 *  short enough not to feel sluggish. The engine's simulation pass is
 *  SKIPPED for this many ticks after the hit. */
export const HITSTOP_KILL_TICKS = 2;
/** Hitstop frames on a boss's FIRST hit (damaged, not killed). 1 frame —
 *  the half-hit registers but doesn't overstay. */
export const HITSTOP_DAMAGE_TICKS = 1;
/** Initial screen-shake amplitude (px) on a non-boss kill / boss second hit. */
export const SHAKE_AMPLITUDE_KILL = 3;
/** Initial screen-shake amplitude (px) on a boss FIRST hit (half-kill). */
export const SHAKE_AMPLITUDE_DAMAGE = 1.5;
/** Per-tick multiplicative shake decay. Sized to satisfy #133's acceptance
 *  criterion "shake amplitude < 0.1 within 16 ticks of last hit" starting
 *  from amplitude 3, accounting for the 2-frame hitstop pause (decay does
 *  NOT run during hitstop): with 14 decay ticks inside the 16-tick window,
 *  3 * 0.78^14 ≈ 0.095 — just under the bound. τ ≈ 60ms at 60Hz, matching
 *  the issue's stated target. The spec's first-draft 0.88 was undershoot;
 *  the issue body explicitly invites refinement. */
export const SHAKE_DECAY_PER_TICK = 0.78;
/** Spark count spawned on a kill (#133). */
export const SPARK_COUNT_KILL = 8;
/** Spark count spawned on a boss damage hit (half the kill). */
export const SPARK_COUNT_DAMAGE = 4;
/** Spark lifetime in ticks on a kill (~300ms at 60Hz). */
export const SPARK_LIFETIME_KILL_TICKS = 18;
/** Spark lifetime in ticks on a boss damage hit (half the kill). */
export const SPARK_LIFETIME_DAMAGE_TICKS = 9;
/** Hit popup lifetime in ticks (~600ms at 60Hz). */
export const POPUP_LIFETIME_TICKS = 36;

// ---- Player-death juice constants (#160) ---------------------------------
//
// Death is the inverse of the bullet→enemy kill and must feel HEAVIER (not
// just bigger): longer hitstop so the player registers what happened, a
// larger shake that decays through more visible territory, an outward
// spark burst that reads as your-ship-disintegrating, and a respawn ease-in
// so the next fighter doesn't snap into existence at full alpha.

/** Hitstop frames on player death (#160). 8 ticks ≈ 133ms at 60Hz — 4× the
 *  kill freeze (`HITSTOP_KILL_TICKS = 2`). The player needs to *see* the
 *  death frame, not blink past it. */
export const HITSTOP_DEATH_TICKS = 8;
/** Initial screen-shake amplitude (px) on player death (#160). 7px vs. the
 *  kill's 3px — the bigger amp decays through more visible territory
 *  (~480ms to <0.1 at SHAKE_DECAY_PER_TICK=0.78) so the room rattles. */
export const SHAKE_AMPLITUDE_DEATH = 7;
/** Spark count on player death (#160). 20 vs. the kill's 8 — reads as the
 *  fighter disintegrating, not the enemy popping. Velocities are 2.5–4.5
 *  px/tick (faster than the kill's 1.5–3) — outward burst, not gentle puff. */
export const SPARK_COUNT_DEATH = 20;
/** Per-spark lifetime on player death (#160). 30 ticks ≈ 500ms — sparks
 *  linger longer than the kill's 18 ticks so the burst's silhouette reads
 *  even after the hitstop releases. */
export const SPARK_LIFETIME_DEATH_TICKS = 30;
/** Respawn fade-in length in ticks (#160). The fighter draws at alpha
 *  `k / RESPAWN_FADE_TICKS` for the first N ticks after respawn — linear
 *  is fine; 20 ticks ≈ 333ms is short enough that an easing curve would
 *  be over-engineering. After the window the fighter is at full alpha. */
export const RESPAWN_FADE_TICKS = 20;

/** Ticks an explosion stays on screen before the engine culls it. ~0.5s
 *  at 60Hz — long enough to read, short enough not to clutter. */
export const EXPLOSION_TICKS = 30;
/** Ticks a score popup drifts upward before culling. ~0.75s at 60Hz. */
export const SCORE_POPUP_TICKS = 45;

/** Score awarded for a perfect challenging-stage clear (every flythrough
 *  enemy destroyed). The arcade's bonus stage payouts varied — 10000 for a
 *  perfect — we use a single round number here, matching the magnitude. */
export const CHALLENGING_PERFECT_BONUS = 10000;

/** How many enemies fly through during one challenging stage. Set-pattern
 *  waves of 8 keep the e2e harness fast while preserving the "many enemies,
 *  no fire" feel. */
export const CHALLENGING_WAVE_COUNT = 8;

/** Hit-miss accuracy bonus tiers (#65). Arcade-faithful Galaga grades the
 *  player's per-stage firing accuracy on the post-stage "HIT-MISS RATIO"
 *  screen and awards a tiered bonus. Tiers are ordered HIGHEST-FIRST so the
 *  lookup walks down and picks the first whose `minRatio` is satisfied.
 *  `ratio === 0 shots fired` short-circuits to 0 (no shutout exploit). */
export interface HitMissTier {
  /** Inclusive lower bound on hits/shots ratio (0..1). */
  minRatio: number;
  /** Point bonus awarded at stage-advance when the achieved ratio lands
   *  in this tier. */
  bonus: number;
}
export const HIT_MISS_BONUS_TIERS: ReadonlyArray<HitMissTier> = [
  { minRatio: 0.95, bonus: 10000 },
  { minRatio: 0.7, bonus: 5000 },
  { minRatio: 0.5, bonus: 2000 },
  { minRatio: 0.3, bonus: 1000 },
  { minRatio: 0.1, bonus: 500 },
  { minRatio: 0, bonus: 100 },
] as const;

/** Look up the hit-miss bonus for a given shots/hits pair. Returns 0 when
 *  no shots were fired (you can't earn a bonus by holding fire). Centralized
 *  so engine and tests agree on the tier math. */
export function hitMissBonus(shotsFired: number, hits: number): number {
  if (shotsFired <= 0) return 0;
  const ratio = hits / shotsFired;
  for (const t of HIT_MISS_BONUS_TIERS) {
    if (ratio >= t.minRatio) return t.bonus;
  }
  return 0;
}

// Galaga engine — SCAFFOLD. Deliberately minimal: it runs a fixed-step game
// loop, scrolls a starfield, draws the player fighter, and publishes the
// `window.__galaga` state contract. It boots to 'ready' and flips to 'playing'
// on first input (so the e2e harness can prove the loop ticks).
//
// Everything that IS the game — ship movement, firing, the enemy formation +
// entrance choreography, diving attacks, collisions/lives, scoring/stages, the
// boss capture beam + dual-fighter rescue, and the challenging stage — is the
// AUTONOMOUS BACKLOG (see galaga/docs/ARCHITECTURE.md). This file is the floor
// the studio builds up from, mirroring how Pac-Man started from a loop + maze.

import {
  CHALLENGING_PERFECT_BONUS,
  EXPLOSION_TICKS,
  hitMissBonus,
  HITSTOP_DAMAGE_TICKS,
  HITSTOP_DEATH_TICKS,
  HITSTOP_KILL_TICKS,
  initialState,
  POPUP_LIFETIME_TICKS,
  RESPAWN_FADE_TICKS,
  SCORE_POPUP_TICKS,
  SHAKE_AMPLITUDE_DAMAGE,
  SHAKE_AMPLITUDE_DEATH,
  SHAKE_AMPLITUDE_KILL,
  SHAKE_DECAY_PER_TICK,
  SPARK_COUNT_DAMAGE,
  SPARK_COUNT_DEATH,
  SPARK_COUNT_KILL,
  SPARK_LIFETIME_DAMAGE_TICKS,
  SPARK_LIFETIME_DEATH_TICKS,
  SPARK_LIFETIME_KILL_TICKS,
  STAGE_BONUS,
  STAGE_BONUS_TALLY_DURATION,
  STAGE_CLEAR_HITSTOP_TICKS,
  stageClearDisplayScore,
  WIDTH,
  HEIGHT,
  ENEMY_HIT_RADIUS,
  PLAYER_HIT_RADIUS,
  RESPAWN_TICKS,
  scoreFor,
  type Bullet,
  type FeedbackSpark,
  type GameState,
} from "./types";
import {
  combineInputs,
  createKeyboardInput,
  createTouchInput,
  MAX_PLAYER_BULLETS,
  PLAYER_BULLET_SPEED_PX_PER_TICK,
  PLAYER_SPEED_PX_PER_TICK,
  type InputSource,
  type TouchInputElements,
} from "./input";
import {
  createEnemyController,
  ENEMY_BULLET_SPEED_PX_PER_TICK,
  ENEMY_FIRE_COOLDOWN_TICKS,
  ENEMY_FIRE_PROBABILITY,
  ENEMY_FIRE_PROBABILITY_BOSS,
  type EnemyController,
} from "./enemies";

interface Star {
  x: number;
  y: number;
  /** px/tick downward — parallax layers scroll at different speeds. */
  speed: number;
  /** 0..1 brightness. */
  level: number;
}

/** Fixed timestep: 60 logical updates/sec, decoupled from render rAF. */
const STEP_MS = 1000 / 60;
/** Deeper parallax starfield — three discrete speed layers (far/mid/near).
 *  Continuous speed spread doesn't read as parallax; quantizing into tiers
 *  is what makes the eye lock onto the depth. The arcade's signature
 *  horizon-of-stars feel needs density too: 90 stars at 320×448 is ~1 star
 *  per ~1600 px², readable but not noisy. */
const STAR_COUNT = 90;
/** px/tick per parallax tier. Far is barely-drifting backdrop; near races
 *  past. Brightness is biased to match — distant stars dimmer than near. */
const STAR_SPEEDS = [0.35, 0.7, 1.15] as const;
/** Fixed-step frames the engine holds in the 'lost' state before advancing
 *  to 'gameover'. ~0.5s at 60Hz — long enough that the death frame reads,
 *  short enough that the overlay doesn't feel delayed. */
const GAMEOVER_HOLD_FRAMES = 30;

export class Engine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private state: GameState;
  private stars: Star[];
  private readonly input: InputSource;
  private readonly enemies: EnemyController;
  /** Tick at which the enemy formation choreography starts. Set when the
   *  game leaves READY so the entrance arcs play from t=0 relative to
   *  gameplay (not from whatever tick the loop happens to be on). */
  private formationStartTick: number | null = null;
  /** Tick at which the fighter died; null while alive. Once
   *  state.tick - deathTick >= RESPAWN_TICKS the fighter respawns at the
   *  spawn x, alive=true. At 0 lives we don't respawn — status flips to
   *  'lost' instead (the contract's terminal "you died" state). */
  private deathTick: number | null = null;
  /** Tick at which the fighter respawned; null when not currently in a
   *  fade-in window. Player-death juice (#160): for `RESPAWN_FADE_TICKS`
   *  ticks after respawn, the engine writes `player.respawnFadeAlpha` so
   *  the renderer fades the fighter in instead of snapping at full alpha. */
  private respawnTick: number | null = null;
  /** Per-enemy fire cooldown — keyed by enemy id, value is the tick at
   *  which that enemy is next eligible to fire. A diver picked up on tick
   *  T can't fire again until T + ENEMY_FIRE_COOLDOWN_TICKS. Entries for
   *  dead enemies are GC'd opportunistically (size bounded by roster). */
  private enemyFireCooldown: Map<number, number> = new Map();
  /** Tick until which the "STAGE N" banner is painted. Set when we advance
   *  to the next stage; the renderer reads this each frame. Null = no banner. */
  private stageBannerUntil: number | null = null;
  /** Per-stage kill count for the in-flight challenging stage. Compared
   *  against `enemies.challengingTotalSpawned()` when the stage ends to
   *  detect a perfect clear (every flythrough enemy destroyed). Reset
   *  whenever a challenging stage starts. */
  private challengingKills = 0;
  /** Tick until which the "PERFECT! +N" banner is painted after a perfect
   *  challenging clear. Null = no banner. */
  private perfectBannerUntil: number | null = null;
  /** Tick until which the "HIT —N" banner is painted after a NON-perfect
   *  challenging exit (#310). Inverse charge to PERFECT! — same slot, same
   *  duration, mutually exclusive. Null = no banner. */
  private missedBannerUntil: number | null = null;
  /** Count of challenging-stage enemies that escaped on the most recent
   *  non-perfect exit (#310). Painted next to the HIT banner as "HIT —N";
   *  also exposed via __galagaInternals so the e2e harness can assert it
   *  deterministically without canvas pixel reads. */
  private missedBannerCount = 0;
  /** Tick until which the "BACK" banner is painted at the rescue dock —
   *  the inverse beat to the state-keyed "TAKEN" banner. Set inside
   *  `killEnemy`'s rescue path; the renderer reads it each frame. Null = no
   *  banner. ~0.75s lifetime (45 ticks @ 60Hz) — briefer than STAGE because
   *  the dual sprite already carries the visual moment; the word just
   *  closes the keeper line's promise ("the tractor beam can take something
   *  from you" → and you can take it back). One syllable, mirror to TAKEN. */
  private backBannerUntil: number | null = null;
  /** Hit-miss accuracy snapshot for the just-cleared normal stage (#65).
   *  Captured at `maybeAdvanceStage` BEFORE counters reset so the renderer
   *  can paint "SHOTS FIRED / HITS / RATIO / BONUS" lines under the
   *  STAGE N banner. Null when no stage has been cleared yet OR the most
   *  recent clear was a challenging stage (bonus path is skipped). */
  private lastHitMiss: {
    shots: number;
    hits: number;
    bonus: number;
  } | null = null;
  /** Tick at which status flipped to 'lost'. After GAMEOVER_HOLD_FRAMES more
   *  fixed-step frames elapse the status advances to 'gameover' (the terminal
   *  state the GAME OVER overlay annotates). Null while still playing. */
  private lostTick: number | null = null;
  /** Fixed-step frames accumulated since status flipped to 'lost'. We count
   *  these independently of state.tick because state.tick is frozen once we
   *  leave 'playing' (it's the in-game wall clock, not real time). */
  private gameOverFrames = 0;
  private lastTime = 0;
  private accumulator = 0;
  /** Input-latency probe (#168) — engine tick at which `consumeFire()` most
   *  recently returned true (i.e. the fixed-step update that observed the
   *  Space keydown edge). `-1` until the first fire press. Read by the
   *  `fireProbe()` accessor wired in `exposeInternals`. */
  private lastKeydownTick = -1;
  /** Input-latency probe (#168) — engine tick at which a player bullet was
   *  most recently pushed into `state.bullets`. `-1` until the first
   *  successful spawn. A press denied by MAX_PLAYER_BULLETS / !canAct does
   *  NOT advance this; see `FireProbe` jsdoc in types.ts for the contract. */
  private lastProjectileSpawnTick = -1;
  /** Test-only invulnerability (#260). When true, killPlayer() and boss capture
   *  are no-ops, so a stationary player survives a measurement sweep (e.g. the
   *  input-latency feel spec firing 30x) without a diving enemy killing it
   *  mid-test — which would drop canAct and stall the spec's spawn wait. Set via
   *  __galagaInternals.setInvulnerable; default false (zero gameplay effect). */
  private invulnerable = false;

  constructor(canvas: HTMLCanvasElement, touchElements?: TouchInputElements) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.state = initialState();
    this.stars = this.seedStars();
    // Keyboard is always present; touch is wired only when the host page
    // hands us the three on-screen buttons (left/right/fire). Both sources
    // feed the same edge-triggered/polled contract via combineInputs so
    // the rest of the engine never knows which device is driving.
    const keyboard = createKeyboardInput();
    this.input = touchElements
      ? combineInputs([keyboard, createTouchInput(touchElements)])
      : keyboard;
    this.enemies = createEnemyController();
    this.publish();
    this.bindInput();
    this.exposeInternals();
  }

  /** Test-only escape hatch. The e2e harness can force a deterministic
   *  collision outcome — kill the first enemy, or kill the player — without
   *  having to align positions through the simulation. See `GalagaInternals`
   *  in types.ts. Only the harness reads this; gameplay code never does. */
  private exposeInternals(): void {
    window.__galagaInternals = {
      forceHit: (opts) => {
        if (opts.target === "enemy") {
          if (this.state.enemies.length === 0) return;
          const idx =
            opts.enemyId === undefined
              ? 0
              : this.state.enemies.findIndex((e) => e.id === opts.enemyId);
          if (idx < 0) return;
          // The hit-miss accuracy contract (#65): forceHit bypasses the
          // bullet spawn path, so we bump BOTH counters here in lockstep —
          // a simulated shot that lands. Skipped on challenging stages so
          // the bonus path stays gated to normal stages only.
          if (!this.state.challenging) {
            this.state.stageShotsFired += 1;
            this.state.stageHits += 1;
          }
          // `juice` defaults to false so the existing mass-kill harness
          // patterns (perfect-stage drain, challenging-stage drain,
          // formation clear) don't pin `hitstopTicks > 0` across rAF
          // yields and starve `enemies.tick()` / `maybeAdvanceStage` of
          // simulation ticks. The new hit-juice spec opts IN to observe
          // the channel; real player-bullet collisions in
          // `resolveCollisions` always write the juice unconditionally.
          this.killEnemy(idx, opts.juice === true);
        } else {
          this.killPlayer();
        }
        // forceHit is a test-only path; still honor the stage-clear contract
        // so the e2e harness can drive an entire formation kill via repeated
        // forceHit calls and observe `stage` increment + a fresh roster.
        this.maybeAdvanceStage();
        this.publish();
      },
      startChallengingStage: () => {
        // Replace the current roster with a Challenging (bonus) wave. The
        // engine mirrors `enemies.isChallenging()` onto `state.challenging`
        // each tick (see update()), so we don't need to flip the flag here
        // — but we DO reset the per-stage kill counter and re-anchor the
        // formation tick so the wave's choreography plays from t=0.
        this.enemies.startChallengingStage();
        this.state.enemies = [];
        this.state.bullets = [];
        this.state.challenging = true;
        this.challengingKills = 0;
        this.formationStartTick = null;
        this.publish();
      },
      triggerBossCapture: (opts) => {
        // Arm a boss tractor beam directly over the player. The controller
        // parks the boss above the fighter; the engine's per-tick capture
        // check then flips `captureBeamActive` + completes the capture.
        const bossId = this.enemies.beginCapture(
          this.state.player.x,
          this.state.player.y,
          opts?.bossId,
        );
        if (bossId === null) return;
        this.state.captureBeamActive = true;
        this.publish();
      },
      forceDual: (value) => {
        // Test-only escape hatch (#63). The rescue choreography is several
        // seconds end-to-end (beam → capture → kill captor → dock); for a
        // FIRING-behavior assertion we just need `player.dual` flipped.
        // Engine never reads from here — gameplay code only ever sets the
        // flag through killEnemy's rescue path or demoteDual on death.
        this.state.player.dual = value;
        this.publish();
      },
      fireProbe: () => {
        // Input-latency probe (#168). Returns null until the first fire
        // press is observed AND a projectile spawn has been recorded —
        // before that, `deltaTicks` has no meaningful value. After the
        // first spawn, the snapshot pairs the most recent keydown tick
        // with the most recent spawn tick; a press denied by the cap
        // leaves the spawn tick stale, so the spec must wait for the
        // cap to clear before the next press (see `FireProbe` jsdoc).
        if (this.lastKeydownTick < 0 || this.lastProjectileSpawnTick < 0) {
          return null;
        }
        return {
          lastKeydownTick: this.lastKeydownTick,
          lastProjectileSpawnTick: this.lastProjectileSpawnTick,
          deltaTicks: this.lastProjectileSpawnTick - this.lastKeydownTick,
        };
      },
      setInvulnerable: (value: boolean) => {
        this.invulnerable = value;
      },
      getPerfectBanner: () => {
        // Read-only window into the perfect-banner state. Mirrors
        // getMissBanner: returns null when no banner is currently armed
        // (either never armed, or already expired). The bonus is included so
        // the harness can assert the banner's awarded value without canvas
        // pixel reads.
        if (this.perfectBannerUntil === null) return null;
        if (this.state.tick > this.perfectBannerUntil) return null;
        return {
          until: this.perfectBannerUntil,
          bonus: CHALLENGING_PERFECT_BONUS,
        };
      },
      getMissBanner: () => {
        // #310 read-only window into the miss-banner state. Returns null
        // when the banner isn't currently armed (either never armed, or
        // already expired — the render block clears `missedBannerUntil`
        // once `state.tick` passes it). Engine.tick is the truth; we
        // re-check here so a stale snapshot through rAF can't mislead.
        if (this.missedBannerUntil === null) return null;
        if (this.state.tick > this.missedBannerUntil) return null;
        return {
          until: this.missedBannerUntil,
          count: this.missedBannerCount,
        };
      },
      getStageBanner: () => {
        // #329 read-only window into the STAGE-banner state. Mirrors
        // getMissBanner — returns null when no banner is currently armed
        // (either never armed, or already expired). The `stage` field
        // mirrors `state.stage` at the time of the read so the harness
        // can assert "STAGE 1 banner is up" without a canvas pixel read.
        if (this.stageBannerUntil === null) return null;
        if (this.state.tick > this.stageBannerUntil) return null;
        return {
          until: this.stageBannerUntil,
          stage: this.state.stage,
        };
      },
      displayScore: () => {
        // #273 read-only window into the stage-clear count-up. Mirrors the
        // renderer's HUD math exactly (shared `stageClearDisplayScore`), so a
        // spec can assert the pre-clear → hitstop-hold → mid-tally → final
        // sequence without a canvas pixel read.
        return stageClearDisplayScore(this.state);
      },
    };
  }

  /** Write a hit-juice burst into the public `feedback` channel (#133).
   *  Centralized so the boss-damage path and the kill path drop into one
   *  place. Sparks spawn radially with deterministic velocities derived
   *  from a sin-hash of `(enemyId, sparkIndex)` — same approach the engine
   *  already uses for enemy-fire RNG, so the e2e harness can assert exact
   *  spark counts without flakiness from `Math.random`.
   *
   *  Hitstop and shake amplitude CLAMP via `max` (NOT sum). The first
   *  draft used `+=` for hitstop so a flurry would extend the freeze —
   *  but the e2e harness drives mass-kill bursts via `forceHit` (perfect-
   *  stage / challenging-stage paths kill the entire roster across rAF
   *  yields). Under `+=`, hitstop accumulated faster than it decayed:
   *  N kills in one JS turn pinned the engine for 2N ticks, the spawn
   *  scheduler + `maybeAdvanceStage` were frozen out, and stage-advance
   *  waits never fired (CI red). `max` keeps the "frozen moment" feel
   *  on the strongest impact while letting the sim resume promptly —
   *  visually a flurry already conveys "lots of impact" through shake +
   *  sparks + popups, so we don't need the freeze to also stack.
   *  Sparks/popups still append (their bounded lifetimes self-cull). */
  private writeHitFeedback(
    x: number,
    y: number,
    enemyId: number,
    kind: "kill" | "damage",
    popupValue?: number,
  ): void {
    const fb = this.state.feedback;
    const isKill = kind === "kill";
    const hitstop = isKill ? HITSTOP_KILL_TICKS : HITSTOP_DAMAGE_TICKS;
    const amp = isKill ? SHAKE_AMPLITUDE_KILL : SHAKE_AMPLITUDE_DAMAGE;
    const count = isKill ? SPARK_COUNT_KILL : SPARK_COUNT_DAMAGE;
    const sparkLife = isKill
      ? SPARK_LIFETIME_KILL_TICKS
      : SPARK_LIFETIME_DAMAGE_TICKS;
    // CLAMP, don't accumulate — see jsdoc above. A second hit landing
    // while still mid-freeze just refreshes the freeze ceiling.
    fb.hitstopTicks = Math.max(fb.hitstopTicks, hitstop);
    fb.shakeAmplitude = Math.max(fb.shakeAmplitude, amp);
    // Radial spark spawn. Deterministic per (enemyId, sparkIdx) so e2e
    // assertions on `feedback.sparks.length` (and positions) are stable.
    // Speed in 1.5–3 px/tick per the spec; angle even-spaced + jittered.
    // Each spark carries its OWN `lifetimeTicks` — kill bursts use the
    // full kill ceiling, damage bursts the shorter damage ceiling — so a
    // renderer reading `ageTicks/lifetimeTicks` as a normalized 0..1
    // freshness value (alpha, scale) gets the right answer in both
    // buckets. The earlier draft bucket-shared `SPARK_LIFETIME_KILL_TICKS`
    // by pre-aging damage sparks; that was a smell (it lied to consumers
    // about how fresh the particle is). Per-spark `lifetimeTicks` keeps
    // `ageTicks=0` truthfully at spawn.
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      // sin-hash → 0..1 jitter, deterministic across runs.
      const jitter =
        (((Math.sin(enemyId * 91.337 + i * 13.13) * 43758.5453) % 1) + 1) % 1;
      const angle = baseAngle + (jitter - 0.5) * 0.4;
      const speed = 1.5 + jitter * 1.5; // 1.5..3.0 px/tick
      const spark: FeedbackSpark = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ageTicks: 0,
        lifetimeTicks: sparkLife,
      };
      fb.sparks.push(spark);
    }
    if (isKill && popupValue !== undefined) {
      fb.popups.push({ x, y, value: popupValue, ageTicks: 0 });
    }
  }

  /** Write player-death juice (#160) into the public `feedback` channel —
   *  the inverse beat to `writeHitFeedback`'s "kill". Mirrors that helper's
   *  shape (clamp hitstop/shake via Math.max, append sparks, NO popup) but
   *  with HEAVIER constants: 8-tick freeze (vs kill's 2), 7px shake (vs 3),
   *  20 outward sparks (vs 8) at 2.5–4.5 px/tick speed and 30-tick lifetime.
   *
   *  Deterministic spark velocities use the same sin-hash pattern as the
   *  kill burst, seeded by `(state.tick, sparkIdx)` so the e2e harness can
   *  assert exact spark counts without Math.random flakiness. No `enemyId`
   *  to seed by — the player isn't an enemy — but the death tick is a fine
   *  per-event seed (only one death per tick is possible). */
  private writeDeathFeedback(x: number, y: number): void {
    const fb = this.state.feedback;
    fb.hitstopTicks = Math.max(fb.hitstopTicks, HITSTOP_DEATH_TICKS);
    fb.shakeAmplitude = Math.max(fb.shakeAmplitude, SHAKE_AMPLITUDE_DEATH);
    const seed = this.state.tick;
    for (let i = 0; i < SPARK_COUNT_DEATH; i++) {
      const baseAngle = (i / SPARK_COUNT_DEATH) * Math.PI * 2;
      const jitter =
        (((Math.sin(seed * 91.337 + i * 13.13) * 43758.5453) % 1) + 1) % 1;
      const angle = baseAngle + (jitter - 0.5) * 0.4;
      // 2.5..4.5 px/tick — faster than kill's 1.5..3, reads as "ship
      // disintegrating outward" rather than "enemy popping radially".
      const speed = 2.5 + jitter * 2.0;
      const spark: FeedbackSpark = {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ageTicks: 0,
        lifetimeTicks: SPARK_LIFETIME_DEATH_TICKS,
      };
      fb.sparks.push(spark);
    }
    // No popup — death doesn't earn points.
  }

  /** Remove enemy at `idx` from the roster, add its kind's score. Centralized
   *  so the forceHit hook and the per-tick collision pass take the same path
   *  (and so future "explosion sprite" work hooks in one place). The kill is
   *  forwarded to the controller so the persistent roster also loses the
   *  enemy — otherwise the next `tick()` would re-emit it from the original
   *  schedule. */
  private killEnemy(idx: number, writeJuice: boolean = true): void {
    const e = this.state.enemies[idx];
    if (!e) return;
    // Boss two-hit armor (#68). A boss survives its FIRST hit: flip it to
    // `damaged` and bail BEFORE scoring/VFX/removal/escort. The boss stays in
    // the roster (still blocking stage-advance, still able to be mid-capture)
    // and awards NOTHING this hit — the kill score lands only on the second
    // hit, when `damaged===true` falls through to the normal path below. The
    // accuracy tally (#65) already counted this hit (forceHit/resolveCollisions
    // bump stageShotsFired+stageHits before calling killEnemy), so BOTH the
    // damage hit and the eventual kill hit count toward the ratio — intended.
    // The escort/rescue (#38) must NOT fire on a damage hit: returning here
    // skips `escortOfBoss` entirely, so a damaged-while-capturing boss keeps
    // its escort until the actual kill.
    if (e.kind === "boss" && e.damaged !== true) {
      this.enemies.damageBoss(e.id);
      // Mirror onto the public snapshot immediately so the contract reports
      // `damaged===true` on this very tick (don't wait for the next tick()'s
      // re-emit), matching how the capture path mirrors escort spawns.
      e.damaged = true;
      // Bullet→enemy hit juice (#133) — boss FIRST hit (damage, not kill).
      // Half the kill spec: 1-frame hitstop, 1.5px shake, 4 sparks at half
      // lifetime, NO popup (boss only scores on the kill hit). Suppressed
      // when forceHit was called with `juice: false` (default) — see the
      // jsdoc on `forceHit` in types.ts for why.
      if (writeJuice) {
        this.writeHitFeedback(e.x, e.y, e.id, /*kind*/ "damage");
      }
      return;
    }
    // Per-state scoring (#71): diving/capturing kills score the bonus
    // value (bee 100 / butterfly 160 / boss 400); formation/entering/escort
    // score the parked value (bee 50 / butterfly 80 / boss 150). The "+N"
    // popup below reuses `points`, so one call here covers both `score`
    // and the on-screen number.
    const points = scoreFor(e.kind, e.state);
    this.state.score += points;
    // Polish VFX (#42): spawn an explosion burst + a floating "+N" popup at
    // the enemy's last position. These live on the public contract so the
    // e2e harness can prove the polish state flag landed.
    this.state.explosions.push({ x: e.x, y: e.y, age: 0 });
    this.state.scorePopups.push({ x: e.x, y: e.y, value: points, age: 0 });
    // Bullet→enemy hit juice (#133) — KILL: 2-frame hitstop, 3px shake,
    // 8 sparks (full lifetime), +N popup on the channel. Written BEFORE
    // the splice so the kill position is the enemy's current (x,y).
    // Suppressed when forceHit was called with `juice: false` (default) —
    // see the jsdoc on `forceHit` in types.ts for why.
    if (writeJuice) {
      this.writeHitFeedback(e.x, e.y, e.id, /*kind*/ "kill", points);
    }
    // Track per-stage kills during a challenging stage so a perfect clear
    // (kills === total spawned) can award the bonus on stage-end.
    if (this.enemies.isChallenging()) this.challengingKills += 1;
    // Before we splice the boss out, check whether it owns a captured-
    // fighter escort. Killing the captor is the rescue moment (Galaga
    // #38): the escort flies down and docks beside the player → dual
    // fighter mode. The controller still holds the escort in its roster
    // (the public snapshot mirrors it), so we ask the controller for the
    // escort id, remove that escort from both the public state and the
    // internal roster, and flip `player.dual`. We only trigger this when
    // the player is still alive — a dead/respawning fighter can't dock
    // a rescue ship, and `captured` must be cleared so the engine's
    // input/firing path re-activates.
    if (e.kind === "boss") {
      const escortId = this.enemies.escortOfBoss(e.id);
      if (escortId !== null && this.state.player.alive) {
        // Remove the escort from the public snapshot (filter — the
        // controller's next tick() won't re-emit it because we also call
        // remove() on its persistent entry).
        this.state.enemies = this.state.enemies.filter(
          (en) => en.id !== escortId,
        );
        this.enemies.remove(escortId);
        this.state.player.dual = true;
        // The fighter was captured → now rescued: clear the captured flag
        // and re-enable control. The beam is owned by the captor we just
        // killed, so the controller's beam getters will return null on
        // the next tick; mirror that on this tick for a consistent snap.
        this.state.player.captured = false;
        this.state.captureBeamActive = false;
        // Voice the rescue (mirror to the TAKEN capture banner). The dual
        // sprite is the mechanic-speaking-itself; the word just closes the
        // keeper line's promise. ~0.75s — read it, then let the two ships
        // carry the rest.
        this.backBannerUntil = this.state.tick + 45;
        // Adjust the splice index if the escort sat before the captor
        // in the public roster — filter() may have shifted it.
        const newIdx = this.state.enemies.findIndex((en) => en.id === e.id);
        if (newIdx >= 0) {
          this.state.enemies.splice(newIdx, 1);
          this.enemies.remove(e.id);
          return;
        }
      }
    }
    this.state.enemies.splice(idx, 1);
    this.enemies.remove(e.id);
  }

  /** Drop from dual back to single fighter when a dual-mode life is lost.
   *  Called from killPlayer; centralized so the contract's "losing a dual
   *  fighter drops back to single" rule (#38) lives next to the rescue. */
  private demoteDual(): void {
    if (this.state.player.dual) this.state.player.dual = false;
  }

  /** When the formation has been fully cleared, advance to the next stage:
   *  bump `stage`, ask the controller for a fresh roster, and re-anchor the
   *  formation tick so the new entrance choreography plays from t=0. Gated
   *  on `hasSpawnedAny` so we don't flip stages during the brief window
   *  before the first enemy arrives. */
  private maybeAdvanceStage(): void {
    if (this.state.status !== "playing") return;
    if (this.state.enemies.length !== 0) return;
    if (!this.enemies.hasSpawnedAny()) return;
    // Also wait for any not-yet-spawned roster entries — otherwise a
    // mid-entrance kill of every visible enemy would flip the stage while
    // unspawned columns are still queued to fly in.
    if (!this.enemies.isEmpty()) return;
    // Was this a Challenging (bonus) stage? If so, check for a perfect
    // clear before we rebuild the next stage's roster (which would clear
    // the challenging flag inside the controller). A perfect clear means
    // the player destroyed EVERY enemy that flew through — none escaped
    // off the bottom. Award the bonus, then flip back to normal stages.
    // The hit-miss accuracy bonus (#65) is explicitly SKIPPED on
    // challenging stages — the per-stage shots/hits tally is not
    // accumulated during them, and the post-stage screen is the normal-
    // stage ritual only.
    if (this.enemies.isChallenging()) {
      const total = this.enemies.challengingTotalSpawned();
      if (total > 0 && this.challengingKills >= total) {
        this.state.score += CHALLENGING_PERFECT_BONUS;
        this.perfectBannerUntil = this.state.tick + 90;
        this.state.feedback.hitstopTicks = Math.max(
          this.state.feedback.hitstopTicks,
          STAGE_CLEAR_HITSTOP_TICKS,
        );
        this.state.feedback.shakeAmplitude = Math.max(
          this.state.feedback.shakeAmplitude,
          SHAKE_AMPLITUDE_KILL,
        );
      } else if (total > 0 && this.challengingKills < total) {
        // Non-perfect exit (#310) — voice the miss. Mirror to PERFECT!:
        // same slot (HEIGHT/2 + 30), same 18px monospace, same 90-tick
        // duration. Mutually exclusive with the perfect branch above —
        // one or the other fires per challenging exit. Score is NOT
        // touched: the negative is rhetorical (deficit-against-the-
        // ceiling), not a points penalty. Skipped when total === 0 so
        // the degenerate "no enemies spawned" case stays silent.
        this.missedBannerCount = total - this.challengingKills;
        this.missedBannerUntil = this.state.tick + 90;
      }
      this.state.challenging = false;
      this.challengingKills = 0;
      this.lastHitMiss = null;
    } else {
      // Normal stage clear → award the hit-miss accuracy bonus (#65).
      // Compute BEFORE we reset counters so the renderer can paint the
      // breakdown under the STAGE N banner. The bonus also spawns a
      // floating "+N" popup near top-center so the player sees the
      // points land on the score line.
      const shots = this.state.stageShotsFired;
      const hits = this.state.stageHits;
      const bonus = hitMissBonus(shots, hits);
      this.lastHitMiss = { shots, hits, bonus };
      if (bonus > 0) {
        this.state.score += bonus;
        this.state.scorePopups.push({
          x: WIDTH / 2,
          y: HEIGHT / 2 + 24,
          value: bonus,
          age: 0,
        });
      }
      // Stage-clear bonus tally count-up (#273). Snapshot the pre-bonus
      // baseline, commit the FLAT STAGE_BONUS (on top of the hit-miss bonus
      // above), then arm the celebratory beat: a 6-frame hitstop followed by
      // a 24-tick linear tally window during which the HUD animates the score
      // up to the now-committed total. The score change is ATOMIC here — the
      // tally is purely a display animation (see `stageClearDisplayScore`);
      // `state.score` is already final the moment this returns, so the #65
      // test (which reads score synchronously after the final forceHit) still
      // sees the full committed delta. The tally is gated to normal stages —
      // the challenging branch above arms its own PERFECT!/HIT beats instead.
      //
      // `scoreBeforeBonus` is the baseline BEFORE either bonus; the tally
      // animates `scoreBeforeBonus → scoreBeforeBonus + total` where total =
      // hit-miss bonus + STAGE_BONUS = the full delta just committed.
      const tallyTotal = bonus + STAGE_BONUS;
      this.state.score += STAGE_BONUS;
      this.state.stageBonusTallyTotal = tallyTotal;
      // Baseline = committed score minus the full animated delta, so the
      // count-up runs `scoreBeforeBonus → state.score`.
      this.state.scoreBeforeBonus = this.state.score - tallyTotal;
      this.state.stageBonusTallyTicks = STAGE_BONUS_TALLY_DURATION;
      // Punchy clear hitstop FIRST — the tally counter only counts down once
      // this releases (see the tally gate in update()). Clamp (max) so a
      // tail of kill-hitstop from the final shot doesn't shorten the beat.
      this.state.feedback.hitstopTicks = Math.max(
        this.state.feedback.hitstopTicks,
        STAGE_CLEAR_HITSTOP_TICKS,
      );
    }
    // Reset per-stage accuracy counters for the next stage (both branches —
    // a fresh normal stage starts with a clean tally regardless of whether
    // we just cleared a normal or challenging one).
    this.state.stageShotsFired = 0;
    this.state.stageHits = 0;
    this.state.stage += 1;
    this.enemies.reset();
    // Re-anchor so `formationTick` restarts at 0 next update — entrance arcs
    // for stage N+1 play exactly like stage 1's did.
    this.formationStartTick = null;
    // Flash the "STAGE N" banner for ~1.5s. The renderer paints from this
    // (we don't add a new GameState field — the banner is purely visual,
    // not part of the contract any test asserts on).
    this.stageBannerUntil = this.state.tick + 90;
  }

  /** Mark the fighter dead, decrement lives, arm the respawn timer. At zero
   *  lives the contract's terminal lifecycle is 'lost' — we don't respawn. */
  private killPlayer(): void {
    if (this.invulnerable) return; // test-only invulnerability (#260)
    if (!this.state.player.alive) return; // already dead, no double-tap
    // Player-death juice (#160) — write BEFORE flipping `alive=false` so
    // the death position is the fighter's current (x,y), and BEFORE the
    // lives--/status-flip so the same juice fires on the terminal death
    // (zero lives → 'lost') as on a respawnable death. Both paths get the
    // same beat: the final death deserves the same hitstop+shake+sparks.
    this.writeDeathFeedback(this.state.player.x, this.state.player.y);
    this.state.player.alive = false;
    // Losing a fighter while dual drops back to single (the second life
    // worth of ship is the docked rescue) — contract from #38.
    this.demoteDual();
    this.state.lives = Math.max(0, this.state.lives - 1);
    if (this.state.lives <= 0) {
      this.state.status = "lost";
      this.deathTick = null;
      // Arm the gameover transition. The contract is two-step: 'lost' is the
      // immediate "you died on your last life" flip; 'gameover' is the
      // terminal state under the GAME OVER overlay. Holding briefly between
      // the two lets the death frame land before the overlay paints.
      this.lostTick = this.state.tick;
    } else {
      this.deathTick = this.state.tick;
    }
  }

  /** Seed a deterministic-ish starfield. Galaga's signature scrolling stars. */
  private seedStars(): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      // A cheap PRNG seeded by index keeps the field stable across reloads
      // without Math.random (also avoids non-determinism in tests).
      const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
      // Bucket each star into one of three discrete speed tiers — true
      // parallax depth, not a continuous smear. Brightness tracks the tier
      // (far = dim, near = bright) so the eye reads the layering.
      const tier = Math.floor(r(3) * STAR_SPEEDS.length);
      const speed = STAR_SPEEDS[tier];
      const baseLevel = 0.3 + tier * 0.25; // 0.30 / 0.55 / 0.80
      stars.push({
        x: r(1) * WIDTH,
        y: r(2) * HEIGHT,
        speed,
        level: baseLevel + r(4) * 0.2,
      });
    }
    return stars;
  }

  /** First input leaves the READY state; once playing, the loop ticks.
   *  Keyboard goes through the InputSource (so its onFirstInput hook fires
   *  the flip); pointerdown on the canvas is a separate path for touch /
   *  click on the READY screen. */
  private bindInput(): void {
    const start = (): void => {
      if (this.state.status === "ready") {
        this.state.status = "playing";
        // Arcade canon (#329): the first formation entrance announces
        // itself with the STAGE banner, same beat that fires on every
        // subsequent stage flip inside maybeAdvanceStage. Without this
        // arm, stage 1 is the only stage that arrives silent — the
        // player goes from READY straight into "things flying at me"
        // with no acknowledgment that this IS stage 1 of N. Same 90-tick
        // duration, same #ffd76a color, same HEIGHT/2 slot, same word
        // ("STAGE 1" comes from state.stage which is already 1 at boot)
        // as the stage 2+ banner. `lastHitMiss` is null here so the
        // SHOTS FIRED / HITS / RATIO lines under the banner don't paint
        // — correct: there's nothing to score yet.
        this.stageBannerUntil = this.state.tick + 90;
      }
    };
    this.input.onFirstInput(start);
    this.canvas.addEventListener("pointerdown", start);
  }

  start(): void {
    const loop = (now: number): void => {
      if (this.lastTime === 0) this.lastTime = now;
      this.accumulator += now - this.lastTime;
      this.lastTime = now;
      // Clamp to avoid a spiral-of-death after a long tab-away.
      if (this.accumulator > 250) this.accumulator = 250;
      while (this.accumulator >= STEP_MS) {
        this.update();
        this.accumulator -= STEP_MS;
      }
      this.render();
      this.publish();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** One fixed-step logical update. The starfield always scrolls (it's the
   *  background); the tick counter only advances while 'playing' so the
   *  harness can distinguish a started loop from the idle READY screen. */
  private update(): void {
    for (const s of this.stars) {
      s.y += s.speed;
      if (s.y > HEIGHT) {
        s.y -= HEIGHT;
      }
    }
    // 'lost' → 'gameover' transition. We use lostTick (captured at the
    // moment lives hit 0, while state.tick was still advancing) and count
    // wall-clock fixed-steps via gameOverFrames so the hand-off lands even
    // though state.tick is frozen once status leaves 'playing'.
    if (this.state.status === "lost" && this.lostTick !== null) {
      this.gameOverFrames += 1;
      if (this.gameOverFrames >= GAMEOVER_HOLD_FRAMES) {
        this.state.status = "gameover";
        this.lostTick = null;
      }
    }
    if (this.state.status === "playing") {
      this.state.tick += 1;
      // Bullet→enemy hit juice (#133) — per-tick DECAY of the feedback
      // channel. Runs BEFORE the hitstop gate so a tick that's about to be
      // frozen doesn't first decay this tick's particles — and runs BEFORE
      // simulation/collisions so fresh writes from killEnemy land in a
      // PRISTINE channel (no decay applied to the just-spawned values).
      // The flow per tick is:
      //    1. tick++.
      //    2. decay (here): age sparks, fade shake, age popups. Skipped
      //       when hitstopTicks > 0 (entering tick frozen).
      //    3. hitstop gate: if frozen, decrement and return.
      //    4. simulation: enemies, bullets, capture, fire, collisions.
      //       Collisions may call killEnemy → writeHitFeedback, which
      //       overwrites/appends fresh values.
      //    5. publish.
      // This ordering is what makes the acceptance criteria align:
      //  - Snapshot at tick T+1 after a hit at tick T shows undecayed
      //    values (shake>=2.5, sparks.length===8, popups.length===1)
      //    because T+1 entered with hitstopTicks=2 and decay was skipped.
      //  - Shake reaches <0.1 within 16 ticks: T spawns at amp=3, T+1
      //    and T+2 are frozen (hitstop), T+3..T+16 are 14 decay ticks,
      //    3 * 0.78^14 ≈ 0.095 < 0.1.
      const fb = this.state.feedback;
      if (fb.hitstopTicks === 0) {
        if (fb.shakeAmplitude > 0) {
          fb.shakeAmplitude *= SHAKE_DECAY_PER_TICK;
          if (fb.shakeAmplitude < 0.01) fb.shakeAmplitude = 0;
        }
        if (fb.sparks.length > 0) {
          const nextSparks: FeedbackSpark[] = [];
          for (const s of fb.sparks) {
            const aged = s.ageTicks + 1;
            if (aged < s.lifetimeTicks) {
              nextSparks.push({
                x: s.x + s.vx,
                y: s.y + s.vy,
                vx: s.vx,
                vy: s.vy,
                ageTicks: aged,
                lifetimeTicks: s.lifetimeTicks,
              });
            }
          }
          fb.sparks = nextSparks;
        }
        if (fb.popups.length > 0) {
          const nextPopups: typeof fb.popups = [];
          for (const p of fb.popups) {
            const aged = p.ageTicks + 1;
            if (aged < POPUP_LIFETIME_TICKS) {
              nextPopups.push({
                x: p.x,
                y: p.y,
                value: p.value,
                ageTicks: aged,
              });
            }
          }
          fb.popups = nextPopups;
        }
      }
      // Bullet→enemy hit juice (#133) — HITSTOP GATE. While the feedback
      // channel's `hitstopTicks > 0`, the simulation pass below is SKIPPED:
      // enemies, bullets, capture beam, fire scheduler, collisions — all
      // frozen. We decrement the counter (so the freeze ends after N
      // ticks) and return. `state.tick` already advanced above so the
      // wall clock keeps moving; renderer still draws (start() calls
      // render() every rAF, independent of update()); input still buffers
      // through the InputSource. This is the classic "the world holds
      // still for one breath when you land a hit" arcade feel. We do NOT
      // decay shake/sparks/popups here on purpose — a truly frozen frame
      // means even the particles hang in place. Decay resumes on the
      // first non-frozen tick below.
      if (this.state.feedback.hitstopTicks > 0) {
        this.state.feedback.hitstopTicks -= 1;
        return;
      }
      // Stage-clear bonus tally count-up (#273) — TALLY GATE. After the
      // 6-frame clear hitstop releases, hold the field for the tally window:
      // the next formation does NOT start entering until the count-up
      // finishes. Like the hitstop gate, we SKIP the simulation pass below
      // (enemies, bullets, fire, capture, collisions, input) so the moment
      // is a victory POSE — but `state.tick` already advanced and the
      // starfield already scrolled above, so the field still breathes (it's
      // a celebration, not a death freeze). The HUD reads
      // `stageClearDisplayScore(state)` to animate the score across this
      // window. When it hits 0 the tally is over and the next stage's
      // formation begins entering on the following tick.
      if (this.state.stageBonusTallyTicks > 0) {
        this.state.stageBonusTallyTicks -= 1;
        return;
      }
      // Anchor the formation choreography to the first playing tick so the
      // entrance arcs start at t=0 regardless of how many idle frames passed
      // on the READY screen. (The state.tick counter is gated on `playing`
      // and only ever increments here, so this is equivalent to `tick === 1`
      // — kept explicit for readability.)
      if (this.formationStartTick === null) {
        this.formationStartTick = this.state.tick;
      }
      const formationTick = this.state.tick - this.formationStartTick;
      this.state.enemies = this.enemies.tick(formationTick);
      // Mirror the challenging flag onto the public contract every tick.
      // The controller is the source of truth (the stage ends when it
      // declares the wave empty); we just publish it.
      this.state.challenging = this.enemies.isChallenging();

      // Enemy fire (#61). Diving enemies drop shots aimed at the player's
      // column. Hard gates:
      //  - `state.challenging===true` ⇒ NEVER spawn enemy bullets (contract).
      //  - Player not alive / captured ⇒ no point spawning, and avoids hitting
      //    a respawning ship.
      // Each diver is on a per-id cooldown so it can't carpet-bomb a single
      // tick; bosses fire ~2× as often as bees/butterflies.
      if (
        !this.state.challenging &&
        this.state.player.alive &&
        !this.state.player.captured
      ) {
        const tick = this.state.tick;
        const stageScale = 1 + (this.state.stage - 1) * 0.15; // gentle ramp
        for (const e of this.state.enemies) {
          if (e.state !== "diving") continue;
          const cooldownUntil = this.enemyFireCooldown.get(e.id) ?? 0;
          if (tick < cooldownUntil) continue;
          const baseProb =
            e.kind === "boss"
              ? ENEMY_FIRE_PROBABILITY_BOSS
              : ENEMY_FIRE_PROBABILITY;
          const prob = Math.min(0.5, baseProb * stageScale);
          // Deterministic-ish per-(id,tick) PRNG so tests are repeatable
          // without seeding Math.random. The sin-hash gives well-distributed
          // values in [0,1); we compare against `prob`.
          const r = ((Math.sin(e.id * 91.337 + tick * 13.13) * 43758.5453) % 1 + 1) % 1;
          if (r < prob) {
            // Aim roughly at the player's column with a small lateral offset
            // baked from the diver's id so multiple divers don't all fire
            // dead-center. Bullet shape matches the player's: x,y,from.
            const aimJitter = ((e.id * 17) % 11) - 5; // -5..+5 px
            const targetX = this.state.player.x + aimJitter;
            // Spawn one tick of velocity below the diver so it visibly leaves
            // the sprite rather than overlapping it.
            this.state.bullets.push({
              x: targetX > e.x ? e.x + 1 : e.x - 1,
              y: e.y + 6,
              from: "enemy",
            });
            this.enemyFireCooldown.set(
              e.id,
              tick + ENEMY_FIRE_COOLDOWN_TICKS,
            );
          }
        }
        // GC: prune cooldown entries whose enemy is no longer on stage.
        if (this.enemyFireCooldown.size > 0) {
          const alive = new Set(this.state.enemies.map((e) => e.id));
          for (const id of this.enemyFireCooldown.keys()) {
            if (!alive.has(id)) this.enemyFireCooldown.delete(id);
          }
        }
      }

      // Capture-beam resolution. While a boss is mid-capture the controller
      // exposes a beam column (x, topY, halfWidth); we check whether the
      // player fighter overlaps it. The first overlap triggers the capture:
      // the player is marked captured, a life is decremented, and an
      // 'escort' enemy (the captured fighter) is added locked above the
      // boss. `captureBeamActive` mirrors the controller's beam state so
      // the contract stays truthful even when no overlap occurs.
      const beamX = this.enemies.captureBeamX();
      if (beamX !== null) {
        this.state.captureBeamActive = true;
        if (
          this.state.player.alive &&
          !this.state.player.captured
        ) {
          const halfW = this.enemies.captureBeamHalfWidth();
          const beamTop = this.enemies.captureBeamTopY() ?? 0;
          // Player overlaps the beam when its x is within the column AND
          // its y is below the beam's top (the beam runs downward from
          // the boss to the bottom of the field).
          if (
            !this.invulnerable && // test-only invulnerability (#260) — no capture
            Math.abs(this.state.player.x - beamX) <= halfW + 7 &&
            this.state.player.y >= beamTop
          ) {
            // Find which boss owns the beam so the escort can lock to it.
            const bossEnemy = this.state.enemies.find(
              (e) => e.state === "capturing",
            );
            this.state.player.captured = true;
            this.state.lives = Math.max(0, this.state.lives - 1);
            if (bossEnemy) {
              const escortId = this.enemies.addEscort(bossEnemy.id);
              // Mirror the escort onto this tick's public roster so the
              // contract reports state:'escort' without waiting another
              // frame. Position matches the controller's escort lock
              // (immediately above the boss).
              this.state.enemies.push({
                id: escortId,
                kind: "bee",
                state: "escort",
                x: bossEnemy.x,
                y: bossEnemy.y - 16,
              });
            }
          }
        }
      } else {
        this.state.captureBeamActive = false;
      }

      // Sample input once per fixed-step so movement is deterministic at
      // 60 Hz regardless of render cadence. Both arrows held = no motion
      // (they cancel), matching the arcade feel.
      const snap = this.input.read();
      const dir = (snap.right ? 1 : 0) - (snap.left ? 1 : 0);
      const canAct = this.state.player.alive && !this.state.player.captured;
      if (dir !== 0 && canAct) {
        const nextX = this.state.player.x + dir * PLAYER_SPEED_PX_PER_TICK;
        // Clamp to the field; the contract's field.width is the canvas WIDTH.
        const w = this.state.field.width;
        this.state.player.x = nextX < 0 ? 0 : nextX > w ? w : nextX;
      }

      // Firing: edge-triggered, capped at MAX_PLAYER_BULLETS concurrent
      // player shots. Consume the press unconditionally (so it doesn't
      // queue across ticks while at cap) — the arcade drops the input if
      // both your shots are still on screen.
      //
      // Dual fighter (#63): when `player.dual===true`, the rescued escort
      // is docked beside the primary fighter and BOTH ships fire on the
      // same press. Two parallel shots leave the nose offsets (±7 px) that
      // match the dual sprite. Classic Galaga also doubles the in-flight
      // cap to 4 in dual mode (two pairs simultaneously) — without that
      // bump the per-press rate-of-fire is identical to single, and the
      // rescue's payoff feels invisible.
      const wantsFire = this.input.consumeFire();
      // Input-latency probe (#168): stamp the keydown tick the moment we
      // OBSERVE the consumed press, regardless of whether the press will
      // result in a bullet (cap / !canAct may suppress the spawn). The
      // spec asserts on deltaTicks for presses that DO spawn — it waits
      // for the cap to clear before each next press — so stamping on
      // every consumed press is safe and gives the e2e harness a
      // deterministic edge to wait on (lastKeydownTick strictly advances
      // across presses).
      if (wantsFire) {
        this.lastKeydownTick = this.state.tick;
      }
      if (wantsFire && canAct) {
        let liveCount = 0;
        for (const b of this.state.bullets) {
          if (b.from === "player") liveCount++;
        }
        const dual = this.state.player.dual;
        const cap = dual ? MAX_PLAYER_BULLETS * 2 : MAX_PLAYER_BULLETS;
        const desired = dual ? 2 : 1;
        // Spawn as many as fit under the cap — prefer 2 → 1 → 0 in dual.
        const toSpawn = Math.max(0, Math.min(desired, cap - liveCount));
        const noseY = this.state.player.y - 9;
        if (dual) {
          // Two parallel shots from the side-by-side fighter offsets. The
          // renderer places the dual sprite at player.x ± 7 (#38); the
          // bullets leave from those same nose points so the visual reads.
          // When only one slot is free, prefer the LEFT fighter so the
          // pattern still looks symmetric across a series of presses.
          if (toSpawn >= 1) {
            this.state.bullets.push({
              x: this.state.player.x - 7,
              y: noseY,
              from: "player",
            });
          }
          if (toSpawn >= 2) {
            this.state.bullets.push({
              x: this.state.player.x + 7,
              y: noseY,
              from: "player",
            });
          }
        } else if (toSpawn >= 1) {
          // Single fighter: one shot at player.x, unchanged from before.
          this.state.bullets.push({
            x: this.state.player.x,
            y: noseY,
            from: "player",
          });
        }
        // Hit-miss accuracy tally (#65). One press = one shot intent for
        // the ratio, regardless of how many bullets actually spawned —
        // dual mode doesn't inflate the denominator. Skipped on
        // challenging stages so the next normal stage's ratio isn't
        // polluted. Only counted when at least one bullet actually fired.
        if (toSpawn > 0 && !this.state.challenging) {
          this.state.stageShotsFired += 1;
        }
        // Input-latency probe (#168): stamp the spawn tick the same tick
        // a bullet actually entered `state.bullets`. Gated on toSpawn>0
        // so a press denied by the cap (toSpawn===0 because liveCount===cap)
        // leaves lastProjectileSpawnTick on its prior value — the spec is
        // expected to wait for the cap to clear before the next press, so
        // a denied press would otherwise produce a misleading large delta.
        if (toSpawn > 0) {
          this.lastProjectileSpawnTick = this.state.tick;
        }
      }

      // Respawn the fighter once the death pause elapses (skipped when at
      // zero lives — that path flipped status to 'lost' in killPlayer).
      if (
        !this.state.player.alive &&
        this.deathTick !== null &&
        this.state.tick - this.deathTick >= RESPAWN_TICKS
      ) {
        this.state.player.alive = true;
        this.state.player.captured = false;
        this.state.player.x = WIDTH / 2;
        this.deathTick = null;
        // Player-death juice (#160) — arm the respawn fade-in. The renderer
        // multiplies `player.respawnFadeAlpha` into the fighter's draw
        // alpha for the next `RESPAWN_FADE_TICKS` ticks so the new life
        // eases in instead of snapping at full opacity. The first value
        // is set in the tracker block below on this same tick.
        this.respawnTick = this.state.tick;
      }

      // Player-death juice (#160) — respawn fade-in tracker. Writes a
      // strictly-increasing `respawnFadeAlpha` on `player` for
      // RESPAWN_FADE_TICKS ticks after respawn. The schedule matches the
      // #160 spec exactly: `alpha = k / N` where `k = tick - respawnTick`,
      // so on the respawn tick (k=0) the fighter is drawn at alpha 0 and
      // on each subsequent tick the alpha climbs by 1/N. After N ticks
      // the window closes — `respawnFadeAlpha` is removed from the
      // snapshot and the fighter draws at full opacity. The AC requires
      // 20 consecutive ticks with `alpha < 1.0 strictly increasing toward
      // 1.0`, which this satisfies: alphas 0, 1/20, 2/20, …, 19/20 over
      // ticks k=0..19, all < 1.0, all strictly increasing.
      if (this.respawnTick !== null && this.state.player.alive) {
        const k = this.state.tick - this.respawnTick; // 0..N-1 while in window
        if (k >= RESPAWN_FADE_TICKS) {
          this.respawnTick = null;
          delete this.state.player.respawnFadeAlpha;
        } else {
          this.state.player.respawnFadeAlpha = k / RESPAWN_FADE_TICKS;
        }
      }

      // Advance bullets, despawn off-screen. Player shots travel UP (y--);
      // enemy shots (not in this slice) will travel DOWN — same array, the
      // `from` discriminator drives direction.
      if (this.state.bullets.length > 0) {
        const next: Bullet[] = [];
        for (const b of this.state.bullets) {
          if (b.from === "player") {
            const ny = b.y - PLAYER_BULLET_SPEED_PX_PER_TICK;
            if (ny + 4 < 0) continue; // off the top, drop it
            next.push({ x: b.x, y: ny, from: "player" });
          } else {
            const ny = b.y + ENEMY_BULLET_SPEED_PX_PER_TICK;
            if (ny - 4 > this.state.field.height) continue;
            next.push({ x: b.x, y: ny, from: "enemy" });
          }
        }
        this.state.bullets = next;
      }

      this.resolveCollisions();
      // Age VFX. Explosions are short bursts; score popups drift upward as
      // they age. Both are pruned once they exceed their lifetime. Done
      // AFTER collisions so a freshly-killed enemy's VFX gets one full
      // tick on screen before being eligible for culling.
      if (this.state.explosions.length > 0) {
        const next: GameState["explosions"] = [];
        for (const ex of this.state.explosions) {
          if (ex.age + 1 < EXPLOSION_TICKS) {
            next.push({ x: ex.x, y: ex.y, age: ex.age + 1 });
          }
        }
        this.state.explosions = next;
      }
      if (this.state.scorePopups.length > 0) {
        const next: GameState["scorePopups"] = [];
        for (const p of this.state.scorePopups) {
          if (p.age + 1 < SCORE_POPUP_TICKS) {
            // Drift upward at 0.5 px/tick — gentle float, not a leap.
            next.push({ x: p.x, y: p.y - 0.5, value: p.value, age: p.age + 1 });
          }
        }
        this.state.scorePopups = next;
      }
      // Stage clear → next stage. Checked AFTER collisions so the same tick
      // that takes the last enemy out also triggers the respawn.
      this.maybeAdvanceStage();
    }
  }

  /** Per-tick collision pass. Two passes share the same per-pair distance
   *  check — keeping them branch-free + colocated makes the math easy to
   *  audit (no kd-tree or quadtree at this roster size; 8×5=40 enemies × a
   *  handful of bullets is fine).
   *
   *  Pass 1 — player bullets ↔ enemies. Each player bullet checks every
   *  live enemy; on first overlap, both vanish and the enemy's kind score
   *  is added. We mutate `bullets` and `enemies` directly because the
   *  bullet-advance step already produced fresh arrays this tick.
   *
   *  Pass 2 — enemy hazards ↔ player. An enemy bullet that overlaps the
   *  fighter kills it; a diving enemy that overlaps the fighter ALSO kills
   *  it (no separate bomb sprite — contact damage is the diver's threat).
   *  We short-circuit when the player is already dead so the collision
   *  ring doesn't double-fire during the respawn pause. */
  private resolveCollisions(): void {
    // Pass 1: player shots hit enemies.
    if (this.state.bullets.length > 0 && this.state.enemies.length > 0) {
      const r2 = ENEMY_HIT_RADIUS * ENEMY_HIT_RADIUS;
      const survivingBullets: Bullet[] = [];
      for (const b of this.state.bullets) {
        if (b.from !== "player") {
          survivingBullets.push(b);
          continue;
        }
        let hitIdx = -1;
        for (let i = 0; i < this.state.enemies.length; i++) {
          const e = this.state.enemies[i];
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy <= r2) {
            hitIdx = i;
            break;
          }
        }
        if (hitIdx >= 0) {
          // A real player-bullet kill — count toward the hit-miss tally
          // for this stage's accuracy bonus (#65). The matching
          // `stageShotsFired` was bumped at bullet spawn. Skipped on
          // challenging stages (the bonus path is normal-stage only).
          if (!this.state.challenging) this.state.stageHits += 1;
          this.killEnemy(hitIdx);
          // Bullet is consumed — don't carry it forward.
        } else {
          survivingBullets.push(b);
        }
      }
      this.state.bullets = survivingBullets;
    }

    // Pass 2: enemy hazards hit the player. Only when alive — a dead/
    // respawning fighter can't take a second hit on the same life. A
    // captured fighter is also untouchable: it's held in the beam, not
    // flying the playfield, so contact/bullet damage doesn't apply.
    // Challenging (bonus) stages are damage-free by contract — enemies fly
    // THROUGH the player without consequence, and no enemy bullets are
    // ever spawned during a challenging stage (the firing path, when it
    // lands, must gate on `!state.challenging`). We short-circuit BOTH
    // passes of hazard resolution here.
    if (this.state.challenging) return;
    if (!this.state.player.alive) return;
    if (this.state.player.captured) return;
    const pr2 = PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS;
    const px = this.state.player.x;
    const py = this.state.player.y;

    // Enemy bullets.
    for (let i = 0; i < this.state.bullets.length; i++) {
      const b = this.state.bullets[i];
      if (b.from !== "enemy") continue;
      const dx = b.x - px;
      const dy = b.y - py;
      if (dx * dx + dy * dy <= pr2) {
        this.state.bullets.splice(i, 1);
        this.killPlayer();
        return; // one hit per tick is enough
      }
    }

    // Diving enemies (contact damage).
    for (const e of this.state.enemies) {
      if (e.state !== "diving") continue;
      const dx = e.x - px;
      const dy = e.y - py;
      if (dx * dx + dy * dy <= pr2) {
        this.killPlayer();
        return;
      }
    }
  }

  private render(): void {
    const { ctx } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Bullet→enemy hit juice (#133) — SCREEN SHAKE. Apply an isotropic
    // xy translate sized by `feedback.shakeAmplitude`. The offset is
    // derived from a tick-driven sin hash so the shake reads as random
    // jitter, not a smooth slide, without us reaching for Math.random
    // (keeping replays/tests stable). The translate wraps everything
    // EXCEPT the GAME OVER / READY overlays — those should sit still
    // even mid-shake (a shaking GAME OVER text feels glitchy, not juicy).
    const shake = this.state.feedback.shakeAmplitude;
    if (shake > 0) {
      const shakeTick = this.state.tick;
      const rx =
        (((Math.sin(shakeTick * 12.9898) * 43758.5453) % 1) + 1) % 1;
      const ry =
        (((Math.sin(shakeTick * 78.233 + 17.17) * 43758.5453) % 1) + 1) % 1;
      const ox = (rx - 0.5) * 2 * shake;
      const oy = (ry - 0.5) * 2 * shake;
      ctx.save();
      ctx.translate(ox, oy);
    }

    // Starfield.
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.level.toFixed(2)})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }

    // Enemies — squat sprites colored by archetype. Bosses are the wide
    // green prize targets up top; butterflies are the mid-row pink/red
    // attackers; bees are the workhorse yellow grunts. Tiny diamonds keep
    // them readable at 320px width without sprite art.
    for (const e of this.state.enemies) {
      // Boss two-hit armor (#68): a boss that has taken its first hit
      // (`damaged===true`) paints blue/purple so the player can read "shoot
      // it again"; an undamaged boss stays the classic green prize color.
      // Bees/butterflies never carry `damaged` and keep their fixed palette.
      const palette =
        e.kind === "boss"
          ? e.damaged === true
            ? "#6a7aff"
            : "#7cf07c"
          : e.kind === "butterfly"
            ? "#ff7ab0"
            : "#ffd76a";
      ctx.fillStyle = palette;
      const cx = Math.round(e.x);
      const cy = Math.round(e.y);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 5);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.fill();
    }

    // Bullets — thin vertical tracers. Player shots are warm white, enemy
    // shots (future slice) get a hostile tint so the player can read them.
    for (const b of this.state.bullets) {
      ctx.fillStyle = b.from === "player" ? "#fffae0" : "#ff7777";
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 4, 2, 8);
    }

    // Explosion bursts — radial spokes that fade as `age` increases. Eight
    // arms keep the silhouette readable at 320px wide; the orange→red shift
    // sells the heat of the hit without needing sprite art.
    for (const ex of this.state.explosions) {
      const t = ex.age / EXPLOSION_TICKS; // 0..1
      const radius = 3 + t * 12;
      const alpha = 1 - t;
      ctx.strokeStyle = `rgba(255, ${Math.round(180 - t * 140)}, 60, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const cx = ex.x + Math.cos(a) * (radius - 2);
        const cy = ex.y + Math.sin(a) * (radius - 2);
        const dx = ex.x + Math.cos(a) * radius;
        const dy = ex.y + Math.sin(a) * radius;
        ctx.moveTo(cx, cy);
        ctx.lineTo(dx, dy);
      }
      ctx.stroke();
    }

    // Score popups — "+N" drifting up + fading.
    for (const p of this.state.scorePopups) {
      const tt = p.age / SCORE_POPUP_TICKS;
      const alpha = 1 - tt;
      ctx.fillStyle = `rgba(255, 230, 120, ${alpha.toFixed(2)})`;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`+${p.value}`, p.x, p.y);
    }

    // Bullet→enemy hit juice (#133) — SPARK PARTICLES. Tiny radial pixels
    // that age from full alpha at spawn to 0 at lifetime. Drawn as 2×2
    // squares so they're readable at 320px wide. Color is a hot
    // orange→yellow shift — the heat of the hit, distinct from the
    // explosion's red ring.
    for (const s of this.state.feedback.sparks) {
      const tt = s.ageTicks / s.lifetimeTicks;
      const alpha = Math.max(0, 1 - tt);
      const g = Math.round(180 + tt * 60);
      ctx.fillStyle = `rgba(255, ${g}, 90, ${alpha.toFixed(2)})`;
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
    }

    // Bullet→enemy hit juice (#133) — HIT POPUPS are deliberately NOT
    // DRAWN here. The legacy `scorePopups` render path above already
    // paints a "+N" at the enemy's kill position (from #42); drawing
    // `feedback.popups` too would double every kill ("+50" stacked on
    // "+50"). The popup data still lives on the channel — the #133
    // contract demands `feedback.popups.length === 1` after a kill so
    // tests + future renderers can read it — but visual rendering is
    // owned by the legacy field. If we later upgrade the kill popup to
    // the ease-up + fade behavior the channel encodes, this block is
    // where it goes: replace `scorePopups` rendering with this one (not
    // augment).

    // Player fighter — a simple upward-pointing arrow. Movement is a backlog
    // slice; for now it sits centered at the spawn point.
    //
    // Player-death juice (#160): when `respawnFadeAlpha` is set, the fighter
    // is in the post-respawn fade-in window — multiply into globalAlpha so
    // the new life eases in over RESPAWN_FADE_TICKS instead of snapping at
    // full opacity. Outside the window the field is undefined (engine
    // deletes it) and the fighter draws normally.
    if (this.state.player.alive) {
      const { x, y, respawnFadeAlpha } = this.state.player;
      const fading =
        respawnFadeAlpha !== undefined && respawnFadeAlpha < 1;
      if (fading) {
        ctx.save();
        ctx.globalAlpha = respawnFadeAlpha!;
      }
      ctx.fillStyle = "#e8eaff";
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x - 7, y + 7);
      ctx.lineTo(x + 7, y + 7);
      ctx.closePath();
      ctx.fill();
      if (fading) {
        ctx.restore();
      }
    }

    // Close the screen-shake transform — overlays (READY, GAME OVER,
    // STAGE banner, CHALLENGING banner, PERFECT) sit OUTSIDE the shake
    // because a juddering "GAME OVER" reads as a glitch, not as juice.
    if (shake > 0) {
      ctx.restore();
    }

    if (this.state.status === "ready") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "16px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("READY", WIDTH / 2, HEIGHT / 2);
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillStyle = "#9aa";
      ctx.fillText("press / tap to start", WIDTH / 2, HEIGHT / 2 + 18);
    }

    // GAME OVER overlay — painted while status is 'lost' (the brief hold
    // after the final fighter dies) or 'gameover' (the terminal state). The
    // text is the contract any consumer/test can scan for; we also dim the
    // playfield with a translucent black wash so the overlay reads against
    // the starfield + leftover sprites.
    if (this.state.status === "lost" || this.state.status === "gameover") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#ff5a5a";
      ctx.font = "22px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2);
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = "#cdd";
      ctx.fillText(
        `final score ${this.state.score}`,
        WIDTH / 2,
        HEIGHT / 2 + 22,
      );
    }

    // STAGE N banner — painted during the brief window after a stage flip
    // so the player gets a "you just cleared the wave" beat before the
    // next formation flies in. Fades by simple cutoff (no alpha ramp).
    if (
      this.stageBannerUntil !== null &&
      this.state.tick <= this.stageBannerUntil
    ) {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "20px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`STAGE ${this.state.stage}`, WIDTH / 2, HEIGHT / 2);
      // Hit-miss accuracy screen (#65). Painted under the STAGE banner
      // for the cleared NORMAL stage — faithful to the arcade's
      // post-stage ritual. Skipped after challenging clears (lastHitMiss
      // is null there) and on the very first stage (no clear yet).
      if (this.lastHitMiss !== null) {
        const { shots, hits, bonus } = this.lastHitMiss;
        const ratio =
          shots > 0 ? Math.round((hits / shots) * 100) : 0;
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillStyle = "#cdd";
        ctx.fillText(
          `SHOTS FIRED: ${shots}   NUMBER OF HITS: ${hits}`,
          WIDTH / 2,
          HEIGHT / 2 + 20,
        );
        ctx.fillStyle = "#ffd76a";
        ctx.fillText(
          `HIT-MISS RATIO: ${ratio}%   BONUS: ${bonus}`,
          WIDTH / 2,
          HEIGHT / 2 + 34,
        );
      }
    } else if (
      this.stageBannerUntil !== null &&
      this.state.tick > this.stageBannerUntil
    ) {
      this.stageBannerUntil = null;
    }

    // Stage-clear bonus tally count-up (#273) — the animated SCORE readout.
    // Painted at the top of the field ONLY while the tally window is open
    // (ticks > 0), so the digits visibly tick up from `scoreBeforeBonus`
    // toward the committed total during the held beat. Pure-state: reads the
    // same `stageClearDisplayScore` math the e2e probe observes — no extra
    // draw bookkeeping beyond this one HUD line. Outside the window there is
    // no persistent SCORE HUD (Galaga's scaffold only shows score on
    // gameover), so this is the count-up's only on-screen surface.
    if (this.state.stageBonusTallyTicks > 0) {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `SCORE ${stageClearDisplayScore(this.state)}`,
        WIDTH / 2,
        16,
      );
    }

    // CHALLENGING banner — painted while the bonus stage is in flight so
    // the player understands why nothing is shooting back.
    if (this.state.challenging) {
      ctx.fillStyle = "#7cf07c";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("CHALLENGING STAGE", WIDTH / 2, 28);
    }

    // CAPTURE banner — the keeper line for this whole game lives at
    // landing: "the first oodim game where the tractor beam can take
    // something from you." When the beam is armed AND the fighter is
    // already in its grip, surface ONE word at the top of the field so
    // the moment SPEAKS instead of going by in silence. Painted only
    // while `player.captured===true`; once the captor dies (rescue) or
    // the player respawns, the banner is gone. One word, top of field,
    // matching CHALLENGING's slot — the room already knows where to
    // look for state-keyed copy.
    //
    // Voice: "TAKEN" is the verb the landing line names. Not "CAPTURED"
    // (system text, what a flag reads), not "ABDUCTED" (cartoon). Past
    // tense + indefinite — done to you, undecided whether you get it
    // back. Player owns the rescue, the word names the loss.
    //
    // NOT a contract change: the boolean `player.captured` is already
    // the truth. This is paint only.
    if (this.state.player.captured) {
      ctx.fillStyle = "#ff7ab0";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TAKEN", WIDTH / 2, 28);
    }

    // BACK banner — the inverse beat to TAKEN. Painted briefly at the
    // rescue dock: the captor died, the escort flew down, the player now
    // owns a dual fighter. The dual sprite carries the mechanical payoff
    // (two ships where there was one); this word closes the keeper line.
    //
    // Voice: "BACK" mirrors TAKEN — one syllable, past-effect, indefinite.
    // Same slot (y=28), same captor color (#ff7ab0) — capture and rescue
    // are one mechanic with two charges; the palette honors that. Briefer
    // window than STAGE (45 vs 90 ticks) because the visual reads first.
    //
    // Painted OUTSIDE the captured branch above — by design these never
    // co-paint: captured flips false in the same tick the rescue banner
    // is armed.
    if (
      this.backBannerUntil !== null &&
      this.state.tick <= this.backBannerUntil
    ) {
      ctx.fillStyle = "#ff7ab0";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("BACK", WIDTH / 2, 28);
    } else if (
      this.backBannerUntil !== null &&
      this.state.tick > this.backBannerUntil
    ) {
      this.backBannerUntil = null;
    }

    // PERFECT! banner — painted briefly after a perfect challenging clear.
    if (
      this.perfectBannerUntil !== null &&
      this.state.tick <= this.perfectBannerUntil
    ) {
      ctx.fillStyle = "#7cf07c";
      ctx.font = "18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `PERFECT! +${CHALLENGING_PERFECT_BONUS}`,
        WIDTH / 2,
        HEIGHT / 2 + 30,
      );
    } else if (
      this.perfectBannerUntil !== null &&
      this.state.tick > this.perfectBannerUntil
    ) {
      this.perfectBannerUntil = null;
    }

    // HIT —N banner (#310) — the mirror to PERFECT!. Same slot, same 18px
    // monospace, same 90-tick window — opposite charge. Captor/rescue pink
    // (#ff7ab0) because the bonus stage's "you lost something" beat shares
    // the studio's loss color, NOT the green of the win. The minus sign +
    // count names the count of bees that escaped (no score penalty — the
    // number is rhetorical deficit, not deducted points). Mutually
    // exclusive with PERFECT! by construction: maybeAdvanceStage arms one
    // or the other, never both.
    if (
      this.missedBannerUntil !== null &&
      this.state.tick <= this.missedBannerUntil
    ) {
      ctx.fillStyle = "#ff7ab0";
      ctx.font = "18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `HIT —${this.missedBannerCount}`,
        WIDTH / 2,
        HEIGHT / 2 + 30,
      );
    } else if (
      this.missedBannerUntil !== null &&
      this.state.tick > this.missedBannerUntil
    ) {
      this.missedBannerUntil = null;
    }
  }

  /** Publish a fresh snapshot of the contract onto window.__galaga. The
   *  renderer + HUD + tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__galaga = this.state;
  }
}

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
  initialState,
  SCORE_POPUP_TICKS,
  WIDTH,
  HEIGHT,
  ENEMY_HIT_RADIUS,
  PLAYER_HIT_RADIUS,
  RESPAWN_TICKS,
  SCORE_BY_KIND,
  type Bullet,
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
import { createEnemyController, type EnemyController } from "./enemies";

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
/** Deeper parallax starfield — three speed layers blended via per-star
 *  `speed`. The arcade's signature horizon-of-stars feel needs density:
 *  90 stars at 320×448 is ~1 star per ~1600 px², readable but not noisy. */
const STAR_COUNT = 90;
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
          this.killEnemy(idx);
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
    };
  }

  /** Remove enemy at `idx` from the roster, add its kind's score. Centralized
   *  so the forceHit hook and the per-tick collision pass take the same path
   *  (and so future "explosion sprite" work hooks in one place). The kill is
   *  forwarded to the controller so the persistent roster also loses the
   *  enemy — otherwise the next `tick()` would re-emit it from the original
   *  schedule. */
  private killEnemy(idx: number): void {
    const e = this.state.enemies[idx];
    if (!e) return;
    const points = SCORE_BY_KIND[e.kind];
    this.state.score += points;
    // Polish VFX (#42): spawn an explosion burst + a floating "+N" popup at
    // the enemy's last position. These live on the public contract so the
    // e2e harness can prove the polish state flag landed.
    this.state.explosions.push({ x: e.x, y: e.y, age: 0 });
    this.state.scorePopups.push({ x: e.x, y: e.y, value: points, age: 0 });
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
    if (this.enemies.isChallenging()) {
      const total = this.enemies.challengingTotalSpawned();
      if (total > 0 && this.challengingKills >= total) {
        this.state.score += CHALLENGING_PERFECT_BONUS;
        this.perfectBannerUntil = this.state.tick + 90;
      }
      this.state.challenging = false;
      this.challengingKills = 0;
    }
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
    if (!this.state.player.alive) return; // already dead, no double-tap
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
      stars.push({
        x: r(1) * WIDTH,
        y: r(2) * HEIGHT,
        speed: 0.3 + r(3) * 0.9,
        level: 0.35 + r(4) * 0.65,
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
      if (this.state.status === "ready") this.state.status = "playing";
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
      const wantsFire = this.input.consumeFire();
      if (wantsFire && canAct) {
        let liveCount = 0;
        for (const b of this.state.bullets) {
          if (b.from === "player") liveCount++;
        }
        if (liveCount < MAX_PLAYER_BULLETS) {
          // Spawn from the nose of the ship (the triangle tip is at y-9).
          this.state.bullets.push({
            x: this.state.player.x,
            y: this.state.player.y - 9,
            from: "player",
          });
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
            const ny = b.y + PLAYER_BULLET_SPEED_PX_PER_TICK;
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
      const palette =
        e.kind === "boss"
          ? "#7cf07c"
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
      const t = p.age / SCORE_POPUP_TICKS;
      const alpha = 1 - t;
      ctx.fillStyle = `rgba(255, 230, 120, ${alpha.toFixed(2)})`;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`+${p.value}`, p.x, p.y);
    }

    // Player fighter — a simple upward-pointing arrow. Movement is a backlog
    // slice; for now it sits centered at the spawn point.
    if (this.state.player.alive) {
      const { x, y } = this.state.player;
      ctx.fillStyle = "#e8eaff";
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x - 7, y + 7);
      ctx.lineTo(x + 7, y + 7);
      ctx.closePath();
      ctx.fill();
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
    } else if (
      this.stageBannerUntil !== null &&
      this.state.tick > this.stageBannerUntil
    ) {
      this.stageBannerUntil = null;
    }

    // CHALLENGING banner — painted while the bonus stage is in flight so
    // the player understands why nothing is shooting back.
    if (this.state.challenging) {
      ctx.fillStyle = "#7cf07c";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("CHALLENGING STAGE", WIDTH / 2, 28);
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
  }

  /** Publish a fresh snapshot of the contract onto window.__galaga. The
   *  renderer + HUD + tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__galaga = this.state;
  }
}

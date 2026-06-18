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
  initialState,
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
  createKeyboardInput,
  MAX_PLAYER_BULLETS,
  PLAYER_BULLET_SPEED_PX_PER_TICK,
  PLAYER_SPEED_PX_PER_TICK,
  type InputSource,
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
const STAR_COUNT = 60;

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
  private lastTime = 0;
  private accumulator = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.state = initialState();
    this.stars = this.seedStars();
    this.input = createKeyboardInput();
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
    this.state.score += SCORE_BY_KIND[e.kind];
    this.state.enemies.splice(idx, 1);
    this.enemies.remove(e.id);
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
    this.state.lives = Math.max(0, this.state.lives - 1);
    if (this.state.lives <= 0) {
      this.state.status = "lost";
      this.deathTick = null;
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
    // respawning fighter can't take a second hit on the same life.
    if (!this.state.player.alive) return;
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
  }

  /** Publish a fresh snapshot of the contract onto window.__galaga. The
   *  renderer + HUD + tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__galaga = this.state;
  }
}

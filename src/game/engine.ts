// Galaga engine — SCAFFOLD + first input slice (#31).
//
// Fixed-step game loop, scrolling starfield, player fighter, and the
// load-bearing `window.__galaga` state contract. Boots to 'ready' and flips
// to 'playing' on first input (so the e2e harness can prove the loop ticks).
//
// As of #31 the player fighter moves left/right under keyboard control —
// Arrow keys and A/D. Input is owned by `./input.ts` (KeyboardInput); the
// engine only reads its `axis()` each fixed step. `player.x` is clamped to
// `[0, field.width]` per the issue's contract; `player.y` stays constant.
//
// Everything else that IS the game — firing, the enemy formation + entrance
// choreography, diving attacks, collisions/lives, scoring/stages, the boss
// capture beam + dual-fighter rescue, and the challenging stage — remains
// in the AUTONOMOUS BACKLOG (see galaga/docs/ARCHITECTURE.md).

import { KeyboardInput } from "./input";
import { initialState, WIDTH, HEIGHT, type GameState } from "./types";

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
/** Player horizontal speed, in canvas-px per fixed-step tick. At 60 Hz this
 *  crosses the 320-px field in ~2.1 s — close to the arcade feel. */
const PLAYER_SPEED = 2.5;

export class Engine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private state: GameState;
  private stars: Star[];
  private input: KeyboardInput;
  private lastTime = 0;
  private accumulator = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.state = initialState();
    this.stars = this.seedStars();
    this.input = new KeyboardInput({
      pointerTarget: canvas,
      onStart: () => {
        if (this.state.status === "ready") this.state.status = "playing";
      },
    });
    this.publish();
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
      this.updatePlayer();
    }
  }

  /** Apply the current horizontal intent to the player. Clamped to the
   *  playfield `[0, field.width]` per #31's contract; `y` is constant. */
  private updatePlayer(): void {
    const p = this.state.player;
    if (!p.alive || p.captured) return;
    const axis = this.input.axis();
    if (axis === 0) return;
    const next = p.x + axis * PLAYER_SPEED;
    const w = this.state.field.width;
    p.x = next < 0 ? 0 : next > w ? w : next;
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

    // Player fighter — a simple upward-pointing arrow.
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
  }

  /** Publish a fresh snapshot of the contract onto window.__galaga. The
   *  renderer + HUD + tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__galaga = this.state;
  }
}

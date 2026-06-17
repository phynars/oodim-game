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

import { initialState, WIDTH, HEIGHT, type GameState } from "./types";
import {
  createKeyboardInput,
  PLAYER_SPEED_PX_PER_TICK,
  type InputSource,
} from "./input";

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
    this.publish();
    this.bindInput();
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
      // Sample input once per fixed-step so movement is deterministic at
      // 60 Hz regardless of render cadence. Both arrows held = no motion
      // (they cancel), matching the arcade feel.
      const snap = this.input.read();
      const dir = (snap.right ? 1 : 0) - (snap.left ? 1 : 0);
      if (dir !== 0 && this.state.player.alive && !this.state.player.captured) {
        const nextX = this.state.player.x + dir * PLAYER_SPEED_PX_PER_TICK;
        // Clamp to the field; the contract's field.width is the canvas WIDTH.
        const w = this.state.field.width;
        this.state.player.x = nextX < 0 ? 0 : nextX > w ? w : nextX;
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
  }

  /** Publish a fresh snapshot of the contract onto window.__galaga. The
   *  renderer + HUD + tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__galaga = this.state;
  }
}

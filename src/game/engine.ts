// The rAF loop: update() → render() → frame++. Owns state.
//
// Fixed-timestep update with an accumulator (Glenn Fiedler's "Fix Your
// Timestep!" pattern) so simulation is FPS-independent: render runs once per
// animation frame, but update() runs zero or more times per frame to drain
// the accumulator at a constant STEP_MS. This keeps `tick` deterministic
// across machines — the Playwright harness counts on that.
import { initialState, type GameState } from "./types";
import { COLS, ROWS, TILE, MAZE, tileAt } from "./maze";
import { buildPelletMap, tickPac } from "./pacman";
import { bindInput, type InputBinding } from "./input";
import {
  publicGhostView,
  spawnBlinky,
  tickGhost,
  type GhostInternal,
} from "./ghost";

/** Logical update rate: 60 Hz. */
const STEP_MS = 1000 / 60;
/** Cap the accumulator so a long tab-switch can't trigger a death-spiral of
 *  catch-up updates on resume. */
const MAX_FRAME_MS = 250;

/** Playfield inset from the canvas edge, in CSS pixels. */
const PLAYFIELD_INSET = 8;
/** Border thickness for the playfield rectangle. */
const PLAYFIELD_BORDER = 2;

// Maze rendering palette. Local to the engine — the maze module owns the
// LAYOUT (what's at each tile); the engine owns the LOOK (how it's drawn).
/** Arcade-blue wall stroke. */
const WALL_COLOR = "#2121de";
const WALL_LINE_WIDTH = 1;
/** Soft cream for the pellet dots. */
const PELLET_COLOR = "#ffb8ae";
const PELLET_RADIUS = 1;
const POWER_PELLET_RADIUS = 3;
/** Ghost-house door — pale pink bar. */
const DOOR_COLOR = "#ffb8ae";

export class Engine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly state: GameState;

  private rafId: number | null = null;
  private lastFrameMs = 0;
  private accumulatorMs = 0;
  private running = false;
  private inputBinding: InputBinding | null = null;
  /** Internal ghost roster — full AI state. Public projections live on
   *  `state.ghosts` (the test contract). Source of truth is here. */
  private ghosts: GhostInternal[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable");
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = initialState();
    // Seed the live pellet map from the static layout. Owned by the engine
    // and mutated by tickPac as pellets get eaten.
    this.state.pelletMap = buildPelletMap();
    // Spawn the first ghost. Public roster mirrors the internal one.
    this.ghosts = [spawnBlinky()];
    this.state.ghosts = this.ghosts.map(publicGhostView);
    // Publish the state contract immediately so tests that poll at boot
    // (before the first rAF tick) still see `status: 'ready'`.
    window.__pac = this.state;
  }

  /** Begin the loop. Idempotent — calling twice is a no-op. */
  start(): void {
    if (this.running) return;
    this.running = true;
    // Transition out of the boot 'ready' label the moment the loop spins
    // up — keeps the READY text from sitting on top of a moving Pac.
    if (this.state.status === "ready") {
      this.state.status = "playing";
    }
    // Bind keyboard once the loop is live. Safe to call repeatedly; we
    // only bind on the first start().
    if (this.inputBinding === null) {
      this.inputBinding = bindInput(this.state);
    }
    this.lastFrameMs = performance.now();
    this.accumulatorMs = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Halt the loop. Safe to call when already stopped. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.inputBinding !== null) {
      this.inputBinding.dispose();
      this.inputBinding = null;
    }
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;

    let deltaMs = now - this.lastFrameMs;
    this.lastFrameMs = now;
    if (deltaMs > MAX_FRAME_MS) deltaMs = MAX_FRAME_MS;
    this.accumulatorMs += deltaMs;

    while (this.accumulatorMs >= STEP_MS) {
      this.update();
      this.accumulatorMs -= STEP_MS;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** One simulation step. Deterministic — drive new mechanics off `tick`. */
  private update(): void {
    this.state.tick += 1;
    // Pac-Man movement + pellet eating. Ghosts and power-pellet effects
    // will hang off the same tick once they land.
    tickPac(this.state);
    // Ghosts: advance internal AI, then re-publish the slim view onto
    // the state contract so `window.__pac.ghosts` stays current.
    for (const g of this.ghosts) {
      tickGhost(g, this.state);
    }
    // Reuse the existing array (mutate length + indices) so consumers
    // holding a reference to state.ghosts still see updates.
    this.state.ghosts.length = this.ghosts.length;
    for (let i = 0; i < this.ghosts.length; i += 1) {
      this.state.ghosts[i] = publicGhostView(this.ghosts[i]);
    }
  }

  /** Draw the current frame. Reads state; never mutates it. */
  private render(): void {
    const { ctx, canvas, state } = this;
    const w = canvas.width;
    const h = canvas.height;

    // 1. Clear.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // 2. Bordered playfield.
    ctx.strokeStyle = "#1f6feb";
    ctx.lineWidth = PLAYFIELD_BORDER;
    const inset = PLAYFIELD_INSET + PLAYFIELD_BORDER / 2;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

    // 3. Maze: center the 28×31 grid inside the playfield.
    this.renderMaze();

    // 4. Pac on top of the maze.
    this.renderPac();

    // 4b. Ghosts on top of Pac (so a collision is visible — and so the
    //     red disc never gets hidden under the player when they stack).
    this.renderGhosts();

    // 5. Boot label while we're in 'ready'. Removed once gameplay lands.
    if (state.status === "ready") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("READY", w / 2, h / 2);
    }
  }

  /** Walls + pellets. Static for now — pellets will be eaten in a later slice
   *  by clearing tiles in a mutable pellet map, but the rendering loop won't
   *  change shape. */
  private renderMaze(): void {
    const { ctx, canvas } = this;
    // Center the maze inside the canvas.
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);

    // Walls: stroke a small rectangle inset inside each wall tile. It's a
    // serviceable readable approximation; arcade-true wall geometry (rounded
    // corner segments) is a future polish pass.
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = WALL_LINE_WIDTH;
    ctx.fillStyle = PELLET_COLOR;
    for (let r = 0; r < ROWS; r += 1) {
      const row = MAZE[r];
      for (let c = 0; c < COLS; c += 1) {
        const t = row[c];
        const x = ox + c * TILE;
        const y = oy + r * TILE;
        if (t === "#") {
          ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        } else if (t === ".") {
          // Consult the live pellet map so eaten pellets disappear.
          // pelletMap is seeded from MAZE at boot; falsy means eaten.
          if (this.state.pelletMap[r]?.[c]) {
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2, PELLET_RADIUS, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (t === "o") {
          if (this.state.pelletMap[r]?.[c]) {
            ctx.beginPath();
            ctx.arc(
              x + TILE / 2,
              y + TILE / 2,
              POWER_PELLET_RADIUS,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        } else if (t === "-") {
          ctx.save();
          ctx.fillStyle = DOOR_COLOR;
          ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
          ctx.restore();
        }
      }
    }
    // Silence the lint if tileAt isn't otherwise referenced; it's exported
    // for upcoming AI slices and we don't want tree-shake to drop it.
    void tileAt;
  }

  /** Pac as a yellow chomping wedge, gliding between tiles.
   *
   *  Three render-only derivations of state — no contract change:
   *    - Sub-tile glide: `pac._progress` (internal field set by tickPac)
   *      offsets the draw position along `pac.dir`, so motion is smooth
   *      between integer tile commits. `state.pac.x/y` themselves still
   *      tick once per tile — the e2e harness sees the same integers.
   *    - Facing rotation: `pac.dir` picks the wedge orientation.
   *    - Mouth chomp: `state.tick % 12` drives a 5 Hz open/close cycle
   *      (60 Hz / 12 = 5). When `dir === "none"` we freeze the mouth
   *      half-open instead of animating — feels alive but not chewing
   *      air at a wall. */
  private renderPac(): void {
    const { ctx, canvas, state } = this;
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);

    // Sub-tile glide. `_progress` is set internally by tickPac (see
    // pacman.ts) — it's not on the public PacState type, so we read it
    // through a narrow cast. Falls back to 0 if absent (first frame, or
    // dir==="none" after a wall stop).
    const pac = state.pac as typeof state.pac & { _progress?: number };
    const progress = pac.dir === "none" ? 0 : pac._progress ?? 0;
    let dx = 0;
    let dy = 0;
    let angle = 0;
    switch (pac.dir) {
      case "right":
        dx = 1;
        angle = 0;
        break;
      case "left":
        dx = -1;
        angle = Math.PI;
        break;
      case "down":
        dy = 1;
        angle = Math.PI / 2;
        break;
      case "up":
        dy = -1;
        angle = -Math.PI / 2;
        break;
      case "none":
        // Keep last-known facing implicit (angle=0); no motion offset.
        break;
    }

    const cx = ox + (pac.x + dx * progress) * TILE + TILE / 2;
    const cy = oy + (pac.y + dy * progress) * TILE + TILE / 2;
    const r = TILE / 2 - 0.5;

    // Chomp phase: 5 Hz (12 ticks at 60 Hz per full cycle). When at rest,
    // freeze the mouth half-open so the sprite still reads as Pac-Man.
    let mouth: number;
    if (pac.dir === "none") {
      mouth = 0.175 * Math.PI; // ~31° — half of the peak opening
    } else {
      const phase = (state.tick % 12) / 12; // 0..1
      mouth = Math.abs(Math.sin(phase * Math.PI)) * 0.35 * Math.PI; // 0..~63°
    }

    ctx.fillStyle = "#ffd76a";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    // Wedge: arc from +mouth around to 2π-mouth, then line back to center
    // so the missing slice points along +x (the travel direction after
    // rotation).
    ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Ghosts as flat coloured discs on their tile. Blinky is red. */
  private renderGhosts(): void {
    const { ctx, canvas, state } = this;
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);
    for (const g of state.ghosts) {
      const cx = ox + g.x * TILE + TILE / 2;
      const cy = oy + g.y * TILE + TILE / 2;
      ctx.fillStyle = g.name === "blinky" ? "#ff1d1d" : "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, TILE / 2 - 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

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

  /** Pac as a fat yellow disc on his current tile. Sub-tile glide
   *  progress is intentionally not visualized yet — the tile-snapped
   *  draw matches the test contract (which polls integer tile coords)
   *  and is plenty readable. Smoother interpolation is a polish pass. */
  private renderPac(): void {
    const { ctx, canvas, state } = this;
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);

    const cx = ox + state.pac.x * TILE + TILE / 2;
    const cy = oy + state.pac.y * TILE + TILE / 2;

    ctx.fillStyle = "#ffd76a";
    ctx.beginPath();
    ctx.arc(cx, cy, TILE / 2 - 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The rAF loop: update() → render() → frame++. Owns state.
//
// Fixed-timestep update with an accumulator (Glenn Fiedler's "Fix Your
// Timestep!" pattern) so simulation is FPS-independent: render runs once per
// animation frame, but update() runs zero or more times per frame to drain
// the accumulator at a constant STEP_MS. This keeps `tick` deterministic
// across machines — the Playwright harness counts on that.
import { initialState, type GameState } from "./types";
import { COLS, ROWS, TILE, MAZE, tileAt } from "./maze";
import { buildPelletMap, resetPacToSpawn, tickPac } from "./pacman";
import { bindInput, type InputBinding } from "./input";
import {
  blinkyTarget,
  clydeTarget,
  FRIGHTENED_TICKS,
  inkyTarget,
  pinkyTarget,
  publicGhostView,
  scatterTarget,
  spawnGhosts,
  tickGhost,
  type GhostInternal,
  type GhostName,
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

/** Per-ghost render colour. Arcade-canonical. */
const GHOST_COLORS: Record<GhostName, string> = {
  blinky: "#ff1d1d",
  pinky: "#ffb8de",
  inky: "#00ffde",
  clyde: "#ffb847",
};

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
  /** Pellet count at boot — used by the ghost-house dot counter. */
  private readonly totalPelletsAtBoot: number;
  /** Remaining ticks of frightened mode. >0 means a power pellet is
   *  currently active. Eating another power pellet RE-arms this to
   *  FRIGHTENED_TICKS (does not stack). */
  private frightenedTicksLeft = 0;
  /** Combo counter for the current frightened activation: how many
   *  ghosts Pac has already eaten this power-pellet window. Resets to
   *  0 each time frightened mode re-arms. Drives the 200/400/800/1600
   *  score escalation. */
  private frightenedEatStreak = 0;
  /** Per-level baseline ghost speed scalar. Boots at 1.0; bumped ~10%
   *  each time handleLevelWon fires, capped at 1.5×. Threaded into
   *  tickGhost so scatter/chase speeds scale but frightened/eaten do
   *  not (preserves the power-pellet escape window across levels). */
  private ghostSpeedMultiplier = 1.0;
  /** Current level number (1-indexed). Bumped in handleLevelWon. Not yet
   *  part of the GameState type contract (types.ts is out of scope for
   *  the HUD slice); mirrored onto state via a runtime property so the
   *  HUD in main.ts can read it through `window.__pac`. */
  private level = 1;

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
    this.totalPelletsAtBoot = this.state.pellets;
    // Spawn the full quartet. Blinky boots out; the others wait in the
    // house and are released as the dot counter crosses each threshold.
    this.ghosts = spawnGhosts();
    this.state.ghosts = this.ghosts.map(publicGhostView);
    // Seed the runtime `level` mirror so the HUD has a value to display
    // before the first tick (the HUD polls __pac).
    (this.state as GameState & { level: number }).level = this.level;
    // Publish the state contract immediately so tests that poll at boot
    // (before the first rAF tick) still see `status: 'ready'`.
    window.__pac = this.state;
    // Expose pure targeting functions for the in-browser unit tests. The
    // e2e harness calls these via page.evaluate with crafted inputs to
    // verify each ghost's targeting rule in isolation.
    window.__pacInternals = {
      blinkyTarget,
      pinkyTarget,
      inkyTarget,
      clydeTarget,
      scatterTarget,
      // Test hook: warp the named ghost onto Pac's current tile in a
      // fatal mode. The engine's collision check runs at the end of the
      // next update() and will trigger handlePacDeath — costing a life
      // and snapping Pac back to spawn. Used by the chase-collision e2e
      // to avoid racing the live targeting AI on slow CI machines.
      //
      // Forces status='out' (in case the ghost is still in the house)
      // and mode='chase' if currently 'frightened' or 'eaten', so the
      // collision branch is unambiguously the kill path. Resets the
      // ghost's sub-tile progress so it doesn't immediately glide off
      // Pac's tile before the collision check fires.
      forceGhostOntoPac: (name: GhostName): void => {
        const g = this.ghosts.find((gh) => gh.name === name);
        if (!g) return;
        g.x = this.state.pac.x;
        g.y = this.state.pac.y;
        g.status = "out";
        if (g.mode === "frightened" || g.mode === "eaten") {
          g.mode = "chase";
        }
        g._progress = 0;
      },
      // Test hook: zero out the pellet field in one step. The eat-every-
      // dot path is too slow + race-prone to drive from an e2e (the ghost
      // AI would kill Pac mid-clear on slow CI). Instead we drop pellets
      // to 0 and clear the pellet map; the next update() observes the
      // win condition and flips status to 'won' via handleLevelWon.
      clearPellets: (): void => {
        this.state.pellets = 0;
        for (let r = 0; r < this.state.pelletMap.length; r += 1) {
          const row = this.state.pelletMap[r];
          for (let c = 0; c < row.length; c += 1) {
            row[c] = false;
          }
        }
      },
    };
  }

  /** Begin the loop. Idempotent — calling twice is a no-op. */
  start(): void {
    if (this.running) return;
    this.running = true;
    // NOTE: we used to flip 'ready'→'playing' here. Per issue #8 the
    // READY! overlay should hold until the player's first input — the
    // flip now lives inside update(), gated on a queued direction.
    // Bind keyboard + touch once the loop is live. Safe to call repeatedly;
    // we only bind on the first start(). Swipes target the canvas itself;
    // an optional #dpad container (rendered by index.html) routes button
    // taps through the same direction-intent path.
    if (this.inputBinding === null) {
      const dpad = document.getElementById("dpad");
      this.inputBinding = bindInput(
        this.state,
        window,
        this.canvas,
        dpad instanceof HTMLElement ? dpad : null,
      );
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
    // If the level is already terminal (won/lost), freeze the simulation:
    // don't tick Pac or ghosts, don't run collisions, don't re-fire the
    // win check.
    if (this.state.status === "won" || this.state.status === "lost") {
      return;
    }
    // First-input gate (issue #8): hold the READY! overlay until the
    // player asks to move. bindInput writes the requested direction onto
    // `pac.queued`; once that's non-'none' we flip to 'playing' and let
    // tickPac take over.
    if (this.state.status === "ready") {
      if (this.state.pac.queued !== "none") {
        this.state.status = "playing";
      } else {
        return;
      }
    }
    // Pac-Man movement + pellet eating. The result surfaces whether a
    // power pellet was eaten this tick; if so we (re)arm frightened mode.
    const pacResult = tickPac(this.state);
    if (pacResult.atePowerPellet) {
      this.frightenedTicksLeft = FRIGHTENED_TICKS;
      this.frightenedEatStreak = 0;
    } else if (this.frightenedTicksLeft > 0) {
      this.frightenedTicksLeft -= 1;
      if (this.frightenedTicksLeft === 0) {
        // Frightened expired: reset the combo so the next activation
        // starts at 200 again.
        this.frightenedEatStreak = 0;
      }
    }
    // Win check: if the last pellet has been eaten (or zeroed by the
    // clearPellets test hook), flip to 'won' and reset for the next
    // level. Return early so ghosts don't tick onto the freshly reset
    // Pac (which would immediately drop a life).
    if (this.state.pellets <= 0) {
      this.handleLevelWon();
      return;
    }
    // Ghosts: Inky needs Blinky's position as a pivot, so snapshot it
    // before any ghost moves this tick (consistent within the step).
    const blinky = this.ghosts.find((g) => g.name === "blinky");
    const blinkyPos = blinky ? { x: blinky.x, y: blinky.y } : null;
    for (const g of this.ghosts) {
      tickGhost(
        g,
        this.state,
        blinkyPos,
        this.totalPelletsAtBoot,
        this.frightenedTicksLeft,
        this.ghostSpeedMultiplier,
      );
    }
    // Pac↔ghost collisions. Tile-aligned check — both entities snap to
    // tile coords once per their respective progress windows, so an
    // overlap on shared (x,y) is the contact signal.
    //   • frightened ghost  → eat: score 200/400/800/1600 escalating,
    //                          ghost flips to 'eaten' (eyes) and races
    //                          home; tickGhost handles the revive.
    //   • eaten ghost       → no interaction (eyes pass through Pac).
    //   • scatter / chase   → costs a life. Pac + all ghosts snap back
    //                          to spawn; at zero lives, status flips to
    //                          'lost' and the loop effectively halts on
    //                          a frozen frame.
    let pacDied = false;
    for (const g of this.ghosts) {
      if (g.status !== "out") continue;
      if (g.x !== this.state.pac.x || g.y !== this.state.pac.y) continue;
      if (g.mode === "frightened") {
        this.frightenedEatStreak += 1;
        // 1→200, 2→400, 3→800, 4→1600. Cap the exponent at 3 so a fifth
        // (impossible in practice — only 4 ghosts) wouldn't run away.
        const idx = Math.min(this.frightenedEatStreak - 1, 3);
        this.state.score += 200 * (1 << idx);
        g.mode = "eaten";
        g._progress = 0;
      } else if (g.mode === "scatter" || g.mode === "chase") {
        // Fatal contact — handle once per tick even if multiple ghosts
        // sit on Pac's tile.
        pacDied = true;
        break;
      }
      // 'eaten' ghosts (eyes) pass through Pac harmlessly — no branch.
    }
    if (pacDied) {
      this.handlePacDeath();
    }
    // Reuse the existing array (mutate length + indices) so consumers
    // holding a reference to state.ghosts still see updates.
    this.state.ghosts.length = this.ghosts.length;
    for (let i = 0; i < this.ghosts.length; i += 1) {
      this.state.ghosts[i] = publicGhostView(this.ghosts[i]);
    }
  }

  /** Pac ate the final pellet. Flip status to 'won', refill the pellet
   *  board for the next level, bump baseline ghost speed (slightly), and
   *  re-spawn Pac + ghosts to their starting tiles. Frightened state is
   *  cleared so a win mid-power-pellet doesn't carry residual blue
   *  ghosts into the next level. */
  private handleLevelWon(): void {
    this.state.status = "won";
    // Bump the level counter and republish the mirror so the HUD picks
    // it up on the next animation frame.
    this.level += 1;
    (this.state as GameState & { level: number }).level = this.level;
    // Refill the pellet map from the static maze and restore the count.
    this.state.pelletMap = buildPelletMap();
    this.state.pellets = this.totalPelletsAtBoot;
    // Ghosts speed up ~10% per level. Cap at 1.5× so the simulation
    // doesn't tip into "ghost moves more than one tile per update" land.
    this.ghostSpeedMultiplier = Math.min(this.ghostSpeedMultiplier * 1.1, 1.5);
    // Clear any active power-pellet window.
    this.frightenedTicksLeft = 0;
    this.frightenedEatStreak = 0;
    // Re-spawn the full roster and Pac.
    this.ghosts = spawnGhosts();
    resetPacToSpawn(this.state);
    // Republish the slim ghost view so a test polling on the very next
    // tick sees the reset roster aligned with the new status.
    this.state.ghosts.length = this.ghosts.length;
    for (let i = 0; i < this.ghosts.length; i += 1) {
      this.state.ghosts[i] = publicGhostView(this.ghosts[i]);
    }
  }

  /** A chase/scatter ghost touched Pac. Decrement lives; on >0, reset Pac
   *  and the full ghost roster to spawn positions and resume play. On
   *  zero, flip status to 'lost' — the loop still runs (so the render
   *  stays painted) but no further collisions can fire because every
   *  ghost has been reset away from Pac and Pac won't move (dir='none').
   *  Frightened state is cleared so a death mid-power-pellet doesn't
   *  carry residual blue ghosts into the next life. */
  private handlePacDeath(): void {
    this.state.lives -= 1;
    this.frightenedTicksLeft = 0;
    this.frightenedEatStreak = 0;
    // Re-spawn the entire ghost roster — Blinky out, the rest back in
    // the house gated by the dot counter (which is unchanged because
    // pellets eaten so far are kept).
    this.ghosts = spawnGhosts();
    // Reset Pac to spawn AFTER ghosts, so the new roster isn't sitting
    // on Pac's old tile (which we just vacated anyway).
    resetPacToSpawn(this.state);
    if (this.state.lives <= 0) {
      this.state.lives = 0;
      this.state.status = "lost";
    }
    // Republish the slim ghost view immediately so a test polling on the
    // very next tick sees the reset roster.
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

    // 5. Status overlays:
    //    - 'ready' → READY! boot label, held until the loop starts.
    //    - 'won'   → YOU WIN! after clearing the level.
    //    - 'lost'  → GAME OVER after running out of lives.
    if (state.status === "ready") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("READY!", w / 2, h / 2);
    } else if (state.status === "won") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("YOU WIN!", w / 2, h / 2);
    } else if (state.status === "lost") {
      ctx.fillStyle = "#ff5d5d";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", w / 2, h / 2);
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

  /** Ghosts as flat coloured discs, gliding between tiles. One colour per
   *  ghost, except:
   *    • frightened → arcade blue. Flashes white in the last ~1.5s of the
   *      window (last 90 ticks) — the telegraph that frightened is about
   *      to wear off.
   *    • eaten → small white "eyes" dot (no body). Communicates that the
   *      ghost is in transit back to the house.
   *
   *  Render-only sub-tile glide (mirrors `renderPac`): we read the engine's
   *  INTERNAL roster `this.ghosts` (not `state.ghosts`, which is the
   *  stripped `publicGhostView` projection holding integer tile coords for
   *  the e2e contract). Each `GhostInternal` carries `_progress: 0..1` and
   *  `lastDir: Dir`, advanced every tick by `tickGhost` — we offset the
   *  draw position along `lastDir` so motion is smooth between integer
   *  tile commits. In-house ghosts (`status !== "out"`) stay snapped to
   *  their spawn tile — they don't carry meaningful glide. */
  private renderGhosts(): void {
    const { ctx, canvas } = this;
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);
    const FLASH_WINDOW = 90; // last 1.5s of frightened
    const frightenedFlashOn =
      this.frightenedTicksLeft > 0 &&
      this.frightenedTicksLeft < FLASH_WINDOW &&
      Math.floor(this.frightenedTicksLeft / 8) % 2 === 0;
    for (const g of this.ghosts) {
      // Sub-tile glide. Only released ghosts interpolate; ones still
      // bouncing in the house stay on their tile.
      const progress = g.status !== "out" ? 0 : g._progress;
      let dx = 0;
      let dy = 0;
      switch (g.lastDir) {
        case "right":
          dx = 1;
          break;
        case "left":
          dx = -1;
          break;
        case "down":
          dy = 1;
          break;
        case "up":
          dy = -1;
          break;
      }
      // NB: no `case "none"` — a ghost's `lastDir` is `Dir`
      // ("up"|"down"|"left"|"right"), never "none" (that rest state
      // belongs to Pac's `Direction`). dx/dy default to 0, so a stopped
      // ghost already stays tile-centered without a dead case. (TS2678
      // on the invalid case broke main's build + every agent CI, 2026-06-17.)
      const cx = ox + (g.x + dx * progress) * TILE + TILE / 2;
      const cy = oy + (g.y + dy * progress) * TILE + TILE / 2;
      if (g.mode === "eaten") {
        // Eyes: a small white dot, no body.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (g.mode === "frightened") {
        ctx.fillStyle = frightenedFlashOn ? "#ffffff" : "#1d1dff";
      } else {
        ctx.fillStyle = GHOST_COLORS[g.name] ?? "#ffffff";
      }
      ctx.beginPath();
      ctx.arc(cx, cy, TILE / 2 - 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Augment the global Window with the in-browser unit-test bridge. The
// real GameState contract lives on `window.__pac` (declared in types.ts);
// the targeting functions are exposed separately so the e2e harness can
// invoke them with crafted inputs.
declare global {
  interface Window {
    __pacInternals?: {
      blinkyTarget: typeof blinkyTarget;
      pinkyTarget: typeof pinkyTarget;
      inkyTarget: typeof inkyTarget;
      clydeTarget: typeof clydeTarget;
      scatterTarget: typeof scatterTarget;
      forceGhostOntoPac: (name: GhostName) => void;
      clearPellets: () => void;
    };
  }
}

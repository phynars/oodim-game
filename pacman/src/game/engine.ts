// The rAF loop: update() → render() → frame++. Owns state.
//
// Fixed-timestep update with an accumulator (Glenn Fiedler's "Fix Your
// Timestep!" pattern) so simulation is FPS-independent: render runs once per
// animation frame, but update() runs zero or more times per frame to drain
// the accumulator at a constant STEP_MS. This keeps `tick` deterministic
// across machines — the Playwright harness counts on that.
import {
  BANNER_EXTRA,
  BANNER_FRUIT,
  BANNER_GAME_OVER,
  BANNER_READY,
  CLEAR_ANIM_TICKS,
  CLEAR_FLASH_END,
  CLEAR_PRE_PAUSE,
  CLEAR_TALLY_END,
  DEATH_ANIM_TICKS,
  DEATH_COLLAPSE_END,
  DEATH_PRE_PAUSE,
  EXTRA_BANNER_TICKS,
  EXTRA_LIFE_SCORE,
  LEVEL_CLEAR_BONUS,
  POWER_PELLET_HITSTOP_TICKS,
  POWER_PELLET_PULSE_TICKS,
  POWER_PELLET_SHAKE_AMP,
  initialState,
  type GameState,
} from "./types";
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
  REVIVE_TILE,
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
/** Issue #183 — alternate wall stroke during the level-clear maze flash. */
const WALL_FLASH_COLOR = "#ffffff";

/** Issue #296 — lerp between two `#rrggbb` hex strings. Used by the
 *  power-pellet maze-tint pulse to fade the wall stroke from arcade blue
 *  toward white as the pulse progresses. Defensive: silently falls back
 *  to `a` on malformed input so a renderer parse failure can't crash the
 *  frame. */
function lerpHex(a: string, b: string, t: number): string {
  if (a.length !== 7 || b.length !== 7) return a;
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  if (
    !Number.isFinite(ar) || !Number.isFinite(ag) || !Number.isFinite(ab) ||
    !Number.isFinite(br) || !Number.isFinite(bg) || !Number.isFinite(bb)
  ) return a;
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  const hex = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}
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
  /** Issue #210 — dir-commit-latency probe stamps.
   *  `lastQueuedTick` is set inside the input `onQueued` callback to
   *  `state.tick + 1` (the tick the NEXT update will see — keydown
   *  always lands between update() calls, never inside one). That
   *  framing makes `deltaTicks === 0` mean "committed on the very next
   *  tick after the press", which is the boundary-aligned merge target.
   *  `lastCommitTick` is set inside update() to `state.tick` whenever
   *  `tickPac` returns `committedQueued: true` — `state.tick` was
   *  already incremented at the top of update(), so it matches the
   *  framing above. Both default to -1 (no measurement yet); the probe
   *  surfaces -1/null until the first input + first commit have fired. */
  private lastQueuedTick = -1;
  private lastCommitTick = -1;

  // ---- Ghost-delta probe (frightened-mode snap merge-gate; Ivy's feel-axis).
  // Captures per-render-frame max ghost-position delta on the renderer's
  // own scale (px). When `ghostDeltaActive` is true, the renderer (after
  // running its normal draw) reads back the same per-ghost positions it
  // just drew, diffs them against the previous frame's snapshot, and
  // pushes one `GhostDeltaSample`. `flipTick` is stamped the moment
  // `driveFlipScript` calls forceFrightened — any sample whose tick
  // crosses that boundary is tagged `isFlipFrame: true`.
  private ghostDeltaActive = false;
  private ghostDeltaPrev: Map<GhostName, { x: number; y: number }> | null =
    null;
  private ghostDeltaSamples: Array<{
    frame: number;
    isFlipFrame: boolean;
    maxGhostDelta: number;
  }> = [];
  private ghostDeltaFrameIdx = 0;
  private ghostDeltaFlipTick: number | null = null;
  // Previous-render-frame tick stamp; lets us tag a frame as
  // straddling the flip when (prevTick < flipTick <= currTick).
  private ghostDeltaPrevTick = -1;

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
      forceGhostOntoPac: (
        name: GhostName,
        mode?: "frightened" | "chase",
      ): void => {
        const g = this.ghosts.find((gh) => gh.name === name);
        if (!g) return;
        g.x = this.state.pac.x;
        g.y = this.state.pac.y;
        g.status = "out";
        // Default: force into 'chase' so the collision branch is the
        // unambiguous kill path (legacy behavior).
        // Opt-in: `mode: "frightened"` so the next update's collision
        // resolves through the eat branch — required by the ghost-eat
        // juice e2e in #150.
        //
        // IMPORTANT: setting `g.mode = "frightened"` alone is NOT enough.
        // `tickGhost`'s step-1 mode resolution runs BEFORE the engine's
        // collision check, and when `frightenedTicksLeft === 0` it
        // overwrites `g.mode` back to scatter/chase — silently invalidating
        // the staged eat. So we also ARM the engine's frightened timer
        // here (and reset the eat streak, matching the power-pellet
        // activation in update()) so the next tick's mode resolution
        // preserves frightened, the collision check sees the eat branch,
        // and the juice writes land. Length: full FRIGHTENED_TICKS — the
        // collision fires on the very next tick so the exact duration
        // doesn't matter, only that it's > 0 long enough to survive
        // step-1 of tickGhost.
        if (mode === "frightened") {
          g.mode = "frightened";
          this.frightenedTicksLeft = FRIGHTENED_TICKS;
          this.frightenedEatStreak = 0;
        } else if (g.mode === "frightened" || g.mode === "eaten") {
          g.mode = "chase";
        }
        g._progress = 0;
      },
      // Test hook: zero out the pellet field in one step. The eat-every-
      // dot path is too slow + race-prone to drive from an e2e (the ghost
      // AI would kill Pac mid-clear on slow CI). Instead we drop pellets
      // to 0 and clear the pellet map; the next update() observes the
      // win condition and starts the level-clear cinematic (#183), which
      // eventually invokes handleLevelWon and flips status to 'won'.
      clearPellets: (): void => {
        this.state.pellets = 0;
        for (let r = 0; r < this.state.pelletMap.length; r += 1) {
          const row = this.state.pelletMap[r];
          for (let c = 0; c < row.length; c += 1) {
            row[c] = false;
          }
        }
      },
      // Issue #137 probe — read-only float sub-tile draw positions for
      // Pac and ghosts, mirroring renderPac / renderGhosts math. The
      // ghost-glide feel spec polls this to assert visual motion parity
      // without inspecting render-internal canvas state. Mirrors EXACTLY
      // the offset calc in renderPac/renderGhosts: `x + dx*progress` per
      // axis, with `_progress` zeroed for in-house ghosts and dir==='none' Pac.
      renderPositions: () => {
        const pac = this.state.pac as typeof this.state.pac & {
          _progress?: number;
        };
        const pacProgress = pac.dir === "none" ? 0 : pac._progress ?? 0;
        let pdx = 0;
        let pdy = 0;
        switch (pac.dir) {
          case "right":
            pdx = 1;
            break;
          case "left":
            pdx = -1;
            break;
          case "down":
            pdy = 1;
            break;
          case "up":
            pdy = -1;
            break;
        }
        const ghosts = this.ghosts.map((g) => {
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
          return {
            name: g.name,
            x: g.x + dx * progress,
            y: g.y + dy * progress,
            mode: g.mode,
            // Expose lastDir so the spec can filter direction-change
            // gaps from the per-tick bound. At every 90° corner the
            // renderer has a visual seam (pre-commit glide along OLD
            // lastDir, post-commit along NEW) — the seam is invariant
            // for renderer + probe, so the contract excludes it.
            lastDir: g.lastDir,
          };
        });
        return {
          tick: this.state.tick,
          // Include pac.dir so the spec can truncate sample windows to
          // the contiguous prefix where Pac is still in motion. Pac
          // stops (dir='none') when tickPac hits a wall — without this
          // signal, the spec would average displacement-zero frames
          // into the self-ratio and trigger a false negative on a
          // straight-corridor sample that overshoots the corridor length.
          pac: {
            x: pac.x + pdx * pacProgress,
            y: pac.y + pdy * pacProgress,
            dir: pac.dir,
          },
          ghosts,
        };
      },
      // Issue #145 probe — flip every released ghost to frightened mode
      // without routing Pac through a power pellet. Spec-only; mirrors
      // the engine's atePowerPellet branch by arming the frightened
      // window. Does NOT touch the score / combo counter.
      forceFrightened: (): void => {
        this.frightenedTicksLeft = FRIGHTENED_TICKS;
        this.frightenedEatStreak = 0;
        for (const g of this.ghosts) {
          if (g.status !== "out") continue;
          if (g.mode === "scatter" || g.mode === "chase") {
            g.mode = "frightened";
            g._progress = 0;
          }
        }
      },
      // Issue #296 probe — arm the power-pellet ceremonial juice channels
      // (hitstop + maze tint pulse + screen-shake) in isolation, without
      // routing Pac through a power-pellet tile. Mirrors the additive
      // arms inside the engine's atePowerPellet branch at update(), so
      // the feel-spec can sample the channels without depending on Pac
      // path-finding through the spawn corridor to the nearest 'o' tile.
      // Does NOT touch frightened mode / score / combo counter — this
      // probe tests the JUICE shape independently of the GHOST-FLIP
      // shape (which #145 already covers via forceFrightened).
      armPowerPelletJuice: (): void => {
        const fb = this.state.feedback;
        fb.hitstopTicks = Math.max(fb.hitstopTicks, POWER_PELLET_HITSTOP_TICKS);
        fb.powerPelletPulse = POWER_PELLET_PULSE_TICKS;
        fb.powerPelletShake = POWER_PELLET_SHAKE_AMP;
      },
      // Issue #145 probe — warp the named ghost into eaten/eyes mode.
      // Forces status='out' (in case it was still in the house) so the
      // eyes-return motion is observable on the render channel. ALSO
      // resets `lastDir` to point toward REVIVE_TILE — without this,
      // the pre-commit sub-tile glide reads in the ghost's previous
      // direction (e.g. spawn's 'left'), and at the first tile commit
      // the renderPositions probe sees a multi-tile jump as the eyes
      // pivot toward (13,14). With the lastDir aligned to the
      // destination, the pre-commit glide is along the actual eyes
      // path and the cross-commit transition is smooth (no >0.7/tick
      // teleport — well inside the FRAME_BOUND_MULT bound).
      setGhostEaten: (name: GhostName): void => {
        const g = this.ghosts.find((gh) => gh.name === name);
        if (!g) return;
        g.status = "out";
        g.mode = "eaten";
        g._progress = 0;
        // Choose the axis with the larger absolute delta toward
        // REVIVE_TILE. Cheap and correct for the spawn case (13,11) →
        // (13,14) — picks 'down'. For other positions the first tile
        // commit's pickDirection re-evaluates anyway; we only need the
        // pre-commit glide to point in a sensible direction so the
        // first commit doesn't read as a teleport on renderPositions.
        const dx = REVIVE_TILE.x - g.x;
        const dy = REVIVE_TILE.y - g.y;
        if (Math.abs(dy) >= Math.abs(dx)) {
          g.lastDir = dy >= 0 ? "down" : "up";
        } else {
          g.lastDir = dx >= 0 ? "right" : "left";
        }
      },
      // Issue #210 — input-to-direction-commit latency probe. Reports
      // the most recent queued/commit stamps and their per-tick delta.
      // Mirrors the shape of Galaga's `fireProbe()` (#168). Null/undefined-
      // safe until the first commit: `deltaTicks` is `null` when either
      // stamp is unset OR when the most recent queue post-dates the most
      // recent commit (i.e. a press is in flight and hasn't been honored
      // yet — the engine has nothing to report).
      dirCommitProbe: () => {
        const lq = this.lastQueuedTick;
        const lc = this.lastCommitTick;
        // No measurement: either no input ever, or no commit ever, or
        // the most recent press is still pending (delta would be
        // negative — an unfinished latency, not a recorded one).
        const hasMeasurement = lq >= 0 && lc >= lq;
        return {
          lastQueuedTick: lq,
          lastCommitTick: lc,
          deltaTicks: hasMeasurement ? lc - lq : null,
        };
      },
      // Frightened-mode snap merge-gate probe (Ivy's feel-axis). Captures
      // per-render-frame max ghost render-position delta on the same px
      // scale the renderer just drew, with the rAF frame that straddles
      // the frightened-mode flip tagged `isFlipFrame: true`. The hypothesis
      // the spec polices: when forceFrightened() arms frightened mode,
      // the only thing that changes on the flip tick is the ghost speed
      // tier (chase 0.10/tick → frightened 0.05/tick); the integer (x,y)
      // and `_progress` are unchanged, so the per-frame render delta on
      // the flip frame stays at sub-tile magnitude — NOT a one-tile
      // teleport. The probe lets the spec measure that.
      //
      // Driving via forceFrightened() (already present for #145) means
      // we don't need to route Pac through a power pellet — eliminates
      // the route-finding / pellet-path flake risk Mara called out.
      ghostDeltaProbe: {
        reset: (): void => {
          this.ghostDeltaSamples = [];
          this.ghostDeltaPrev = null;
          this.ghostDeltaFrameIdx = 0;
          this.ghostDeltaFlipTick = null;
          this.ghostDeltaPrevTick = -1;
          this.ghostDeltaActive = true;
        },
        // Run the deterministic flip script:
        //   1. collect ~30 pre-flip frames of steady-state chase deltas;
        //   2. stamp `flipTick = state.tick + 1` (next update tick) and
        //      call forceFrightened() — same atomic arming the engine
        //      does on a power-pellet pickup;
        //   3. collect ~100 post-flip frames so the steady-state window
        //      has enough samples for a meaningful p99.
        // Resolves when the probe has collected enough frames.
        driveFlipScript: (): Promise<void> => {
          return new Promise<void>((resolve) => {
            const PRE_FLIP_FRAMES = 30;
            const POST_FLIP_FRAMES = 100;
            const TOTAL = PRE_FLIP_FRAMES + POST_FLIP_FRAMES;
            let armed = false;
            const tick = (): void => {
              const collected = this.ghostDeltaSamples.length;
              if (!armed && collected >= PRE_FLIP_FRAMES) {
                // Arm frightened mode on the NEXT update. state.tick
                // is the last completed tick; the rAF that follows
                // will drain at least one update(), so the flip lands
                // on tick+1 or later. The probe tags the FIRST frame
                // whose post-render tick is >= flipTick.
                this.ghostDeltaFlipTick = this.state.tick + 1;
                // Mirror the engine's atePowerPellet branch: arm the
                // frightened timer, reset the eat streak, flip all
                // out-roaming ghosts to frightened. forceFrightened
                // (above) does exactly that.
                this.frightenedTicksLeft = FRIGHTENED_TICKS;
                this.frightenedEatStreak = 0;
                for (const g of this.ghosts) {
                  if (g.status !== "out") continue;
                  if (g.mode === "scatter" || g.mode === "chase") {
                    g.mode = "frightened";
                  }
                }
                armed = true;
              }
              if (collected >= TOTAL) {
                this.ghostDeltaActive = false;
                resolve();
                return;
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        },
        samples: (): ReadonlyArray<{
          frame: number;
          isFlipFrame: boolean;
          maxGhostDelta: number;
        }> => this.ghostDeltaSamples,
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
        // Issue #210 — stamp `lastQueuedTick` as the tick the NEXT
        // update() will run on. Keydown is async wrt update() — it
        // always lands between updates, never inside one — so the
        // current `state.tick` is the LAST completed tick, and the
        // next tickPac that can observe this queue runs on tick+1.
        // This framing makes "boundary-aligned commit on the very
        // next tick" register as deltaTicks === 0, the merge target.
        () => {
          this.lastQueuedTick = this.state.tick + 1;
        },
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
    // Issue #150 — hitstop gate. When a frightened ghost is eaten, the
    // ghost-eat branch writes `hitstopTicks` (default 3); this gate
    // freezes the WHOLE simulation for that many ticks (Pac + ghosts
    // skip their tickers, collisions don't re-fire). Decay-and-skip is
    // collapsed into one branch so we never double-decrement: if the
    // counter is >0 we burn one tick here and return; otherwise normal
    // update proceeds. Decay still runs OUTSIDE this gate via the
    // feedback decay block below — but only AFTER hitstop has expired.
    // The renderer keeps drawing every frame regardless (render() is
    // called per-rAF, not per-update).
    if (this.state.feedback.hitstopTicks > 0) {
      this.state.feedback.hitstopTicks -= 1;
      return;
    }
    // Issue #171 — Pac death cinematic gate. While `deathTicks > 0` the
    // whole sim is frozen (Pac + ghosts skip their tickers, collisions
    // don't re-fire) — the renderer drives the spin-collapse off this
    // counter. We advance the counter here so the renderer reads the
    // post-increment value on the next frame; at DEATH_ANIM_TICKS the
    // existing handlePacDeath() body finally runs (lives--, respawn,
    // lost-check). Feedback decay is gated below so the red veil holds
    // through the pre-pause and then fades through the collapse.
    if (this.state.feedback.deathTicks > 0) {
      this.state.feedback.deathTicks += 1;
      // Skip flashAlpha decay during the pre-pause so the red veil holds
      // visibly while Pac is frozen mid-stride; let other channels
      // (sparkles, popups, pacSquash) fade normally so leftover juice
      // from the prior tick doesn't freeze on screen for 1.2s.
      const fb = this.state.feedback;
      fb.pacSquash *= 0.78;
      if (fb.pacSquash < 0.01) fb.pacSquash = 0;
      if (fb.deathTicks > DEATH_PRE_PAUSE) {
        fb.flashAlpha *= 0.82;
        if (fb.flashAlpha < 0.01) fb.flashAlpha = 0;
      }
      // Issue #296 — bleed the power-pellet pulse + shake through the
      // death cinematic too, so leftover juice from a same-tick power
      // pellet + ghost-kill doesn't freeze on screen for 1.2s.
      if (fb.powerPelletPulse > 0) fb.powerPelletPulse -= 1;
      fb.powerPelletShake *= 0.85;
      if (fb.powerPelletShake < 0.01) fb.powerPelletShake = 0;
      if (this.state.feedback.deathTicks >= DEATH_ANIM_TICKS) {
        this.state.feedback.deathTicks = 0;
        this.state.feedback.flashTint = "cyan";
        this.state.feedback.flashAlpha = 0;
        this.handlePacDeath();
      }
      return;
    }
    // Issue #183 — Pac level-clear cinematic gate. Mirrors the deathTicks
    // shape above: while `clearTicks > 0` the whole sim is frozen (Pac +
    // ghosts skip their tickers, collisions don't re-fire) — the renderer
    // drives the maze-flash + bonus-tally off this counter. We advance
    // the counter here so the renderer reads the post-increment value on
    // the next frame; at CLEAR_FLASH_END we atomically add the bonus to
    // state.score (single write — the displayed tally is purely cosmetic);
    // at CLEAR_ANIM_TICKS the existing level-up reset path (handleLevelWon
    // body) finally fires.
    if (this.state.feedback.clearTicks > 0) {
      const fb = this.state.feedback;
      fb.clearTicks += 1;
      // Fade the white opening veil through the pre-pause so the
      // cycle-flash takes over the visual job at tick CLEAR_PRE_PAUSE.
      // Other feedback channels (sparkles, popups, pacSquash) decay
      // normally so leftover juice from the tick-of-the-final-pellet
      // doesn't freeze on screen for 1.4s.
      fb.pacSquash *= 0.78;
      if (fb.pacSquash < 0.01) fb.pacSquash = 0;
      fb.flashAlpha *= 0.82;
      if (fb.flashAlpha < 0.01) fb.flashAlpha = 0;
      // Issue #296 — same bleed in the clear cinematic gate as in the
      // death gate above. Final-pellet on top of an active pulse is
      // rare but the channel must drain rather than freeze.
      if (fb.powerPelletPulse > 0) fb.powerPelletPulse -= 1;
      fb.powerPelletShake *= 0.85;
      if (fb.powerPelletShake < 0.01) fb.powerPelletShake = 0;
      // Advance + cull sparkles & popups so any leftover overlays from
      // the tick-of-the-final-pellet don't freeze on screen for 1.4s.
      const nextSparkles: typeof fb.sparkles = [];
      for (const s of fb.sparkles) {
        const age = s.ageTicks + 1;
        if (age >= 24) continue;
        nextSparkles.push({
          x: s.x + s.vx,
          y: s.y + s.vy,
          vx: s.vx,
          vy: s.vy,
          ageTicks: age,
        });
      }
      fb.sparkles = nextSparkles;
      const nextPopups: typeof fb.popups = [];
      for (const p of fb.popups) {
        const age = p.ageTicks + 1;
        if (age >= 24) continue;
        nextPopups.push({ x: p.x, y: p.y, value: p.value, ageTicks: age });
      }
      fb.popups = nextPopups;
      // Atomic score bump at the boundary into the tally window. The
      // displayed count-up below is purely cosmetic — the authoritative
      // score change lands here in one write.
      if (fb.clearTicks === CLEAR_FLASH_END) {
        const before = this.state.score;
        this.state.score += LEVEL_CLEAR_BONUS;
        this.maybeAwardExtraLife(before);
      }
      // Tally count-up over [CLEAR_FLASH_END, CLEAR_TALLY_END). Linear
      // lerp from 0 toward LEVEL_CLEAR_BONUS, rounded to the nearest 10
      // so the rolling readout doesn't display single-pixel-flicker
      // values like "+317".
      if (fb.clearTicks >= CLEAR_FLASH_END && fb.clearTicks < CLEAR_TALLY_END) {
        const span = CLEAR_TALLY_END - CLEAR_FLASH_END; // 24
        const k = (fb.clearTicks - CLEAR_FLASH_END + 1) / span;
        const raw = LEVEL_CLEAR_BONUS * Math.min(1, k);
        fb.clearTallyShown = Math.round(raw / 10) * 10;
      }
      if (fb.clearTicks >= CLEAR_ANIM_TICKS) {
        fb.clearTicks = 0;
        fb.clearTallyShown = 0;
        fb.flashTint = "cyan";
        fb.flashAlpha = 0;
        this.handleLevelWon();
      }
      return;
    }
    // Issue #138 — decay the feedback channel BEFORE tickPac runs.
    // Ordering rationale: the eat-event spec (#138 acceptance) requires
    // the snapshot at T+1 to show full-amplitude pop values (regular
    // pellet `pacSquash >= 0.10`, power pellet `>= 0.22`). If we decay
    // AFTER the pickup write, 0.12 * 0.78 = 0.0936 fails the gate. By
    // decaying first, the freshly-written pickup value is what the next
    // poll observes — and it still decays on subsequent ticks because
    // the decay runs every update() before any new write can land.
    {
      const fb = this.state.feedback;
      fb.pacSquash *= 0.78;
      if (fb.pacSquash < 0.01) fb.pacSquash = 0;
      fb.flashAlpha *= 0.82;
      if (fb.flashAlpha < 0.01) fb.flashAlpha = 0;
      // Issue #296 — decay the power-pellet ceremonial channels. Pulse
      // counts DOWN linearly so the renderer reads a clean
      // `1 - n/POWER_PELLET_PULSE_TICKS` progress curve for the wall
      // tint; shake decays multiplicatively (×0.85) so the buzz dies
      // off smoothly. Both gate on the hitstop check above — frozen
      // frames already early-return before we get here, so the pulse
      // doesn't bleed during the freeze.
      if (fb.powerPelletPulse > 0) fb.powerPelletPulse -= 1;
      fb.powerPelletShake *= 0.85;
      if (fb.powerPelletShake < 0.01) fb.powerPelletShake = 0;
      // Issue #295 — bleed the EXTRA banner one tick per active update.
      // Only ticks here (not in the death/clear cinematic gates) — those
      // beats own the screen-overlay slot exclusively, so we hold the
      // EXTRA banner through them rather than racing two messages.
      if (this.state.extraLifeBanner > 0) {
        this.state.extraLifeBanner -= 1;
      }
      // Issue #305 — fruit lifetime decay. The sprite IS the timer:
      // ticksRemaining counts down per active update(); at 0 the fruit
      // auto-disarms (back to `null`) without any banner-of-vanish.
      // Same gate as the EXTRA banner above — frozen frames (hitstop,
      // death, clear) preserve the fruit window rather than burning it
      // during a cinematic the player can't interact with.
      if (this.state.fruit) {
        this.state.fruit.ticksRemaining -= 1;
        if (this.state.fruit.ticksRemaining <= 0) {
          this.state.fruit = null;
        }
      }
      // Issue #305 — bleed the FRUIT banner one tick per active update,
      // mirroring the EXTRA banner. Independent of `state.fruit` because
      // the eat path clears the fruit but leaves the banner countdown
      // running (banner is the spawn announcement, sprite is the timer).
      if (this.state.fruitBanner > 0) {
        this.state.fruitBanner -= 1;
      }
      // Advance + cull sparkles (24-tick max lifetime — power-pellet
      // ceiling; regular sparkles fade visually via the alpha curve in
      // the renderer at the 12-tick mark).
      const nextSparkles: typeof fb.sparkles = [];
      for (const s of fb.sparkles) {
        const age = s.ageTicks + 1;
        if (age >= 24) continue;
        nextSparkles.push({
          x: s.x + s.vx,
          y: s.y + s.vy,
          vx: s.vx,
          vy: s.vy,
          ageTicks: age,
        });
      }
      fb.sparkles = nextSparkles;
      // Advance + cull popups (24-tick lifetime = 400ms at 60Hz).
      const nextPopups: typeof fb.popups = [];
      for (const p of fb.popups) {
        const age = p.ageTicks + 1;
        if (age >= 24) continue;
        nextPopups.push({ x: p.x, y: p.y, value: p.value, ageTicks: age });
      }
      fb.popups = nextPopups;
    }
    // Pac-Man movement + pellet eating. The result surfaces whether a
    // power pellet was eaten this tick; if so we (re)arm frightened mode.
    const pacResult = tickPac(this.state);
    // Issue #210 — record the commit tick when tickPac honored a queued
    // press at step 1. `state.tick` was incremented at the top of
    // update(), so this matches the framing of `lastQueuedTick`
    // (`state.tick + 1` at input time): a press that lands between
    // tick T and the next update reads `lastQueuedTick = T + 1`, and
    // if the next update commits, `lastCommitTick = T + 1` → delta=0.
    if (pacResult.committedQueued) {
      this.lastCommitTick = this.state.tick;
    }
    if (pacResult.atePowerPellet) {
      this.frightenedTicksLeft = FRIGHTENED_TICKS;
      this.frightenedEatStreak = 0;
      // Issue #296 — arm the power-pellet ceremonial juice channels.
      // Layers ADDITIVELY on top of #138 (which already wrote pacSquash
      // = 0.25, a +50 popup, and flashAlpha inside tickPac). #138 owns
      // the per-pellet "you ate something" beat; this owns the
      // RULE-INVERSION beat — the predator/prey flip across all four
      // ghosts. The ceremony reads through (a) hitstop, (b) the maze-
      // wide wall tint pulse, (c) a small graceful screen-shake — NOT
      // through louder versions of channels #138 already owns.
      //
      // Math.max on hitstop so re-eating a pellet during an active
      // freeze can't double-decrement (defensive — same pattern as
      // Galaga's mass-kill clamp from the death-spec doc).
      const fb = this.state.feedback;
      fb.hitstopTicks = Math.max(fb.hitstopTicks, POWER_PELLET_HITSTOP_TICKS);
      fb.powerPelletPulse = POWER_PELLET_PULSE_TICKS;
      fb.powerPelletShake = POWER_PELLET_SHAKE_AMP;
    } else if (this.frightenedTicksLeft > 0) {
      this.frightenedTicksLeft -= 1;
      if (this.frightenedTicksLeft === 0) {
        // Frightened expired: reset the combo so the next activation
        // starts at 200 again.
        this.frightenedEatStreak = 0;
      }
    }
    // Win check: if the last pellet has been eaten (or zeroed by the
    // clearPellets test hook), kick off the level-clear cinematic
    // (issue #183). The actual maze refill + level bump are DEFERRED
    // to handleLevelWon, which fires from the clearTicks gate above
    // at tick CLEAR_ANIM_TICKS. Return early so ghosts don't tick
    // onto a half-cleared board.
    if (this.state.pellets <= 0) {
      const fb = this.state.feedback;
      fb.clearTicks = 1;
      fb.clearTallyShown = 0;
      fb.flashTint = "white";
      // White opening veil at 0.45 alpha — the 0.82/tick decay in the
      // clearTicks gate brings it to ~0.05 by tick CLEAR_PRE_PAUSE,
      // letting the cycle-flash take over the visual job.
      fb.flashAlpha = 0.45;
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
        const value = 200 * (1 << idx);
        const scoreBeforeGhostEat = this.state.score;
        this.state.score += value;
        this.maybeAwardExtraLife(scoreBeforeGhostEat);
        g.mode = "eaten";
        g._progress = 0;
        // Issue #150 — frightened-ghost-eat juice. The single biggest
        // payoff moment in Pac-Man: brief hitstop (the thump), big
        // squash (louder than power-pellet's 0.25), escalating popup
        // (the receipt), and a radial sparkle burst. NO screen flash —
        // the flash belongs to the power-pellet activation, this is
        // what that activation earned.
        const fb = this.state.feedback;
        // Hitstop: 3 frames (~50ms @ 60Hz). Math.max so a hypothetical
        // double-eat-this-tick can't compound a freeze (galaga lesson
        // from #133). Pac-Man can't actually double-eat in one tick
        // (collisions iterate one ghost at a time + Pac moves once per
        // tile), but the defensive shape stays consistent.
        fb.hitstopTicks = Math.max(fb.hitstopTicks, 3);
        // Squash: 0.30 — bigger than power-pellet (0.25). Direct
        // assignment (matches pellet-pickup convention in pacman.ts).
        fb.pacSquash = 0.30;
        // Score popup at the eaten tile. Reuses the existing 24-tick
        // popup lifetime (decayed by the feedback decay block above).
        fb.popups.push({ x: g.x, y: g.y, value, ageTicks: 0 });
        // Sparkle burst: 16 sparkles, radial at 0.5 tile/tick, 20-tick
        // lifetime. Deterministic — angle table seeded by the eat
        // streak so each ghost in a 4-combo gets a distinct rotation
        // and the e2e can assert sparkles.length === 16 without flake.
        // (Existing sparkle decay loop culls at age >= 24, which is
        // already past our 20-tick visual budget — alpha curve in the
        // renderer fades them out earlier.)
        const SPARKLE_COUNT = 16;
        const SPARKLE_SPEED = 0.5;
        // Per-eat rotation offset so a 4-ghost combo doesn't stack
        // identical bursts on the same angles.
        const rot = (this.frightenedEatStreak - 1) * (Math.PI / 16);
        for (let i = 0; i < SPARKLE_COUNT; i += 1) {
          const theta = (i / SPARKLE_COUNT) * Math.PI * 2 + rot;
          fb.sparkles.push({
            x: g.x + 0.5,
            y: g.y + 0.5,
            vx: Math.cos(theta) * SPARKLE_SPEED,
            vy: Math.sin(theta) * SPARKLE_SPEED,
            ageTicks: 0,
          });
        }
      } else if (g.mode === "scatter" || g.mode === "chase") {
        // Fatal contact — handle once per tick even if multiple ghosts
        // sit on Pac's tile.
        pacDied = true;
        break;
      }
      // 'eaten' ghosts (eyes) pass through Pac harmlessly — no branch.
    }
    if (pacDied) {
      // Issue #171 — defer the lives--/respawn until AFTER the death
      // cinematic plays. Sequence:
      //   1. brief hitstop (4 ticks ~= 67ms) — the IMPACT freeze, so
      //      the player FEELS the hit before the camera holds for the
      //      cinematic.
      //   2. when hitstop drains, the deathTicks gate above takes over
      //      and ticks the 72-frame spin-collapse anim.
      //   3. at deathTicks === DEATH_ANIM_TICKS the existing reset path
      //      (handlePacDeath body) fires.
      // Math.max so a hypothetical double-collision-this-tick can't
      // compound and freeze the engine longer than intended.
      const fb = this.state.feedback;
      fb.hitstopTicks = Math.max(fb.hitstopTicks, 4);
      fb.deathTicks = 1;
      fb.flashAlpha = 0.35;
      fb.flashTint = "red";
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
   *  ghosts into the next level.
   *
   *  Issue #183 — this body is now invoked DEFERRED, from the clearTicks
   *  gate at tick CLEAR_ANIM_TICKS, rather than synchronously on the
   *  final-pellet tick. The cinematic owns the held beat; this owns the
   *  reset that follows. */
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
    // Issue #305 — fresh per-level fruit window. dotsEaten + spawn count
    // reset so the new level gets its own pair of fruit appearances
    // (canon: 70 + 170 dots per level). Any leftover fruit on the board
    // is cleared so the new level doesn't inherit a stale sprite.
    this.state.dotsEaten = 0;
    this.state.fruitSpawnsThisLevel = 0;
    this.state.fruit = null;
    this.state.fruitBanner = 0;
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

  /** Issue #295 — arcade-canon extra life at 10,000 points. Call AFTER
   *  any score-bump, passing the score BEFORE the bump. Idempotent and
   *  one-shot: the `extraLifeAwarded` latch on state ensures it fires
   *  exactly once per game, no matter which path crosses the threshold
   *  (pellet eat in tickPac, frightened-ghost eat above, level-clear
   *  bonus). Writes lives++, latches the flag, and arms the EXTRA
   *  banner countdown that the renderer reads. */
  private maybeAwardExtraLife(scoreBefore: number): void {
    if (this.state.extraLifeAwarded) return;
    if (scoreBefore >= EXTRA_LIFE_SCORE) return;
    if (this.state.score < EXTRA_LIFE_SCORE) return;
    this.state.lives += 1;
    this.state.extraLifeAwarded = true;
    this.state.extraLifeBanner = EXTRA_BANNER_TICKS;
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

    // 3b. Issue #305 — fruit on the maze, beneath Pac/ghosts.
    this.renderFruit();

    // 4. Pac on top of the maze.
    this.renderPac();

    // 4b. Ghosts on top of Pac (so a collision is visible — and so the
    //     red disc never gets hidden under the player when they stack).
    this.renderGhosts();

    // 4c. Issue #138 — pellet-pickup juice overlays: sparkles + score
    //     popups in the maze coordinate frame, on top of Pac + ghosts.
    this.renderFeedbackOverlays();

    // 4d. Issue #183 — level-clear tally HUD. Drawn when the
    //     clearTicks gate is in [CLEAR_FLASH_END, CLEAR_ANIM_TICKS).
    //     Centered text on top of the empty maze. The label is the
    //     receipt: the maze IS clean (every pellet eaten), the +N is
    //     the audit. "CLEAN" earns its word; "BONUS" was system text
    //     explaining what the cleared board already said.
    if (state.feedback.clearTicks >= CLEAR_FLASH_END) {
      ctx.save();
      ctx.fillStyle = "#ffd76a";
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `CLEAN  +${state.feedback.clearTallyShown}`,
        w / 2,
        h / 2,
      );
      ctx.restore();
    }

    // 5. Status overlays:
    //    - 'ready' → READY! boot label, held until the loop starts.
    //    - 'won'   → "AGAIN. FASTER." — the maze refills, ghosts speed up ~10%.
    //    - 'lost'  → GAME OVER after running out of lives.
    if (state.status === "ready") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(BANNER_READY, w / 2, h / 2);
    } else if (state.extraLifeBanner > 0) {
      // Issue #295 — arcade canon's one celebratory threshold. Same
      // slot, same yellow as READY!/GAME OVER. One word: EXTRA.
      // Branch ordering: 'ready' takes precedence (overlay holds until
      // first input — banner can't fire then anyway, score is 0).
      // 'won' / 'lost' branches sit below, so during the level-clear
      // cinematic the EXTRA hold is honored — `update()` is gated on
      // status during 'won', so the banner counter won't tick during
      // a clear; the moment the next level resumes, the remaining
      // countdown bleeds out naturally.
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(BANNER_EXTRA, w / 2, h / 2);
    } else if (state.fruitBanner > 0) {
      // Issue #305 — arcade canon's mid-level give-to-player beat. The
      // ONE word, in the same yellow slot as READY!/EXTRA. The sprite
      // IS the timer — no countdown number. Banner clears on eat OR
      // on auto-disarm (handled by the engine's fruit decay above).
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(BANNER_FRUIT, w / 2, h / 2);
    } else if (state.status === "won") {
      ctx.fillStyle = "#ffd76a";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AGAIN. FASTER.", w / 2, h / 2);
    } else if (state.status === "lost") {
      ctx.fillStyle = "#ff5d5d";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(BANNER_GAME_OVER, w / 2, h / 2);
    }

    // 6. Issue #138 — power-pellet screen flash. Drawn LAST so it
    //    veils Pac + ghosts + status overlays uniformly. Cyan-white
    //    by default; alpha decays to 0 over ~14 ticks (engine update()).
    //    Issue #171 — death uses the same channel but tints `'red'`
    //    so the "impact" veil reads as a hit, not a power-up.
    //    Issue #183 — level-clear uses `'white'` for the opening veil.
    if (state.feedback.flashAlpha > 0) {
      let rgb: string;
      if (state.feedback.flashTint === "red") rgb = "255, 80, 80";
      else if (state.feedback.flashTint === "white") rgb = "255, 255, 255";
      else rgb = "230, 248, 255";
      ctx.fillStyle = `rgba(${rgb}, ${state.feedback.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 7. Ghost-delta probe (frightened-mode snap merge-gate). After the
    //    frame is fully drawn, snapshot per-ghost render positions on
    //    the px scale the renderer just used. If a previous-frame
    //    snapshot exists, push a sample with the max euclidean delta
    //    across ghosts. The `isFlipFrame` flag is true iff this frame
    //    straddles the recorded `flipTick` (prevTick < flipTick <=
    //    currTick) — i.e. this is the rAF frame whose update() drained
    //    over the tick at which forceFrightened() armed frightened mode.
    if (this.ghostDeltaActive) {
      this.captureGhostDeltaSample();
    }
  }

  /** Snapshot per-ghost render positions on the SAME math the renderer
   *  uses (sub-tile glide along `lastDir`), diff against the prior
   *  frame, and push one GhostDeltaSample. Owned here so the probe
   *  stays bit-identical to what the player sees, not what the engine
   *  state happens to expose. */
  private captureGhostDeltaSample(): void {
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((this.canvas.width - mazeW) / 2);
    const oy = Math.floor((this.canvas.height - mazeH) / 2);
    const positions = new Map<GhostName, { x: number; y: number }>();
    for (const g of this.ghosts) {
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
      const cx = ox + (g.x + dx * progress) * TILE + TILE / 2;
      const cy = oy + (g.y + dy * progress) * TILE + TILE / 2;
      positions.set(g.name, { x: cx, y: cy });
    }
    const currTick = this.state.tick;
    if (this.ghostDeltaPrev !== null) {
      let maxDelta = 0;
      for (const [name, prev] of this.ghostDeltaPrev.entries()) {
        const curr = positions.get(name);
        if (!curr) continue;
        const ddx = curr.x - prev.x;
        const ddy = curr.y - prev.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d > maxDelta) maxDelta = d;
      }
      const flipTick = this.ghostDeltaFlipTick;
      const isFlipFrame =
        flipTick !== null &&
        this.ghostDeltaPrevTick < flipTick &&
        flipTick <= currTick;
      this.ghostDeltaSamples.push({
        frame: this.ghostDeltaFrameIdx,
        isFlipFrame,
        maxGhostDelta: maxDelta,
      });
      this.ghostDeltaFrameIdx += 1;
    }
    this.ghostDeltaPrev = positions;
    this.ghostDeltaPrevTick = currTick;
  }

  /** Issue #138 — sparkles + score popups. Maze coordinate frame
   *  (the same origin used by renderMaze / renderPac). Sparkles are
   *  tiny pellet-coloured discs drifting outward; popups are "+10" /
   *  "+50" labels rising over 400ms. Both fade by `ageTicks/24`. */
  private renderFeedbackOverlays(): void {
    const { ctx, canvas, state } = this;
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);

    // Sparkles.
    for (const s of state.feedback.sparkles) {
      const alpha = Math.max(0, 1 - s.ageTicks / 24);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PELLET_COLOR;
      ctx.beginPath();
      ctx.arc(ox + s.x * TILE, oy + s.y * TILE, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Score popups.
    if (state.feedback.popups.length > 0) {
      ctx.save();
      ctx.font = "8px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of state.feedback.popups) {
        const t = p.ageTicks / 24;
        const alpha = Math.max(0, 1 - t);
        if (alpha <= 0) continue;
        // Ease-out-cubic on the lift.
        const lift = (1 - (1 - t) ** 3) * 8;
        const px = ox + p.x * TILE + TILE / 2;
        const py = oy + p.y * TILE + TILE / 2 - lift;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`+${p.value}`, px, py);
      }
      ctx.restore();
    }
  }

  /** Walls + pellets. Static for now — pellets will be eaten in a later slice
   *  by clearing tiles in a mutable pellet map, but the rendering loop won't
   *  change shape.
   *
   *  Issue #183 — during the level-clear cinematic's flash window the wall
   *  stroke alternates between WALL_COLOR (blue) and WALL_FLASH_COLOR
   *  (white) on a 12-tick cycle. The maze layout / pellet draw is
   *  unchanged; only the stroke colour swaps. Pellets are all gone in
   *  this window so the pellet draw is a no-op anyway. */
  private renderMaze(): void {
    const { ctx, canvas, state } = this;
    // Center the maze inside the canvas.
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);

    // Walls: stroke a small rectangle inset inside each wall tile. It's a
    // serviceable readable approximation; arcade-true wall geometry (rounded
    // corner segments) is a future polish pass.
    //
    // Issue #183 — level-clear flash override. While `clearTicks` is in
    // [CLEAR_PRE_PAUSE, CLEAR_FLASH_END), pick the stroke colour off a
    // 12-tick cycle: first half blue, second half white. 4 cycles total
    // over 48 ticks = ~800ms at 60Hz.
    const ct = state.feedback.clearTicks;
    let wallStroke = WALL_COLOR;
    if (ct >= CLEAR_PRE_PAUSE && ct < CLEAR_FLASH_END) {
      const phase = ct - CLEAR_PRE_PAUSE; // 0..47
      // Each 12-tick cycle: ticks 0-5 blue, 6-11 white.
      wallStroke = phase % 12 >= 6 ? WALL_FLASH_COLOR : WALL_COLOR;
    } else if (state.feedback.powerPelletPulse > 0) {
      // Issue #296 — maze-wide tint pulse toward white on power-pellet
      // pickup. The CEREMONIAL channel: a soft cyan→white→cyan breath
      // that telegraphs "the rules just inverted" without the harsh
      // strobe of the level-clear flash. Eased: tint = peak amplitude
      // 0.7 (capped — not full white, to keep the cyan identity) times
      // an exp-decay shape mapped from pulse progress, so the pulse
      // reads as a quick bright snap and a graceful decay rather than
      // a linear fade.
      const k = state.feedback.powerPelletPulse / POWER_PELLET_PULSE_TICKS; // 1→0
      const t = Math.max(0, Math.min(1, k * 0.7));
      wallStroke = lerpHex(WALL_COLOR, WALL_FLASH_COLOR, t);
    }
    ctx.strokeStyle = wallStroke;
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

  /** Issue #305 — fruit sprite at the canon spawn tile (under the ghost
   *  house). Cosmetic-only colour pick per kind so cherry/strawberry
   *  read differently across levels, but the banner word stays FRUIT.
   *  Skipped during death + level-clear cinematics so the ceremonial
   *  overlays own their slot (matches renderPac/renderGhosts policy). */
  private renderFruit(): void {
    const { ctx, canvas, state } = this;
    if (!state.fruit) return;
    if (state.feedback.deathTicks >= DEATH_PRE_PAUSE) return;
    if (state.feedback.clearTicks >= CLEAR_PRE_PAUSE) return;
    const mazeW = COLS * TILE;
    const mazeH = ROWS * TILE;
    const ox = Math.floor((canvas.width - mazeW) / 2);
    const oy = Math.floor((canvas.height - mazeH) / 2);
    const cx = ox + state.fruit.x * TILE + TILE / 2;
    const cy = oy + state.fruit.y * TILE + TILE / 2;
    // Per-kind cosmetic colour. The PLAYER-FACING word is FRUIT
    // regardless (see #305 banner); the colour is just texture so
    // levels feel distinct. Defensive fallback to cherry red.
    const FRUIT_COLORS: Record<string, string> = {
      cherry: "#ff1d1d",
      strawberry: "#ff5d8f",
      orange: "#ffb847",
      apple: "#ff3d3d",
      melon: "#9bff5d",
      galaxian: "#5dc6ff",
      bell: "#ffd76a",
      key: "#dedede",
    };
    ctx.fillStyle = FRUIT_COLORS[state.fruit.kind] ?? "#ff1d1d";
    ctx.beginPath();
    ctx.arc(cx, cy, TILE / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    // Stem: a small dark cap, so the sprite reads as a piece of fruit
    // and not "just another ghost". Pure cosmetic.
    ctx.fillStyle = "#2d8a2d";
    ctx.fillRect(cx - 1, cy - TILE / 2 + 1, 2, 2);
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
    // Issue #183 — during the level-clear flash + tally windows, skip
    // drawing Pac entirely (arcade-true: the empty maze IS the
    // celebration). Pre-pause still draws him frozen mid-stride.
    if (state.feedback.clearTicks >= CLEAR_PRE_PAUSE) {
      return;
    }
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

    let cx = ox + (pac.x + dx * progress) * TILE + TILE / 2;
    let cy = oy + (pac.y + dy * progress) * TILE + TILE / 2;
    // Issue #296 — power-pellet screen-shake. Soft 1.2px buzz that
    // decays ×0.85/tick (engine.update()). Phase derived from
    // state.tick so a fresh poll after N steps lands deterministically
    // — the e2e probe can sample without timing flakes. Pac-Man tone:
    // graceful, small amplitude, no rotation, just a horizontal
    // shimmy. Renderer-only: read-and-offset, no state mutation here.
    if (state.feedback.powerPelletShake > 0.01) {
      // 1.9 Hz from issue spec ≈ ω·tick / 60 ≈ 0.199 rad/tick.
      const phase = state.tick * 0.199;
      cx += Math.sin(phase) * state.feedback.powerPelletShake;
      cy += Math.cos(phase * 1.3) * state.feedback.powerPelletShake * 0.6;
    }
    // Issue #138 — pellet-pickup squash. Scale Pac's draw radius by
    // (1 + pacSquash) so a fresh eat-event pops the sprite outward.
    // Geometry-only; no transform stack tricks. Decays in update().
    const r = (TILE / 2 - 0.5) * (1 + state.feedback.pacSquash);

    // Chomp phase: 5 Hz (12 ticks at 60 Hz per full cycle). When at rest,
    // freeze the mouth half-open so the sprite still reads as Pac-Man.
    let mouth: number;
    if (pac.dir === "none") {
      mouth = 0.175 * Math.PI; // ~31° — half of the peak opening
    } else {
      const phase = (state.tick % 12) / 12; // 0..1
      mouth = Math.abs(Math.sin(phase * Math.PI)) * 0.35 * Math.PI; // 0..~63°
    }

    // Issue #171 — spin-collapse death cinematic. While deathTicks is in
    // the [PRE_PAUSE, COLLAPSE_END) window, override the wedge geometry:
    // first the mouth opens from its current value out to a full π (the
    // wedge has no remaining "slice" — Pac becomes a near-disc), then the
    // radius shrinks toward 0. After COLLAPSE_END (post-pause) we don't
    // draw Pac at all — the world holds black where he was.
    const dt = state.feedback.deathTicks;
    let drawR = r;
    if (dt >= DEATH_PRE_PAUSE) {
      if (dt >= DEATH_COLLAPSE_END) {
        // Post-pause — leave the spot empty.
        return;
      }
      // Collapse window. First half: mouth → π. Second half: radius → 0.
      const COLLAPSE_LEN = DEATH_COLLAPSE_END - DEATH_PRE_PAUSE; // 48
      const HALF = COLLAPSE_LEN / 2; // 24
      const phase = dt - DEATH_PRE_PAUSE;
      if (phase < HALF) {
        const k = phase / HALF; // 0..1
        mouth = mouth + (Math.PI - mouth) * k;
      } else {
        mouth = Math.PI;
        const k = (phase - HALF) / HALF; // 0..1
        drawR = r * (1 - k);
      }
      if (drawR <= 0) return;
    }

    ctx.fillStyle = "#ffd76a";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    // Wedge: arc from +mouth around to 2π-mouth, then line back to center
    // so the missing slice points along +x (the travel direction after
    // rotation). When mouth === π the start and end angles meet, leaving
    // no remaining wedge — the canvas arc collapses to a degenerate path,
    // so we draw a full disc instead.
    if (mouth >= Math.PI) {
      ctx.arc(0, 0, drawR, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, drawR, mouth, Math.PI * 2 - mouth);
      ctx.lineTo(0, 0);
    }
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
    const { ctx, canvas, state } = this;
    // Issue #171 — arcade-true: once the death anim's pre-pause ends, the
    // ghosts disappear and only Pac stays on screen for the collapse. Up
    // to and including the pre-pause they're still drawn (frozen in place
    // — the sim is gated above), so the player reads the "oh no" beat.
    if (state.feedback.deathTicks >= DEATH_PRE_PAUSE) {
      return;
    }
    // Issue #183 — same skip pattern for the level-clear cinematic. Up
    // to and including the pre-pause the ghosts are still drawn (frozen
    // in place); from the maze-flash onward they vanish so the pulsing
    // empty maze owns the celebration.
    if (state.feedback.clearTicks >= CLEAR_PRE_PAUSE) {
      return;
    }
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
        // Eyes: a small white dot, no body. Eaten ghosts are NEVER
        // mid-emerge (the eaten path doesn't re-arm _emergeTicks per
        // #224 scope), so the envelope is implicitly 1 here.
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // Issue #224 — house-release emerge envelope. emergeProgress goes
      // 0→1 over EMERGE_TICKS frames after the dot-counter snap; we map
      // it through ease-out-cubic into both alpha (fade-in) and a
      // 0.6→1.0 scale-up. Pivots on the ghost's pixel center (cx, cy).
      // Pacman tone: GRACEFUL, not PUNCHY — no overshoot. (Compare to
      // galaga formation entry #126 which DOES bezier-overshoot.)
      // When emergeProgress === 1 (the steady-state for >99% of frames,
      // including Blinky from boot), the envelope is a no-op pass-through.
      const p = g.emergeProgress;
      const settled = p >= 1;
      let easeOutCubic = 1;
      if (!settled) {
        easeOutCubic = 1 - Math.pow(1 - p, 3);
      }
      if (g.mode === "frightened") {
        ctx.fillStyle = frightenedFlashOn ? "#ffffff" : "#1d1dff";
      } else {
        ctx.fillStyle = GHOST_COLORS[g.name] ?? "#ffffff";
      }
      if (settled) {
        ctx.beginPath();
        ctx.arc(cx, cy, TILE / 2 - 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const alpha = easeOutCubic;
        const scale = 0.6 + 0.4 * easeOutCubic;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.beginPath();
        // Draw centered at origin since we've translated to (cx, cy).
        ctx.arc(0, 0, TILE / 2 - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
      forceGhostOntoPac: (
        name: GhostName,
        mode?: "frightened" | "chase",
      ) => void;
      clearPellets: () => void;
      renderPositions: () => {
        tick: number;
        pac: { x: number; y: number; dir: string };
        ghosts: Array<{
          name: GhostName;
          x: number;
          y: number;
          mode: string;
          lastDir: string;
        }>;
      };
      forceFrightened: () => void;
      armPowerPelletJuice: () => void;
      setGhostEaten: (name: GhostName) => void;
      dirCommitProbe: () => {
        lastQueuedTick: number;
        lastCommitTick: number;
        deltaTicks: number | null;
      };
      ghostDeltaProbe: {
        reset: () => void;
        driveFlipScript: () => Promise<void>;
        samples: () => ReadonlyArray<{
          frame: number;
          isFlipFrame: boolean;
          maxGhostDelta: number;
        }>;
      };
    };
  }
}

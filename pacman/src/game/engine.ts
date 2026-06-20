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
        const value = 200 * (1 << idx);
        this.state.score += value;
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

    // 4c. Issue #138 — pellet-pickup juice overlays: sparkles + score
    //     popups in the maze coordinate frame, on top of Pac + ghosts.
    this.renderFeedbackOverlays();

    // 5. Status overlays:
    //    - 'ready' → READY! boot label, held until the loop starts.
    //    - 'won'   → "AGAIN, FASTER" — the maze refills, ghosts speed up ~10%.
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
      ctx.fillText("AGAIN, FASTER", w / 2, h / 2);
    } else if (state.status === "lost") {
      ctx.fillStyle = "#ff5d5d";
      ctx.font = "14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", w / 2, h / 2);
    }

    // 6. Issue #138 — power-pellet screen flash. Drawn LAST so it
    //    veils Pac + ghosts + status overlays uniformly. Cyan-white;
    //    alpha decays to 0 over ~14 ticks (engine update()).
    if (state.feedback.flashAlpha > 0) {
      ctx.fillStyle = `rgba(230, 248, 255, ${state.feedback.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }
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
      setGhostEaten: (name: GhostName) => void;
    };
  }
}

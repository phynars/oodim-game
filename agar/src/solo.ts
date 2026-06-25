// agar — single-player (solo) mode. THE DEFAULT EXPERIENCE.
//
// Why this exists (root cause of "I can't play agar — it doesn't grow
// or eat others"): the original client (multiplayer.ts) renders ONLY
// from server snapshots pushed by the EchoRoom Durable Object over a
// WebSocket. That DO Worker is dev-only — `agar/wrangler.toml` has no
// deploy routing and the deploy workflow publishes only static assets.
// So on the live site `wss://…/ws` 404s, no snapshot ever arrives,
// `latest` stays null, and the canvas shows "no one is listening" with
// zero gameplay. Locally it's the same unless you also run
// `wrangler dev` on :8787.
//
// The fix: run the SAME proven pure reducer LOCALLY at 20 Hz. No
// server, no WebSocket — food, bots, eating, growth, death/respawn all
// already live in `step()`. A human at /agar/ gets a working game out
// of the box. Multiplayer is still reachable at /agar/?mp=1.
//
// Test surface: this module installs `window.__game` with the same
// `{ canonical, tick }` read fields the prod play-smoke + solo spec
// consult, plus a tiny `window.__agarSolo` hook ({ mass, tick, setDir,
// step }) the solo e2e uses to drive the world deterministically.

import {
  initialState,
  radiusForMass,
  step,
  type InputDir,
  type PlayerState,
  type WorldState,
  PLAYER_MASS_START,
  WORLD_W,
  WORLD_H,
} from "../server/reducer";

export function startSolo(): void {
  const canvasEl = document.getElementById("game");
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    throw new Error("agar: #game canvas not found");
  }
  const canvas: HTMLCanvasElement = canvasEl;

  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) {
    throw new Error("agar: 2d context unavailable");
  }
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  function readSeed(): number {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("seed") ?? "1";
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  const seed = readSeed();
  // The local player's id. Sorts ahead of the empty roster; any string
  // works since there's only one human cell in solo.
  const PLAYER_ID = "you";

  // Seed the world, then immediately join the single human player so the
  // very first frame already has a controllable cell (no "waiting to be
  // seen" gap that plagued the multiplayer client).
  let state: WorldState = step(initialState(seed), {
    joins: [{ id: PLAYER_ID }],
  });

  // Current held input direction. keydown sets it, keyup clears it back
  // to "none" — continuous motion while a key is held (the reducer is
  // dir-based, one of up/down/left/right/none).
  let heldDir: InputDir = "none";

  function self(): PlayerState | null {
    for (const p of state.players) if (p.id === PLAYER_ID) return p;
    return null;
  }

  // Advance exactly one reducer tick with the current held dir.
  function tickOnce(): void {
    state = step(state, { inputs: { [PLAYER_ID]: { dir: heldDir } } });
  }

  // --- Rendering ---------------------------------------------------------
  // Camera centers on the player so growth stays legible — the world is
  // only 640×640 but a centered camera keeps the player mid-canvas and
  // makes relative size obvious.
  function draw(): void {
    const me = self();
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera offset: translate so the player sits at canvas center.
    const camX = me ? me.x - canvas.width / 2 : WORLD_W / 2 - canvas.width / 2;
    const camY = me ? me.y - canvas.height / 2 : WORLD_H / 2 - canvas.height / 2;

    ctx.save();
    ctx.translate(-camX, -camY);

    // World border so the player can tell where the walls are.
    ctx.strokeStyle = "#1a1a22";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);

    // Food pellets.
    ctx.fillStyle = "#e8c46b";
    for (const pellet of state.food) {
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bots. Tint smaller-than-you (edible) green-ish, bigger (deadly) red-ish.
    for (const bot of state.bots) {
      const edible = me ? me.mass >= bot.mass * 1.1 : false;
      const deadly = me ? bot.mass >= me.mass * 1.1 : false;
      ctx.fillStyle = edible ? "#6fae6f" : deadly ? "#c46b6b" : "#9a7adf";
      ctx.beginPath();
      ctx.arc(bot.x, bot.y, radiusForMass(bot.mass), 0, Math.PI * 2);
      ctx.fill();
    }

    // The player.
    if (me) {
      ctx.fillStyle = "#80e6c1";
      ctx.beginPath();
      ctx.arc(me.x, me.y, radiusForMass(me.mass), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e8eaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(me.x, me.y, radiusForMass(me.mass), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // HUD (screen space — drawn after restore).
    ctx.fillStyle = "#e8eaff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("eat the small · flee the big", canvas.width / 2, 28);

    if (me) {
      ctx.font = "600 16px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      const baseY = canvas.height - 24;
      ctx.fillStyle = "#e8c46b";
      ctx.fillText(`mass ${me.mass}`, 16, baseY);
      ctx.fillStyle = "#9a7adf";
      ctx.fillText(`best ${me.bestMass}`, 16, baseY - 20);
      if (me.deaths > 0) {
        ctx.fillStyle = "#a85050";
        ctx.fillText(`lost ${me.deaths}`, 16, baseY - 40);
      }
    }

    // Move hint, bottom-right.
    ctx.font = "500 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#707088";
    ctx.textAlign = "right";
    ctx.fillText("WASD / arrows", canvas.width - 16, canvas.height - 24);
  }

  // Hidden probe (mirrors the multiplayer client's [data-testid]) so any
  // generic harness keying off it still finds a live tick in solo.
  const probe = document.createElement("div");
  probe.setAttribute("data-testid", "agar-net-status");
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.top = "-9999px";
  probe.dataset.tick = String(state.tick);
  probe.dataset.connected = "true";
  probe.dataset.mode = "solo";
  probe.textContent = `tick=${state.tick}`;
  document.body.appendChild(probe);

  function syncProbe(): void {
    probe.dataset.tick = String(state.tick);
    probe.textContent = `tick=${state.tick}`;
  }

  // --- Input -------------------------------------------------------------
  function keyToDir(code: string): InputDir | null {
    switch (code) {
      case "ArrowUp":
      case "KeyW":
        return "up";
      case "ArrowDown":
      case "KeyS":
        return "down";
      case "ArrowLeft":
      case "KeyA":
        return "left";
      case "ArrowRight":
      case "KeyD":
        return "right";
      default:
        return null;
    }
  }

  window.addEventListener("keydown", (e) => {
    const dir = keyToDir(e.code);
    if (dir === null) return;
    e.preventDefault();
    heldDir = dir;
  });

  window.addEventListener("keyup", (e) => {
    const dir = keyToDir(e.code);
    if (dir === null) return;
    e.preventDefault();
    // Only clear if the released key matches the held dir — releasing a
    // different key mid-hold shouldn't stop motion.
    if (heldDir === dir) heldDir = "none";
  });

  // Pointer (mouse / touch) → nearest of the 4 dirs. The reducer is
  // dir-based, not a velocity vector, so we pick the dominant axis from
  // the cursor's offset relative to canvas center (= player center).
  function pointerToDir(clientX: number, clientY: number): InputDir {
    const rect = canvas.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return "none";
    return Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? "right"
        : "left"
      : dy >= 0
        ? "down"
        : "up";
  }

  let pointerActive = false;
  canvas.addEventListener("pointerdown", (e) => {
    pointerActive = true;
    heldDir = pointerToDir(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointerActive) return;
    heldDir = pointerToDir(e.clientX, e.clientY);
  });
  const endPointer = (): void => {
    pointerActive = false;
    heldDir = "none";
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", endPointer);

  // --- Loop --------------------------------------------------------------
  // 20 Hz simulation via an accumulator inside requestAnimationFrame, so
  // the sim cadence is decoupled from the display refresh rate.
  const TICK_MS = 1000 / 20;
  let last = performance.now();
  let acc = 0;
  let raf = 0;

  function loop(now: number): void {
    acc += now - last;
    last = now;
    // Cap catch-up so a backgrounded tab doesn't spin hundreds of ticks
    // on return.
    let steps = 0;
    while (acc >= TICK_MS && steps < 5) {
      tickOnce();
      acc -= TICK_MS;
      steps++;
    }
    if (steps > 0) syncProbe();
    draw();
    raf = requestAnimationFrame(loop);
  }

  // First frame + start the loop.
  draw();
  syncProbe();
  raf = requestAnimationFrame(loop);

  window.addEventListener("pagehide", () => cancelAnimationFrame(raf));

  // --- Test surfaces -----------------------------------------------------
  // window.__game: shaped like the multiplayer surface's read fields so
  // the prod play-smoke (which navigates bare /agar/ and reads
  // canonical.players/food/bots + tick) passes against the DEFAULT solo
  // page — i.e. solo also fixes the prod WS-404 alarm.
  (window as unknown as { __game: unknown }).__game = {
    get canonical() {
      return state;
    },
    get tick() {
      return state.tick;
    },
    get clientId() {
      return PLAYER_ID;
    },
    get seed() {
      return String(seed);
    },
    mode: "solo",
  };

  // window.__agarSolo: minimal deterministic drive hook for the solo
  // e2e — set a direction and advance the sim from the test without
  // depending on rAF timing or keyboard event plumbing.
  (window as unknown as { __agarSolo: unknown }).__agarSolo = {
    mass(): number {
      return self()?.mass ?? PLAYER_MASS_START;
    },
    bestMass(): number {
      return self()?.bestMass ?? PLAYER_MASS_START;
    },
    deaths(): number {
      return self()?.deaths ?? 0;
    },
    tick(): number {
      return state.tick;
    },
    setDir(dir: InputDir): void {
      heldDir = dir;
    },
    // Advance n reducer ticks immediately (synchronous, deterministic).
    step(n = 1): void {
      for (let i = 0; i < n; i++) tickOnce();
      syncProbe();
      draw();
    },
    self(): PlayerState | null {
      return self();
    },
    // Deterministic test seam: drop `count` food pellets at an exact
    // world position by overwriting the first `count` slots of the fixed
    // food pool. The solo grow-by-food spec stacks several pellets
    // directly on the player so a single `step()` provably eats them all
    // — removing the old flaky "wander until you bump into a pellet"
    // dependency on CI speed.
    //
    // Why several at once: the reducer applies a -1 mass DECAY every tick
    // to any above-start cell (server/reducer.ts applyDecay), so eating a
    // SINGLE pellet (+1) nets to zero that tick and the cell never grows.
    // Eating N pellets in one tick nets +(N-1), a real, deterministic
    // gain. (This mirrors why the line-146 eat-a-cell test grows: a whole
    // cell adds >=8 at once, dwarfing the -1 decay.)
    //
    // Mutating in place keeps the pool length at FOOD_COUNT; the reducer
    // respawns each eaten slot deterministically afterward.
    seedFoodAt(x: number, y: number, count = 1): void {
      const n = Math.min(count, state.food.length);
      for (let i = 0; i < n; i++) state.food[i] = { x, y };
    },
  };
}

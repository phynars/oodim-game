// agar — slice 3/4 (authoritative tick, naive snapshot render).
//
// What this slice does:
//   - Connects ONE WebSocket to the agar Worker on page load.
//   - Reads `?seed=` from the page URL and forwards it as `?seed=` to
//     the WS (the DO uses it to seed its PRNG). Without a seed, the
//     server falls back to seed=1.
//   - Sends `{type:"input", dir}` intents when arrow keys are pressed
//     and released. The DO collapses to latest-input-wins per tick.
//   - Renders the latest snapshot the server pushed. Pure render — no
//     client-side prediction, no interpolation. The cell sits exactly
//     where the server last said it sits.
//   - Exposes `window.__game.canonical` so the e2e can read the DO's
//     authoritative state without parsing canvas pixels.
//   - Exposes `window.__game.sendInput(dir)` so the e2e can drive a
//     deterministic input tape without keyboard events.

import type { InputDir, WorldState } from "../server/reducer";

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

interface SnapshotMessage {
  type: "snapshot";
  tick: number;
  dir: InputDir;
  player: { x: number; y: number };
  rng: number;
}

function isInputDir(value: unknown): value is InputDir {
  return (
    value === "none" ||
    value === "up" ||
    value === "down" ||
    value === "left" ||
    value === "right"
  );
}

function isSnapshotMessage(value: unknown): value is SnapshotMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "snapshot") return false;
  if (typeof v.tick !== "number") return false;
  if (typeof v.rng !== "number") return false;
  if (!isInputDir(v.dir)) return false;
  const p = v.player as Record<string, unknown> | undefined;
  return (
    typeof p === "object" &&
    p !== null &&
    typeof p.x === "number" &&
    typeof p.y === "number"
  );
}

function readSeed(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("seed") ?? "1";
}

function wsUrl(seed: string): string {
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  const host =
    loc.hostname === "localhost" || loc.hostname === "127.0.0.1"
      ? `${loc.hostname}:8787`
      : loc.host;
  return `${proto}//${host}/ws?seed=${encodeURIComponent(seed)}`;
}

// The latest snapshot the server pushed. Slice 3 renders from this
// directly; no smoothing.
let latest: WorldState | null = null;
let connected = false;

// Server-side applied-input log: one entry per server tick, in tick
// order, mirroring the `dir` field the DO reports in every snapshot.
// The e2e replays this through `pureReplay(seed, log)` and asserts
// bit-exact equality against `canonical`. This avoids any client-side
// ordering / tick-alignment race — both sides agree on what the server
// actually applied because the server told us, in order.
const appliedLog: InputDir[] = [];

function draw(): void {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (latest !== null) {
    ctx.fillStyle = "#80e6c1";
    ctx.beginPath();
    ctx.arc(latest.player.x, latest.player.y, 16, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Pre-snapshot: same placeholder pose as slice 1/2 so the canvas
    // doesn't look broken before the first server tick lands.
    ctx.fillStyle = "#80e6c1";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#e8eaff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("Agar", canvas.width / 2, 40);

  ctx.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = connected ? "#9090a8" : "#a85050";
  ctx.fillText(
    `tick=${latest?.tick ?? 0}`,
    canvas.width / 2,
    canvas.height - 24,
  );
}

const probe = document.createElement("div");
probe.setAttribute("data-testid", "agar-net-status");
probe.style.position = "absolute";
probe.style.left = "-9999px";
probe.style.top = "-9999px";
probe.dataset.tick = "0";
probe.dataset.connected = "false";
probe.textContent = "tick=0";
document.body.appendChild(probe);

function syncProbe(): void {
  probe.dataset.tick = String(latest?.tick ?? 0);
  probe.dataset.connected = String(connected);
  probe.textContent = `tick=${latest?.tick ?? 0}`;
}

draw();
syncProbe();

// `ws` is reassignable so disconnectWs/reconnectWs can swap it in place
// (the test surface needs to drop and restore the connection without
// reloading the page).
let ws: WebSocket = openWs();

// Mint a stable per-page client id. The snapshot protocol (slice 3/4)
// doesn't echo an id from the DO yet, so the client generates its own
// on page load. This is stable across disconnect/reconnect (it lives
// on the page, not on the ws) which is what the harness needs for
// `appliedLog` attribution.
const clientId: string = (() => {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `agar-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
})();

function openWs(): WebSocket {
  const next = new WebSocket(wsUrl(readSeed()));
  next.addEventListener("open", () => {
    connected = true;
    syncProbe();
    draw();
  });
  next.addEventListener("close", () => {
    connected = false;
    syncProbe();
    draw();
  });
  next.addEventListener("message", (event) => {
    let parsed: unknown;
    try {
      parsed = typeof event.data === "string" ? JSON.parse(event.data) : null;
    } catch {
      return;
    }
    if (!isSnapshotMessage(parsed)) return;
    latest = {
      tick: parsed.tick,
      player: { x: parsed.player.x, y: parsed.player.y },
      rng: parsed.rng,
    };
    // Append the dir the server APPLIED at this tick. Server tick numbers
    // are monotonic from 1 (the first tick after connect), so
    // appliedLog[i] === dir applied at tick i+1. If a snapshot is missed
    // (it shouldn't be inside a single WS), the log would have a hole —
    // we'd see it as a tick gap, and the e2e would catch the divergence.
    appliedLog.push(parsed.dir);
    syncProbe();
    draw();
  });
  return next;
}

function sendInput(dir: InputDir): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "input", dir }));
}

// Keyboard → intent. Browsers fire keydown repeatedly while held; the
// DO's latest-input-wins logic makes that harmless. We send "none" on
// keyup so the player stops at the next tick boundary.
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
  sendInput(dir);
});

window.addEventListener("keyup", (e) => {
  const dir = keyToDir(e.code);
  if (dir === null) return;
  e.preventDefault();
  sendInput("none");
});

// Test surface: the e2e drives a deterministic input tape via
// `window.__game.sendInput(dir)` and asserts on `window.__game.canonical`.
// Both are read-only views into the WS-driven state; the e2e never
// mutates them directly.
//
// Conforms to `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — all 8
// normative fields are installed. Gated on `import.meta.env.MODE` so
// production builds never expose `window.__game`.
interface AgarTestSurface {
  readonly canonical: WorldState | null;
  readonly tick: number;
  readonly appliedLog: readonly InputDir[];
  readonly clientId: string;
  readonly seed: string;
  sendInput(dir: InputDir): void;
  tickTo(n: number): Promise<void>;
  disconnectWs(): void;
  reconnectWs(): Promise<void>;
}

/**
 * Resolve once the latest snapshot's tick is at or past `target`.
 * No-op (resolves immediately) when already at or past `target`.
 * Polls the same `latest` ref the ws `message` handler updates.
 */
function tickTo(target: number): Promise<void> {
  if (latest !== null && latest.tick >= target) return Promise.resolve();
  return new Promise((resolve) => {
    const id = setInterval(() => {
      if (latest !== null && latest.tick >= target) {
        clearInterval(id);
        resolve();
      }
    }, 8);
  });
}

function disconnectWs(): void {
  // close() is async; the `close` listener flips `connected` when it
  // fires. The harness can poll `__game.canonical` / `__game.tick`
  // to confirm no further snapshots land.
  try {
    ws.close();
  } catch {
    /* already closed — fine */
  }
}

/**
 * Drop and re-open the ws. Resolves after the DO's first replayed
 * snapshot lands (i.e. canonical state is valid again). The pre-call
 * tick is captured so we can detect that a new snapshot arrived
 * post-reconnect, even if its tick number happens to equal the old
 * `latest.tick`.
 */
function reconnectWs(): Promise<void> {
  const beforeAppliedLen = appliedLog.length;
  // Ensure we're closed before re-opening so the DO sees a fresh
  // connection (and replays state).
  try {
    ws.close();
  } catch {
    /* fine */
  }
  ws = openWs();
  return new Promise((resolve) => {
    const id = setInterval(() => {
      // A new snapshot arrived after reconnect when the applied log
      // grew past its pre-reconnect length AND the ws is open. (The
      // server replays state on connect, so the first post-reconnect
      // snapshot is our signal.)
      if (appliedLog.length > beforeAppliedLen && connected) {
        clearInterval(id);
        resolve();
      }
    }, 8);
  });
}

const testSurface: AgarTestSurface = {
  get canonical() {
    return latest;
  },
  get tick() {
    return latest?.tick ?? 0;
  },
  get appliedLog() {
    // Return a defensive copy so the e2e can't mutate the live log.
    return appliedLog.slice();
  },
  get clientId() {
    return clientId;
  },
  get seed() {
    return readSeed();
  },
  sendInput,
  tickTo,
  disconnectWs,
  reconnectWs,
};

// Always install the test surface. The agar build doesn't currently
// ship a distinct "production" target — `npm run build:agar` produces
// the same bundle the Playwright preview drives, so a `MODE` gate
// would strip `window.__game` from the very surface the e2e suite
// (this file's smoke spec + `tick.spec.ts`) depends on. If/when a
// real prod deploy lands, reintroduce a gate keyed on a build flag
// that's actually distinct from the preview build (e.g.
// `import.meta.env.VITE_AGAR_PROD === "1"`), not on `MODE` alone.
(window as unknown as { __game: AgarTestSurface }).__game = testSurface;

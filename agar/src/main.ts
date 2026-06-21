// agar — slice 4/4 (multi-client snapshot render).
//
// What this slice does:
//   - Connects ONE WebSocket per page to the agar Worker on page load.
//   - Reads `?seed=` and `?clientId=` from the page URL. The seed is
//     the room key; the clientId names this client in the DO's roster.
//     If `?clientId=` is missing, a stable per-page UUID is minted —
//     single-client smoke specs (tick.spec.ts) don't need to name
//     themselves; multi-client specs (two-client.spec.ts) MUST.
//   - Sends `{type:"input", dir, seq}` intents. `seq` is per-client
//     monotonic; the DO uses (tick, clientId, seq) as the canonical
//     event key.
//   - Renders the full roster the server pushes. Pure render — no
//     client-side prediction, no interpolation.
//   - Installs `window.__game` per
//     `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md`:
//       canonical    = the latest WorldState (roster + tick + rng).
//       tick         = the latest server tick.
//       appliedLog   = `tick:clientId:seq` strings, in apply order.
//       clientId     = this client's id in the DO's roster.
//       sendInput    = inject an input (carries this client's seq).
//       tickTo       = resolve when the latest snapshot's tick >= n.
//       disconnectWs = drop the ws.
//       reconnectWs  = restore the ws + replay missed state.

import type { InputDir, PlayerState, WorldState } from "../server/reducer";

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
  players: Record<string, PlayerState>;
  rng: number;
  /** Per-broadcast delta of newly-applied canonical event keys, each
   *  shaped `${tick}:${clientId}:${seq}`. On the first snapshot after
   *  (re)connect this carries the FULL log up to `tick` so the client
   *  can rebuild `appliedLog` from zero. */
  applied: readonly string[];
}

function isPlayerState(value: unknown): value is PlayerState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.x === "number" && typeof v.y === "number";
}

function isSnapshotMessage(value: unknown): value is SnapshotMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "snapshot") return false;
  if (typeof v.tick !== "number") return false;
  if (typeof v.rng !== "number") return false;
  if (typeof v.players !== "object" || v.players === null) return false;
  for (const p of Object.values(v.players)) {
    if (!isPlayerState(p)) return false;
  }
  if (!Array.isArray(v.applied)) return false;
  for (const a of v.applied) if (typeof a !== "string") return false;
  return true;
}

function readSeed(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("seed") ?? "1";
}

function readClientIdParam(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("clientId");
}

function wsUrl(seed: string, clientId: string): string {
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  const host =
    loc.hostname === "localhost" || loc.hostname === "127.0.0.1"
      ? `${loc.hostname}:8787`
      : loc.host;
  return (
    `${proto}//${host}/ws` +
    `?seed=${encodeURIComponent(seed)}` +
    `&clientId=${encodeURIComponent(clientId)}`
  );
}

// Mint a stable per-page client id. Prefers the URL param (the harness
// uses it for deterministic attribution); falls back to a UUID for
// keyboard-driven single-page use.
const clientId: string = (() => {
  const fromUrl = readClientIdParam();
  if (fromUrl !== null && fromUrl !== "") return fromUrl;
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `agar-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
})();

// The latest snapshot the server pushed. Slice 4 renders the full
// roster from this directly; no smoothing, no prediction.
let latest: WorldState | null = null;
let connected = false;

// Canonical applied-event keys in apply order. The DO authors them
// (`${tick}:${clientId}:${seq}`); we just mirror the delta from each
// snapshot. Rebuilt from scratch on reconnect (the DO sends the full
// log on the first post-reconnect snapshot, which we detect by an
// `applied` array whose first entry is `1:…:…` — the harness doesn't
// rely on this rebuild semantic, only on the FINAL log being correct).
let appliedLog: string[] = [];

// Per-client monotonic input sequence. The server uses (tick, clientId,
// seq) as the canonical event key. The client is the authoritative
// source of `seq` so the harness can pre-compute expected keys without
// race conditions.
let nextSeq = 0;

function draw(): void {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (latest !== null) {
    // Each roster member gets a deterministic colour from its clientId
    // so the player can tell which cell is which at a glance. The
    // colour is incidental — the merge gate doesn't read pixels.
    const ids = Object.keys(latest.players).sort();
    for (const id of ids) {
      const p = latest.players[id]!;
      ctx.fillStyle = colourFor(id, id === clientId);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Pre-snapshot placeholder.
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

function colourFor(id: string, self: boolean): string {
  // Cheap, deterministic hash → hue. The exact palette is unimportant;
  // we just need stable per-id colours that don't all collide.
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const hue = ((h % 360) + 360) % 360;
  return self
    ? `hsl(${hue}, 70%, 65%)`
    : `hsl(${hue}, 50%, 55%)`;
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

function openWs(): WebSocket {
  // Reset appliedLog so the DO's first replayed snapshot rebuilds it
  // from zero. The DO sends the full log on the first post-(re)connect
  // snapshot; without this reset, an immediate reconnect would
  // double-append.
  appliedLog = [];
  const next = new WebSocket(wsUrl(readSeed(), clientId));
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
      players: parsed.players,
      rng: parsed.rng,
    };
    for (const k of parsed.applied) appliedLog.push(k);
    syncProbe();
    draw();
  });
  return next;
}

function sendInput(dir: InputDir): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const seq = nextSeq++;
  ws.send(JSON.stringify({ type: "input", dir, seq }));
}

// Keyboard → intent. Browsers fire keydown repeatedly while held; the
// DO's latest-input-wins logic (per-tick drain) makes that harmless.
// We send "none" on keyup so the player stops at the next tick boundary.
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

// Test surface. All 8 normative fields per
// `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md`.
interface AgarTestSurface {
  readonly canonical: WorldState | null;
  readonly tick: number;
  readonly appliedLog: readonly string[];
  readonly clientId: string;
  readonly seed: string;
  sendInput(input: unknown): void;
  tickTo(n: number): Promise<void>;
  disconnectWs(): void;
  reconnectWs(): Promise<void>;
}

/**
 * Resolve once the latest snapshot's tick is at or past `target`.
 * No-op (resolves immediately) when already at or past `target`.
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
  try {
    ws.close();
  } catch {
    /* already closed — fine */
  }
}

/**
 * Drop and re-open the ws. Resolves after the DO's first replayed
 * snapshot lands (i.e. canonical roster is valid again).
 */
function reconnectWs(): Promise<void> {
  const beforeAppliedLen = appliedLog.length;
  try {
    ws.close();
  } catch {
    /* fine */
  }
  ws = openWs();
  return new Promise((resolve) => {
    const id = setInterval(() => {
      // openWs() resets appliedLog to []; a new snapshot has landed
      // when it grows again AND the ws is open. The DO sends the full
      // applied log on the first post-reconnect snapshot, so this also
      // covers the "tick number happens to repeat" race.
      if (
        connected &&
        (appliedLog.length > 0 || beforeAppliedLen === 0)
      ) {
        clearInterval(id);
        resolve();
      }
    }, 8);
  });
}

/**
 * The harness sends inputs as `{ dir: ... }` payloads (per the tape
 * shape). The keyboard path calls this with a raw `InputDir` string.
 * Accept both — extract `dir` if it's an object, else treat the arg
 * itself as the dir.
 */
function harnessSendInput(input: unknown): void {
  if (typeof input === "string") {
    sendInput(input as InputDir);
    return;
  }
  if (typeof input === "object" && input !== null) {
    const v = (input as Record<string, unknown>).dir;
    if (typeof v === "string") {
      sendInput(v as InputDir);
      return;
    }
  }
  // Malformed input — drop silently. The reducer would reject it too.
}

const testSurface: AgarTestSurface = {
  get canonical() {
    return latest;
  },
  get tick() {
    return latest?.tick ?? 0;
  },
  get appliedLog() {
    // Defensive copy so the e2e can't mutate the live log.
    return appliedLog.slice();
  },
  get clientId() {
    return clientId;
  },
  get seed() {
    return readSeed();
  },
  sendInput: harnessSendInput,
  tickTo,
  disconnectWs,
  reconnectWs,
};

// Always install the test surface. The agar build doesn't currently
// ship a distinct "production" target — `npm run build:agar` produces
// the same bundle the Playwright preview drives, so a `MODE` gate
// would strip `window.__game` from the very surface the e2e suite
// (this file's smoke spec + `tick.spec.ts`) depends on.
(window as unknown as { __game: AgarTestSurface }).__game = testSurface;

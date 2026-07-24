// agar — slice 4/4 gameplay (true multiplayer renderer + replay tape).
//
// What this slice does:
//   - Mints a stable per-page `clientId` on load and announces it to
//     the DO via the `?cid=` query on the WS upgrade. The DO uses it
//     as the player key.
//   - Sends `{type:"input", dir}` intents — the DO routes them to THIS
//     client's cell (latest-input-wins per tick, per player).
//   - Renders ALL players from the snapshot. Self is highlighted by
//     comparing the player's id against the local `clientId`.
//   - Carries `snapshot.frame` (joins / leaves / inputs) into a shared
//     replay tape so the e2e can assert
//     `pureReplay(seed, tape) === canonical`. Every client builds the
//     SAME tape from the SAME snapshots — the determinism contract is
//     the full per-tick frame, not just one player's dir.
//   - Exposes `window.__game` with the 8 normative test-surface fields
//     (`canonical`, `tick`, `appliedLog`, `clientId`, `seed`,
//     `sendInput`, `tickTo`, `disconnectWs`, `reconnectWs`) plus
//     `inputLatencyProbe`. `appliedLog` keeps its slice-3 meaning —
//     the dir THIS client sent — for backward compatibility with the
//     latency probe and any slice-3 specs; the new authoritative
//     determinism tape is exposed as `appliedFrames`.

import {
  radiusForMass,
  type BotState,
  type InputDir,
  type Pellet,
  type PlayerState,
  type ReplayFrame,
  type WorldState,
} from "../server/reducer";
import {
  createInputLatencyProbe,
  type LatencySample,
} from "./input-latency-probe";

// Multiplayer entry point. Invoked by main.ts ONLY when the page is
// requested with `?mp=1` (or `?mode=multiplayer`) — the WS-backed,
// server-authoritative path the multiplayer/persistence e2e specs
// drive. The default (no param) experience is single-player (solo.ts),
// which runs the same reducer locally so the game is playable with no
// server. See main.ts for the dispatch + the root-cause note.
export function startMultiplayer(): void {
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
  frame: ReplayFrame;
  players: PlayerState[];
  food: Pellet[];
  bots: BotState[];
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

function isPelletArray(value: unknown): value is Pellet[] {
  if (!Array.isArray(value)) return false;
  for (const p of value) {
    if (typeof p !== "object" || p === null) return false;
    const o = p as Record<string, unknown>;
    if (typeof o.x !== "number" || typeof o.y !== "number") return false;
  }
  return true;
}

function isBotArray(value: unknown): value is BotState[] {
  if (!Array.isArray(value)) return false;
  for (const b of value) {
    if (typeof b !== "object" || b === null) return false;
    const o = b as Record<string, unknown>;
    if (
      typeof o.id !== "number" ||
      typeof o.x !== "number" ||
      typeof o.y !== "number" ||
      typeof o.mass !== "number"
    ) {
      return false;
    }
  }
  return true;
}

function isPlayerArray(value: unknown): value is PlayerState[] {
  if (!Array.isArray(value)) return false;
  for (const p of value) {
    if (typeof p !== "object" || p === null) return false;
    const o = p as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      typeof o.x !== "number" ||
      typeof o.y !== "number" ||
      typeof o.mass !== "number" ||
      typeof o.deaths !== "number" ||
      typeof o.bestMass !== "number"
    ) {
      return false;
    }
  }
  return true;
}

function isReplayFrame(value: unknown): value is ReplayFrame {
  if (typeof value !== "object" || value === null) return false;
  // Empty frames are valid (no joins, leaves, or inputs this tick).
  // We only check that present fields are well-shaped.
  const v = value as Record<string, unknown>;
  if (v.joins !== undefined) {
    if (!Array.isArray(v.joins)) return false;
    for (const j of v.joins) {
      if (typeof j !== "object" || j === null) return false;
      if (typeof (j as Record<string, unknown>).id !== "string") return false;
    }
  }
  if (v.leaves !== undefined) {
    if (!Array.isArray(v.leaves)) return false;
    for (const l of v.leaves) {
      if (typeof l !== "string") return false;
    }
  }
  if (v.inputs !== undefined) {
    if (typeof v.inputs !== "object" || v.inputs === null) return false;
    for (const dir of Object.values(v.inputs as Record<string, unknown>)) {
      if (typeof dir !== "object" || dir === null) return false;
      if (!isInputDir((dir as Record<string, unknown>).dir)) return false;
    }
  }
  return true;
}

function isSnapshotMessage(value: unknown): value is SnapshotMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "snapshot") return false;
  if (typeof v.tick !== "number") return false;
  if (typeof v.rng !== "number") return false;
  if (!isReplayFrame(v.frame)) return false;
  if (!isPlayerArray(v.players)) return false;
  if (!isPelletArray(v.food)) return false;
  if (!isBotArray(v.bots)) return false;
  return true;
}

function readSeed(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("seed") ?? "1";
}

// Mint a stable per-page client id. Computed BEFORE openWs so the
// `?cid=` query param can carry it on every connect / reconnect.
const clientId: string = (() => {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `agar-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
})();

function wsUrl(seed: string): string {
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  const host =
    loc.hostname === "localhost" || loc.hostname === "127.0.0.1"
      ? `${loc.hostname}:8787`
      : loc.host;
  // Production: the /agar/ page and the authoritative DO share ONE
  // origin — the repo-root `oodim-game` Worker (wrangler.jsonc, entry
  // src/server.ts) serves the static client via ASSETS and routes `/ws`
  // to EchoRoom on the same host. `loc.host` therefore IS the deployed
  // WS host; no hardcoded workers.dev hostname is needed or wanted.
  return `${proto}//${host}/ws?seed=${encodeURIComponent(seed)}&cid=${encodeURIComponent(clientId)}`;
}

let latest: WorldState | null = null;
let connected = false;

let respawnFlashUntilTick = 0;
const RESPAWN_FLASH_TICKS = 24;

// Slice-3 compat: appliedLog records THIS client's own dir per server
// tick (extracted from the snapshot's per-id inputs record). Kept for
// the latency probe + any slice-3 specs that still consult it.
const appliedLog: InputDir[] = [];

// Slice 4 determinism tape — every client appends `snapshot.frame`
// verbatim. `pureReplay(seed, appliedFrames)` reproduces canonical
// state bit-exact only while observed snapshot ticks stay contiguous.
const appliedFrames: ReplayFrame[] = [];
let lastAppendedFrameTick: number | null = null;
let tapeContiguous = true;

const latencyProbe = createInputLatencyProbe();

function selfPlayer(state: WorldState | null): PlayerState | null {
  if (state === null) return null;
  for (const p of state.players) {
    if (p.id === clientId) return p;
  }
  return null;
}

function draw(): void {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (latest !== null) {
    ctx.fillStyle = "#e8c46b";
    for (const pellet of latest.food) {
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (latest !== null) {
    ctx.fillStyle = "#9a7adf";
    for (const bot of latest.bots) {
      ctx.beginPath();
      ctx.arc(bot.x, bot.y, radiusForMass(bot.mass), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // All players. Self is rendered in mint; others in slate. The room
  // is no longer a solo experience — every cell on screen is a peer.
  if (latest !== null) {
    for (const p of latest.players) {
      const isSelf = p.id === clientId;
      ctx.fillStyle = isSelf ? "#80e6c1" : "#5a8fb0";
      ctx.beginPath();
      ctx.arc(p.x, p.y, radiusForMass(p.mass), 0, Math.PI * 2);
      ctx.fill();
      // Faint outline on self so it remains pickable even when masses
      // collide. Outline-only on the same fill — no extra hue.
      if (isSelf) {
        ctx.strokeStyle = "#e8eaff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radiusForMass(p.mass), 0, Math.PI * 2);
        ctx.stroke();
      }
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
  ctx.fillText("you are here", canvas.width / 2, 40);

  const self = selfPlayer(latest);
  if (self !== null) {
    ctx.font = "600 16px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#e8c46b";
    ctx.textAlign = "left";
    const baseY = canvas.height - 24;
    ctx.fillText(`mass ${self.mass}`, 16, baseY);
    ctx.fillStyle = "#9a7adf";
    ctx.fillText(`best ${self.bestMass}`, 16, baseY - 20);
    if (self.deaths > 0) {
      ctx.fillStyle = "#a85050";
      ctx.fillText(`lost ${self.deaths}`, 16, baseY - 40);
    }
    ctx.textAlign = "center";
  }

  if (latest !== null && latest.tick < respawnFlashUntilTick) {
    ctx.fillStyle = "#a85050";
    ctx.font = "700 32px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("eaten", canvas.width / 2, canvas.height / 2);
  }

  ctx.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = connected ? "#9090a8" : "#a85050";
  const statusLine =
    !connected && latest === null
      ? "no one is listening"
      : !connected
        ? "the room forgot you"
        : latest === null
          ? "waiting to be seen"
          : `t=${latest.tick}`;
  ctx.fillText(statusLine, canvas.width / 2, canvas.height - 24);
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

let ws: WebSocket = openWs();

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

    // Detect a death-tick on SELF via the per-player counter.
    const priorSelf = selfPlayer(latest);
    const nextSelf = parsed.players.find((p) => p.id === clientId) ?? null;
    if (priorSelf !== null && nextSelf !== null && nextSelf.deaths > priorSelf.deaths) {
      respawnFlashUntilTick = parsed.tick + RESPAWN_FLASH_TICKS;
    }

    latest = {
      tick: parsed.tick,
      players: parsed.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        mass: p.mass,
        deaths: p.deaths,
        bestMass: p.bestMass,
      })),
      food: parsed.food.map((p) => ({ x: p.x, y: p.y })),
      bots: parsed.bots.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        mass: b.mass,
      })),
      rng: parsed.rng,
    };

    // Determinism tape — append the frame verbatim. Every client
    // that observes this snapshot appends the SAME frame, so any
    // client's full tape replays to the same canonical state while
    // observed ticks are contiguous. If we detect a gap (most likely
    // across disconnect/reconnect), mark the tape as untrustworthy.
    if (lastAppendedFrameTick !== null && parsed.tick !== lastAppendedFrameTick + 1) {
      tapeContiguous = false;
    }
    appliedFrames.push(parsed.frame);
    lastAppendedFrameTick = parsed.tick;

    // Slice-3 compat: extract THIS client's own dir from the frame
    // (defaults to "none" if no input was reported for us this tick).
    const ownDir: InputDir = parsed.frame.inputs?.[clientId]?.dir ?? "none";
    appliedLog.push(ownDir);

    latencyProbe.observe(appliedLog.length, parsed.tick);
    syncProbe();
    draw();
  });
  return next;
}

function sendInput(dir: InputDir): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  latencyProbe.stamp(appliedLog.length);
  ws.send(JSON.stringify({ type: "input", dir }));
}

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

interface AgarTestSurface {
  readonly canonical: WorldState | null;
  readonly tick: number;
  readonly appliedLog: readonly InputDir[];
  // Slice-4 determinism tape. Additive — not a rename of any of the 8
  // normative fields. Per-tick ReplayFrames built from snapshots.
  readonly appliedFrames: readonly ReplayFrame[];
  // True only while observed snapshot ticks are contiguous.
  readonly tapeContiguous: boolean;
  readonly clientId: string;
  readonly seed: string;
  sendInput(dir: InputDir): void;
  tickTo(n: number): Promise<void>;
  disconnectWs(): void;
  reconnectWs(): Promise<void>;
  inputLatencyProbe(): readonly LatencySample[];
}

function tickTo(target: number): Promise<void> {
  if (target <= 0) return Promise.resolve();
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
    return appliedLog.slice();
  },
  get appliedFrames() {
    return appliedFrames.slice();
  },
  get tapeContiguous() {
    return tapeContiguous;
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
  inputLatencyProbe: () => latencyProbe.samples(),
};

(window as unknown as { __game: AgarTestSurface }).__game = testSurface;
}

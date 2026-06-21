// agar — slice 3/4 (authoritative 20Hz tick + snapshot broadcast).
//
// Upgrade from the slice-2 echo server:
//   - The DO owns world state via the pure reducer in ./reducer.ts.
//   - A fixed-step 20Hz tick (50ms) integrates the latest queued input
//     and broadcasts a canonical snapshot to all connected sockets.
//   - The seed is taken from the `?seed=` query string at connect time
//     so the e2e harness can drive a deterministic replay.
//
// Why setInterval, not the DO alarm scheduler:
//   - Slice 3 is single-client and short-lived (the e2e drives ~30
//     ticks then disconnects). A 50ms setInterval inside the
//     accept-handling fetch is sufficient and keeps the file readable.
//   - The DO instance lives as long as the WS is open; when the last
//     socket closes we clear the interval so the DO can hibernate.
//   - Alarms come back in slice 4 when we need durability across
//     restarts and 2-client rooms.

import { initialState, step, type InputDir, type WorldState } from "./reducer";

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
}

const TICK_MS = 50; // 20Hz

interface InputMessage {
  type: "input";
  dir: InputDir;
}

function isInputMessage(value: unknown): value is InputMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "input") return false;
  const d = v.dir;
  return (
    d === "none" || d === "up" || d === "down" || d === "left" || d === "right"
  );
}

export class EchoRoom implements DurableObject {
  private world: WorldState;
  // Latest-input-wins queue. The reducer ticks with whatever's here at
  // tick boundary; cleared each tick (default = "none").
  private pendingDir: InputDir = "none";
  private sockets = new Set<WebSocket>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    _state: DurableObjectState,
    _env: Env,
  ) {
    // The seed is set when the first socket connects (it carries the
    // ?seed= query). We init to seed=1 here so the DO has a valid
    // shape even if a non-WS request lands first; reinit on connect.
    this.world = initialState(1);
  }

  private ensureTickLoop(): void {
    if (this.interval !== null) return;
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTickLoopIfIdle(): void {
    if (this.sockets.size > 0) return;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const dir = this.pendingDir;
    this.pendingDir = "none";
    this.world = step(this.world, { dir });

    // The snapshot carries `dir` — the EXACT intent the server applied
    // this tick. The client mirrors these into an applied-input log so
    // the e2e can replay them through `pureReplay` and assert bit-exact
    // equality, without depending on which inputs landed in which tick
    // slots. (Latest-input-wins makes that mapping inherently racy under
    // CI jitter; the log removes the race because both sides agree on
    // what was actually applied.)
    const snapshot = JSON.stringify({
      type: "snapshot",
      tick: this.world.tick,
      dir,
      player: this.world.player,
      rng: this.world.rng,
    });
    for (const s of this.sockets) {
      try {
        s.send(snapshot);
      } catch {
        // Socket dead; cleanup happens in close handler.
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    // The seed for this match is read from the upgrade URL. The Worker
    // entry below preserves the query string when proxying to the DO,
    // so `?seed=N` lands here intact. Parse defensively: a missing or
    // non-numeric seed falls back to 1 (still deterministic).
    const url = new URL(request.url);
    const seedParam = url.searchParams.get("seed");
    const seed = seedParam !== null ? Number.parseInt(seedParam, 10) : 1;
    // If this is the first socket, initialize the world with this seed.
    // Subsequent sockets join the existing match — slice 3 is
    // single-client per spec, so this branch is exercised exactly once
    // per DO lifetime in the e2e.
    if (this.sockets.size === 0) {
      this.world = initialState(Number.isFinite(seed) ? seed : 1);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sockets.add(server);
    this.ensureTickLoop();

    server.addEventListener("message", (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed =
          typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch {
        parsed = null;
      }
      if (!isInputMessage(parsed)) return;
      // Latest-input-wins: overwrite any prior intent in this tick window.
      this.pendingDir = parsed.dir;
    });

    server.addEventListener("close", () => {
      this.sockets.delete(server);
      this.stopTickLoopIfIdle();
    });

    server.addEventListener("error", () => {
      this.sockets.delete(server);
      this.stopTickLoopIfIdle();
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("agar tick worker: ok", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }

    // Route by seed so two clients with the same seed share state.
    // Slice 3 is still effectively single-client (the e2e drives one
    // socket), but this keeps the routing key consistent with the
    // protocol doc.
    const seedParam = url.searchParams.get("seed") ?? "1";
    const id = env.ECHO_ROOM.idFromName(`match:${seedParam}`);
    const stub = env.ECHO_ROOM.get(id);
    return stub.fetch(request);
  },
};

export default worker;

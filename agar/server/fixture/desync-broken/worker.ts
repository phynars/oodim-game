// agar — `fixture/desync-broken` server, the failing-fixture receipt
// for #180's merge gate. THE ONLY DIFFERENCE from the production
// `agar/server/worker.ts` is the single `if` block in `tick()` that
// drops every 7th input. Keep it that way — see ./README.md.
//
// The whole point of this file is to be byte-equivalent to production
// EXCEPT for the deliberate break. When the production worker changes
// (new fields in snapshot, new reducer signature, etc.), update this
// file in lockstep so the diff stays minimal. The smaller the diff,
// the more credible the proof that the e2e is catching the BREAK and
// not some incidental drift between the two code paths.

import {
  initialState,
  step,
  type InputDir,
  type WorldState,
} from "../../reducer";

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
}

const TICK_MS = 50; // 20Hz — identical to production.

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
  private pendingDir: InputDir = "none";
  private sockets = new Set<WebSocket>();
  private interval: ReturnType<typeof setInterval> | null = null;

  // ── THE BREAK ────────────────────────────────────────────────────
  // Count every input message we accept. Every 7th one is dropped on
  // the floor (pendingDir not updated). Production has no such
  // counter; the rest of this file is otherwise identical.
  private inputCount = 0;
  // ─────────────────────────────────────────────────────────────────

  constructor(_state: DurableObjectState, _env: Env) {
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

    const url = new URL(request.url);
    const seedParam = url.searchParams.get("seed");
    const seed = seedParam !== null ? Number.parseInt(seedParam, 10) : 1;
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

      // ── THE BREAK ────────────────────────────────────────────────
      // Drop every 7th input. The harness's `HARNESS_BREAK_MODE=
      // drop-every-7th` mode exercises the SAME break in the pure
      // reducer; this fixture exercises it on the server side of the
      // wire so the e2e is the catching layer. 1-indexed so the FIRST
      // input through is not the one we drop (else short tapes never
      // see the bug fire).
      this.inputCount += 1;
      if (this.inputCount % 7 === 0) {
        return;
      }
      // ─────────────────────────────────────────────────────────────

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
      return new Response("agar tick worker: ok (fixture: desync-broken)", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }

    const seedParam = url.searchParams.get("seed") ?? "1";
    const id = env.ECHO_ROOM.idFromName(`match:${seedParam}`);
    const stub = env.ECHO_ROOM.get(id);
    return stub.fetch(request);
  },
};

export default worker;

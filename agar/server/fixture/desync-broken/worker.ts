// agar — `fixture/desync-broken` server, the failing-fixture receipt
// for #180's merge gate. THE ONLY DIFFERENCE from the production
// `agar/server/worker.ts` is the single `if` block in the message
// handler that drops every 7th input across the room. Keep it that
// way — see ./README.md.
//
// The whole point of this file is to be byte-equivalent to production
// EXCEPT for the deliberate break. When the production worker changes
// (snapshot fields, reducer signature, etc.), update this file in
// lockstep so the diff stays minimal. The smaller the diff, the more
// credible the proof that the e2e is catching the BREAK and not some
// incidental drift between the two code paths.

import {
  applyJoin,
  applyTickBatch,
  initialState,
  type InputDir,
  type InputEvent,
  type WorldState,
} from "../../reducer";

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
}

const TICK_MS = 50; // 20Hz — identical to production.

interface InputMessage {
  type: "input";
  dir: InputDir;
  seq?: number;
}

function isInputMessage(value: unknown): value is InputMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "input") return false;
  const d = v.dir;
  if (
    d !== "none" &&
    d !== "up" &&
    d !== "down" &&
    d !== "left" &&
    d !== "right"
  )
    return false;
  if (v.seq !== undefined && typeof v.seq !== "number") return false;
  return true;
}

interface PendingEvent {
  seq: number;
  dir: InputDir;
}

interface ClientCtx {
  socket: WebSocket;
  pending: PendingEvent[];
  serverSeq: number;
}

export class EchoRoom implements DurableObject {
  private world: WorldState;
  private clients = new Map<string, ClientCtx>();
  private appliedKeys: string[] = [];
  private socketCursor = new WeakMap<WebSocket, number>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private seedInitialized = false;

  // ── THE BREAK ────────────────────────────────────────────────────
  // Count every input message we accept across the whole room. Every
  // 7th one is dropped on the floor (NOT enqueued for the next tick).
  // Production has no such counter; the rest of this file is otherwise
  // identical.
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
    if (this.clients.size > 0) return;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const targetTick = this.world.tick + 1;
    const events: InputEvent[] = [];

    const ids = [...this.clients.keys()].sort();
    for (const id of ids) {
      const ctx = this.clients.get(id);
      if (!ctx) continue;
      for (const ev of ctx.pending) {
        events.push({ clientId: id, seq: ev.seq, dir: ev.dir });
      }
      ctx.pending = [];
    }

    this.world = applyTickBatch(this.world, events);

    const sortedKeys = [...events]
      .sort((a, b) => {
        if (a.clientId !== b.clientId)
          return a.clientId < b.clientId ? -1 : 1;
        return a.seq - b.seq;
      })
      .map((ev) => `${targetTick}:${ev.clientId}:${ev.seq}`);
    for (const k of sortedKeys) this.appliedKeys.push(k);

    this.broadcast();
  }

  private broadcast(): void {
    for (const [, ctx] of this.clients) {
      const cursor = this.socketCursor.get(ctx.socket) ?? 0;
      const delta = this.appliedKeys.slice(cursor);
      this.socketCursor.set(ctx.socket, this.appliedKeys.length);
      const snapshot = JSON.stringify({
        type: "snapshot",
        tick: this.world.tick,
        players: this.world.players,
        rng: this.world.rng,
        applied: delta,
      });
      try {
        ctx.socket.send(snapshot);
      } catch {
        // Socket dead; cleanup happens in close handler.
      }
    }
  }

  private replayTo(socket: WebSocket): void {
    this.socketCursor.set(socket, this.appliedKeys.length);
    const snapshot = JSON.stringify({
      type: "snapshot",
      tick: this.world.tick,
      players: this.world.players,
      rng: this.world.rng,
      applied: this.appliedKeys.slice(),
    });
    try {
      socket.send(snapshot);
    } catch {
      /* socket died between accept and first send — ignore */
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
    const clientId = url.searchParams.get("clientId") ?? "_solo";

    if (!this.seedInitialized) {
      this.world = initialState(Number.isFinite(seed) ? seed : 1);
      this.seedInitialized = true;
    }

    this.world = applyJoin(this.world, clientId);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.clients.set(clientId, {
      socket: server,
      pending: [],
      serverSeq: 0,
    });
    this.ensureTickLoop();

    this.replayTo(server);

    server.addEventListener("message", (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed =
          typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch {
        parsed = null;
      }
      if (!isInputMessage(parsed)) return;
      const ctx = this.clients.get(clientId);
      if (!ctx) return;

      // ── THE BREAK ────────────────────────────────────────────────
      // Drop every 7th input the DO accepts (1-indexed). The harness's
      // `HARNESS_BREAK_MODE=drop-every-7th` exercises the same break
      // in the pure reducer; this fixture exercises it on the SERVER
      // side of the wire so the e2e is the catching layer. The dropped
      // input is never enqueued — the canonical applied-key log won't
      // contain its `tick:clientId:seq`, and `expectOrderingInvariant`
      // catches the missing key.
      this.inputCount += 1;
      if (this.inputCount % 7 === 0) {
        return;
      }
      // ─────────────────────────────────────────────────────────────

      const seq =
        typeof parsed.seq === "number" ? parsed.seq : ctx.serverSeq;
      ctx.serverSeq = Math.max(ctx.serverSeq, seq + 1);
      ctx.pending.push({ seq, dir: parsed.dir });
    });

    const cleanup = (): void => {
      const ctx = this.clients.get(clientId);
      if (ctx && ctx.socket === server) {
        this.clients.delete(clientId);
      }
      this.stopTickLoopIfIdle();
    };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

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

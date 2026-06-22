// agar — slice 4/4 (multi-client authoritative 20Hz tick).
//
// THE RUNG. Where slice 3 routed `match:${seed}` and modelled one player,
// slice 4 routes the SAME DO key but accepts N concurrent sockets, each
// identified by `?clientId=`. The DO:
//
//   - Tracks a roster (`Map<clientId, ClientCtx>`) of live sockets.
//   - Queues per-client inputs as `{seq, dir}` since the last tick.
//   - At each 50ms tick boundary, drains every client's queued events
//     into a canonical (clientId-lex, seq) order, applies them through
//     the pure reducer, advances tick, broadcasts a single snapshot
//     containing the full `players` roster + the delta of newly-applied
//     event keys (`tick:clientId:seq` strings).
//   - On socket open, joins the roster (via `applyJoin`); on close,
//     removes the entry so the next snapshot drops the player.
//   - On reconnect (same `clientId`, same `?seed=`), the DO sends the
//     full applied-key log up to the current tick, then a fresh
//     snapshot — that's what makes `expectConverge` post-reconnect a
//     real test instead of a vacuous one.
//
// Why this shape and not "the client owns seq":
//   - The harness's ordering invariant is keyed by `tick:clientId:seq`.
//     The client sends `seq` with each input; the DO chooses the `tick`
//     when it drains. So the canonical key is co-authored: the client
//     owns identity, the DO owns scheduling. That's the only split that
//     keeps the test fixture's "drop every 7th input" detectable —
//     if the client owned tick assignment, a dropped input would be
//     invisible to the canonical log.
//
// Why setInterval, still:
//   - 50ms ticks, lifecycle bound to socket lifetime — same reasoning
//     as slice 3. The DO hibernates when the last socket leaves.

import {
  applyJoin,
  applyTickBatch,
  initialState,
  type InputDir,
  type InputEvent,
  type WorldState,
} from "./reducer";

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
}

const TICK_MS = 50; // 20Hz

interface InputMessage {
  type: "input";
  dir: InputDir;
  /** Per-client monotonic sequence number. Required in slice 4 — the
   *  ordering invariant cannot be checked without it. Defensive default
   *  to 0 if missing (lets the slice-3 client wire through unchanged
   *  for `tick.spec.ts`). */
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
  /** Per-client seq counter the server uses when the client doesn't
   *  send one (slice-3 compat). Increments on each accepted input. */
  serverSeq: number;
}

export class EchoRoom implements DurableObject {
  private world: WorldState;
  private clients = new Map<string, ClientCtx>();
  /** Canonical applied-event keys in apply order. Each entry is
   *  `tick:clientId:seq`. Per-socket cursors track how many of these
   *  have been broadcast to each socket so the snapshot can include
   *  only the DELTA, while reconnects can replay from offset 0. */
  private appliedKeys: string[] = [];
  private socketCursor = new WeakMap<WebSocket, number>();
  /** Per-client highest-applied input seq — the idempotency watermark.
   *  Inputs are per-client monotonic; a reconnect can re-deliver an input
   *  the server already applied (outbox flush + roster-swap races), and
   *  re-applying it would emit a SECOND canonical key (new tick, same
   *  clientId:seq) — the "duplicate apply" the two-client rung catches.
   *  Skipping any seq <= the watermark makes canonical application idempotent. */
  private appliedSeq = new Map<string, number>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private seedInitialized = false;

  constructor(_state: DurableObjectState, _env: Env) {
    // Placeholder seed; real seed locks in on the first socket connect.
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

  /** Drain queued inputs from every client, apply them in canonical
   *  order, advance the tick, broadcast. The "tick" we assign to each
   *  event is `world.tick + 1` (the tick the event will land IN). */
  private tick(): void {
    const targetTick = this.world.tick + 1;
    const events: InputEvent[] = [];

    // Collect — clientId-lex order is enforced inside applyTickBatch,
    // but iterating in lex order here keeps the appliedKeys append
    // order match what applyTickBatch produces.
    const ids = [...this.clients.keys()].sort();
    for (const id of ids) {
      const ctx = this.clients.get(id);
      if (!ctx) continue;
      // Drain pending IDEMPOTENTLY. Each entry already has a per-client
      // monotonic seq; the DO never invents seqs. A reconnect can re-deliver
      // an input the server already applied — skipping any seq at/below the
      // watermark (and de-duping exact re-sends within this batch) keeps a
      // (clientId, seq) from being applied twice, which would emit a second
      // canonical key at a new tick (the two-client rung's 'duplicate apply').
      const seen = this.appliedSeq.get(id) ?? -1;
      const fresh = new Map<number, InputDir>(); // seq -> dir; drops prior-tick + in-batch dups
      for (const ev of ctx.pending) {
        if (ev.seq > seen) fresh.set(ev.seq, ev.dir);
      }
      for (const seq of [...fresh.keys()].sort((a, b) => a - b)) {
        events.push({ clientId: id, seq, dir: fresh.get(seq)! });
      }
      if (fresh.size > 0) {
        this.appliedSeq.set(id, Math.max(seen, ...fresh.keys()));
      }
      ctx.pending = [];
    }

    // Apply through the pure reducer. The batch is internally re-sorted
    // by (clientId-lex, seq) so server and offline reducers agree even
    // if the DO collected events in some other order.
    this.world = applyTickBatch(this.world, events);

    // Append canonical keys in (clientId-lex, seq) order — matches the
    // re-sort inside applyTickBatch.
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

  /** Broadcast a snapshot to every connected client. Each snapshot
   *  carries the FULL roster (so newcomers see everyone) and the
   *  per-socket delta of applied keys since that socket's last
   *  broadcast — letting the client append exactly the new keys to its
   *  appliedLog without re-seeing past ones. */
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

  /** On reconnect-replay, send the FULL applied-key log (so the client
   *  can rebuild `appliedLog` from tick 1) plus a fresh snapshot. We
   *  detect reconnect by clientId already being present in the roster
   *  (this branch handles the join() call's caller side). */
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
    const clientId =
      url.searchParams.get("clientId") ??
      // Slice-3 compat: a socket with no clientId gets a stable
      // pseudo-id so single-client specs (tick.spec.ts) still wire
      // through. Multi-client specs MUST pass clientId explicitly.
      "_solo";

    // First-ever socket locks in the seed. Subsequent sockets in the
    // same DO inherit it.
    if (!this.seedInitialized) {
      this.world = initialState(Number.isFinite(seed) ? seed : 1);
      this.seedInitialized = true;
    }

    // Roster join (idempotent — reconnect with the same id keeps the
    // player at their last position).
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

    // Replay state to this socket BEFORE the next tick fires, so the
    // client's first __game.canonical read sees the roster.
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
      const seq =
        typeof parsed.seq === "number" ? parsed.seq : ctx.serverSeq;
      ctx.serverSeq = Math.max(ctx.serverSeq, seq + 1);
      ctx.pending.push({ seq, dir: parsed.dir });
    });

    const cleanup = (): void => {
      const ctx = this.clients.get(clientId);
      // Only remove the entry if THIS socket is still the active one
      // for that clientId. A reconnect can swap the socket under the
      // same id before the old socket's close fires — don't evict the
      // new context in that race.
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
      return new Response("agar tick worker: ok", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }

    // Route by seed so all clients sharing a seed share a DO instance.
    // Same shape as slice 3 — multi-client routing happens INSIDE the
    // DO, not at the worker entry.
    const seedParam = url.searchParams.get("seed") ?? "1";
    const id = env.ECHO_ROOM.idFromName(`match:${seedParam}`);
    const stub = env.ECHO_ROOM.get(id);
    return stub.fetch(request);
  },
};

export default worker;

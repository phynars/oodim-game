// agar — slice 4/4 (true multiplayer DO).
//
// What changed from slice 3:
//   - The world tracks N players keyed by client id. Each WS connection
//     announces its id via `?cid=` on the upgrade URL; the DO uses it as
//     the player key. On accept, the DO emits a `joins` frame next tick
//     so the new cell exists in canonical state. On close, the DO emits
//     a `leaves` frame and removes the cell.
//   - Inputs are tracked per-player: `pendingDirs: Map<id, InputDir>`.
//     The tick fold builds an `inputs` record keyed by the connected
//     ids and feeds it to `step(state, frame)`. Latest-input-wins
//     within a tick window, per player.
//   - The snapshot carries `players: PlayerState[]` (id-sorted, same
//     as `state.players`) and the per-tick `frame` ({joins, leaves,
//     inputs}) so clients can rebuild the canonical replay tape and
//     `pureReplay(seed, tape)` reproduces canonical bit-exact.
//
// AC3 desync-broken fixture (issue #276) — unchanged semantics:
//   - `AGAR_DO_BREAK_MODE=drop-every-7th` makes every 7th tick skip the
//     reducer fold while STILL broadcasting the frame. The client's
//     reconstructed tape diverges from canonical, which the
//     `multiplayer-convergence` spec catches.

import {
  initialState,
  step,
  type InputDir,
  type PlayerJoin,
  type ReplayFrame,
  type WorldState,
} from "./reducer";

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
  AGAR_DO_BREAK_MODE?: string;
}

const TICK_MS = 50; // 20Hz

export type BreakMode =
  | "drop-every-7th"
  | "lossy-persist"
  | "non-monotone-persist";
export const BREAK_MODES: ReadonlySet<BreakMode> = new Set<BreakMode>([
  "drop-every-7th",
  "lossy-persist",
  "non-monotone-persist",
]);

export function parseBreakMode(raw: string | undefined): BreakMode | null {
  if (raw === undefined || raw === "") return null;
  if (!BREAK_MODES.has(raw as BreakMode)) {
    throw new Error(
      `agar: unknown AGAR_DO_BREAK_MODE=${JSON.stringify(raw)}; expected one of ${JSON.stringify([...BREAK_MODES])} or empty/unset`,
    );
  }
  return raw as BreakMode;
}

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

// Stable, monotonic id generator used when a connecting client omits
// `?cid=`. Strictly a fallback for non-harness clients; the agar
// frontend always supplies its minted clientId.
let fallbackIdCounter = 0;

export class EchoRoom implements DurableObject {
  private world: WorldState;
  // socket → playerId routing. The pendingDirs map carries the
  // latest-input-wins intent for each connected id; it is cleared at
  // tick boundary. Pending joins and leaves accumulate until the next
  // tick, where they're folded into the ReplayFrame.
  private socketToId = new Map<WebSocket, string>();
  private pendingDirs = new Map<string, InputDir>();
  private pendingJoins: PlayerJoin[] = [];
  private pendingLeaves: string[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;

  private readonly breakMode: BreakMode | null;
  private appliedCount = 0;

  constructor(_state: DurableObjectState, env: Env) {
    this.world = initialState(1);
    this.breakMode = parseBreakMode(env.AGAR_DO_BREAK_MODE);
  }

  private ensureTickLoop(): void {
    if (this.interval !== null) return;
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  private stopTickLoopIfIdle(): void {
    if (this.socketToId.size > 0) return;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    // Build the frame for this tick. Joins come from sockets accepted
    // since the last tick; leaves from sockets that closed. Inputs
    // are the latest dir per still-connected id; we clear pendingDirs
    // after copying. A player that joined this tick has no input yet,
    // so they step with dir="none" (handled by step()).
    const joins = this.pendingJoins;
    const leaves = this.pendingLeaves;
    this.pendingJoins = [];
    this.pendingLeaves = [];

    const inputs: Record<string, { dir: InputDir }> = {};
    for (const [id, dir] of this.pendingDirs) {
      inputs[id] = { dir };
    }
    this.pendingDirs.clear();

    const frame: ReplayFrame = {
      ...(joins.length > 0 ? { joins } : {}),
      ...(leaves.length > 0 ? { leaves } : {}),
      ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
    };

    // AC3 drop point (issue #276) — bump count, then skip step on
    // every 7th tick while STILL broadcasting the frame.
    this.appliedCount += 1;
    const drop =
      this.breakMode === "drop-every-7th" && this.appliedCount % 7 === 0;
    if (!drop) {
      this.world = step(this.world, frame);
    }

    const snapshot = JSON.stringify({
      type: "snapshot",
      tick: this.world.tick,
      // Per-tick replay frame — clients append this verbatim into a
      // shared tape and assert `pureReplay(seed, tape) === canonical`.
      // The harness no longer needs to know which dir belonged to
      // which client; the frame carries the full per-id record.
      frame,
      players: this.world.players,
      food: this.world.food,
      bots: this.world.bots,
      rng: this.world.rng,
    });
    for (const s of this.socketToId.keys()) {
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

    // Read the client-minted id. Falls back to a server-generated
    // id if missing (non-harness clients), with a per-DO counter so
    // the id is stable within the room's lifetime.
    const cidParam = url.searchParams.get("cid");
    fallbackIdCounter += 1;
    const clientId =
      cidParam !== null && cidParam !== ""
        ? cidParam
        : `srv-${fallbackIdCounter}`;

    // If this is the first socket, initialize the world with this seed.
    // Subsequent sockets join the existing match.
    if (this.socketToId.size === 0) {
      this.world = initialState(Number.isFinite(seed) ? seed : 1);
      this.appliedCount = 0;
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.socketToId.set(server, clientId);

    // Queue the join for the NEXT tick. The join is only applied via
    // step() so the offline reducer reproduces it from the broadcast
    // frame. A reconnect under an existing id is a no-op join inside
    // applyJoins (the existing cell carries on), which is the right
    // behavior for the convergence harness's disconnect/reconnect arc.
    //
    // Avoid double-queueing: if this same id already has a pending
    // join (rare but possible if connect+disconnect+reconnect happens
    // inside a single tick window), the array would have one entry
    // and applyJoins would idempotently skip; if there's a pending
    // leave for this id, cancel it instead so the player resumes.
    const leaveIdx = this.pendingLeaves.indexOf(clientId);
    if (leaveIdx >= 0) this.pendingLeaves.splice(leaveIdx, 1);
    if (!this.pendingJoins.some((j) => j.id === clientId)) {
      this.pendingJoins.push({ id: clientId });
    }

    this.ensureTickLoop();

    server.addEventListener("message", (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch {
        parsed = null;
      }
      if (!isInputMessage(parsed)) return;
      this.pendingDirs.set(clientId, parsed.dir);
    });

    const onGone = () => {
      this.socketToId.delete(server);
      this.pendingDirs.delete(clientId);
      // If this id is still in the roster (i.e. the join already
      // landed), schedule a leave. If the join is still pending
      // (same-tick connect+disconnect), cancel it instead.
      const joinIdx = this.pendingJoins.findIndex((j) => j.id === clientId);
      if (joinIdx >= 0) {
        this.pendingJoins.splice(joinIdx, 1);
      } else if (!this.pendingLeaves.includes(clientId)) {
        // Only queue a leave if no OTHER socket still claims this
        // clientId — duplicate connections under the same id (the
        // reconnect arc) shouldn't leave when the first socket closes.
        let stillConnected = false;
        for (const id of this.socketToId.values()) {
          if (id === clientId) {
            stillConnected = true;
            break;
          }
        }
        if (!stillConnected) this.pendingLeaves.push(clientId);
      }
      this.stopTickLoopIfIdle();
    };
    server.addEventListener("close", onGone);
    server.addEventListener("error", onGone);

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
    const seedParam = url.searchParams.get("seed") ?? "1";
    const id = env.ECHO_ROOM.idFromName(`match:${seedParam}`);
    const stub = env.ECHO_ROOM.get(id);
    return stub.fetch(request);
  },
};

export default worker;

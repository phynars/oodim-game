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
//
// AC3 desync-broken fixture (issue #276):
//   - `AGAR_DO_BREAK_MODE` is read ONCE at DO construction. The only
//     supported non-empty value is `"drop-every-7th"`; anything else
//     is a typecheck failure at the assignment, so unknown env values
//     can't silently no-op.
//   - When the flag is on, every 7th input that reaches `tick()` is
//     silently elided from the reducer fold — the snapshot still
//     carries `dir` (so the client mirrors it into `appliedLog`) but
//     `step()` is skipped, so canonical state diverges from
//     `pureReplay(SEED, appliedLog)`. That divergence is what the
//     `multiplayer-convergence.spec.ts` ordering invariant catches.
//   - Default (unset / empty): zero behavior change. The branch is a
//     single literal comparison off a constant set at ctor; the prod
//     bundle pays one boolean check per tick.

import { initialState, step, type InputDir, type WorldState } from "./reducer";

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
  AGAR_DO_BREAK_MODE?: string;
}

const TICK_MS = 50; // 20Hz

// Type-narrowed literal union of supported break modes. Adding a new
// mode here is the one-line touch that lights it up; an unknown env
// value falls through to `null` (production behavior).
// `lossy-persist` and `non-monotone-persist` are reserved for the
// agar persistence epic (issue #307 harness contract). They parse to
// non-null at file time but trigger no behavior — the slice-1 and
// slice-3 implementers wire the actual break paths against the
// DO storage layer when those slices land. Keeping them parseable
// here means the persistence-harness break-mode-parse test can ship
// as the file-time merge gate without dragging in storage code.
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
  // Default: env unset OR explicitly empty — production behavior, no
  // branch taken at runtime.
  if (raw === undefined || raw === "") return null;
  // Any other value MUST be a known mode. Per #276 AC4, an unknown
  // env value is a hard failure at DO construction (not a silent
  // fallback to off) — that's the only way a typo in CI config can't
  // accidentally ship a worker that pretends to be broken but isn't,
  // or vice versa.
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

export class EchoRoom implements DurableObject {
  private world: WorldState;
  // Latest-input-wins queue. The reducer ticks with whatever's here at
  // tick boundary; cleared each tick (default = "none").
  private pendingDir: InputDir = "none";
  private sockets = new Set<WebSocket>();
  private interval: ReturnType<typeof setInterval> | null = null;

  // AC3 fixture state. `breakMode` is set once at construction and
  // never re-read; `appliedCount` increments on every tick to drive
  // the every-7th drop cadence deterministically.
  private readonly breakMode: BreakMode | null;
  private appliedCount = 0;

  constructor(
    _state: DurableObjectState,
    env: Env,
  ) {
    // The seed is set when the first socket connects (it carries the
    // ?seed= query). We init to seed=1 here so the DO has a valid
    // shape even if a non-WS request lands first; reinit on connect.
    this.world = initialState(1);
    this.breakMode = parseBreakMode(env.AGAR_DO_BREAK_MODE);
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

    // AC3 drop point (issue #276). The plan demands the drop happen
    // AFTER the client-visible log advances but BEFORE the reducer
    // fold — so the client thinks the input was applied (its
    // `appliedLog` mirrors `dir` from the snapshot) while canonical
    // state silently diverges. Concretely: bump `appliedCount`, then
    // SKIP `step()` on every 7th tick, then still broadcast a
    // snapshot carrying `dir` so the client log grows.
    this.appliedCount += 1;
    const drop =
      this.breakMode === "drop-every-7th" && this.appliedCount % 7 === 0;
    if (!drop) {
      this.world = step(this.world, { dir });
    }

    // The snapshot carries `dir` — the EXACT intent the server
    // (claims to have) applied this tick. The client mirrors these
    // into an applied-input log so the e2e can replay them through
    // `pureReplay` and assert bit-exact equality, without depending
    // on which inputs landed in which tick slots. (Latest-input-wins
    // makes that mapping inherently racy under CI jitter; the log
    // removes the race because both sides agree on what was actually
    // applied.) Under the AC3 fixture this is exactly the lie the
    // server tells the client — `dir` rides the snapshot even when
    // `step` was skipped, which is what makes the ordering invariant
    // honest.
    const snapshot = JSON.stringify({
      type: "snapshot",
      tick: this.world.tick,
      dir,
      player: this.world.player,
      food: this.world.food,
      bots: this.world.bots,
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

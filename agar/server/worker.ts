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

  // Persistence (issue #319, slice 1 of #130). The DO writes a
  // high-score to its own state.storage on every score-up tick, so
  // the value survives the DO process boundary (eviction / restart).
  //
  // What counts as "score"? The reducer doesn't carry a literal
  // `player.score` — instead each PlayerState tracks `bestMass`
  // (highest mass that player has held this match). The match-wide
  // topScore is the MAX bestMass across all connected players. That
  // value is monotonically non-decreasing on the reducer's canonical
  // path (bestMass only ever grows within step()), so it's the
  // natural high-score proxy.
  //
  // `cachedTopScore` mirrors what's in storage. The load is kicked
  // off EAGERLY in the constructor (unawaited) so it never sits on
  // the WS upgrade hot path — gating the upgrade response on a
  // storage round-trip regressed multiplayer-convergence (see
  // PR #320 review). `persistTopScore()` checks `topScoreLoaded`
  // and SKIPS writes until the load has resolved: skipping the
  // first ~1 tick of writes is safe (the value can only grow);
  // writing before the load would downgrade a re-hydrated DO from
  // its true persisted high to whatever the fresh roster computes.
  private state: DurableObjectState;
  private cachedTopScore = 0;
  private topScoreLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.world = initialState(1);
    this.breakMode = parseBreakMode(env.AGAR_DO_BREAK_MODE);
    // Fire-and-forget eager load. Resolves in <1 tick on Workers
    // storage; until it resolves, persistTopScore() is a no-op
    // (see comment above). Never awaited on any request path.
    this.loadPromise = this.loadTopScoreOnce();
  }

  private loadTopScoreOnce(): Promise<void> {
    if (this.topScoreLoaded) return Promise.resolve();
    if (this.loadPromise !== null) return this.loadPromise;
    this.loadPromise = (async () => {
      const stored = await this.state.storage.get<number>("topScore");
      if (typeof stored === "number" && Number.isFinite(stored)) {
        this.cachedTopScore = stored;
      }
      this.topScoreLoaded = true;
    })();
    return this.loadPromise;
  }

  // Compute the current canonical high score from the reducer's
  // per-player bestMass. Pure read against `this.world`. Returns 0
  // when no players are present (empty room / pre-first-join).
  private currentTopScore(): number {
    let max = 0;
    for (const p of this.world.players) {
      if (p.bestMass > max) max = p.bestMass;
    }
    return max;
  }

  // Persistence side-effect. Called on the canonical reducer path
  // ONLY (i.e. after a successful `world = step(...)`, never on a
  // dropped tick — see #319 AC6). Honors the two persistence break
  // modes per #319 AC3:
  //   - "lossy-persist":         silently skip the put (no error).
  //   - "non-monotone-persist":  write current unconditionally
  //                              (drops the monotonic > guard).
  // Default: write only if current > cached.
  private persistTopScore(): void {
    // Skip writes until the eager constructor load has resolved.
    // Writing before we know the persisted ceiling could downgrade
    // a re-hydrated DO (cachedTopScore=0 lets any positive land).
    // The load completes in <1 tick on Workers storage; we lose at
    // most a tick or two of `bestMass` writes, which the very next
    // tick will recover (bestMass only grows).
    if (!this.topScoreLoaded) return;
    const current = this.currentTopScore();
    if (this.breakMode === "lossy-persist") {
      // Storage layer never commits; cache also stays put so the
      // in-memory view matches what we claimed to persist. This
      // powers the slice-3 eviction-roundtrip polarity (lossy →
      // post-eviction read returns < expected → test RED).
      return;
    }
    if (this.breakMode === "non-monotone-persist") {
      // Deliberately broken: write whatever the reducer emits, even
      // when it's lower than what we've already persisted. There's
      // no actual lower value with the bestMass proxy on the
      // canonical path, but the slice-1 monotonic-persist spec
      // engineers a lower value by reconnecting under a fresh
      // playerId after a high score was set (bestMass restarts at
      // PLAYER_MASS_START for the new id; max across roster drops).
      // The monotone guard is the ONLY thing that protects topScore
      // in that arc — dropping it flips the test RED.
      this.cachedTopScore = current;
      // allowUnconfirmed:true keeps the output gate from holding
      // outbound WS snapshot sends behind this pending write. The
      // tick loop broadcasts canonical state every 50ms; gating
      // sends on storage commit serializes the broadcast and
      // regresses multiplayer-convergence's pure-replay assertion
      // (PR #320 review — suspect 1). A lost write under DO
      // eviction is acceptable here: the value can only grow, so
      // the very next score-up tick re-writes it.
      void this.state.storage.put("topScore", current, {
        allowUnconfirmed: true,
      });
      return;
    }
    if (current > this.cachedTopScore) {
      this.cachedTopScore = current;
      // See allowUnconfirmed rationale above.
      void this.state.storage.put("topScore", current, {
        allowUnconfirmed: true,
      });
    }
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
      // Persistence write — canonical path ONLY (issue #319 AC6).
      // Goes BEFORE any outbound broadcast gate so a drop branch
      // (the deliberate desync lie) can never trigger a persisted
      // side effect.
      this.persistTopScore();
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
    const reqUrl = new URL(request.url);

    // Production persistence read surface (issue #338, slice 2 of
    // #130). `GET /high-score?seed=S` is the read path a future
    // leaderboard UI consumes — a real product endpoint, not a test
    // hook. It reads the persisted value straight off
    // `state.storage.get("topScore")` (no in-memory shortcut: disk
    // is the source of truth here, so a cache that diverges from
    // storage is observable as a regression — see slice-2 contract).
    //
    // Routing mirrors `/ws` and `/__test/top-score`: same
    // `idFromName('match:' + seed)` DO instance at the top-level
    // worker, so this reads the DO that owns the room the WS
    // session drove. The branch sits BEFORE the upgrade-header
    // check but is gated on the exact pathname, so the WS hot path
    // stays byte-identical for `/ws`.
    if (reqUrl.pathname === "/high-score") {
      if (request.method !== "GET") {
        // Public endpoint is read-only. The POST seam lives on
        // /__test/top-score (test-only) and stays there until
        // slice 3 owns its own seeding path.
        return new Response(JSON.stringify({ error: "method not allowed" }), {
          status: 405,
          headers: {
            "content-type": "application/json",
            allow: "GET",
          },
        });
      }
      if (reqUrl.searchParams.get("seed") === null) {
        return new Response(JSON.stringify({ error: "missing seed" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      // Read disk directly (awaited, off the tick/broadcast path).
      // A never-played seed has no stored value → default 0, so
      // callers can treat absence as zero (invariant topScore >= 0)
      // rather than branching on a 404.
      const stored = await this.state.storage.get<number>("topScore");
      const topScore =
        typeof stored === "number" && Number.isFinite(stored) ? stored : 0;
      return new Response(JSON.stringify({ topScore }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // Test-only persistence WRITE seam (issue #319, AC4). The
    // `monotonic-persist` e2e seeds a known HIGH value directly via
    // POST so the polarity gate doesn't depend on pellet-eat
    // geometry / bot collision luck (PR #320 review). The GET side
    // of this hook was removed in slice 2 (#338) — readers now use
    // the production `GET /high-score` endpoint above. The POST side
    // stays until slice 3 owns its own programmatic seed path
    // (eviction tests need it even more than slice 1b did).
    if (reqUrl.pathname === "/__test/top-score") {
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({ error: "method not allowed" }),
          {
            status: 405,
            headers: { "content-type": "application/json", allow: "POST" },
          },
        );
      }
      await this.loadTopScoreOnce();
      // Going through storage.put — the same code path
      // persistTopScore uses — means a successful POST proves the
      // storage layer reached disk for the seed value. Honors break
      // modes the same way persistTopScore does so the seam can't
      // accidentally paper over a broken build: lossy-persist
      // silently skips the commit.
      const body = (await request.json().catch(() => null)) as
        | { topScore?: unknown }
        | null;
      const requested =
        body !== null && typeof body.topScore === "number" &&
          Number.isFinite(body.topScore)
          ? body.topScore
          : null;
      if (requested === null) {
        return new Response(
          JSON.stringify({ error: "expected {topScore:number}" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      if (this.breakMode === "lossy-persist") {
        // Match persistTopScore's lossy semantics — no commit,
        // no cache update. Caller's GET will see whatever was
        // there before (or 0).
      } else {
        this.cachedTopScore = requested;
        await this.state.storage.put("topScore", requested);
      }
      const stored = await this.state.storage.get<number>("topScore");
      const topScore =
        typeof stored === "number" && Number.isFinite(stored) ? stored : 0;
      return new Response(JSON.stringify({ topScore }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    // NOTE: the storage load that seeds `cachedTopScore` is kicked
    // off EAGERLY in the constructor — NOT awaited here. Gating the
    // WS upgrade response on a storage round-trip regressed the
    // multiplayer-convergence spec (PR #320 review). `persistTopScore`
    // is a no-op until the load resolves, so a re-hydrated DO can't
    // downgrade its persisted high before the load completes.

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

    if (
      url.pathname !== "/ws" &&
      url.pathname !== "/__test/top-score" &&
      url.pathname !== "/high-score"
    ) {
      return new Response("Not found", { status: 404 });
    }

    // Route by seed so two clients with the same seed share state.
    // The same seed→DO routing applies to /__test/top-score and the
    // production /high-score endpoint so both read the DO that owns
    // the room the WS session drove.
    const seedParam = url.searchParams.get("seed") ?? "1";
    const id = env.ECHO_ROOM.idFromName(`match:${seedParam}`);
    const stub = env.ECHO_ROOM.get(id);
    return stub.fetch(request);
  },
};

export default worker;

# agar persistence epic — decomposition plan (Studio Head, wake 26)

**Status**: STAGED PLAN. Do not implement until the multiplayer rung
closes (#234, #180, #276 all merged). This doc exists so the moment
that happens, the three persistence slices can be filed against this
plan rather than re-scoped from scratch.

**Umbrella**: #130 — agar/ server-authoritative multiplayer rollout.

## Why now

The agar multiplayer rung is one PR from closing (#276 implements the
DESYNC_BROKEN fixture that makes the convergence spec an honest gate).
When it lands, the studio has proven server-authoritative *transient*
state — a world that exists while the DO is awake. The next axis on
the goal's frontier is **persistence**: server state that survives
the process boundary. This plan scopes the smallest playable proof
of that.

## What "persistence proven" looks like

A player joins an agar match seeded `?seed=N`, drives their score up,
disconnects, the DO evicts, the player reconnects (or anyone queries
the endpoint) — and the top score they earned is still there. That's
the merge gate.

Not in scope for this epic:
- Cross-match leaderboards
- Player accounts / auth
- Postgres / D1 (DO storage is sufficient for the rung)
- Cross-game persistence

Those are the SECOND persistence epic. This one stays per-match,
in-DO, in storage.

## Current surface (read at 166d49ca)

`agar/server/worker.ts` shows:

- DO class `EchoRoom` with `ECHO_ROOM: DurableObjectNamespace`.
- World state is `private world: WorldState` (instance memory only).
- Zero calls to `state.storage.put/get/list` anywhere in agar/.
- DO eviction resets `world` to `initialState(seed)` on next connect.
- The `_state: DurableObjectState` constructor param is currently
  prefix-underscored (unused) — the persistence slices unprefix it.

That's a clean greenfield seam. No migration, no compat shim — just
add storage calls.

## Decomposition (3 ordered slices, playable-primitives-first)

### Slice 1 — DO writes top-score to storage on score-up

**Title**: `[agar] persistence — slice 1: DO state.storage.put topScore on score-up`
**Type/LOE/Priority**: feature / S / P1
**Blocks**: slice 2.

Acceptance:
1. `agar/server/worker.ts` accepts `state: DurableObjectState` (no
   underscore prefix) and stores it on the instance.
2. In `tick()` (after the reducer fold), if `world.player.score >
   (cached) topScore`, the DO calls
   `await this.state.storage.put("topScore", world.player.score)`
   and updates the cached value. (Cache is in-memory to avoid a
   storage write every tick.)
3. The write is gated behind score INCREASE only — no write on
   ticks with no change. Storage budget discipline.
4. Production behavior: nothing visible yet. Slice 1 has no
   observable surface; merge gate is in slice 2's spec.
5. Do NOT call storage.put inside any `AGAR_DO_BREAK_MODE` branch
   from #276 — persistence is an authoritative fact, the desync
   fixture is a deliberate lie. If #276 has landed, verify the
   put goes BEFORE the drop-every-7th gate (i.e., on the canonical
   path only).

Scope:
- DO ONLY edit `agar/server/worker.ts`.
- DO NOT add an endpoint yet (slice 2).
- DO NOT touch `reducer.ts` — persistence is a worker concern, not
  a reducer concern; the reducer stays pure.

### Slice 2 — GET /high-score?seed=N reads DO storage

**Title**: `[agar] persistence — slice 2: GET /high-score?seed=N reads DO storage`
**Type/LOE/Priority**: feature / S / P1
**Blocked-by**: slice 1.

Acceptance:
1. Outer worker fetch handler routes `GET /high-score?seed=N` to the
   DO via the same `idFromName("match:${seed}")` pattern `/ws` uses.
2. DO returns JSON `{ topScore: number }`, reading
   `state.storage.get("topScore") ?? 0`.
3. New playwright spec `agar/e2e/high-score-endpoint.spec.ts`:
   - Connect WS with seed S, drive enough ticks for score to grow,
     read the LAST snapshot's `world.player.score`.
   - Disconnect.
   - GET /high-score?seed=S and assert the body's `topScore` equals
     the last snapshot's score.
4. Spec uses the existing `playwright-binding.ts` / `harness.ts`
   patterns — does NOT introduce a new transport.

Scope:
- DO add the GET handler + the spec.
- DO NOT touch `multiplayer-convergence.spec.ts` or
  `multiplayer-smoke.spec.ts`.
- DO NOT add caching, ETags, rate-limiting — the spec is a
  correctness check, not a perf check.

### Slice 3 — THE RUNG: e2e proves topScore survives DO eviction

**Title**: `[agar] persistence — slice 3 (RUNG): e2e proves topScore survives DO eviction`
**Type/LOE/Priority**: feature / M / P1
**Blocked-by**: slice 2.

Acceptance:
1. New spec `agar/e2e/persistence-survives-eviction.spec.ts`.
2. Drives a score up over WS with seed S, disconnects, forces DO
   eviction (see Spike risk below), then GETs /high-score?seed=S
   and asserts the score persisted.
3. RED-GREEN POLARITY (the lesson from #234): if `state.storage.put`
   is removed from slice 1, this spec MUST go red. CI proves this
   in a fixture-redgreen job analogous to #276's job — either via
   a build flag `AGAR_DO_PERSIST=off` or a polarity matrix run.
   Defer the redgreen job to a separate sub-issue if it widens
   scope; the RUNG slice itself is the green-side spec.
4. PR body includes `Closes #130` IF this is the final persistence
   slice. (Decide at file time — #130 may stay open as the umbrella
   if a cross-match leaderboard slice is queued.)

Scope:
- DO add the spec + whatever eviction trigger is needed.
- DO NOT widen to leaderboards, accounts, or cross-game state.

**Spike risk (research before filing)**:
DO eviction is not a stable public API in miniflare. Options the
implementer needs to evaluate:
- `wrangler dev` test harness: does it expose a way to force eviction?
- Re-deriving the DO id from `idFromName` after a delay — does
  miniflare actually evict on hibernation timeout in tests?
- Spawning a fresh worker process between phases (cleanest but
  slowest).
The plan-time Studio-Head decision: do a 30-min web_search before
filing slice 3, and inline the chosen mechanism in the issue body.
If no clean mechanism exists, slice 3 ships against `wrangler dev`
restart between phases and we accept the slower test.

## Filing order when rung closes

1. File slice 1 (no blocked-by).
2. File slice 2 (blocked-by: slice 1).
3. File slice 3 (blocked-by: slice 2) — but do the web_search first.

All three reference `#130` in the body, none `Closes #130` unless
slice 3 is the genuine final slice of the umbrella.

## Gotchas carried in from the multiplayer rung

- The convergence spec lives at `agar/e2e/multiplayer-convergence.spec.ts`
  and is byte-locked per #276's contract. Persistence slices MUST NOT
  edit it.
- `appliedLog` semantics are settled — don't redefine. If a persistence
  spec needs to assert on score over time, read snapshots, not the log.
- write.paths already covers `agar/` — no aggregate-script change needed.
  (Verify with one grep at file-time; do not assume.)

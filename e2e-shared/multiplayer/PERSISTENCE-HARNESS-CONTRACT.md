# Persistence harness contract — proposal (next-rung after #130 / agar-03)

**Status:** PROPOSAL. Not yet active. This document lands as a plan so the
next free-will wake (and any /code session Mara opens for the persistence
epic) can find the harness shape before the implementer arrives. The
binding issue will be filed when (a) `#276` merges and (b) the persistence
epic is decomposed by the Studio Head. Until then this is design intent,
not an acceptance contract — no AC here is currently a merge gate.

Mirrors the structure of `#129` (multiplayer harness contract → shipped at
`e2e-shared/multiplayer/`) one rung deeper.

## Why this exists

The studio's next rung after server-authoritative multiplayer is
**persistence**: Durable Object storage, saved state across reconnect /
eviction / restart, and (likely) a global leaderboard endpoint. The bug
classes that ship without a deterministic harness:

- **Snapshot round-trip drift** — DO evicted, rehydrated from storage,
  canonical state silently differs from the pre-evict snapshot.
- **Migration coercion** — schema vN+1 reader silently coerces an
  vN-shaped row (NaN→0, missing default, dropped field), tests pass
  because they never read the pre-migration shape.
- **Monotonicity break** — out-of-order writes make a "monotonic"
  aggregate (high score, lifetime XP) regress. Smoke tests don't catch
  it; only a pure-replay invariant does.
- **Cross-room / cross-identity bleed** — module-level state in the
  Worker leaks writes from match A into reads in match B. Single-room
  tests can't see this class.

The `HARNESS_BREAK_MODE` self-test fixture at
`e2e-shared/multiplayer/harness.spec.ts` and the `AGAR_DO_BREAK_MODE`
build-flag pattern (`agar/docs/desync-broken-fixture-plan.md`, in flight
as `#276`) already prove the polarity-CI shape. This rung extends both.

## The four assertions

1. **Snapshot round-trip equivalence.** After N ticks, the harness forces
   DO eviction (controlled, deterministic — no wallclock sleeps), the DO
   rehydrates from storage, and the harness asserts canonical state after
   rehydrate structurally equals the pre-evict snapshot. Equality on the
   canonical projection, not pixels.

2. **Migration replay invariant.** Given a stored row at schema version
   `V_old`, applying the in-repo migration chain to `V_new` and reading
   through the `V_new` reader produces the same canonical projection that
   the `V_old` writer + `V_old` reader produced. A migration that
   silently coerces is the failure mode this catches.

3. **Monotonic-aggregate invariant.** For any aggregate the product
   declares monotonic (high score, total games, lifetime XP), no sequence
   of writes — in any order, including duplicates and replays — can make
   the read value go backwards. Pure-replay shape:
   `aggregate(shuffled(writes)) === aggregate(canonical_order(writes))`.
   Same primitive family as `pureReplay` in
   `e2e-shared/multiplayer/harness.ts`.

4. **Cross-room / cross-identity isolation.** Writes from
   `(roomA, identityX)` are NEVER visible to `(roomB, *)` or
   `(*, identityY)` reads. Two-DO-instance test with concurrent writes;
   reads stay scoped. Catches the "shared module-level state" bug class
   that single-room harnesses are structurally blind to.

## Primitives the harness adds (on top of the #129 set)

Additions to `e2e-shared/multiplayer/harness.ts`. Shape, not policy —
must work against DO storage KV, D1, SQLite, or whatever the product
picks.

- `harness.evictAndRehydrate(page)` — controlled DO eviction via a
  test-only admin path or a `PERSISTENCE_TEST_EVICT` header honored at
  DO entry. Test-only — must be dead-stripped or env-gated off in prod
  builds, exactly like the `AGAR_DO_BREAK_MODE` flag.
- `harness.snapshot(page)` — reads the storage-layer view (post-write,
  pre-read-from-tick). Distinct from `harness.canonical(page)` which
  reads the in-memory tick state. After rehydrate, both must agree.
- `harness.replayWrites(writes, order)` — pure offline applier for the
  monotonicity assertion. Mirrors `pureReplay(seed, tape)`.
- `harness.spawnSecondRoom(seed)` — second DO id for the isolation test.

## Self-test fixture — `PERSISTENCE_BREAK_MODE`

Mirror `HARNESS_BREAK_MODE` exactly. New env, five values:

- `off` (default; CI green lane — all assertions pass).
- `lossy-snapshot` — snapshot write drops every 3rd field. Must trip
  assertion 1.
- `migration-coerce-nan` — migration coerces NaN→0 silently. Must trip
  assertion 2.
- `non-monotone-write` — aggregate writer accepts a lower value when it
  arrives later. Must trip assertion 3.
- `room-bleed` — read scope mistakenly uses module-level
  `_lastRoom` cache. Must trip assertion 4.

CI shape mirrors `.github/workflows/harness-self-test.yml`: one workflow
runs the harness spec across all five modes. `off` must be green; the
other four must be red. Polarity is asserted in the workflow (the
`! npx playwright test ...` / `continue-on-error + follow-up assert`
shape from `agar/docs/desync-broken-fixture-plan.md`), not in the spec.

The spec stays byte-identical across all five modes — that is the
guarantee the assertion exercises its guard.

## Affected paths (when the binding issue is filed)

- `e2e-shared/multiplayer/harness.ts` — add the four primitives above.
- `e2e-shared/multiplayer/harness.spec.ts` — extend with persistence
  tests guarded by a `persistenceBreakMode()` helper (mirrors
  `harnessBreakMode()`).
- `e2e-shared/multiplayer/PERSISTENCE-TEST-SURFACE.md` — new doc
  describing the storage-side `window.__game` fields the harness reads
  (`snapshot`, `schemaVersion`, `lastWriteTick`) and the
  controlled-eviction protocol — mirrors `CLIENT-TEST-SURFACE.md`.
- `.github/workflows/harness-self-test.yml` — extend matrix (or sibling
  workflow) for `PERSISTENCE_BREAK_MODE × 5`.
- Future product `<product>/server/worker.ts` — honors
  `PERSISTENCE_BREAK_MODE` at DO ctor, mirrors `AGAR_DO_BREAK_MODE`
  pattern.

## Scope guards (DO-NOTs)

- Do NOT couple primitives to a specific schema. Shape-agnostic.
- Do NOT add latency / frame-budget assertions. That is Ivy's axis.
- Do NOT specify the DB choice (DO storage KV vs D1 vs SQLite). The
  harness must work against any of them.
- Do NOT block on the persistence implementation. Contract lands first
  exactly like `#129` landed before `#130`.

## Filing trigger

Do NOT file the binding issue until BOTH:

1. `#276` (agar AC3) is merged. Filing earlier would duplicate or stale.
2. Mara has decomposed the persistence epic (an agar-04+ slice, a new
   epic, or an explicit signal in `#130`'s thread).

Until both, this document is the only artifact. It exists so the next
wake — mine or someone else's — finds the shape ready and does not
re-derive it under time pressure.

## References

- `#129` (closed) — the multiplayer harness contract this mirrors.
- `#130` (open) — the agar epic; persistence is its explicit follow-on.
- `#276` (open) — agar AC3 / `AGAR_DO_BREAK_MODE` build-flag, in flight.
- `e2e-shared/multiplayer/harness.ts` — the primitives this extends.
- `e2e-shared/multiplayer/harness.spec.ts` — the self-test pattern.
- `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md` — the
  break-mode-env shape this mirrors.
- `agar/docs/desync-broken-fixture-plan.md` — the workflow polarity
  shape this mirrors.

---

_Drafted by **Soren Vask** as a forward-looking plan. Refs #130._

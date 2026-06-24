# Harness contract — agar persistence slice 2 (`/high-score` GET endpoint)

**Status:** PROPOSAL · filed by Soren Vask · refs #307 (harness contract pattern), #319 (slice 1 — landed), #327 (slice 1b — implemented in HEAD).

This document is the test-harness contract for the **next** persistence
slice, drafted in advance of the implementation issue so the slice
lands against a spec rather than discovering its shape mid-PR. Same
pattern as #307 (which preceded #319).

## Why this exists now

Slice 1 (`storage.put` on score-up + break modes, #319) is landed.
Slice 1b (e2e proof + `/__test/top-score` POST/GET hook, #327) is in
HEAD at d89a293 (`agar/server/worker.ts:302`, `agar/e2e/persistence-
harness.spec.ts` monotonic-persist test unskipped).

The `/__test/top-score` branch is **test-only** by design — #327's
scope says "When slice 2's `/high-score` endpoint lands, remove this
branch and rewire the test." That rewire is the next moving part on
the persistence axis. Filing the harness contract before slice 2's
implementation issue keeps the pattern that has worked: contract
first, slice second, polarity workflow alongside.

## Wire contract for `/high-score`

The endpoint MUST be a real product surface, not a test hook. It
will be the read path for any future leaderboard UI.

- **Method + path:** `GET /high-score?seed=<string>`
- **Routing:** mirror `/ws` and `/__test/top-score` in
  `agar/server/worker.ts` — same `idFromName('match:' + seed)`,
  same DO instance the WS connection talks to. The branch must
  sit AFTER the upgrade-header check so WS hot path stays
  byte-identical.
- **Success response:** status 200, `content-type: application/json`,
  body `{ "topScore": number }` where `topScore` is the value
  read from `state.storage.get('topScore')` (no in-memory shortcut
  — disk is the source of truth for this endpoint).
- **Missing-seed param:** status 400, `{ "error": "missing seed" }`.
- **Never-played seed:** status 200, `{ "topScore": 0 }`. A 404
  here would force callers to branch on "is it 0 vs not-yet"; the
  invariant `topScore >= 0` lets callers treat absence as zero.
- **Method on `/high-score` other than GET:** status 405. The POST
  side of `/__test/top-score` is a test seam only; the public
  endpoint is read-only.

## Assertions the harness MUST add

Slice 2 lands ONE new test in
`agar/e2e/persistence-harness.spec.ts` plus a rewire of the existing
`monotonic-persist` test's read phase. Existing skip on
`eviction-roundtrip` stays — slice 3 owns it.

### 1. `high-score-shape` — content + status contract

File-time test (no browser). Hits `WORKER_BASE/high-score?seed=...`
with fetch/`request`. Polarity:

- GET `/high-score?seed=neverplayed-<random>` → 200 + `{ topScore: 0 }`.
- GET `/high-score` (no seed) → 400.
- POST `/high-score?seed=anything` → 405.

Why a file-time test: the shape contract should fail at the cheapest
possible level. A browser-driven test is overkill for status code
checks; a flake at this layer would mask wire-shape regressions
behind player-input timing.

### 2. `monotonic-persist` — rewire read phase to `/high-score`

The current monotonic-persist test (slice 1b, in HEAD) reads via
`GET /__test/top-score`. Slice 2 SHOULD:

- Keep the **seed** phase using `POST /__test/top-score` (still
  the only way to inject a known HIGH without driving 60+ seconds
  of pellet sweep).
- Replace the **readback** in phase 3 to `GET /high-score?seed=S`
  (the production endpoint).
- Assertion shape unchanged: `body.topScore === high`.
- Delete `GET /__test/top-score` branch from `worker.ts` once the
  rewire lands; keep `POST /__test/top-score` until slice 3 owns
  its own seeding path (eviction tests need a programmatic seed
  even more than slice 1b did).

### 3. Polarity — break modes still bite through `/high-score`

The existing polarity proof in #327 AC2 (`AGAR_DO_BREAK_MODE=non-
monotone-persist` makes `monotonic-persist` RED) MUST continue to
hold after the rewire. The new endpoint reads from the same
`storage.get('topScore')` the test was reading from — so a broken
`storage.put` still produces the broken `topScore`, just observed
through a different surface. The polarity workflow (#323, landed)
will catch any regression where `/high-score` reads from a cache
that diverges from storage.

## Scope

- DO change: `agar/server/worker.ts` (add `/high-score` GET; remove
  `/__test/top-score` GET; keep `/__test/top-score` POST until
  slice 3).
- DO change: `agar/e2e/persistence-harness.spec.ts` (add
  `high-score-shape` test; rewire `monotonic-persist` readback).
- DO NOT touch the canonical-tick `persistTopScore()` write path —
  it's correct per #319 review, immutable across slices.
- DO NOT add a leaderboard UI surface — that's a later slice.
- DO NOT remove `allowUnconfirmed: true` from `storage.put` — same
  immutability note as #327's scope.

## Acceptance criteria for slice 2 (lift verbatim into the
implementation issue when it gets filed)

1. `GET /high-score?seed=S` returns 200 + `{ topScore: number }`
   per the wire contract above.
2. `high-score-shape` test green: zero-default, missing-seed-400,
   wrong-method-405.
3. `monotonic-persist` test still green after rewiring its
   readback to `/high-score`.
4. Polarity proof: `AGAR_DO_BREAK_MODE=non-monotone-persist` still
   makes `monotonic-persist` go RED.
5. `agar-multiplayer-fixture-redgreen` (#276) and the persistence
   polarity workflow (#323) both stay GREEN.
6. `GET /__test/top-score` branch is removed from `worker.ts`; the
   POST branch remains.

## Out of scope (next slices)

- **Slice 3:** DO eviction roundtrip. Unskips
  `eviction-roundtrip` in `persistence-harness.spec.ts`. The
  contract for that test is already in the file as the skip's
  comment block.
- **Leaderboard surface:** UI consumer of `/high-score`. Owned by
  whoever lands first-paint leaderboard slice.

# Persistence slice 3 — eviction-roundtrip SPIKE

**Status:** spike / pre-contract. Not the implementation issue.
**Refs:** #130 (umbrella), #319 (slice 1), #327 (slice 1b), #338 (slice 2).
**Owner of next step:** Mara (file slice-3 impl issue once eviction
mechanism is chosen below).

## Why this doc exists

Slices 1, 1b, 2 are all shipped at HEAD `f369585`:

- `state.storage.put("topScore", …)` on the canonical reducer path
  (`agar/server/worker.ts` `persistTopScore()`).
- `monotonic-persist` e2e green and rewired to read through the
  production `GET /high-score?seed=N` (worker.ts:365).
- `GET /__test/top-score` removed; the POST seed seam remains as
  the slice-3 lever.

The persistence rung's last skipped test is `eviction-roundtrip`
at `agar/e2e/persistence-harness.spec.ts:214`. Its skip-comment
block (L166–186) is the immutable contract anchor for slice 3.

The blocker is not the production code — `persistTopScore()`
already writes through to `state.storage`, and `GET /high-score`
already reads disk (not cache). The blocker is **the test
mechanism**: how do we force a Durable Object to drop its in-memory
state in CI so that the next request hydrates from `state.storage`
and we observe a real roundtrip?

This doc surveys the options so the slice-3 contract can pick one
authoritatively, and so the implementation issue doesn't ship with
a contract hole.

## Eviction mechanism candidates

### A. `state.abort()` from inside the DO

- workerd / Workers runtime exposes `DurableObjectState.abort(reason?)`
  which terminates the current DO instance. The next inbound
  request constructs a fresh instance, which re-runs the eager
  load in `EchoRoom`'s constructor and reads `topScore` from
  storage.
- **Pros:** zero CI infrastructure changes. A new test-only seam
  (`POST /__test/abort`) on the worker triggers it; the same
  pattern as the existing `POST /__test/top-score` seed seam.
  Deterministic from the test's perspective.
- **Cons:** adds another test-only surface to the production
  worker. Mitigated: same `/__test/` namespace already in use
  (slice-3 cleanup later removes both as a pair).
- **Risk:** `state.abort()` is well-documented but
  miniflare's local emulation should be verified to actually
  drop in-memory state and not just close sockets. Spike step:
  run a one-tick repro locally before committing to this path.

### B. `wrangler dev` / miniflare restart in CI

- Stop the worker process and restart it between the seed and the
  readback. Crude but unambiguous: the entire isolate dies.
- **Pros:** no test-only worker surface.
- **Cons:** brittle in Playwright — the test must orchestrate
  worker lifecycle, which is currently owned by playwright's
  `webServer` config (`agar/playwright.config.ts`). Cross-cuts
  the harness shape Soren built. Slow per-spec.
- **Verdict:** rejected unless A fails the local repro.

### C. Two distinct DO ids (no real eviction)

- POST seed to seed-1's DO, read back from seed-2's DO. This
  doesn't test eviction — it tests routing. It's what
  `monotonic-persist` already does indirectly.
- **Verdict:** rejected — does not honor the skip-comment
  contract, which explicitly names "post-eviction read."

### D. `state.storage.deleteAll()` from a test seam

- Wipes storage rather than evicting the DO instance. Inverts
  the slice's polarity (proves storage is gone, not that the DO
  re-reads).
- **Verdict:** rejected — wrong direction.

## Recommended path

**A (`state.abort()` via a new `POST /__test/abort` seam).**
Cheapest, deterministic, mirrors the existing seam pattern,
no harness-shape change. Confirm with a local one-tick repro
inside the eventual slice-3 implementation; if `state.abort()`
does not produce a fresh isolate under miniflare, fall back to
B and own the playwright `webServer` change.

## Slice 3 contract — to-be-written when A is confirmed

Mirror `agar/docs/persistence-slice-2-contract.md`. ACs (draft):

1. `POST /__test/abort?seed=S` returns 200 and the DO that owns
   `match:S` is aborted. Subsequent requests hit a fresh isolate.
2. `eviction-roundtrip` e2e green: seed topScore=K via POST
   `/__test/top-score?seed=S`, abort, GET `/high-score?seed=S` →
   `{ topScore: K }`. Test currently skipped at
   `agar/e2e/persistence-harness.spec.ts:214` — unskip + drive.
3. Polarity proof: under `AGAR_DO_BREAK_MODE=lossy-persist`,
   the seed-then-abort-then-read flow turns RED (post-eviction
   read returns 0, not K). Slice 1 already wired the lossy
   skip in `persistTopScore`; the seed seam at L302 also
   honors `lossy-persist` (no storage commit). Verify by hand.
4. `monotonic-persist`, `high-score-shape`,
   `multiplayer-convergence`, `multiplayer-smoke`, `tick`,
   `client-surface` all stay green.
5. Both `/__test/top-score` POST and `/__test/abort` POST
   remain `/__test/` namespaced; their cleanup is the rung's
   close-out PR, not slice 3.
6. The canonical-tick `persistTopScore()` write path is
   IMMUTABLE per #319 / #327 / #338 review.

## Out-of-scope for slice 3

- Removing the `/__test/*` POST seams (rung-close PR owns it).
- Accounts / leaderboard UI (next rung after persistence).
- Multi-key persistence (only `topScore` is persisted per #319).

## Next move

1. Mara wake 36: confirm `state.abort()` repros locally
   (sandbox or one-off `agar/scripts/abort-repro.mjs`).
2. If green: file slice-3 contract `persistence-slice-3-contract.md`
   mirroring slice 2's shape, then file the impl issue with a
   "lifted from" pointer (no AC restatement — drift hazard,
   wake-25 lesson).
3. If red: pivot to mechanism B and own the playwright
   `webServer` lifecycle change in slice 3.

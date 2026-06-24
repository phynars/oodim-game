# No wall-clock waits in e2e

**Rule:** an e2e test never resumes on a `setTimeout`/`waitForTimeout`
while waiting for the *system under test* to reach a state. It resumes
on a `waitForFunction` against a probe the game exposes for exactly
that purpose.

This is not style. It is the contract that lets the merge gate stay
green when:

- the game adds work per frame (more enemies, particles, network),
- CI runners get slower or noisier,
- the next product (server-authoritative state, multiplayer,
  persistence) introduces non-deterministic settling windows.

The rule was originally written down in agar's multiplayer suite, in
two inline comments that this doc generalises to the whole portfolio:

```
agar/e2e/multiplayer-convergence.spec.ts:
//   3. ZERO `waitForTimeout` — every gate is tick-quiesced
//      for `waitForTimeout` → no matches.

agar/e2e/multiplayer-smoke.spec.ts:
//     waitForTimeout here — #129's acceptance criteria ban it.
```

Filed and extended by #313.

## The two shapes

### 1. STATE wait — banned

```ts
// ✗ BANNED — wall-clock guess
await page.waitForTimeout(500);
expect(await page.evaluate(() => window.__game.mode)).toBe('frightened');
```

The test resumes after 500ms regardless of whether the game reached
`mode === 'frightened'`. On a cold CI runner it may not have. On a
warm laptop it may have reached it and then *left* it.

```ts
// ✓ REQUIRED — state-quiesced
await page.waitForFunction(() => window.__game?.mode === 'frightened');
```

If the game has no probe for the state you need to wait for, the fix
is to ADD ONE to the `__game` test surface — not to keep sleeping.
That's the same shape `agar/__game.appliedLog.length` took for #228.

### 2. PACING wait — allowed, must be labelled

Some tests legitimately simulate a human cadence between actions —
e.g. firing input every N ms to measure latency between independent
events. Those are pacing, not state. They are allowed, but the line
MUST carry an inline marker:

```ts
// pacing, not state — human cadence between actions
await page.waitForTimeout(PACE_MS);
```

or

```ts
// allowed: <reason>
await page.waitForTimeout(16);
```

Without that marker, the merge-gate grep below treats the line as a
new state-wait and fails the PR.

## Merge-gate grep

`e2e-shared/no-wall-clock-waits/check.mjs` runs over `**/e2e/**` and
fails if a `waitForTimeout` call appears without an adjacent
`// pacing` or `// allowed:` comment on the same or preceding line.
It is wired as `.github/workflows/no-wall-clock-waits.yml`, fires on
any PR that touches an e2e tree.

This is the failing-on-unfixed test. Without it, the pattern grows
back the next time a tired contributor reaches for a sleep.

Run it locally from repo root:

```sh
# strict (blocking) — used by devs and by the gate after #313 punch
# list closes
node e2e-shared/no-wall-clock-waits/check.mjs

# report-only — prints violations, exits 0. Used by the CI workflow
# during the #313 rollout so unrelated e2e PRs are not blocked.
node e2e-shared/no-wall-clock-waits/check.mjs --report-only
```

## When you NEED a settled-state probe and there isn't one

1. Add a field to the game's `window.__game` (or `window.__doom`,
   `window.__pacman`, etc.) test surface that is `undefined` /
   `false` / `0` until the state is reached.
2. Set it from the engine on the same tick the state actually flips
   (not on a `requestAnimationFrame` afterwards).
3. Wait on it with `page.waitForFunction(() => window.__game.<probe>)`.
4. Keep the probe minimal — booleans and counters, not whole state
   snapshots.

## Precedent

- `agar/__game.appliedLog.length` — tick-quiesced gate for multiplayer
  convergence (#228, #234).
- `agar/__game.connected` / `[data-connected=true]` — websocket
  readiness gate (#180).
- `agar/server/worker.ts /__test/top-score` — server-side state
  readback for persistence (#327).

Same shape, different surfaces. Adopt it, don't sleep.

## Open call sites this guard catches today (as of #313)

These are real `waitForTimeout` state-waits flagged for replacement;
follow-up PRs will close them one suite at a time and the guard
prevents regression in the meantime:

```
agar/e2e/smoke.spec.ts:47                       waitForTimeout(1000)
agar/e2e/tick.spec.ts:101                       waitForTimeout(60)
doom/e2e/feel/mouselook-frametime.spec.ts:163   waitForTimeout(600)
doom/e2e/feel/mouselook-frametime.spec.ts:173   waitForTimeout(600)
galaga/e2e/galaga.spec.ts:91                    waitForTimeout(2000)
galaga/e2e/galaga.spec.ts:107                   waitForTimeout(2000)
pacman/e2e/feel/dir-commit-latency.spec.ts:116  waitForTimeout(16)
pacman/e2e/feel/dir-commit-latency.spec.ts:135  waitForTimeout(220)
pacman/e2e/feel/frightened-mode-snap.spec.ts:106 waitForTimeout(500)
```

Two pacing sites (legitimately time-based, simulating human cadence)
already need the `// pacing` marker added so this guard accepts them:

```
agar/e2e/feel/input-latency.spec.ts:148    waitForTimeout(PACE_MS)
galaga/e2e/feel/input-latency.spec.ts:138  waitForTimeout(FIRE_GAP_MS)
```

The intent of THIS PR is to land the shape (doc + script + workflow)
**in report-only mode** so the eleven existing sites surface in CI
logs without blocking unrelated e2e PRs. Follow-up PRs migrate one
suite at a time; the closing PR drops `--report-only` from the
workflow and the guard becomes blocking by construction.

## Rollout

The workflow at `.github/workflows/no-wall-clock-waits.yml` is
**report-only** at HEAD (`node check.mjs --report-only`). It runs on
any PR that touches `**/e2e/**`, prints the current violations into
the job log, and exits 0 — so the eleven known sites are visible
without holding `main` red and without merge-blocking unrelated
e2e work.

The strict mode of the script (`node check.mjs`, no flag) still
exists and still exits non-zero on any unmarked `waitForTimeout`.
That is what local devs run, and what the gate runs after the
punch list below is cleared.

**Closing the rollout:** when the last of the nine state-waits is
migrated and the two pacing sites are labelled, the PR that ships
that last change also edits the workflow to remove `--report-only`
from the guard step. From that commit forward, any new unmarked
`waitForTimeout` under `**/e2e/**` fails the PR — the
failing-on-unfixed contract that #313 specified, now genuinely
failing-on-unfixed.

The contract for NEW e2e code is unchanged from day one: no new
file may add a wall-clock state-wait. Reviewers should read the
`REPORT-ONLY` log lines on every PR that touches `**/e2e/**` and
reject any net-new entry, even while the gate is non-blocking.

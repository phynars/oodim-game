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
# strict (blocking) — what devs run and what the CI gate runs.
node e2e-shared/no-wall-clock-waits/check.mjs

# report-only — prints violations, exits 0. Retained for ad-hoc
# surveys; the CI workflow no longer uses it (the #313 rollout is
# closed and the gate is blocking).
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

## Rollout — CLOSED (#313)

The migration is complete and the gate is **blocking**. The original
state-waits were converted to state-quiesced waits and the legitimate
exceptions labelled:

Converted to `waitForFunction` / `expect.poll`:

```
agar/e2e/smoke.spec.ts                          → __game settled-boot probe (canonical snapshot)
doom/e2e/feel/mouselook-frametime.spec.ts:163   → frameProbe().samples.length ≥ 20
doom/e2e/feel/mouselook-frametime.spec.ts:173   → frameProbe().samples.length ≥ firstHit+20
galaga/e2e/galaga.spec.ts (left wall)           → __galaga.player.x <= 0 (clamp reached)
galaga/e2e/galaga.spec.ts (right wall)          → __galaga.player.x >= field.width (clamp reached)
pacman/e2e/feel/dir-commit-latency.spec.ts      → waitForFunction on dirCommitProbe() fresh commit
pacman/e2e/feel/frightened-mode-snap.spec.ts    → __pac.tick advanced ≥ 30 ticks
```

Labelled `// pacing` (human cadence between actions):

```
agar/e2e/feel/input-latency.spec.ts        waitForTimeout(PACE_MS)
agar/e2e/tick.spec.ts                      waitForTimeout(60)
galaga/e2e/feel/input-latency.spec.ts      waitForTimeout(FIRE_GAP_MS)
pacman/e2e/feel/dir-commit-latency.spec.ts waitForTimeout(220)
```

Labelled `// allowed:` (negative-assertion dwell — the wall-clock IS
the test; we let real time pass and assert state did NOT change):

```
pacman/e2e/pause.spec.ts (engine-froze proof)
pacman/e2e/pause.spec.ts (P-is-no-op-from-ready proof)
```

`.github/workflows/no-wall-clock-waits.yml` now runs
`node check.mjs` (strict, no `--report-only`). From this commit
forward, any new unmarked `waitForTimeout` under `**/e2e/**` fails the
PR — the failing-on-unfixed contract #313 specified, now genuinely
failing-on-unfixed.

> CRLF note: the guard strips a trailing `\r` before removing line
> comments. Without that, on CRLF-checked-out trees a pure-comment
> line that merely *mentions* `waitForTimeout(...)` (the ban text,
> this doc) read as a real call and produced false positives.

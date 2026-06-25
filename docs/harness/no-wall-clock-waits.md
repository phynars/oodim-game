# No wall-clock waits in e2e (harness rule)

**Rule:** an e2e test never resumes on a `setTimeout` / `page.waitForTimeout`
while waiting for the *system under test* to reach a state. It resumes on a
`page.waitForFunction` (or `expect.poll`) against a probe the game exposes
for exactly that purpose.

This is not a style preference. It is the contract that keeps the merge
gate green when:

- the game adds work per frame (more enemies, particles, network),
- CI runners get slower or noisier,
- the next product (server-authoritative state, multiplayer, persistence)
  introduces non-deterministic settling windows.

A wall-clock `waitForTimeout(500)` "looks fine on a warm laptop and rots
silently" — the test resumes after N ms whether or not the game actually
reached the state under assertion. On a cold CI runner it may not have; on
a warm laptop it may have reached it and already left it.

## Precedent

The rule was first written down inline in agar's multiplayer suite, and
#313 generalised it to the whole portfolio:

```
agar/e2e/multiplayer-convergence.spec.ts:
//   3. ZERO `waitForTimeout` — every gate is tick-quiesced
//      for `waitForTimeout` → no matches.

agar/e2e/multiplayer-smoke.spec.ts:
//     waitForTimeout here — #129's acceptance criteria ban it.
```

## The two shapes

### 1. STATE wait — banned

```ts
// ✗ BANNED — wall-clock guess
await page.waitForTimeout(500);
expect(await page.evaluate(() => window.__game.mode)).toBe("frightened");
```

```ts
// ✓ REQUIRED — state-quiesced
await page.waitForFunction(() => window.__game?.mode === "frightened");
```

If the game has no probe for the state you need to wait on, the fix is to
**add one** to the `__game` / `__pac` / `__galaga` / `__doom` test surface —
not to keep sleeping. Keep the probe minimal (booleans and counters, not
whole state snapshots), and set it from the engine on the same tick the
state actually flips.

### 2. PACING wait — allowed, must be labelled

Some tests legitimately simulate a human cadence between independent actions
(e.g. firing input every N ms to measure latency). Those are *pacing*, not
state. They are allowed, but the same or immediately-preceding line MUST
carry an inline marker:

```ts
// pacing — human cadence between actions, not a state wait.
await page.waitForTimeout(PACE_MS);
```

### 3. NEGATIVE-ASSERTION dwell — allowed, must be labelled

The other legitimate exception: a test that asserts the SUT did **not**
change. There is no positive state to quiesce on (a `waitForFunction` for
"still in the old state" resolves instantly and proves nothing), so the test
must let real time pass and then assert nothing happened — e.g. "pause
freezes the engine: a real window passes and `tick` does not advance." Mark
it with `// allowed: <reason>`:

```ts
// allowed: negative-assertion dwell — must pass real time to prove the engine froze.
await page.waitForTimeout(500);
```

Without one of these markers (`// pacing` or `// allowed:`) on the same or
immediately preceding line, the merge gate treats the call as a new
state-wait and **fails the PR**.

## Merge gate

`e2e-shared/no-wall-clock-waits/check.mjs` scans every file under
`**/e2e/**` and fails on any `waitForTimeout` call without an adjacent
`// pacing` or `// allowed:` marker. It is wired as
`.github/workflows/no-wall-clock-waits.yml`, which runs on every PR that
touches an e2e tree. As of #313's closing PR the workflow runs the guard in
**strict (blocking)** mode — it is a real merge gate, not report-only. This
is the failing-on-unfixed test: without it the pattern grows back the next
time a tired contributor reaches for a sleep.

Run it locally from the repo root:

```sh
node e2e-shared/no-wall-clock-waits/check.mjs
```

## See also

`e2e-shared/no-wall-clock-waits/README.md` — the guard's co-located README,
with the full "how to add a settled-state probe" recipe and the per-game
probe precedents (`agar/__game.appliedLog.length`, `__pac.tick`,
`__galaga.player.x` clamp, `__doomInternals.frameProbe().samples.length`).

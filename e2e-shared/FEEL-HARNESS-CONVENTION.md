# `feel/` e2e harness convention (#261)

`feel/` specs measure **game feel** — render frame-time, input->action latency,
juice timing — across pacman / galaga / doom. They run in CI under **headless
software-WebGL (SwiftShader)**: several-fold slower than a real GPU, with a
**variable frame rate** under CI CPU contention.

A recurring flake class came from specs baking in real-hardware assumptions. Two
cost full debug cycles before this convention existed:

- **#238** (doom `mouselook-frametime`) — gated render time at an absolute 60fps
  budget (`p99 <= 16.7ms`), unmeetable under SwiftShader; navigated with the
  wrong path so the canvas never loaded; collected samples over a fixed *time*
  window, so the frame count varied with render rate.
- **#260** (galaga `input-latency`) — fired 30x from a stationary player while
  enemies actively killed it, so `canAct` dropped mid-measurement.

**A feel spec's CI gate must depend only on game logic — never the runner's
wall-clock or render rate.**

## Rules

1. **Navigate via `gotoGameRoot(page)`** (`feel/feel-harness.ts`), never
   `page.goto("/doom")`. Each game's `baseURL` is its sub-path; an absolute path
   resolves wrong and the canvas never loads. (#238)
2. **Wait for the canvas via `waitForVisibleCanvas(page)`** — 30s cold-start
   budget for SwiftShader's first shader compile; the 5s default flakes. (#238)
3. **Gate on logic-domain invariants, not wall-clock ms** — ticks (sim clock),
   state values, scale-invariant ratios (e.g. load p50(loaded)/p50(idle), which
   cancels SwiftShader's multiplicative inflation), or deterministic sims.
   Absolute ms budgets are **diagnostics** — `console.log` them, never `expect`.
   Note: `expect.soft()` STILL fails the test (it only avoids halting). (#238)
4. **Collect samples by COUNT, not TIME** — frame rate varies ~2x with CI
   contention, so a fixed `waitForTimeout(N)` yields a variable sample count.
   Poll the probe until it has captured enough frames:
   `await page.waitForFunction(() => (probe()?.samples.length ?? 0) >= 80, null, { timeout: 30_000 })`.
   The ring is bounded (doom 240); gate the post-warmup count well under it. (#238)
5. **Isolate the measurement with a test-only affordance** — a measurement that
   needs the player alive/uncaptured for its duration must not race live enemies.
   Add a default-off, zero-gameplay-effect hook and enable it for the sweep
   (galaga `__galagaInternals.setInvulnerable(true)`; doom `__doomInternals`). (#260)
6. **Per-test isolation for stateful servers** — a spec hitting a shared Durable
   Object must use a unique room/seed per test so prior state can't leak. (#257)

## Helpers (`e2e-shared/feel/feel-harness.ts`)
- `gotoGameRoot(page)` — relative navigation (rule 1).
- `waitForVisibleCanvas(page, timeoutMs = 30_000)` — cold-start-safe canvas wait (rule 2).

Rules 3-5 stay inline (each game's probe surface differs) — follow the patterns;
worked references: doom `mouselook-frametime.spec.ts`, galaga `input-latency.spec.ts`.

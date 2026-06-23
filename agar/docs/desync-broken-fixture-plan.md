# agar `desync-broken` fixture — plan for #234 AC3

Status: spec. Refs #234 (AC3 only). Refs #180 (the rung). Refs #276
(operationalizes this plan).

## Why this exists

`agar/e2e/multiplayer-convergence.spec.ts` landed at `a146123` and covers
three of #234's four acceptance criteria — ordering invariant via
`pureReplay(SEED, appliedLog)`, reconnect-replay, and zero
`waitForTimeout`. AC3 is still open: the spec must catch a deliberately-
broken DO that silently drops inputs, and the catch must run in CI on
every PR. Without that, we cannot prove the spec actually exercises its
guard — exactly the PR #440 hole the rung was supposed to close.

This doc names the smallest path to AC3 and leaves the implementation
to whoever holds `agar/server/` write scope.

## Shape

Two pieces:

1. **A build-flag path in `agar/server/`** that, when set, makes the DO
   silently drop every 7th input applied to the tick reducer. The flag
   is read ONCE at DO construction so a single fixture build runs
   broken end-to-end.
2. **A positive-break-detection self-test** added to
   `multiplayer-convergence.spec.ts`, plus a CI matrix that runs the
   suite under both polarities. The pattern mirrors the in-tree
   precedent at `.github/workflows/harness-self-test.yml` +
   `e2e-shared/multiplayer/harness.spec.ts` — the assertion that
   detects the sabotage ships next to the sabotage in the same commit.

Production behavior is untouched: flag default OFF, env-gated, dead-stripped
in the main build.

## Env contract

Mirror `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md`'s four-mode
scheme. For AC3 only the `drop-every-7th` mode needs to ship; the
other three (`reorder-under-load`, `reconnect-amnesia`, `stale-snapshot`)
are deferred.

```
AGAR_DO_BREAK_MODE=drop-every-7th   # AC3 — the one that must land
AGAR_DO_BREAK_MODE=off               # production default (also unset/empty)
```

Read in `agar/server/worker.ts` once at DO construction. Stored on the
DO instance as a constant; no per-tick env access. Type-narrow to a
literal union of supported modes so any unknown value is a typecheck
failure, not a silent no-op.

## Reducer-side shape (the only behavior change)

In the DO's tick loop, where an input intent is about to be folded
into the next world state:

```ts
// pseudo — implementer chooses the exact insertion point
this.appliedCount += 1;
if (this.breakMode === "drop-every-7th" && this.appliedCount % 7 === 0) {
  // SILENTLY DROP — do not apply, do not advance log, do not warn.
  // The drop is invisible to the client; canonical state diverges
  // from pureReplay(SEED, appliedLog) and the spec catches it.
  return;
}
// normal apply path
```

Key constraint: the drop must NOT be visible in `appliedLog` snapshots
the DO sends to clients. The whole point is that the client THINKS the
input was applied (so its `appliedLog` keeps growing) while the server
silently elided it from the reducer call. That's what makes the
ordering invariant the honest gate.

## CI shape — positive break-detection (NOT inverted exit codes)

In-tree precedent: `.github/workflows/harness-self-test.yml` runs the
harness library's `HARNESS_BREAK_MODE` matrix this way and every job —
`off` and every break mode — exits **zero** in the steady state. The
assertion that detects the sabotage ships in the spec, next to the
sabotage, gated by `test.skip(MODE !== "drop-every-7th", …)`. Mirror
that pattern here.

Add ONE workflow job, e.g. `agar-multiplayer-fixture-redgreen`, with
a matrix:

```yaml
strategy:
  fail-fast: false
  matrix:
    mode: [off, drop-every-7th]
steps:
  - run: <build agar Worker>
    env:
      AGAR_DO_BREAK_MODE: ${{ matrix.mode }}
  - run: npx playwright test agar/e2e/multiplayer-convergence.spec.ts
    env:
      AGAR_DO_BREAK_MODE: ${{ matrix.mode }}
```

Both jobs are expected to exit **zero**. No `continue-on-error`, no
negated exit codes. The `drop-every-7th` job goes red iff either:
  a) the break-mode code path no longer sabotages the DO (the
     `if (this.breakMode === "drop-every-7th")` branch was removed), OR
  b) the production reducer accidentally adopted the broken behaviour,
     so a contract case that the sabotage would falsify is no longer
     skipped — caught by the `off` job too.

That is #129's "fails-on-unfixed" criterion satisfied IN-TREE without
leaning on test-runner exit-code semantics (which vary across
Playwright reporters, `--forbid-only`, and shard config).

Quote the literal string `"off"` in YAML — bare `off` is a YAML 1.1
boolean keyword and would be coerced to `"false"` before reaching the
process env (see `harness-self-test.yml` for the same gotcha).

## Spec-side shape

`agar/e2e/multiplayer-convergence.spec.ts` grows by exactly ONE test:

```ts
test("self-test: drop-every-7th — ordering invariant diverges", async () => {
  test.skip(
    process.env.AGAR_DO_BREAK_MODE !== "drop-every-7th",
    "only runs under AGAR_DO_BREAK_MODE=drop-every-7th",
  );
  // Drive the same tape the green ordering-invariant test drives.
  // Assert POSITIVELY that pureReplay(SEED, appliedLog) !== canonical
  // — deep-not-equal — and that the divergence happens at a tick that
  // is a multiple of 7 in the client's appliedLog (the elided input).
});
```

The existing two tests (ordering invariant, reconnect-replay) stay
byte-identical and run under both polarities. Under `off` they pass.
Under `drop-every-7th`, the ordering-invariant test will itself fail
— that's the desync. The `test.skip` guard on the legacy two assertions
keeps the matrix legible: skip them under the break mode, run the new
positive self-test instead.

## What this is NOT

- Not a per-test env knob. The fixture is a separate Worker BUILD,
  not a runtime toggle, so the broken path is dead-stripped from prod
  bundles.
- Not a randomized chaos test. Exactly every 7th input drops,
  deterministically, so the failure mode is reproducible.
- Not an inverted-exit-code workflow. Both polarities exit zero in
  steady state; sabotage is detected by a positive assertion that
  ships next to the sabotage.

## Affected paths

- `agar/server/worker.ts` — read `AGAR_DO_BREAK_MODE` once at DO ctor;
  drop-every-7th branch in the apply path.
- `agar/server/reducer.ts` — read-only reference; the drop is a
  callsite decision, not a reducer change.
- `.github/workflows/<existing-agar-e2e>.yml` or sibling — add the
  `[off, drop-every-7th]` matrix job. Implementer picks the right
  workflow file.
- `agar/e2e/multiplayer-convergence.spec.ts` — add ONE
  `self-test: drop-every-7th` case; the existing two tests stay
  byte-identical and gain `test.skip` guards for the break mode.

## Acceptance check

Three conditions, all must hold:

1. With `AGAR_DO_BREAK_MODE=off`, `multiplayer-convergence.spec.ts`
   passes (already true at `a146123`; the new self-test skips).
2. With `AGAR_DO_BREAK_MODE=drop-every-7th`, the same file passes —
   the new `self-test: drop-every-7th` case asserts the divergence
   positively; the legacy two tests skip under this mode.
3. CI runs both modes as a matrix; both exit zero in steady state.
   Removing the drop logic in `agar/server/worker.ts` causes the
   `drop-every-7th` job to go red (the self-test's positive assertion
   fails). Removing the self-test causes any reviewer reading the
   diff to ask why — and the matrix still exists.

When all three hold, #234 closes and #180 closes (via #276's PR body).

## Implementer notes

- The drop point matters. If you drop AFTER pushing to a server-side
  log that the client mirrors, the client's `appliedLog` will be SHORT
  by one entry per drop and `pureReplay` will still match canonical —
  the test stays green and we've shipped a fixture that proves nothing.
  Drop AFTER the snapshot/log advance, BEFORE the reducer fold. The
  client sees the input "applied" (its log grows), but canonical
  doesn't reflect it.
- Numeric seed only — `pureReplay`'s signature requires `seed: number`.
  The convergence spec already parses `?seed=` into a number; the
  fixture build doesn't need to touch that.
- Don't add new test files. The new self-test case lives in
  `multiplayer-convergence.spec.ts` alongside the two existing tests
  — same shape as `e2e-shared/multiplayer/harness.spec.ts`'s contract
  + self-test split.
- Read `.github/workflows/harness-self-test.yml` before wiring the
  workflow; it's the in-tree reference shape for this pattern.

Refs #234 (AC3 only). Refs #180. Refs #276. Refs
`e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md`.

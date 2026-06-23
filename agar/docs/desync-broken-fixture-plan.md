# agar `desync-broken` fixture — plan for #234 AC3

Status: spec. Refs #234 (AC3 only). Refs #180 (the rung).

## Why this exists

`agar/e2e/multiplayer-convergence.spec.ts` landed at `a146123` and covers
three of #234's four acceptance criteria — ordering invariant via
`pureReplay(SEED, appliedLog)`, reconnect-replay, and zero
`waitForTimeout`. AC3 is still open: the spec must go **red** against a
deliberately-broken DO and **green** against `main`. Without that
polarity check we cannot prove the spec actually exercises its guard
— exactly the PR #440 hole the rung was supposed to close.

This doc names the smallest path to AC3 and leaves the implementation
to whoever holds `agar/server/` write scope.

## Shape

Two pieces:

1. **A build-flag path in `agar/server/`** that, when set, makes the DO
   drop every 7th input applied to the tick reducer. The flag is read
   ONCE at DO construction so a single fixture build runs broken
   end-to-end.
2. **A second Playwright project / CI job** that builds the agar Worker
   with the flag on, points the existing `multiplayer-convergence.spec.ts`
   at it, and asserts the suite goes **red** — specifically that the
   ordering invariant fails because `pureReplay(SEED, appliedLog) !==
   canonical` once the DO has silently dropped inputs out of band.

Production behavior is untouched: flag default OFF, env-gated, dead-stripped
in the main build.

## Env contract

Mirror `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md`'s four-mode
scheme. For AC3 only the `drop-every-7th` mode needs to ship; the
other three (`reorder`, `duplicate`, `stale-snapshot`) are deferred.

```
AGAR_DO_BREAK_MODE=drop-every-7th   # AC3 — the one that must land
AGAR_DO_BREAK_MODE=                  # unset / empty — production
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

## CI shape

Add ONE workflow job, e.g. `agar-multiplayer-fixture-redgreen`, that:

1. Builds the agar Worker with `AGAR_DO_BREAK_MODE=drop-every-7th`.
2. Runs `agar/e2e/multiplayer-convergence.spec.ts` against that build.
3. Asserts the job exits **non-zero** — the spec MUST go red. Use
   `! npx playwright test ...` or `continue-on-error: true` + a follow-up
   step that fails when the prior step succeeds.
4. The existing green job (against main DO) stays as-is.

Both polarities together are the merge gate. A change that breaks
either side fails CI.

## What this is NOT

- Not a per-test env knob. The fixture is a separate Worker BUILD,
  not a runtime toggle, so the broken path is dead-stripped from prod
  bundles.
- Not a randomized chaos test. Exactly every 7th input drops,
  deterministically, so the failure mode is reproducible.
- Not a broadening of `multiplayer-convergence.spec.ts`. The same file
  runs against both polarities — that's the whole point.

## Affected paths

- `agar/server/worker.ts` — read `AGAR_DO_BREAK_MODE` once at DO ctor;
  drop-every-7th branch in the apply path.
- `agar/server/reducer.ts` — read-only reference; the drop is a
  callsite decision, not a reducer change.
- `.github/workflows/<existing-agar-e2e>.yml` or sibling — add the
  red-polarity job. Implementer picks the right workflow file.
- `agar/e2e/multiplayer-convergence.spec.ts` — read-only. Do NOT
  modify; the spec staying byte-identical across polarities IS the
  guarantee.

## Acceptance check

Three conditions, all must hold:

1. With the agar Worker built with no env, `multiplayer-convergence.spec.ts`
   passes (already true at `a146123`).
2. With the agar Worker built with `AGAR_DO_BREAK_MODE=drop-every-7th`,
   the **ordering invariant** test in the same file fails — specifically
   the `assertCanonicalEqualsReplay` assertion on the first connector.
3. CI runs both builds; the `agar-multiplayer-fixture-redgreen` job
   asserts the second build failed. Removing the broken-path code or
   the drop logic causes the red job to go green, which fails CI.

When all three hold, #234 closes.

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
- Don't add new test files. The polarity is asserted by RUN-level
  red/green, not by a second spec.

Refs #234 (AC3 only). Refs #180. Refs `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md`.

Refs #234

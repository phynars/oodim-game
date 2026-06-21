# The `fixture/desync-broken` merge-gate fixture (Refs #129, #180)

This document specifies the **failing-on-unfixed fixture** that the two-client
multiplayer e2e (#180) MUST satisfy as its merge gate. It is the contract the
agar-03 implementer builds toward — and the contract anyone reviewing the
agar-03 PR holds the diff to.

If you arrive here from #180 looking for "what does 'goes red against the
broken fixture' mean, mechanically?" — this file is the answer.

## Why this fixture exists

A two-client e2e that just checks "both browsers render something" is
decorative. The bugs that kill server-authoritative multiplayer — dropped
inputs, reordering under load, divergent reconnect replay — only surface
when the gate **actively distinguishes** a correct DO from a subtly broken
one. So we keep a deliberately broken DO in-repo and require the e2e suite
to detect it. No detection = no merge gate.

The harness already proves this pattern works at the primitive layer:
`.github/workflows/harness-self-test.yml` runs `npm run test:harness` under
four `HARNESS_BREAK_MODE` values (`off`, `unstable-order`, `drop-every-7th`,
`nan-blind`) and asserts that breaking a primitive flips its self-test red.
`fixture/desync-broken` lifts that same idea one layer up — from primitive
to product.

## Shape of the fixture

A single env var read by the agar Durable Object at construction time:

```
AGAR_DO_BREAK_MODE = "off" | "drop-every-7th" | "reorder-under-load" | "reconnect-amnesia"
```

Default `off`. Production / `main` MUST run with `off`. The fixture jobs in
CI flip it to each break mode in turn and assert the two-client e2e goes
red on each.

### The four modes — each targets one of #129's four assertions

| Mode | What the DO does wrong | Which #129 assertion catches it |
|---|---|---|
| `off` | Nothing — correct DO. | All four PASS. (Baseline; this is `main`.) |
| `drop-every-7th` | Server-side: silently discard every 7th client input message. | **Convergence** fails: client A predicts the input applied, server canonical never reflects it, structural equality on `window.__game.canonical` across the two contexts diverges. |
| `reorder-under-load` | When 2+ inputs arrive in the same tick, apply them in arrival order instead of `(tick, clientId, seq)` canonical order. | **Ordering invariant** fails: `pureReplay(tape, seed)` over the canonical order produces state ≠ DO's emitted snapshot. |
| `reconnect-amnesia` | On client reconnect, replay missed state from `lastAckTick + 2` instead of `lastAckTick + 1` (off-by-one in replay). | **Reconnect-replay equivalence** fails: the reconnected client's final canonical ≠ the never-disconnected client's. |

Note that `off` is what every other CI job runs. The fixture is NOT a
separate branch — it is the same code with the env var set. This means:
- No branch maintenance drift.
- No "the fixture got stale after the DO refactored" hazard.
- One PR changes both real code and the fixture's break-detection coverage
  atomically, because both live in the same file.

The implementer of agar-03 must wire `AGAR_DO_BREAK_MODE` into the DO at
exactly one place — guarded behind a single `if (mode !== "off")` switch in
the input-handling path — and document it inline.

## CI shape (what the workflow MUST do)

Mirror `.github/workflows/harness-self-test.yml`. Add (or extend) a workflow
that runs the agar two-client e2e four times, once per mode:

```yaml
strategy:
  matrix:
    mode: [off, drop-every-7th, reorder-under-load, reconnect-amnesia]
steps:
  - run: npm run test:e2e:agar
    env:
      AGAR_DO_BREAK_MODE: ${{ matrix.mode }}
```

Then **invert the expected exit code** for non-`off` modes — `off` must be
green, every other mode must be red. The clean way to express this is the
same pattern the harness self-test already uses: wrap the test command and
check `$?`. If `off` ever goes red, the merge is blocked. If any broken
mode ever goes green, the merge is blocked — the gate has gone decorative.

## What the agar-03 PR must include (acceptance checklist)

The two-client spec at `agar/e2e/<name>.spec.ts` must:
1. Open two Playwright `browser.newContext()` instances joined to one room.
2. Drive both from one deterministic tape via `driveTape(tape, { seed })`
   — zero `page.waitForTimeout` calls in the spec.
3. After ws-quiesce, call `expectConverge([pageA, pageB])` on
   `window.__game.canonical`.
4. Call `pureReplay(tape, seed)` over the same tape with the agar reducer
   and `structuralEquals` its output to the DO's emitted canonical.
5. Disconnect pageA mid-tape via `harness.disconnect(pageA)`, reconnect,
   then assert its final canonical equals pageB's.

The DO at `agar/<wherever>/do.ts` (or equivalent) must:
1. Honor `AGAR_DO_BREAK_MODE` env at construction.
2. Implement the four mode behaviors above in a single, isolated switch.
3. Default to `off` for any unrecognized value (fail-safe to correct).

The workflow at `.github/workflows/<name>.yml` must:
1. Run the two-client e2e under all four modes.
2. Expect `off` green; expect each of the other three red.
3. Fail the workflow if any expectation is violated.

## Why land this doc before agar-01 lands

The harness primitives are already in place (`e2e-shared/multiplayer/
harness.ts` — `orderTape`, `pureReplay`, `structuralEquals`, etc.). The
gap between "primitives exist" and "two-client merge gate works" is the
**fixture shape**: what does broken look like, and how does CI prove the
gate notices? Writing that down now means the agar-01/-02 implementer
designs the DO's input path with `AGAR_DO_BREAK_MODE` in mind from the
start, instead of bolting it on after agar-03's spec is already filed.

Refs #129 · Refs #130 · Refs #180.

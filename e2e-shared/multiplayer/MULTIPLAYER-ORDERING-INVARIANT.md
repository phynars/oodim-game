# Multiplayer ordering invariant — what a two-client merge gate must assert

**Companion to:** `CLIENT-TEST-SURFACE.md`, `FIXTURE-DESYNC-BROKEN.md`.
**Pin for:** any product that introduces server-authoritative state (Durable
Object, room, authoritative tick). agar is the first; this doc is the rung
that downstream products land on.

## TL;DR — the three layers, named

| Layer | Invariant | Who owns it | Where it lives |
|---|---|---|---|
| **L1 single-client determinism** | `canonical == pureReplay(SEED, appliedLog)` | `tick.spec.ts` (per product) | `agar/e2e/tick.spec.ts:155` |
| **L2 multi-client log equality** | `clientA.appliedLog === clientB.appliedLog` | `multiplayer-convergence.spec.ts` | *NEW per product* |
| **L3 multi-client convergence** | `clientA.canonical === clientB.canonical` | smoke or convergence spec | `agar/e2e/multiplayer-smoke.spec.ts` |

L1 + L2 ⇒ L3, but the gate must assert L2 explicitly. L3 alone is not
enough — a buggy server that diverges the per-connection apply-log stream
can still arrive at the same terminal state by accident; L2 catches it,
L3 does not.

## Why L2 is the rung, not L3

`expectConverge` (L3) compares terminal `canonical` snapshots. A server
that ships **different** ordered snapshot streams to different
connections — e.g. drops every 7th snapshot to client B, or applies a
late-joiner's inputs in arrival-order rather than canonical
`(tick, clientId, seq)` order — can still converge by coincidence:

- Two clients whose appliedLogs differ in order but agree in terminal
  count of each input → terminal `canonical` agrees if the reducer is
  commutative for those inputs. agar's `dir` reducer is **not** order-
  sensitive between same-direction inputs; under such a bug, L3
  greens and L2 reds.
- A late-joiner that gets a compacted snapshot starting at tick N
  while A has logged ticks 0..N → A's `appliedLog.length > B's`,
  L2 reds immediately. L3 may still green if A's intervening inputs
  reduce to a state B can re-derive from N.

L2 names the actual contract: **every client connected to one DO sees
one ordered authoritative stream.** Snapshot-time, snapshot-content,
snapshot-order — all three are gated by one structural equality check
on `appliedLog`.

## The agar gotcha — why `pureReplay(SEED, INPUTS) != canonical`

Counterintuitive but documented in `agar/e2e/tick.spec.ts:8-25`:

> "The protocol is latest-input-wins. Under CI tick jitter the 1:1
>  mapping from intent-send to tick-slot is inherently racy ... the
>  e2e asserts `pureReplay(seed, appliedLog) === canonical`."

So a draft acceptance criterion that says "both pages' canonical ==
pureReplay(tape, SEED)" is wrong for any product whose server collapses
multiple intents per tick — which is every product with a server-side
tick clock, i.e. all of them. **Always replay the appliedLog, never
the intent tape.** The intent tape is the input to the test; the
appliedLog is the server's confession of what it did with it.

## Required acceptance shape for a multiplayer convergence spec

A spec claiming to gate the multiplayer ordering invariant MUST:

1. Drive an asymmetric tape (different inputs from A and B, interleaved
   in tape order) via `driveTape([pageA, pageB], tape)`.
2. Quiesce to a tick boundary on both pages (the binding's `canonical`
   reader does this via `tickTo(tick)` — never `waitForTimeout`).
3. Assert **L2**: `appliedLogA` deep-equals `appliedLogB`. Structural
   equality, not just length. Use `structuralEquals` from
   `e2e-shared/multiplayer/harness.ts` (it handles arrays of primitives
   and `tick:clientId:seq` strings uniformly).
4. Assert **L3**: `expectConverge([pageA, pageB])`. Kept because L3
   failure with L2 success is informative — it means the *reducer* is
   non-deterministic (e.g. floating-point drift), not the *server*.
5. **No `waitForTimeout`** anywhere. `grep waitForTimeout` over the
   spec file returns nothing.

A reconnect-replay sub-test additionally:

6. `driveTape` part of the tape on both pages.
7. `disconnect(pageB)`. Drive more inputs on A only. `reconnect(pageB)`.
8. After WS quiesces, re-assert L2 and L3.

## DESYNC_BROKEN must target L2, not L3

The `FIXTURE-DESYNC-BROKEN.md` break modes were drafted before L1/L2/L3
were named. Update mapping:

| Break mode | Reds which layer? |
|---|---|
| `drop-every-7th` (server drops every 7th input on B's stream) | **L2** (logs diverge); L3 may still green |
| `reorder-under-load` (apply in arrival order, not canonical) | **L2**; L3 reds only if reducer is order-sensitive |
| `late-joiner-snapshot-compacted` (B joins at tick N, gets compacted snapshot) | **L2** (lengths differ); L3 may green |
| `swap-clientid` (server attributes A's input to B in B's snapshot) | **L2**; L3 reds if reducer reads clientId |

The CI red/green polarity job:
- main DO + spec → green (L1 ∧ L2 ∧ L3 all pass).
- broken DO + spec → red, **with the failed assertion naming L2**.
  A run that reds because of L3 alone with the broken DO indicates the
  break mode isn't actually exercising the multiplayer ordering bug
  class — re-pick the break mode.

## Where this lives in the harness

`expectAppliedLogEqual(pages)` belongs next to `expectConverge` in
`e2e-shared/multiplayer/playwright-binding.ts`. It is **not**
`expectOrderingInvariant` — that helper compares an in-page applied-log
against the canonical key order of an offline tape (the
`tick:clientId:seq` shape), which is a different invariant suitable
for products that ship canonical-key applied-logs. agar ships
`InputDir[]` applied-logs, so it uses `expectAppliedLogEqual`.

Both helpers can coexist. Products choose by their applied-log element
shape, which is documented in `CLIENT-TEST-SURFACE.md`:

- `InputDir[]` (or any per-tick collapsed shape) → `expectAppliedLogEqual`.
- `tick:clientId:seq` string keys → `expectOrderingInvariant`.

## Why this doc exists

#234 was filed with an acceptance criterion that conflated L2 with
`pureReplay(SEED, INPUTS)`. That's a gate that would have shipped
green on every correct AND incorrect server, because the intent tape
isn't what the server applies. Catching the shape bug before an
implementer codes to it is the difference between a merge gate that
catches bugs and one that performs catching bugs.

Future products with server-authoritative state should land their
two-client spec against L2 explicitly, with this doc as the reference.

_Refs #234, #180._

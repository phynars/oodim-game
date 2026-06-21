# CLIENT-TEST-SURFACE — the `window.__game` contract for multiplayer e2e

> **Status:** normative spec for the client-side surface the multiplayer
> harness binds against. Partially implemented by agar slice 2 (#179, merged).
> Full surface is required by agar slice 4 (#180 — two-client e2e + reconnect).
>
> Refs #129 (harness contract), #180 (two-client rung), #207 (this doc).

## Why this doc exists

`e2e-shared/multiplayer/harness.ts` ships the server-side / pure pieces
(`orderTape`, `pureReplay`, `structuralEquals`, `withFloatTolerance`,
`assertOrderingInvariant`) and declares the TYPES for the Playwright-bound
primitives (`DriveTape`, `ReadCanonical`, `ExpectConverge`, `Disconnect`,
`Reconnect`).

What those types bind against — the shape of `window.__game` in the
running client — was previously implicit. Agar slice 2 (#179) shipped
three fields ad-hoc (`canonical`, `appliedLog`, `sendInput`); slice 4
(#180) needs five more to assert two-client convergence + reconnect-replay.
This doc names all eight so the next implementer doesn't invent a ninth.

## The 8 fields

Any oodim-game multiplayer client (agar, and any future multiplayer
product) MUST install all eight fields on `window.__game` under the
test-mode guard described in §"Test-mode guard" below. Names are
normative — a PR that ships `state` instead of `canonical` is rejected.

### Read surface — harness READS these

| Field | Signature | Purpose | Status |
|---|---|---|---|
| `canonical` | `() => TState` | Returns the client's current canonical snapshot. Plain JSON-ish (no class instances, Maps, Sets). Called by `ReadCanonical` after ws-quiesce on a tick boundary. | ✓ shipped (#179) — `agar/src/main.ts` |
| `appliedLog` | `() => readonly string[]` | The `tick:clientId:seq` keys this client has APPLIED, in apply order. Feeds `assertOrderingInvariant`. | ✓ shipped (#179) — `agar/server/PROTOCOL.md` |
| `tick` | `() => number` | Current simulated tick. Used to quiesce on tick boundaries (no wallclock). | ✗ to-ship (slice 4 / #180) |
| `clientId` | `() => string` | The client's identity as the DO sees it. Used by `driveTape` to attribute scripted inputs across two pages. | ✗ to-ship (slice 4 / #180) |

### Drive surface — harness WRITES these

| Field | Signature | Purpose | Status |
|---|---|---|---|
| `sendInput` | `(input: unknown) => void` | Inject a `TapeEvent.input` payload as if local. Client sends it through its normal ws path; DO receives it with the client's id and the next seq. | ✓ shipped (#179) — `agar/src/main.ts:225` |
| `tickTo` | `(n: number) => Promise<void>` | Advance simulated time deterministically to tick `n`. Replaces every `waitForTimeout`. Resolves AFTER the client has applied all events through tick `n` and ws-quiesced. | ✗ to-ship (slice 4 / #180) |
| `disconnectWs` | `() => void` | Drop the ws connection but keep the page alive. Bound by `Disconnect`. | ✗ to-ship (slice 4 / #180) |
| `reconnectWs` | `() => Promise<void>` | Restore the ws and resolve after the DO has replayed missed state up to the current tick. Bound by `Reconnect`. | ✗ to-ship (slice 4 / #180) |

## Mapping to harness assertions

Each field exists to make exactly one assertion possible. Removing any
field breaks the named assertion:

| Assertion (from #129) | Required fields |
|---|---|
| **1. Seeded input tape, both clients** | `sendInput`, `tickTo`, `clientId` |
| **2. Canonical-state convergence** | `canonical`, `tick` (for quiesce boundary) |
| **3. Ordering invariant** | `appliedLog`, `canonical` |
| **4. Reconnect-replay equivalence** | `disconnectWs`, `reconnectWs`, `canonical` |

## Test-mode guard

All eight fields MUST be installed only under an explicit test-mode check:

```ts
if (import.meta.env.MODE === 'test' || import.meta.env.DEV) {
  (window as any).__game = { canonical, appliedLog, tick, clientId,
                             sendInput, tickTo, disconnectWs, reconnectWs };
}
```

A production build MUST NOT expose `window.__game`. The harness is for
deterministic merge-time assertions, not a runtime hook.

## Echo-only relaxation (scaffold-only slices)

For a slice that ships scaffold-without-DO (the agar-01 shape before
the DO existed): the four DRIVE-surface fields may be no-ops that echo
locally; `canonical()` returns the local echo; `appliedLog` returns
`[]`; `tick` returns `0`; `clientId` returns `'local'`. This lets the
spec file compile and the binding land in stages without faking a DO.

Once a real DO ships (agar slice 2, shipped via #179), the echo-only
relaxation no longer applies for that product.

## Reviewer enforcement

Any PR under `agar/`, `pacman/` (if it ever goes multiplayer), `doom/`
(ditto), or a new multiplayer product that adds or modifies a
multiplayer client surface MUST:

- Install ALL 8 fields named in §"The 8 fields", OR
- Install the echo-only relaxation under §"Echo-only relaxation" with
  an explicit comment naming this doc, OR
- Be **REQUEST_CHANGES** by the reviewer.

Field names are normative. A PR that ships `window.__game.state`
instead of `window.__game.canonical`, or `window.__game.fire` instead
of `window.__game.sendInput`, is **REQUEST_CHANGES** even if the
semantics are correct. Renaming a field after the fact is more
expensive than picking the contract name up front.

## Failing-on-unfixed grep gate

A `grep -E` over this file MUST return ≥ 8 matches for the canonical
field names — one per field. This is the in-tree receipt that the
contract is intact:

```
grep -nE 'window\.__game\.(canonical|appliedLog|tick|clientId|sendInput|tickTo|disconnectWs|reconnectWs)' \
  e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md
```

Eight named occurrences, one per field, follow as the receipt:

- `window.__game.canonical`
- `window.__game.appliedLog`
- `window.__game.tick`
- `window.__game.clientId`
- `window.__game.sendInput`
- `window.__game.tickTo`
- `window.__game.disconnectWs`
- `window.__game.reconnectWs`

Refs #129, #180, #207.

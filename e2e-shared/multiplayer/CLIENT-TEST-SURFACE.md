# Client test surface — `window.__game`

The multiplayer harness in `e2e-shared/multiplayer/harness.ts` ships the
server-side / pure pieces (`orderTape`, `pureReplay`, `structuralEquals`,
`withFloatTolerance`, `assertOrderingInvariant`) and declares TYPES for
the Playwright-bound primitives (`DriveTape`, `ReadCanonical`,
`Disconnect`, `Reconnect`).

This doc specifies the **client-side surface those primitives bind
against**: the shape every oodim-game multiplayer client must install on
`window.__game` for the harness to drive and read it deterministically.

Field names are **normative**. They are derived from what agar slice 2
(#179) already shipped (`canonical`, `appliedLog`, `sendInput`) plus the
five additional fields slice 4 (#180) needs to land. A PR that renames
any field is REQUEST_CHANGES.

## Read surface (4 fields — harness READS these)

The harness reads these to assert convergence, ordering, and replay.

- `window.__game.canonical: () => TState`
  Returns the client's current canonical state snapshot. Plain JSON-ish
  (no class instances, Maps, Sets — `structuralEquals` requires this).
  Called by `ReadCanonical` after ws-quiesce on a tick boundary.

- `window.__game.tick: () => number`
  Current simulated tick. Used to quiesce on tick boundaries (no
  wallclock). Monotonically non-decreasing.

- `window.__game.appliedLog: () => readonly string[]`
  The `tick:clientId:seq` keys this client has APPLIED, in apply order.
  Feeds `assertOrderingInvariant`. Cleared only on full page reload.

- `window.__game.clientId: () => string`
  The client's identity as the DO sees it. Used by `driveTape` to
  attribute scripted inputs and by `appliedLog` consumers to filter by
  origin.

## Drive surface (4 fields — harness WRITES these)

The harness writes these to inject input and control connection state.

- `window.__game.sendInput: (input: unknown) => void`
  Inject a `TapeEvent.input` payload as if local. The client then sends
  it through its normal ws path; the DO receives it with the client's
  id and the next seq. Already shipped by agar slice 2.

- `window.__game.tickTo: (n: number) => Promise<void>`
  Advance simulated time deterministically to tick `n`. Replaces every
  `waitForTimeout` in e2e specs. Resolves AFTER the client has applied
  all events through tick `n` AND ws-quiesced. Idempotent if already at
  or past `n`.

- `window.__game.disconnectWs: () => void`
  Drop the ws connection but keep the page alive (no reload, no state
  reset). Bound by `Disconnect`. After this returns, no further server
  messages will arrive until `reconnectWs` is called.

- `window.__game.reconnectWs: () => Promise<void>`
  Restore the ws and resolve **after** the DO has replayed missed state
  up to the current tick. Bound by `Reconnect`. The resolved promise is
  the harness's signal that reconnect-replay is complete and a canonical
  read is now valid.

## Echo-only relaxations for agar-01

Agar slice 1 is the scaffold-only slice before the Durable Object exists.
For that slice the four DRIVE-surface fields may be no-ops that echo
back to local state, and `canonical()` returns the local echo:

- `sendInput` → push directly into local applied state, no ws.
- `tickTo` → just step the local sim N ticks and resolve.
- `disconnectWs` / `reconnectWs` → no-op (`reconnectWs` resolves
  immediately).

This lets the spec file compile and the binding land in stages without
faking a DO. Once the DO ships, these must be replaced with the real
implementations — echo-only is a slice-1 affordance, not a long-term
shape.

## Reviewer enforcement

Any `agar/`, `pacman/` (if it ever goes multiplayer), `doom/` (likewise),
or new-product PR that adds a multiplayer client must install **all 8
fields**, OR echo-only versions guarded by an explicit
`import.meta.env.MODE === 'test'` check, or it is **REQUEST_CHANGES**.

Field names are normative:

- A PR that ships `window.__game.state` instead of `canonical` is
  rejected.
- A PR that ships `applyOrder` instead of `appliedLog` is rejected
  (slice 2 already owns `appliedLog`).
- A PR that ships `scriptInput` instead of `sendInput` is rejected
  (slice 2 already owns `sendInput`).

The eight normative names are:

```
window.__game.canonical
window.__game.tick
window.__game.appliedLog
window.__game.clientId
window.__game.sendInput
window.__game.tickTo
window.__game.disconnectWs
window.__game.reconnectWs
```

## Failing-on-unfixed check

A grep over this file must return at least 8 matches for the normative
field names (one per field):

```
grep -E 'window\.__game\.(canonical|tick|appliedLog|clientId|sendInput|tickTo|disconnectWs|reconnectWs)' \
  e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md
```

Merge-time enforcement of the actual client install is the next slice
(#180's binding work): the Playwright binding will fail to compile if a
field is missing once it lands. This doc is the contract those bindings
read.

## References

- `e2e-shared/multiplayer/harness.ts` — declares `DriveTape`,
  `ReadCanonical`, `Disconnect`, `Reconnect` types this surface satisfies.
- `agar/server/PROTOCOL.md` §69-70 — owns the shipped names `canonical`,
  `appliedLog`.
- `agar/src/main.ts` lines 13, 15, 225 — owns the shipped name
  `sendInput`.
- `agar/e2e/tick.spec.ts` lines 21, 71, 94, 117 — first harness
  consumer.
- Refs #129 (harness contract), #179 (slice 2, shipped 3 fields), #180
  (slice 4, needs the remaining 5).

Closes #207

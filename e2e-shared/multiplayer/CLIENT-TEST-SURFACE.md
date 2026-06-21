# Client Test Surface — `window.__game` contract

> **Status:** normative. This document is the contract between any oodim-game
> multiplayer client and the shared Playwright harness in
> `e2e-shared/multiplayer/harness.ts`. The field names below are non-negotiable.
> A PR that renames a field, omits a field, or installs a partial surface is
> **REQUEST_CHANGES** at review.

The multiplayer harness binds against exactly 8 fields installed on
`window.__game` by the client at boot (in test mode). Four are read by the
harness; four are written by the harness. Together they let a Playwright spec
drive two browser contexts deterministically, without `waitForTimeout`, and
assert convergence + ordering + reconnect-replay against a single seeded tape.

This file exists because issue #180 (the agar-03 two-client rung) already
references `window.__game.canonical` in its acceptance criteria, and that
name was an assumption until this document landed. Pin the contract here
once; every multiplayer client (agar/, future products) installs the same
shape; the harness binding slice writes against it without retrofit.

Refs #129, #180.

---

## Read surface

The harness READS these. The client must keep them up to date as ground
truth on every applied tick.

- `window.__game.canonical: () => TState`
  Returns the client's current canonical state snapshot. Plain JSON-ish
  (no class instances, no `Map`, no `Set`, no functions). Called by
  `ReadCanonical` after ws-quiesce on a tick boundary. The harness compares
  the value across two pages with `structuralEquals`, so reference identity
  is irrelevant but key order and value shape must be deterministic.

- `window.__game.tick: () => number`
  The current simulated tick (integer, monotonically non-decreasing). The
  harness quiesces on tick boundaries — never on wallclock. Two clients in
  the same room driven by the same tape must observe the same `tick()` at
  the same logical instant.

- `window.__game.applyOrder: () => readonly string[]`
  The `tick:clientId:seq` keys this client has APPLIED, in apply order. Feeds
  `assertOrderingInvariant`: the harness compares this list against
  `orderTape(tape)` and reports the first divergence. Must be the apply
  order, not the receive order — those differ during reconnect-replay.

- `window.__game.clientId: () => string`
  The client's identity as the DO sees it (the same id the server stamps
  on inbound inputs). Used by `driveTape` to attribute scripted inputs to
  the right page. The harness reads this AFTER the ws handshake completes;
  before then the value is undefined and the harness will retry.

## Drive surface

The harness WRITES these. The client owns the implementation; the harness
owns the call sites.

- `window.__game.scriptInput: (input: unknown) => void`
  Inject a `TapeEvent.input` payload as if it were a local input. The client
  then sends it through its normal ws path; the DO receives it with this
  client's id and the next seq. **Not a backdoor that bypasses the wire** —
  scripted inputs must traverse the same path as real inputs so the gate
  catches real-path bugs.

- `window.__game.tickTo: (n: number) => Promise<void>`
  Advance simulated time deterministically to tick `n`. Replaces every
  `waitForTimeout`. Resolves AFTER the client has applied all events through
  tick `n` AND ws-quiesced (no in-flight frames either direction). If `n` is
  in the past, resolve immediately. If the DO is disconnected (after
  `disconnectWs`), advance local simulated time but do not block on the wire.

- `window.__game.disconnectWs: () => void`
  Drop the ws connection but keep the page alive. Bound by `Disconnect`. The
  client must continue running its local tick loop so `tickTo` still works
  while disconnected. Any inputs queued via `scriptInput` during the
  disconnect period must be buffered and flushed on reconnect.

- `window.__game.reconnectWs: () => Promise<void>`
  Restore the ws and resolve AFTER the DO has replayed missed state up to
  the current tick. Bound by `Reconnect`. On resolve, the harness expects
  `applyOrder()` and `canonical()` on this page to match the never-
  disconnected peer's once both have advanced to the same `tick()`.

---

## Echo-only for agar-01

The agar-01 slice (#178, DO + websocket echo) shipped before a real
authoritative tick existed. For that scaffold-only stage — and for any
future game that wants to land the harness binding before the DO loop is
real — the four DRIVE-surface fields MAY be no-ops that echo back to local
state, and `canonical()` MAY return the local echo. This lets the spec
file compile and the binding land in stages without faking a DO.

Echo-only is allowed ONLY when guarded by an explicit test-mode check:

```ts
if (import.meta.env.MODE === "test") {
  installEchoOnlyTestSurface(window);
}
```

Echo-only is a temporary fixture, not a contract. A PR that ships
echo-only surfaces against a slice where the DO is supposed to exist
(agar-02 and later) is REQUEST_CHANGES — at that point `canonical()` MUST
reflect server-authoritative state, not local echo, or the merge gate is
decorative.

---

## Reviewer enforcement

This section is normative for any reviewer (human or avatar) on a PR that
touches a multiplayer client.

- Any `agar/` PR, any future multiplayer-product PR, and any `pacman/` PR
  that ever goes multiplayer MUST install ALL 8 fields above — or
  echo-only versions guarded by `import.meta.env.MODE === "test"` — or
  the verdict is **REQUEST_CHANGES**.
- Field names are **normative**. A PR that ships `window.__game.state`
  instead of `window.__game.canonical`, or `window.__game.send` instead
  of `window.__game.scriptInput`, is REQUEST_CHANGES. Rename, then
  re-request review.
- A PR that installs only a subset (e.g. read surface but not drive
  surface) is REQUEST_CHANGES unless the issue it closes explicitly
  scopes to the read half and the drive half has a follow-up issue
  linked.
- A PR that adds a 9th field to `window.__game` for harness purposes is
  REQUEST_CHANGES — extend this document first, in a separate PR, so the
  contract stays one place.

The merge-time enforcement for this contract is twofold:
1. Reviewer rule above (catches missing/renamed at PR time).
2. #180's binding slice fails to compile if a field is missing once it
   lands (catches drift after the fact).

---

## Failing-on-unfixed self-check

This file is also a fixture. Running:

```sh
grep -E 'window\.__game\.(canonical|tick|applyOrder|clientId|scriptInput|tickTo|disconnectWs|reconnectWs)' \
  e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md
```

must return 8 or more matches — one per named field. A future edit that
drops a field name from this document will fail this check and the
binding slice will lose its contract anchor. Treat the grep as a CI
canary worth keeping.

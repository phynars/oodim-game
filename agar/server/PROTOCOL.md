# agar wire protocol — slice 4/4 (multi-client)

Authoritative server, naive snapshot render, N concurrent clients per
room. The client never owns position; it sends intents (with a
per-client `seq`) and renders whatever snapshot the server sent last.

## Connection

`GET /ws?seed=<u32>&clientId=<string>` with `Upgrade: websocket`.

- `seed` picks the room AND the PRNG seed for that room. Two sockets
  with the same `seed` land in the same Durable Object instance
  (`idFromName('match:' + seed)`) and see each other's positions.
- `clientId` names this socket inside the room. The DO uses it as the
  player's key in the roster and as the `clientId` component of every
  canonical event key (`tick:clientId:seq`). When omitted, the DO
  assigns the stable pseudo-id `_solo` — fine for single-client smoke
  tests, not for multi-client e2e.
- The e2e harness passes both fields explicitly so the canonical
  applied-key log is deterministic across runs.

## Server → client

```json
{ "type": "snapshot",
  "tick": 42,
  "players": {
    "A": { "x": 320, "y": 320 },
    "B": { "x": 332, "y": 320 }
  },
  "rng": 3735928559,
  "applied": ["41:A:5", "41:B:5", "42:A:6"] }
```

- Broadcast once per server tick (20Hz, fixed-step). The DO clock owns
  the cadence — the client's rAF does NOT pull ticks.
- `tick` is monotonic from 0 (the tick the DO has just committed when
  it broadcasts).
- `players` is the FULL roster: `{ [clientId]: { x, y } }`. A newly-
  joined socket's first snapshot already carries everyone in the room,
  which is what makes `expectConverge` between two contexts a
  meaningful structural-equality check.
- `rng` is the post-tick PRNG state. The e2e asserts the offline
  reducer reproduces this exact number — same end-to-end seed proof
  as slice 3.
- `applied` is the **per-socket delta** of canonical event keys
  applied since this socket's last broadcast. Each key is
  `${tick}:${clientId}:${seq}`. The client appends these to
  `window.__game.appliedLog`; the e2e harness's
  `expectOrderingInvariant` compares that log against the tape's
  canonical order. On the first snapshot after (re)connect the
  `applied` array carries the FULL log so the joining client rebuilds
  its `appliedLog` from zero.

## Client → server

```json
{ "type": "input", "dir": "left", "seq": 17 }
```

- `dir` ∈ `"none" | "up" | "down" | "left" | "right"`.
- `seq` is the client's monotonic per-client sequence number. It
  pairs with the DO-assigned `tick` to form the canonical event key
  `tick:clientId:seq`. Required for multi-client merge-gate runs;
  optional (defaults to a server-assigned monotonic counter) for the
  single-client smoke spec.
- The DO queues every input it accepts and drains them all at the
  next tick boundary, in canonical (clientId-lex, seq) order. No
  latest-input-wins collapse — slice 4 needs every input to appear in
  the canonical log so the ordering invariant is checkable.
- An input arriving for a socket that closed before the next tick is
  silently dropped on close (its pending queue goes with the
  `ClientCtx`).

## Determinism contract

For multi-client e2e: every event the DO applies appears in
`appliedLog` as `tick:clientId:seq`. Two contexts in the same room
see the same `players` roster, the same `rng`, and the same
`appliedLog` delta sequence — that's the convergence + ordering
invariant the rung exists to prove.

For single-client smoke: replay `appliedLog` through
`applyTickBatch(initialState(seed), events)` in tick order; the
terminal `players[clientId]` and `rng` match the DO's `canonical`
exactly.

The harness exposes the DO's latest snapshot at
`window.__game.canonical` and the canonical apply-order at
`window.__game.appliedLog` so the e2e can read and compare directly.

## Failing-fixture switch

`agar/server/fixture/desync-broken/worker.ts` is a byte-equivalent
copy of `agar/server/worker.ts` with a single `if` block that drops
every 7th accepted input. The two-client e2e goes RED against it
(missing canonical keys → ordering invariant fails) and GREEN against
this protocol — that's the receipt that the merge gate is
falsifiable. See `./fixture/desync-broken/README.md`.

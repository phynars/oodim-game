# agar wire protocol — slice 3/4

Authoritative server, naive snapshot render. The client never owns
position; it sends intents and renders whatever snapshot the server
sent last.

## Connection

`GET /ws?seed=<u32>` with `Upgrade: websocket`.

- `seed` is REQUIRED in slice 3 — it picks the PRNG seed for the match.
  The e2e harness passes a fixed seed so the offline reducer (`pureReplay`)
  produces the same terminal state as the DO. If omitted, the DO uses
  `1` (still deterministic, but not test-controlled).
- One DO instance per `seed` value (`idFromName(String(seed))`). Two
  clients with the same seed share state; with different seeds they
  don't see each other. Slice 4 generalises to room ids.

## Server → client

```json
{ "type": "snapshot",
  "tick": 42,
  "dir":  "right",
  "player": { "x": 320, "y": 320 },
  "rng":  3735928559 }
```

- Broadcast once per server tick (20Hz, fixed-step). The DO clock owns
  the cadence — the client's rAF does NOT pull ticks.
- `tick` is monotonic from 0 (the tick the DO is ABOUT to commit when
  it broadcasts; equivalently, the count of `step()` calls already
  applied).
- `dir` is the input direction the server APPLIED on this tick — the
  result of latest-input-wins collapsing all intents that arrived in
  the previous tick window (default `"none"` if nothing arrived). The
  client mirrors these into an applied-input log; the e2e replays the
  log through `pureReplay` to assert bit-exact determinism without
  caring which intent landed in which tick slot.
- `player` is the position the DO believes the (single) connected
  client occupies, in canvas pixels.
- `rng` is the post-step PRNG state. The e2e asserts the offline
  reducer reproduces this exact number — that's how we prove the seed
  is wired end-to-end (no `Math.random()` leaks in).

## Client → server

```json
{ "type": "input", "dir": "left" }
```

- `dir` ∈ `"none" | "up" | "down" | "left" | "right"`.
- The DO queues the latest intent and applies it on the NEXT tick.
  More than one intent arriving between ticks is collapsed to the last
  one — slice 3 is "latest-input wins", not an input queue with replay
  semantics. (Slice 4 may revisit this for prediction.)
- If the client sends nothing in a tick window, the DO ticks with
  `{ dir: "none" }`. Position holds; `tick` and `rng` still advance.

## Determinism contract

`pureReplay(seed, tape)` where `tape: InputIntent[]` and `tape[i]` is
the dir the SERVER applied at tick `i+1` → equals the DO's canonical
state after `tape.length` ticks. Bit-exact equality, not floating-point
tolerance — both sides walk the same `step()` function in the same
order with the same seed.

The harness exposes the DO's latest snapshot at
`window.__game.canonical` and the per-tick applied-dir log at
`window.__game.appliedLog` so the e2e can replay and compare directly.

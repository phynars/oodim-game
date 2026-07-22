# Architecture — agar (WIP)

> **Status: in development.** agar ships slice-by-slice (see
> [`../STATUS.md`](../STATUS.md)); this doc tracks the runtime boundaries
> that already exist and will grow as slices land. It exists so the
> studio-level architecture index
> ([`docs/plan/architecture/README.md`](../../docs/plan/architecture/README.md))
> has no dead ends — every game links to a `<game>/docs/ARCHITECTURE.md`.

## Runtime shape

agar is the repo's **server-authoritative multiplayer** runtime — the
third shape in the studio's runtime-boundaries table. The server, not the
client, owns game state; clients render snapshots pushed to them.

```
agar/
├── server/
│   ├── worker.ts      Cloudflare Worker + EchoRoom Durable Object
│   │                  (websocket endpoint; authoritative room state)
│   └── reducer.ts     Pure state-transition logic the Durable Object
│                      integrates server-side; the e2e harness replays
│                      the same reducer for assertions
├── src/
│   └── solo.ts        Client renderer driven by server snapshots pushed
│                      by EchoRoom over a websocket
├── e2e/               Playwright specs (state assertions, never pixels)
├── playwright.config.ts  Harness boots (1) vite for the client and
│                      (2) `wrangler dev` at :8787 hosting the Worker +
│                      EchoRoom Durable Object
└── docs/
    ├── ARCHITECTURE.md         (this file)
    └── persistence-epic-plan.md  Durable Object persistence plan
                                 (DurableObjectState wiring)
```

## Server boundary

- `agar/server/worker.ts` exports the Worker fetch handler and the
  `EchoRoom` class (`implements DurableObject`), bound via the
  `ECHO_ROOM: DurableObjectNamespace` env binding.
- `agar/server/reducer.ts` keeps state transitions pure so the same
  logic is testable outside the Durable Object.
- Persistence (making `DurableObjectState` load/store room state) is
  planned in [`persistence-epic-plan.md`](./persistence-epic-plan.md).

## Verification contract

Same studio-wide rule as every game: **state assertions, not pixel
diffs**. The Playwright harness runs a real WebSocket round-trip through
`wrangler dev` — browser contexts must converge on the same
authoritative snapshot, and the harness times out red if the round-trip
doesn't happen.

## When to update this file

- A new slice lands that changes the server/client boundary.
- The persistence epic changes how `EchoRoom` stores state.
- The e2e harness contract changes (ports, processes, state contract).

# agar — Architecture (WIP)

> Status: **in development** — agar ships slice-by-slice; this doc tracks
> the runtime boundaries that already exist. Deep per-slice design lives
> in the sibling docs in this directory (see "Slice docs" below).
> For the studio-level view, start at
> [`docs/plan/architecture/README.md`](../../docs/plan/architecture/README.md).

## Runtime shape

agar is the repo's **server-authoritative multiplayer** game — the third
runtime shape in the portfolio (alongside 2D-canvas single-player and
true-3D WebGL single-player). The server, not the client, owns the
canonical world state.

```
agar/
├── src/            → browser client (vite; window.__game state contract)
├── server/         → Cloudflare Worker + Durable Object (authoritative sim)
│   └── worker.ts   → DO class `EchoRoom`, bound as `ECHO_ROOM`
├── e2e/            → Playwright specs driven through real `wrangler dev`
└── docs/           → this file + per-slice design docs
```

## Server: Durable Object loop

- `agar/server/worker.ts` hosts the Durable Object class `EchoRoom`
  (namespace binding `ECHO_ROOM`). Each room is one DO instance holding
  the authoritative world.
- Clients connect over **WebSocket**; the DO broadcasts periodic
  **snapshots** of the canonical state. Clients never simulate
  authoritatively — they apply snapshots.
- Persistence direction (DO storage across restarts) is planned in
  [`persistence-epic-plan.md`](./persistence-epic-plan.md).

## Client: snapshot-apply contract

- The client (`agar/src/main.ts`) exposes a `window.__game` state
  contract, same philosophy as the other games: **state assertions,
  never pixels**.
- `__game.canonical` is `null` until the first snapshot arrives; a
  `data-tick` DOM attribute advances per snapshot received.
- An `appliedLog` records applied snapshots so tests can verify
  convergence via pure replay rather than timing luck.
- `?mp=1` selects the WebSocket multiplayer client surface
  (see `agar/e2e/client-surface.spec.ts`).

## Test harness contract

CI runs a **real WebSocket round-trip through `wrangler dev`**: two
browser contexts join the same room and must converge on the same
authoritative snapshot, or the harness times out red.

- Smoke: `agar/e2e/multiplayer-smoke.spec.ts`
- Convergence + reconnect: `agar/e2e/multiplayer-convergence.spec.ts`
- Input-feel axis: `agar/e2e/feel/input-latency.spec.ts`
- Contract details: [`persistence-harness-contract.md`](./persistence-harness-contract.md)

## Slice docs (deeper reading)

- [`persistence-epic-plan.md`](./persistence-epic-plan.md) — DO storage epic
- [`persistence-harness-contract.md`](./persistence-harness-contract.md) — what the harness may assert
- [`desync-broken-fixture-plan.md`](./desync-broken-fixture-plan.md) — desync fixture design
- [`ivy-input-latency-axis.md`](./ivy-input-latency-axis.md) — input-latency measurement
- [`../STATUS.md`](../STATUS.md) — slice/issue status snapshot

## When to update this file

Update when a slice lands that changes a runtime boundary (new server
message type, new client contract field, new harness capability). Keep
slice-level detail in the slice docs; this file is the map, not the
territory.

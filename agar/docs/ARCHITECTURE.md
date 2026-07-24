# Architecture — agar (WIP)

> **Status: work-in-progress.** agar is being built slice-by-slice; this
> doc tracks the runtime boundaries that exist TODAY and will grow as
> slices land. It exists so the studio-level architecture index
> ([`docs/plan/architecture/README.md`](../../docs/plan/architecture/README.md))
> has no dead ends — read it before changing agar code, and update it
> when a slice changes a boundary.

## Runtime shape

agar is the repo's **server-authoritative multiplayer** game. Unlike
`pacman/`, `galaga/` (2D canvas single-player) and `doom/` (WebGL
single-player), correctness here involves a real network round-trip:

```
browser client (src/)  ⇄  WebSocket  ⇄  Cloudflare Durable Object (server/)
```

## Current boundaries

- **`agar/server/worker.ts`** — the Cloudflare Worker that hosts the
  `EchoRoom` Durable Object (`ECHO_ROOM` namespace binding), which owns
  the authoritative room state, maps sockets to player ids, and handles
  the WebSocket upgrade (`Upgrade: websocket` → 101 with a
  `WebSocketPair`). A test-only `/__test/top-score` route is handled
  before the upgrade path. Dev flow uses local `wrangler dev`; production
  flow is `wrangler deploy --env production` from `agar/wrangler.toml`.
- **`agar/src/multiplayer.ts`** — the WebSocket client. Opens the
  socket (seeded via query param), reconnects, and drives the shared
  `window.__game` state contract from server snapshots.
- **`agar/src/solo.ts`** — the offline single-player sim: no server,
  no WebSocket. Food, bots, eating, growth, death/respawn all run
  client-side.
- **Client selection** — `?mp=1` selects the multiplayer WebSocket
  client; without it the solo sim runs (see `agar/e2e/smoke.spec.ts`
  and `agar/e2e/client-surface.spec.ts`).

## Verification contract

Same studio rule as every game: **state assertions, not pixels.**

- Playwright (`agar/playwright.config.ts`, `agar/e2e/`) boots the
  Worker via `wrangler dev` and opens browser context(s) at `/agar/`.
- Specs assert on the `window.__game` state contract after a real
  WebSocket round-trip through the Durable Object; the harness times
  out red if the round-trip never converges.
- Multiplayer convergence: two browser contexts must observe the same
  authoritative snapshot.

## Layout

```
agar/
├── server/worker.ts     Worker + EchoRoom DO (prod re-exports it via src/server.ts)
├── src/                 client — multiplayer.ts (WS) / solo.ts (offline)
├── e2e/                 Playwright specs (state-contract assertions)
├── playwright.config.ts harness: wrangler dev + browser contexts
├── vite.config.ts       client build (published under /agar/)
└── wrangler.toml        DO Worker config (dev + production env)
```

## When to update this file

- A slice lands that adds/moves a runtime boundary (new server route,
  new client mode, protocol change).
- The state contract (`window.__game`) gains or renames fields that
  e2e specs assert on.
- The DO Worker deployment story changes (env/route/host assumptions
  in either `agar/wrangler.toml` for dev/CI or the repo-root
  `wrangler.jsonc` / `src/server.ts` for prod).

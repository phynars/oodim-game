# oodim-game

The oodim studio's portfolio of complete games shipped via the AIDLC loop
(issue → PR → review → merge, no human writing code).

## Shipped

- **pacman/** — 2D maze classic. Tile-based movement, ghost AI with
  scatter/chase/frightened modes, pellet eating, win/lose lifecycle.
- **galaga/** — 2D shoot-'em-up. Formation entry with eased Bézier
  paths, dives, boss capture, accuracy tally per stage.
- **doom/** — true-3D WebGL FPS. Hitscan combat, weapon switching,
  level traversal.
- **landing/** — index page for the portfolio at game.oodim.com.

## In flight

- **agar/** — server-authoritative real-time multiplayer (Cloudflare
  Durable Object + websockets). The studio's next rung: proving the
  AIDLC loop on software with shared state across clients. See #130
  (rollout) + #136 (scaffold) + #129 (multiplayer e2e harness).

## Architecture

Each game directory is self-contained: its own `vite` build, its own
`src/`, its own `e2e/` (Playwright). Each game publishes a state
contract on `window.__<game>` that the e2e suite asserts on — that's
how mechanics are verified at merge time, not just compilation.

The engine/renderer split is load-bearing: `engine.ts` owns mutable
state and runs the fixed-timestep `update()`; the renderer reads
state and draws. New affordances (juice, networking, persistence)
attach as pure-data sub-channels on the state object so the engine
stays a thin orchestrator.

## House conventions

- **Feel kit (juice):** screen-shake, hitstop, particles, squash,
  popups, flashes — all flow through a `FeedbackChannel` on the
  state object. Engine writes; renderer reads. Tone-adapted per
  game (Galaga punchy, Pac-Man graceful, Doom heavy). See #133
  (Galaga) and #138 (Pac-Man) for the canonical shape.
- **Easing vocabulary:** `easeOutCubic` for arc decel, exponential
  (×0.88/tick) for impact decay, back-out cubic-bezier for squash
  on hit, hard freeze for hitstop. Never `easeOutBack` on a Bézier
  parameter — it extrapolates along the end-tangent.
- **Tests are the gate:** every shipped mechanic has a deterministic
  e2e assertion against the state contract. Flaky timing patterns
  get refactored out before they bite the next product.

## Scripts

Per-project `dev` / `build` / `test` / `e2e` plus aggregate scripts
at the repo root that fan out to every game directory.

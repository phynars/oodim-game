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

## Architecture

Each game directory is self-contained: its own `vite` build, its own
`src/`, its own `e2e/` (Playwright). Each game publishes a state
contract on `window.__<game>` that the e2e suite asserts on — that's
how mechanics are verified at merge time, not just compilation.

The engine/renderer split is load-bearing: `engine.ts` owns mutable
state and runs the fixed-timestep `update()`; the renderer reads
state and draws.

## Scripts

Per-project `dev` / `build` / `test` / `e2e` plus aggregate scripts
at the repo root that fan out to every game directory.

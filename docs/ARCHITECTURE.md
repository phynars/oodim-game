# Architecture — oodim Game / Pac-Man

A small, intentional map so the studio builds *one* coherent game instead of
five overlapping fragments. Extend this as mechanics land; keep slices disjoint.

## Stack
- **Vite + TypeScript**, HTML5 **`<canvas>`** 2D rendering. No game framework —
  Pac-Man is small enough to own end to end, and it keeps the build in the
  toolchain the AIDLC CI already gates (`tsc` + `vite build`).
- Ships static to **https://game.oodim.com/pacman/** (Vite `base: "/pacman/"`).

## Module layout (`src/`)
```
main.ts            bootstrap: find #game canvas → new Engine → start()
game/
  types.ts         GameState + enums. ALSO the window.__pac test contract.
  engine.ts        the rAF loop: update() → render() → frame++. Owns state.
  maze.ts          (to add) tile grid, walls, pellet layout
  player.ts        (to add) Pac-Man position, movement, input intent
  ghosts.ts        (to add) 4 ghosts; chase/scatter/frightened/eaten AIs
  input.ts         (to add) keyboard + touch → direction intent
  hud.ts           (to add) score / lives / messages
```

## The state contract (load-bearing)
`window.__pac` mirrors `GameState` (see `game/types.ts`). The Playwright
gameplay harness (`e2e/pacman.spec.ts`) asserts on it — that's how we verify the
game *plays*, not just compiles. **Add fields as mechanics land; never remove a
field a test depends on.** Every gameplay PR ships its harness assertions
alongside the mechanic.

## Conventions
- Keep `update()` deterministic where possible (drive off `frame`) so the
  harness can step it predictably.
- One mechanic per PR; disjoint files. If two pieces of work touch the same
  file/region, they're one issue, not two (the AIDLC decomposer enforces this).
- Rendering reads state; it never mutates it.

# Galaga — architecture

The second product in the oodim Game portfolio. Self-contained under `galaga/`,
built independently of Pac-Man (its own vite config, tsconfig, and Playwright
harness), and published to **https://game.oodim.com/galaga/**.

## Module map

| File | Role |
|---|---|
| `galaga/index.html` | The shell: `#game` canvas (320×448 portrait) + the `[data-hud]` score/lives/stage strip. Loads `src/main.ts`. |
| `galaga/src/main.ts` | Bootstrap. Constructs the `Engine`, starts the loop, and mirrors `window.__galaga` → the HUD. Stays tiny. |
| `galaga/src/game/types.ts` | **The state contract.** `GameState` (mirrored to `window.__galaga`) is load-bearing — the e2e harness asserts on it. Add fields as mechanics land; never remove one a test depends on. |
| `galaga/src/game/engine.ts` | The engine. Currently the scaffold (fixed-step loop + starfield + READY→playing). Backlog slices grow it. |
| `galaga/e2e/galaga.spec.ts` | Gameplay harness — "CI for gameplay". Drives real input, asserts `window.__galaga` transitions. |

## The state contract (`window.__galaga`)

`status` · `tick` · `score` · `lives` · `stage` · `field{width,height}` ·
`player{x,y,alive,captured,dual}` · `enemies[]{id,kind,state,x,y}` ·
`bullets[]{x,y,from}` · `captureBeamActive`. The scaffold fills the boot/loop
fields; the rest are the contract the backlog implements behind.

## Why a scaffold, not the game

A greenfield product has nothing to anchor on. The scaffold is the one
human-seeded part: a buildable shell, the CI gate, and the verification harness
— just enough that the autonomous loop has somewhere to land. **Everything that
*is* Galaga is the backlog** (`agent-filed` issues, an ordered `blocked-by`
chain). Mirrors how Pac-Man started from a loop + maze. See the repo root
`docs/ARCHITECTURE.md` + `README.md` for the multi-product layout.

## Backlog (ordered; full classic incl. capture)

1. Player ship — horizontal movement + input (keyboard + touch)
2. Player firing + bullets
3. Enemy formation grid + entrance choreography
4. Diving attacks (enemies peel off and dive)
5. Collision (enemy fire + dives) → lives → respawn
6. Scoring + stage clear → next stage
7. **Boss Galaga + tractor-beam capture** (captures the player fighter)
8. **Rescue → dual fighter** (destroy the captor to reclaim → twin ships)
9. Challenging / bonus stage
10. Win-lose-gameover + stage reset
11. Touch controls + responsive mobile canvas
12. Polish + game-feel (sprites, sound, score popups)

Slices 7–8 are the climactic, harder-than-Pac-Man mechanic.

# Doom — architecture

The third product in the oodim Game portfolio, and the studio's **first true-3D
project**: a first-person shooter built on **three.js + WebGL** rather than the
2D canvas Pac-Man and Galaga use. Self-contained under `doom/`, built
independently (its own vite config, tsconfig, and Playwright harness), and
published to **https://game.oodim.com/doom/**.

> Note on naming: this is an *homage* FPS. All identifiers (enemy archetypes
> `imp`/`demon`/`baron`, weapon ids, level names) are original/generic — **no id
> Software trademarks or assets** are used.

## Module map

| File | Role |
|---|---|
| `doom/index.html` | The shell: a full-bleed `#game` canvas (the 3D viewport, 960×540 default, responsive landscape) + the `[data-hud]` health/armor/score overlay. Loads `src/main.ts`. |
| `doom/src/main.ts` | Bootstrap. Constructs the `Engine`, starts the loop, and mirrors `window.__doom` → the HUD. Stays tiny. |
| `doom/src/game/types.ts` | **The state contract.** `DoomState` (mirrored to `window.__doom`) is load-bearing — the e2e harness asserts on it. Declares the WHOLE FPS contract upfront; add fields as mechanics land, never remove one a test depends on. |
| `doom/src/game/engine.ts` | The three.js engine. Currently the scaffold (WebGL scene + fixed-step loop + READY→playing + seeded enemy roster + the `__doomInternals` combat hooks). Backlog slices grow it. |
| `doom/src/game/input.ts` | Keyboard input (WASD + arrows + Space), exposed as a polled `InputSource` the engine samples once per fixed-step. |
| `doom/e2e/doom.spec.ts` | Gameplay harness — "CI for gameplay". Asserts the contract boots, **WebGL initializes headless**, the loop ticks, and the combat hooks drive deterministic outcomes. |

## The state contract (`window.__doom`)

`status` · `tick` · `score` · `stage` · `field{width,height}` ·
`player{x,y,z,yaw,pitch,health,armor,alive}` (the camera IS the player; `y` is
eye height) · `enemies[]{id,kind,x,y,z,hp,state}` ·
`projectiles[]{x,y,z,from}` · `pickups[]{id,kind,x,z,taken}` ·
`doors[]{id,x,z,open}` · `weapon{kind,ammo}`.

The scaffold fills the boot/loop fields plus a **seeded enemy roster** (so the
contract is non-empty and `forceHit` has a target); the rest are the contract
the backlog implements behind.

### Test-only hooks (`window.__doomInternals`)

Deterministic escape hatches so the harness never has to align aim/positions
through the simulation:

- `forceHit({enemyId?})` — damages the first live enemy (or `enemyId`) as if a
  player shot landed; lethal damage flips it to `'dead'` + awards its score.
- `forceDamage({amount?})` — reduces player health (armor soaks a fraction
  first); lethal damage flips `alive=false` and arms the terminal lifecycle.
- `forcePickup({id?})` — marks a pickup taken + applies its effect.

## WebGL in headless CI

This is the make-or-break for a true-3D product: the merge gate is a Playwright
harness running in **headless Chromium**, where hardware WebGL is unavailable.
Two rules keep it green:

1. **Force software WebGL (SwiftShader).** `doom/playwright.config.ts` launches
   Chromium with:

   ```
   --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist
   ```

   ANGLE backed by SwiftShader provides a real WebGL/WebGL2 context with no GPU.
   `--enable-unsafe-swiftshader` opts into SwiftShader on Chromium builds that
   otherwise gate it behind a flag; `--ignore-gpu-blocklist` stops CI's
   blocklisted virtual GPU from disabling acceleration outright. The suite has a
   dedicated test that asserts `canvas.getContext('webgl2'||'webgl')` is
   truthy — if that ever red-fails, the flags (or a Chromium bump) are the first
   suspect.

2. **Assert state, never pixels.** WebGL framebuffer reads are slow, flaky, and
   meaningless under software rendering. The harness reads the published
   `window.__doom` game state to verify the game *plays*; it never samples
   rendered pixels. Every backlog slice adds state assertions, not screenshots.

## Fixed-timestep determinism contract

The simulation advances on a **fixed 60 Hz timestep, decoupled from rendering**
(`engine.ts`: an accumulator drains `STEP_MS` chunks; the rAF loop calls
`update()` N times then `render()` once). The contract for every backlog slice:

- **No `Math.random` in the sim path** without a seeded RNG (use an
  index/tick-hashed PRNG like Galaga's starfield/fire code if randomness is
  needed).
- **No wall-clock reads in `update()`** — each step is a pure function of prior
  state + the once-per-tick input snapshot.
- `state.tick` only advances while `status === 'playing'`, so the harness can
  distinguish a started loop from the idle READY screen.

This is what lets the autonomous loop reproduce a failure deterministically and
gate merges on it.

## Why a scaffold, not the game

A greenfield product has nothing to anchor on. The scaffold is the one
human-seeded part: a buildable WebGL shell, the CI gate (incl. the headless-
WebGL proof), and the verification harness — just enough that the autonomous
loop has somewhere to land. **Everything that *is* Doom is the backlog**
(`agent-filed` issues, an ordered `blocked-by` chain). Mirrors how Pac-Man and
Galaga started from a loop + a minimal world. See the repo root
`docs/ARCHITECTURE.md` + `README.md` for the multi-product layout.

## Backlog (ordered; full FPS)

1. First-person movement — WASD strafe/forward + mouse-look (yaw/pitch)
2. Level geometry — walls, rooms, collision against the player
3. Weapon firing + projectiles (player shots)
4. Enemy AI — idle → chasing → attacking (line-of-sight + pathing)
5. Enemy attacks + projectiles → player damage → health/armor
6. Death + respawn / lives, win-lose-gameover + stage reset
7. Pickups — health / armor / ammo on the floor
8. Doors — proximity/trigger open-close
9. Multiple weapons + inventory switching
10. Scoring + stage clear → next level
11. Touch / mobile controls + responsive canvas
12. Polish + game-feel (textures, sprites, sound, muzzle flash, hit VFX)

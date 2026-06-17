# Note: ghost-glide-fix (impl pointer for #25)

Scratch note for whichever /code session picks up issue #25 — keeping
the map handy so the impl tick doesn't have to re-derive it.

## Where

- File: `src/game/engine.ts`
- Method: `renderGhosts()` (defined just after `renderPac`)

## What's wrong now

`renderGhosts()` iterates `state.ghosts`, which is the stripped
projection produced by `publicGhostView` in `src/game/ghost.ts:432`:

```ts
export function publicGhostView(g: GhostInternal): GhostState {
  return { name: g.name, x: g.x, y: g.y, mode: g.mode };
}
```

So the renderer only has integer tile coords. Position math:

```ts
const cx = ox + g.x * TILE + TILE / 2;
const cy = oy + g.y * TILE + TILE / 2;
```

That's the snap. Pac doesn't have this problem because `renderPac()`
reads `pac._progress` through a narrow cast on the public `pac` field
and interpolates along `pac.dir`.

## Fix shape

Read off the engine's internal roster (`this.ghosts: GhostInternal[]`)
instead of `state.ghosts`. Each `GhostInternal` already carries
`_progress: number` (advanced every tick in `tickGhost` at
`src/game/ghost.ts:393`) and `lastDir: Dir`.

Mirror `renderPac`:

```ts
const progress = g.status !== "out" ? 0 : g._progress;
let dx = 0, dy = 0;
switch (g.lastDir) {
  case "right": dx = 1; break;
  case "left":  dx = -1; break;
  case "down":  dy = 1; break;
  case "up":    dy = -1; break;
  // "none" and any house-bound dir: dx/dy stay 0.
}
const cx = ox + (g.x + dx * progress) * TILE + TILE / 2;
const cy = oy + (g.y + dy * progress) * TILE + TILE / 2;
```

The mode branch (frightened/eaten coloring + the FLASH_WINDOW logic)
stays identical — only the position derivation changes.

## Do not touch

- `publicGhostView` and the `GhostState` type — public contract for the
  e2e harness is integer tile coords; that's deliberate.
- `state.ghosts` republish in `update()` / `handleLevelWon` /
  `handlePacDeath` — no schema change.

## Acceptance

- Visual: ghosts glide between tile centers as smoothly as Pac at 60 Hz.
- `e2e/pacman.spec.ts` still green.
- `tsc` + `vite build` clean.

Refs #25

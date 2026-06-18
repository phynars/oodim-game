// Doom level geometry — slice #75. The arena is no longer a hard-coded square
// box: the playable space is encoded as a TILE GRID (walls + floor + ceiling),
// and the engine builds wall meshes + drives collision from THIS file. Future
// levels are added by appending another `LEVEL_*` constant and swapping
// `CURRENT_LEVEL` (or, later, indexing by `state.stage`).
//
// Conventions
//   - The grid is row-major: `cells[row][col]`.
//   - Row 0 is the NORTHERN edge of the arena (most-negative z).
//   - Column 0 is the WESTERN edge (most-negative x).
//   - Each cell is `TILE_SIZE` world units on a side.
//   - `1` = wall (solid; blocks the player), `0` = floor (walkable).
//   - The level is centered on world origin: a `cols × rows` grid spans
//     `cols * TILE_SIZE` wide × `rows * TILE_SIZE` deep, with x in
//     `[-W/2, +W/2]` and z in `[-D/2, +D/2]`.
//
// Why tiles (not BSP / not arbitrary polygons): an axis-aligned grid gives us
// O(1) collision (a point lookup), trivial mesh construction (one box per
// wall cell), and a level format a human can edit as ASCII art. Doom-the-
// game's geometry is richer; the studio's first level slice doesn't need to be.

import { FIELD_HEIGHT, FIELD_WIDTH, EYE_HEIGHT } from "./types";

/** World-unit size of one grid cell. 2u feels right for a player ~1.6u tall:
 *  corridors are ≥2u wide (passable with `PLAYER_RADIUS = 0.3`), and a 16×16
 *  grid at 2u/cell fills the existing 32×32 FIELD exactly. */
export const TILE_SIZE = 2;

/** Wall height (world units). The ceiling sits at y = WALL_HEIGHT, the floor
 *  at y = 0. Eye height (1.6u) sits comfortably between. */
export const WALL_HEIGHT = 3;

/** A level map: the grid + a player spawn (world-space x/z + facing yaw). */
export interface LevelMap {
  /** Cells in row-major order. cells[row][col] ∈ {0, 1}. All rows must have
   *  the same length. */
  readonly cells: ReadonlyArray<ReadonlyArray<0 | 1>>;
  /** Player spawn in world coordinates. The engine seeds the camera here. */
  readonly spawn: { x: number; z: number; yaw: number };
}

/** Level 1 — a simple rectangular arena with a perimeter wall, an interior
 *  pillar / dividing stub, and an open floor in front of the player so the
 *  seeded enemies + forceHit harness still have line of sight from spawn.
 *
 *  Reading the ASCII below: '#' = wall, '.' = floor, 'P' = spawn.
 *  16 cols × 16 rows = 32u × 32u, matching FIELD_WIDTH × FIELD_HEIGHT.
 *
 *      col:  0 1 2 3 4 5 6 7 8 9 A B C D E F
 *           ─────────────────────────────────
 *   row  0:  # # # # # # # # # # # # # # # #   (north wall)
 *        1:  # . . . . . . . . . . . . . . #
 *        2:  # . . . . . . . . . . . . . . #
 *        3:  # . . . . . . . . . . . . . . #
 *        4:  # . . . . . . # # . . . . . . #   (interior pillar pair)
 *        5:  # . . . . . . . . . . . . . . #
 *        6:  # . . . . . . . . . . . . . . #
 *        7:  # . . . . . . . . . . . . . . #
 *        8:  # . . . . . . . . . . . . . . #
 *        9:  # . . . . . . . . . . . . . . #
 *        A:  # . . . . . . . . . . . . . . #
 *        B:  # . . . . . . . . . . . . . . #
 *        C:  # . . . . . . . . . . . . . . #
 *        D:  # . . . . . . P . . . . . . . #   (spawn at col 7, row D=13)
 *        E:  # . . . . . . . . . . . . . . #
 *        F:  # # # # # # # # # # # # # # # #   (south wall)
 *
 *  The interior pillars at (row=4, col=7) and (row=4, col=8) give the e2e
 *  harness a KNOWN INTERIOR WALL CELL it can teleport adjacent to and prove
 *  collision blocks movement (not just the perimeter clamp). */
export const LEVEL_1: LevelMap = {
  // prettier-ignore
  cells: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // Spawn at grid cell (col=7, row=13) — south of the interior pillar pair at
  // row 4, with a clear corridor between. World-space: convert via cellCenter.
  // (col=7, row=13) → x = (7 + 0.5 - 8) * 2 = -1, z = (13 + 0.5 - 8) * 2 = +11.
  spawn: { x: -1, z: 11, yaw: 0 },
};

/** The active level. Future stage-switch lands behind this. */
export const CURRENT_LEVEL: LevelMap = LEVEL_1;

/** World-space center of grid cell (col, row), given the LEVEL_1-style
 *  origin-centered layout. */
export function cellCenter(
  map: LevelMap,
  col: number,
  row: number,
): { x: number; z: number } {
  const cols = map.cells[0].length;
  const rows = map.cells.length;
  const x = (col + 0.5 - cols / 2) * TILE_SIZE;
  const z = (row + 0.5 - rows / 2) * TILE_SIZE;
  return { x, z };
}

/** Inverse of cellCenter: which (col, row) does world-space (x, z) sit in? */
export function worldToCell(
  map: LevelMap,
  x: number,
  z: number,
): { col: number; row: number } {
  const cols = map.cells[0].length;
  const rows = map.cells.length;
  const col = Math.floor(x / TILE_SIZE + cols / 2);
  const row = Math.floor(z / TILE_SIZE + rows / 2);
  return { col, row };
}

/** Is grid cell (col, row) a wall? Out-of-bounds is treated as a wall — the
 *  player can never leave the map even if the perimeter row has a gap. */
export function isWallCell(map: LevelMap, col: number, row: number): boolean {
  const rows = map.cells.length;
  if (row < 0 || row >= rows) return true;
  const cols = map.cells[0].length;
  if (col < 0 || col >= cols) return true;
  return map.cells[row][col] === 1;
}

/** Would a disc of radius `radius` centered at world (x, z) overlap any wall?
 *  This is the collision predicate the engine uses for movement: we sample
 *  the four cardinal-extent points (x±r, z) and (x, z±r), which is exact for
 *  an axis-aligned grid as long as `radius < TILE_SIZE` (true for
 *  PLAYER_RADIUS = 0.3 vs TILE_SIZE = 2). Cheaper than a full sweep and
 *  enough to keep the player out of any wall cell. */
export function collidesWithWall(
  map: LevelMap,
  x: number,
  z: number,
  radius: number,
): boolean {
  const samples: Array<[number, number]> = [
    [x + radius, z],
    [x - radius, z],
    [x, z + radius],
    [x, z - radius],
  ];
  for (const [sx, sz] of samples) {
    const { col, row } = worldToCell(map, sx, sz);
    if (isWallCell(map, col, row)) return true;
  }
  return false;
}

/** All wall-cell (col, row) pairs in the level, for mesh construction. */
export function* iterateWallCells(
  map: LevelMap,
): Iterable<{ col: number; row: number }> {
  for (let row = 0; row < map.cells.length; row++) {
    for (let col = 0; col < map.cells[row].length; col++) {
      if (map.cells[row][col] === 1) yield { col, row };
    }
  }
}

/** Sanity check at module load: the level's outer dimensions match the
 *  published FIELD_WIDTH × FIELD_HEIGHT (so HUD/test code that reads
 *  `state.field` sees the same arena the geometry encodes). If a future
 *  level changes shape, update FIELD_WIDTH/HEIGHT or this assertion. */
const _cols = CURRENT_LEVEL.cells[0].length;
const _rows = CURRENT_LEVEL.cells.length;
if (_cols * TILE_SIZE !== FIELD_WIDTH || _rows * TILE_SIZE !== FIELD_HEIGHT) {
  // Throwing at import time surfaces the mismatch in CI rather than silently
  // letting the player walk through walls.
  throw new Error(
    `level.ts: grid ${_cols}×${_rows} @ ${TILE_SIZE}u != FIELD ${FIELD_WIDTH}×${FIELD_HEIGHT}`,
  );
}

/** Re-export so consumers don't need two imports. */
export { EYE_HEIGHT };

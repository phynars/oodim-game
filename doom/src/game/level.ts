// Level geometry — issue #75. Encodes the first stage as a small GRID map so
// walls and collision both flow from one source of truth, instead of the
// hard-coded arena-box clamp the scaffold used.
//
// The map is a row-major array of single-char cells. The grid sits centered on
// the origin in the XZ plane: cell (col, row) covers world-space
//   x ∈ [col*CELL - mapW/2, col*CELL + CELL - mapW/2]
//   z ∈ [row*CELL - mapH/2, row*CELL + CELL - mapH/2]
// Row 0 is the NORTH edge (most-negative z), the last row is SOUTH (+z). The
// player looks down -z, so a forward step from a southern spawn moves toward
// row 0.
//
// Cell glyphs:
//   '#' = solid wall  (blocks movement, builds a wall mesh)
//   '.' = floor       (walkable)
//   'S' = floor + spawn marker (exactly one)
//
// Engine + e2e both read THIS file. The acceptance check is two-pronged:
//   1. the player spawns inside bounds (on an 'S' cell, not the legacy clamp)
//   2. a known wall cell BLOCKS movement (per-axis collision against the map)

/** Side length of one grid cell in world units. With a 16-wide × 12-deep map
 *  the arena footprint is 32 × 24 u — close to the prior 32 × 32 scaffold so
 *  fog/far-plane reads unchanged. */
export const CELL = 2;

/** The level map. Outer ring is solid; a single interior pillar at (col=8,
 *  row=8) gives the e2e a known wall cell to push into from the south. Spawn
 *  'S' sits in the south-central corridor looking north (down -z) into the
 *  pillar. */
export const LEVEL_MAP: ReadonlyArray<string> = [
  "################",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#......#.......#",
  "#..............#",
  "#......S.......#",
  "################",
];

/** Width of the map in cells (columns). Derived from LEVEL_MAP[0]. */
export const MAP_COLS = LEVEL_MAP[0].length;
/** Height of the map in cells (rows). */
export const MAP_ROWS = LEVEL_MAP.length;

/** Arena footprint in world units — width = cols × CELL, depth = rows × CELL.
 *  Engine + types both read these so the floor mesh + the published
 *  state.field both reflect the map. */
export const MAP_WIDTH = MAP_COLS * CELL;
export const MAP_HEIGHT = MAP_ROWS * CELL;

/** Convert a cell (col, row) to the WORLD-space center of that cell. */
export function cellCenter(col: number, row: number): { x: number; z: number } {
  return {
    x: col * CELL + CELL / 2 - MAP_WIDTH / 2,
    z: row * CELL + CELL / 2 - MAP_HEIGHT / 2,
  };
}

/** Return the cell glyph at world-space (x, z), or '#' if outside the map.
 *  Treating off-map as solid means the bounds check + the wall check are the
 *  SAME predicate (isSolidAt below). */
export function cellAt(x: number, z: number): string {
  const col = Math.floor((x + MAP_WIDTH / 2) / CELL);
  const row = Math.floor((z + MAP_HEIGHT / 2) / CELL);
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return "#";
  return LEVEL_MAP[row][col];
}

/** True iff the cell containing (x, z) is solid. The only solid glyph is '#';
 *  everything else (floor '.', spawn 'S') is walkable. */
export function isSolidAt(x: number, z: number): boolean {
  return cellAt(x, z) === "#";
}

/** Player capsule collision against the map. Returns true iff a circle of
 *  radius `r` centered at (x, z) overlaps ANY solid cell. We sample the four
 *  cardinal extents of the circle — enough resolution for axis-aligned cells
 *  and a small radius (PLAYER_RADIUS = 0.3, CELL = 2). */
export function collidesAt(x: number, z: number, r: number): boolean {
  return (
    isSolidAt(x - r, z) ||
    isSolidAt(x + r, z) ||
    isSolidAt(x, z - r) ||
    isSolidAt(x, z + r) ||
    isSolidAt(x, z)
  );
}

/** Locate the spawn marker. Throws at construction if the map has no 'S' —
 *  there's no sensible default and a missing spawn would silently drop the
 *  player at the origin, which may itself be a wall. */
export function findSpawn(): { x: number; z: number } {
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = LEVEL_MAP[row];
    for (let col = 0; col < MAP_COLS; col++) {
      if (line[col] === "S") return cellCenter(col, row);
    }
  }
  throw new Error("level.ts: LEVEL_MAP has no 'S' spawn cell");
}

/** Enumerate every solid cell as a world-space center. The engine consumes
 *  this to build one box mesh per wall. */
export function walls(): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = LEVEL_MAP[row];
    for (let col = 0; col < MAP_COLS; col++) {
      if (line[col] === "#") out.push(cellCenter(col, row));
    }
  }
  return out;
}

/** Height of wall meshes in world units. Eye height is 1.6; 3 reads as a
 *  comfortable corridor ceiling clearance. */
export const WALL_HEIGHT = 3;

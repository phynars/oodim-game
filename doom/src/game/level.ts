// Level geometry — issues #75, #82. Encodes each stage as a small GRID map so
// walls + collision + doors + the level exit all flow from one source of
// truth. Stage 1 introduced by #75; stage 2 + door/exit cells added by #82
// (proximity-opening doors flip `doors[i].open` when the player is near, and
// reaching the exit advances `__doom.stage` and loads the next map).
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
//   'D' = door        (walkable; published in state.doors[]; opens by proximity)
//   'X' = level exit  (walkable floor; stepping on it advances the stage)
//
// Engine + e2e both read THIS file. Stages must each have a valid 'S' spawn
// and at least one 'X' exit so the game can ever advance.

/** Side length of one grid cell in world units. With a 16-wide × 12-deep map
 *  the arena footprint is 32 × 24 u — close to the prior 32 × 32 scaffold so
 *  fog/far-plane reads unchanged. */
export const CELL = 2;

/** Stage 1 — the first stage's map. Adds a door `D` two cells north of the
 *  spawn (in the corridor approaching the interior pillar) and a level exit
 *  `X` near the north end of the corridor (past the pillar). The doors+exit
 *  give #82's e2e two reachable landmarks from the spawn. */
const STAGE_1_MAP: ReadonlyArray<string> = [
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
  "#X...D.S.......#",
  "################",
];

/** Stage 2 — a simpler arena the player loads into after touching stage 1's
 *  exit. No interior pillar; new spawn, no exit yet (a future slice can add
 *  more stages). The e2e asserts `stage` incremented after the exit; reading
 *  this map is part of the same behavior — enemies/pickups reset because the
 *  engine reseeds on stage load. */
const STAGE_2_MAP: ReadonlyArray<string> = [
  "################",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#..............#",
  "#......S.......#",
  "################",
];

/** All stage maps, indexed by stage number minus 1. Stage numbers start at 1
 *  (matching `DoomState.stage`); the last entry is the final stage and the
 *  engine clamps further advances. */
const STAGE_MAPS: ReadonlyArray<ReadonlyArray<string>> = [
  STAGE_1_MAP,
  STAGE_2_MAP,
];

/** Mutable pointer to the currently-loaded stage map. The engine swaps this
 *  via `loadStage()` when the player crosses an exit cell, and all helpers
 *  below (cellAt, walls, findSpawn, doors, …) read THIS — so a single
 *  reassignment is the entire stage swap. */
let currentMap: ReadonlyArray<string> = STAGE_1_MAP;

/** Width of the current map in cells (columns). Derived from row 0. */
export function mapCols(): number {
  return currentMap[0].length;
}
/** Height of the current map in cells (rows). */
export function mapRows(): number {
  return currentMap.length;
}

/** Width of the map in cells (columns). Constant across stages by convention
 *  (all stages are 16 wide / 12 deep so the floor mesh + fog read identically),
 *  but exposed as a value for back-compat with #75's consumers. */
export const MAP_COLS = STAGE_1_MAP[0].length;
/** Height of the map in cells (rows). */
export const MAP_ROWS = STAGE_1_MAP.length;

/** Arena footprint in world units — width = cols × CELL, depth = rows × CELL.
 *  Engine + types both read these so the floor mesh + the published
 *  state.field both reflect the map. All stages share these dimensions. */
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
  if (col < 0 || col >= mapCols() || row < 0 || row >= mapRows()) return "#";
  return currentMap[row][col];
}

/** True iff the cell containing (x, z) is solid. Walls block; doors block
 *  ONLY when closed — the engine's per-tick door update keeps a set of OPEN
 *  door cells (see `isOpenDoorAt`) so collision can treat them as walkable.
 *  Floor/spawn/exit are always walkable. */
export function isSolidAt(x: number, z: number): boolean {
  const c = cellAt(x, z);
  if (c === "#") return true;
  if (c === "D") return !isOpenDoorAt(x, z);
  return false;
}

/** Doors that are currently OPEN (keyed by `${col},${row}`). The engine
 *  populates this each tick via `setOpenDoors()` from `state.doors[]` so
 *  `isSolidAt` and `collidesAt` can route around opened doors. Empty by
 *  default — a fresh map has every door closed. */
let openDoorCells: Set<string> = new Set();

/** Tell the level which door cells are currently open. The engine calls this
 *  every fixed-step after it recomputes door proximity, so collision picks up
 *  the new state. */
export function setOpenDoors(cells: ReadonlyArray<{ col: number; row: number }>): void {
  openDoorCells = new Set(cells.map((c) => `${c.col},${c.row}`));
}

/** Lookup helper used by isSolidAt: is the door cell containing (x,z) open? */
function isOpenDoorAt(x: number, z: number): boolean {
  const col = Math.floor((x + MAP_WIDTH / 2) / CELL);
  const row = Math.floor((z + MAP_HEIGHT / 2) / CELL);
  return openDoorCells.has(`${col},${row}`);
}

/** Convert a world-space (x,z) to the integer cell coords containing it.
 *  Returns null if (x,z) is outside the map. */
export function worldToCell(x: number, z: number): { col: number; row: number } | null {
  const col = Math.floor((x + MAP_WIDTH / 2) / CELL);
  const row = Math.floor((z + MAP_HEIGHT / 2) / CELL);
  if (col < 0 || col >= mapCols() || row < 0 || row >= mapRows()) return null;
  return { col, row };
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
  for (let row = 0; row < mapRows(); row++) {
    const line = currentMap[row];
    for (let col = 0; col < mapCols(); col++) {
      if (line[col] === "S") return cellCenter(col, row);
    }
  }
  throw new Error("level.ts: current map has no 'S' spawn cell");
}

/** Enumerate every solid wall cell as a world-space center. The engine
 *  consumes this to build one box mesh per wall. Door cells are NOT walls —
 *  they get their own mesh. */
export function walls(): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (let row = 0; row < mapRows(); row++) {
    const line = currentMap[row];
    for (let col = 0; col < mapCols(); col++) {
      if (line[col] === "#") out.push(cellCenter(col, row));
    }
  }
  return out;
}

/** Enumerate every door cell (`D`) with both its cell coords and world-space
 *  center. The engine seeds `state.doors[]` from this. */
export function doors(): Array<{ col: number; row: number; x: number; z: number }> {
  const out: Array<{ col: number; row: number; x: number; z: number }> = [];
  for (let row = 0; row < mapRows(); row++) {
    const line = currentMap[row];
    for (let col = 0; col < mapCols(); col++) {
      if (line[col] === "D") {
        const c = cellCenter(col, row);
        out.push({ col, row, x: c.x, z: c.z });
      }
    }
  }
  return out;
}

/** Enumerate every exit cell (`X`) as a world-space center. The engine
 *  checks per-tick whether the player's cell matches any of these. */
export function exits(): Array<{ col: number; row: number; x: number; z: number }> {
  const out: Array<{ col: number; row: number; x: number; z: number }> = [];
  for (let row = 0; row < mapRows(); row++) {
    const line = currentMap[row];
    for (let col = 0; col < mapCols(); col++) {
      if (line[col] === "X") {
        const c = cellCenter(col, row);
        out.push({ col, row, x: c.x, z: c.z });
      }
    }
  }
  return out;
}

/** Load the map for `stage` (1-indexed). Clears any prior open-door cache so
 *  the new stage's doors start closed. If `stage` exceeds the available
 *  stages, the LAST stage is loaded (the game has no further content; the
 *  engine should treat this as "won" / final-stage). Returns true iff a new
 *  map was loaded (i.e. the stage exists). */
export function loadStage(stage: number): boolean {
  const idx = Math.max(0, Math.min(STAGE_MAPS.length - 1, stage - 1));
  const next = STAGE_MAPS[idx];
  if (!next) return false;
  currentMap = next;
  openDoorCells = new Set();
  return stage >= 1 && stage <= STAGE_MAPS.length;
}

/** Total number of stages defined in this build. The engine clamps stage
 *  advancement here. */
export const TOTAL_STAGES = STAGE_MAPS.length;

/** Height of wall meshes in world units. Eye height is 1.6; 3 reads as a
 *  comfortable corridor ceiling clearance. */
export const WALL_HEIGHT = 3;

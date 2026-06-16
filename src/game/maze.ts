// Classic 28×31 Pac-Man maze, encoded as a string-grid constant.
//
// Each row is exactly COLS characters; each character is a tile:
//   '#' wall
//   '.' pellet
//   'o' power pellet
//   ' ' empty (corridors that ghosts/Pac traverse but hold no pellet —
//       e.g. ghost house, tunnel mouths, the row in front of the house)
//   '-' ghost-house door (rendered as a thin horizontal bar later)
//   'T' tunnel cell (left/right warp band; no pellet)
//
// The layout mirrors the arcade original: symmetric, four power pellets in
// the corners, a central ghost house, and horizontal tunnels on row 14.
// Subsequent slices will read this grid to spawn pellets, build collision,
// and place actors. This file owns ONE thing — the static layout — so the
// engine can stay ignorant of how the maze is authored.

export const COLS = 28;
export const ROWS = 31;

/** Tile size in CSS pixels. The canvas is 224×248 logical = 8px tiles. */
export const TILE = 8;

export type Tile = "#" | "." | "o" | " " | "-" | "T";

// prettier-ignore
export const MAZE: readonly string[] = [
  "############################", //  0
  "#............##............#", //  1
  "#.####.#####.##.#####.####.#", //  2
  "#o####.#####.##.#####.####o#", //  3
  "#.####.#####.##.#####.####.#", //  4
  "#..........................#", //  5
  "#.####.##.########.##.####.#", //  6
  "#.####.##.########.##.####.#", //  7
  "#......##....##....##......#", //  8
  "######.##### ## #####.######", //  9
  "     #.##### ## #####.#     ", // 10
  "     #.##          ##.#     ", // 11
  "     #.## ###--### ##.#     ", // 12
  "######.## #      # ##.######", // 13
  "TTTTTT.   #      #   .TTTTTT", // 14
  "######.## #      # ##.######", // 15
  "     #.## ######## ##.#     ", // 16
  "     #.##          ##.#     ", // 17
  "     #.## ######## ##.#     ", // 18
  "######.## ######## ##.######", // 19
  "#............##............#", // 20
  "#.####.#####.##.#####.####.#", // 21
  "#.####.#####.##.#####.####.#", // 22
  "#o..##.......  .......##..o#", // 23
  "###.##.##.########.##.##.###", // 24
  "###.##.##.########.##.##.###", // 25
  "#......##....##....##......#", // 26
  "#.##########.##.##########.#", // 27
  "#.##########.##.##########.#", // 28
  "#..........................#", // 29
  "############################", // 30
];

// Sanity: catch a typo in MAZE that would otherwise corrupt rendering /
// pellet counts silently. Cheap, runs once at module load.
if (MAZE.length !== ROWS) {
  throw new Error(`maze: expected ${ROWS} rows, got ${MAZE.length}`);
}
for (let r = 0; r < MAZE.length; r += 1) {
  if (MAZE[r].length !== COLS) {
    throw new Error(
      `maze: row ${r} has ${MAZE[r].length} cols, expected ${COLS}`,
    );
  }
}

/** Tile at (col, row). Out-of-bounds reads as a wall — convenient for AI. */
export function tileAt(col: number, row: number): Tile {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return "#";
  return MAZE[row][col] as Tile;
}

/** Count of pellets ('.') in the static layout — the boot pellet total. */
export function countPellets(): number {
  let n = 0;
  for (const row of MAZE) {
    for (const ch of row) {
      if (ch === ".") n += 1;
    }
  }
  return n;
}

/** Count of power pellets ('o'). Tracked separately for scoring later. */
export function countPowerPellets(): number {
  let n = 0;
  for (const row of MAZE) {
    for (const ch of row) {
      if (ch === "o") n += 1;
    }
  }
  return n;
}

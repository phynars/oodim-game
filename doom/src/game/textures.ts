// Procedural textures (issue #84) — paint into an offscreen canvas, wrap as
// THREE.CanvasTexture. Keeps the studio asset-autonomous: no .png/.jpg files
// ship with the build, no third-party art is referenced. Three small painters
// (wall, floor, ceiling) cover the surfaces the scaffold renders today; the
// shared `paintTo` helper is parameterized so new surface types are a single
// painter function away.
//
// Texturing is the dimmest possible: a base fill + a small amount of
// procedural noise/banding so flat surfaces don't read as solid color in
// engine. We deliberately AVOID Math.random in painters — the texture content
// must be stable across builds (deterministic CI assertions can read texture
// pixels later if needed), so we seed with a tiny linear-congruential PRNG
// derived from pixel coordinates.
//
// All textures repeat: walls tile across the cell, floor + ceiling tile across
// the arena. Repeat counts are picked so one tile is ~one world unit, which
// reads as a brick at WALL_HEIGHT=4 and as a floor flagstone at CELL=2.
import * as THREE from "three";

/** Side length of every painted texture canvas (square). 128 px is small
 *  enough to be cheap to generate and upload, large enough that the procedural
 *  detail reads at typical camera distances. Power of 2 so three.js can
 *  generate mipmaps without resizing. */
const TEXTURE_SIZE = 128;

/** Deterministic pseudo-random in [0, 1) keyed by integer (x, y). Avoids
 *  Math.random so the painted pixels are the SAME on every CI run + every
 *  machine — matches the deterministic-simulation discipline the engine uses
 *  for its fixed-step loop. Mulberry-32-style mix of x and y with a seed. */
function hash01(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

/** Allocate a square canvas + 2D context for painting. Uses
 *  OffscreenCanvas when available (workers / modern browsers); falls back to a
 *  document <canvas> for environments that lack it (jsdom in some test
 *  configs). Either way three.js can wrap the result in CanvasTexture. */
function makeCanvas(size: number): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (ctx) return { canvas, ctx };
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("textures: 2D context unavailable");
  return { canvas, ctx };
}

/** Wrap a painter's output in a CanvasTexture with tiling defaults sensible
 *  for repeated surfaces. Repeat counts are caller-supplied so the same base
 *  texture tiles correctly at very different surface scales (one cell of wall
 *  vs. the whole floor plane). */
function wrap(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  // colorSpace pinned to sRGB so the painted RGB values match what the eye
  // expects on the rendered surface (default since three r152).
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Wall texture: brick-ish banding — horizontal mortar lines with a slight
 *  per-brick value jitter. Reads as the grimy interior of the genre at
 *  typical viewing distance without leaning on any copyrighted art. */
export function makeWallTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(TEXTURE_SIZE);
  // Base fill — the cool gray-blue that matched the prior MeshStandard color.
  ctx.fillStyle = "#4a4a5a";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Brick rows: 4 rows of bricks across the canvas, alternating half-offset
  // to read as masonry. Each brick gets a tiny deterministic value jitter so
  // the wall doesn't look stamped.
  const rows = 4;
  const cols = 4;
  const brickH = TEXTURE_SIZE / rows;
  const brickW = TEXTURE_SIZE / cols;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : brickW / 2;
    for (let c = -1; c < cols + 1; c++) {
      const x = c * brickW + offset;
      const y = r * brickH;
      const jitter = hash01(c, r, 1) * 0.08 - 0.04; // ±0.04 lightness
      const v = Math.max(0, Math.min(1, 0.32 + jitter));
      const g = Math.floor(v * 255);
      ctx.fillStyle = `rgb(${g}, ${g}, ${Math.floor(g * 1.15)})`;
      // Inset by 1 px so mortar lines remain visible between bricks.
      ctx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
    }
  }

  // Subtle pixel-level noise on top so the bricks don't look smooth.
  const img = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % TEXTURE_SIZE;
    const py = Math.floor(i / 4 / TEXTURE_SIZE);
    const n = (hash01(px, py, 7) - 0.5) * 16;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // Walls are 4 units tall × 2 wide per cell — tile 1×2 so a brick row reads
  // at ~half a world unit (i.e. several bricks per cell).
  return wrap(canvas, 1, 2);
}

/** Floor texture: speckled flagstone — a darker base with deterministic
 *  per-pixel grit. Tiles densely across the arena so the player sees motion
 *  parallax against the floor as they walk. */
export function makeFloorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(TEXTURE_SIZE);
  ctx.fillStyle = "#2a2a38";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Pixel grit — every pixel jittered by a deterministic small amount.
  const img = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % TEXTURE_SIZE;
    const py = Math.floor(i / 4 / TEXTURE_SIZE);
    const n = (hash01(px, py, 13) - 0.5) * 32;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // One floor tile per ~2 world units across the arena. Caller is the
  // PlaneGeometry the size of the map, so the repeat is set up at material-
  // bind time (MAP_WIDTH/2 × MAP_HEIGHT/2) — these are defaults that get
  // overridden in engine.ts. Leave them at 1×1; engine.ts sets the real
  // repeat after construction.
  return wrap(canvas, 1, 1);
}

/** Ceiling texture: slightly lighter than the floor, less detail (the player
 *  rarely looks up). Same speckle method, different palette. */
export function makeCeilingTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(TEXTURE_SIZE);
  ctx.fillStyle = "#1f1f2a";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const img = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % TEXTURE_SIZE;
    const py = Math.floor(i / 4 / TEXTURE_SIZE);
    const n = (hash01(px, py, 23) - 0.5) * 18;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  return wrap(canvas, 1, 1);
}

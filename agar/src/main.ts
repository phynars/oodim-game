// Agar client entry — agar-00 scaffold slice.
//
// This is the minimum viable surface that the multiplayer chain (#130) can
// build on: a canvas, a 2D context, and the `window.__game` handle that e2e
// gates assert against. There is intentionally NO gameplay, NO websocket,
// NO tick — those land in agar-01 (echo) and agar-02 (server-authoritative
// convergence). Keeping this slice empty is the point: it unblocks parallel
// work on the harness primitives without committing to a server shape.
//
// The `canonical` field on `window.__game` is the future hook the server-sync
// slice will populate with the server's authoritative snapshot. Until then
// it's `null`, which is also the structural assertion e2e checks.

declare global {
  interface Window {
    __game: {
      /**
       * The server-authoritative world snapshot once agar-01/02 land.
       * `null` during the scaffold slice — having the field present (with
       * an explicit null) lets the harness assert structural readiness
       * before behavior is wired.
       */
      canonical: unknown | null;
    };
  }
}

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("agar: #game canvas missing from index.html");
}

// Paint once so the canvas isn't a transparent rectangle on first load —
// gives the WIP page a visible arena placeholder. No animation loop: the
// scaffold is deliberately static; agar-01 introduces the render loop.
const ctx = canvas.getContext("2d");
if (ctx) {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Subtle grid so the canvas reads as "arena, not yet running" rather
  // than "broken render". 64px cells over a 640×640 surface = 10×10.
  ctx.strokeStyle = "#14141c";
  ctx.lineWidth = 1;
  const step = 64;
  for (let x = step; x < canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = step; y < canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
}

// Expose the harness handle. `canonical: null` is the explicit scaffold
// signal — agar-01 will replace null with a snapshot type once the server
// shape exists.
window.__game = { canonical: null };

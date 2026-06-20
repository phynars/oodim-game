// agar — slice 1/4 (scaffold only).
//
// Mounts the #game canvas, draws ONE frame of centered "agar — in
// development" text, and exits. There is no game loop, no input, no
// network — that arrives in slices 2-4 (DO+ws echo → 20Hz authoritative
// tick → two-client e2e). The job of this file today is to give the
// portfolio a real slot that builds green and passes a smoke e2e.

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("agar: #game canvas not found");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("agar: 2d context unavailable");
}

// Solid background so the canvas reads as "intentional placeholder", not
// a blank/broken element. Picked to match the dark studio palette.
ctx.fillStyle = "#050505";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// One placeholder cell — the only visual cue this is the agar slot and
// not a generic "coming soon" page. Subsequent slices replace this with
// the real authoritative-state render.
ctx.fillStyle = "#80e6c1";
ctx.beginPath();
ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 36, 0, Math.PI * 2);
ctx.fill();

// Centered "agar — in development" text. ui-monospace mirrors the rest of
// the portfolio's in-game type so the slot looks like a sibling of pacman /
// galaga / doom, not a one-off page.
ctx.fillStyle = "#e8eaff";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = "600 28px ui-monospace, SFMono-Regular, Menlo, monospace";
ctx.fillText("agar", canvas.width / 2, canvas.height / 2 + 40);

ctx.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
ctx.fillStyle = "#9090a8";
ctx.fillText(
  "in development — multiplayer prototype",
  canvas.width / 2,
  canvas.height / 2 + 72,
);

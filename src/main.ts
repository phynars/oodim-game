// Bootstrap: find the canvas, hand it to the Engine, start the loop.
// All real behavior lives in src/game/*. This file stays tiny on purpose —
// see docs/ARCHITECTURE.md.
import { Engine } from "./game/engine";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#game canvas not found");
}

const engine = new Engine(canvas);
engine.start();

// HUD mirror. The DOM cells live in index.html (#hud > [data-hud=...]);
// we poll `window.__pac` once per animation frame and write the latest
// score/lives/level into the cells. Reading the contract (instead of
// hooking into the engine directly) keeps the HUD a strictly read-only
// consumer — same shape an external test or telemetry probe would use.
//
// The engine extends GameState at runtime with a `level` mirror (it's
// not yet on the published type; types.ts is out of scope for this
// slice). We read it through a narrow cast and fall back to 1 if absent.
const scoreEl = document.querySelector<HTMLElement>('[data-hud="score"]');
const livesEl = document.querySelector<HTMLElement>('[data-hud="lives"]');
const levelEl = document.querySelector<HTMLElement>('[data-hud="level"]');

if (scoreEl && livesEl && levelEl) {
  const tickHud = (): void => {
    const s = window.__pac;
    if (s) {
      const level = (s as typeof s & { level?: number }).level ?? 1;
      // Only assign when the rendered text actually changes — avoids
      // churn on the DOM for the (common) frames where nothing moved.
      const score = String(s.score);
      const lives = String(s.lives);
      const lvl = String(level);
      if (scoreEl.textContent !== score) scoreEl.textContent = score;
      if (livesEl.textContent !== lives) livesEl.textContent = lives;
      if (levelEl.textContent !== lvl) levelEl.textContent = lvl;
    }
    requestAnimationFrame(tickHud);
  };
  requestAnimationFrame(tickHud);
}

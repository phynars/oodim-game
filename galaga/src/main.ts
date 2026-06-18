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
// we poll `window.__galaga` once per animation frame and write the latest
// score/lives/stage into the cells. Reading the contract (instead of hooking
// the engine directly) keeps the HUD a strictly read-only consumer — the same
// shape an external test or telemetry probe uses.
const scoreEl = document.querySelector<HTMLElement>('[data-hud="score"]');
const livesEl = document.querySelector<HTMLElement>('[data-hud="lives"]');
const stageEl = document.querySelector<HTMLElement>('[data-hud="stage"]');
// GAME OVER overlay — toggled on/off based on window.__galaga.status. The
// overlay sits on top of the canvas (see index.html) and reads `status` +
// `score` from the same contract the HUD does. The element is the contract
// galaga/e2e/galaga.spec.ts asserts via the [data-overlay="gameover"]
// selector.
const gameoverEl = document.querySelector<HTMLElement>(
  '[data-overlay="gameover"]',
);
const finalScoreEl = document.querySelector<HTMLElement>(
  "[data-overlay-final-score]",
);

if (scoreEl && livesEl && stageEl) {
  const tickHud = (): void => {
    const s = window.__galaga;
    if (s) {
      const score = String(s.score);
      const lives = String(s.lives);
      const stage = String(s.stage);
      // Only assign when the rendered text changes — avoids DOM churn on the
      // (common) frames where nothing moved.
      if (scoreEl.textContent !== score) scoreEl.textContent = score;
      if (livesEl.textContent !== lives) livesEl.textContent = lives;
      if (stageEl.textContent !== stage) stageEl.textContent = stage;
      // GAME OVER overlay visibility tracks the terminal lifecycle states.
      // We show on 'lost' (the brief hold after the final fighter dies) and
      // 'gameover' (the terminal state) so the overlay paints continuously
      // through the transition rather than flashing.
      if (gameoverEl) {
        const showOverlay = s.status === "lost" || s.status === "gameover";
        if (showOverlay && gameoverEl.hasAttribute("hidden")) {
          gameoverEl.removeAttribute("hidden");
        } else if (!showOverlay && !gameoverEl.hasAttribute("hidden")) {
          gameoverEl.setAttribute("hidden", "");
        }
        if (finalScoreEl && finalScoreEl.textContent !== score) {
          finalScoreEl.textContent = score;
        }
      }
    }
    requestAnimationFrame(tickHud);
  };
  requestAnimationFrame(tickHud);
}

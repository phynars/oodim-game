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

// HUD mirror. The DOM cells live in index.html (#hud > [data-hud=...]); we poll
// `window.__doom` once per animation frame and write the latest health/armor/
// score into the cells. Reading the contract (instead of hooking the engine
// directly) keeps the HUD a strictly read-only consumer — the same shape an
// external test or telemetry probe uses.
const healthEl = document.querySelector<HTMLElement>('[data-hud="health"]');
const armorEl = document.querySelector<HTMLElement>('[data-hud="armor"]');
const ammoEl = document.querySelector<HTMLElement>('[data-hud="ammo"]');
const scoreEl = document.querySelector<HTMLElement>('[data-hud="score"]');

if (healthEl && armorEl && ammoEl && scoreEl) {
  const tickHud = (): void => {
    const s = window.__doom;
    if (s) {
      const health = String(s.player.health);
      const armor = String(s.player.armor);
      const ammo = String(s.weapon.ammo);
      const score = String(s.score);
      // Only assign when the rendered text changes — avoids DOM churn on the
      // (common) frames where nothing moved.
      if (healthEl.textContent !== health) healthEl.textContent = health;
      if (armorEl.textContent !== armor) armorEl.textContent = armor;
      if (ammoEl.textContent !== ammo) ammoEl.textContent = ammo;
      if (scoreEl.textContent !== score) scoreEl.textContent = score;
    }
    requestAnimationFrame(tickHud);
  };
  requestAnimationFrame(tickHud);
}

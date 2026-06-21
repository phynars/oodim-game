// Bootstrap: find the canvas, hand it to the Engine, start the loop.
// All real behavior lives in src/game/*. This file stays tiny on purpose —
// see docs/ARCHITECTURE.md.
import { Engine } from "./game/engine";
import { DAMAGE_FLASH_DECAY, HIT_FLASH_TICKS } from "./game/types";

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

// Overlay DOM (#91): title screen (status==='ready'), game-over (status===
// 'gameover'|'lost'|'won'), and a red hit-flash veil that fades while
// state.hitFlashTicks > 0. All read-only consumers of window.__doom — same
// shape as the HUD.
const titleEl = document.querySelector<HTMLElement>('[data-overlay="title"]');
const gameoverEl = document.querySelector<HTMLElement>(
  '[data-overlay="gameover"]',
);
const hitFlashEl = document.querySelector<HTMLElement>(
  '[data-overlay="hit-flash"]',
);
const finalScoreEl = document.querySelector<HTMLElement>(
  '[data-overlay="final-score"]',
);

if (healthEl && armorEl && ammoEl && scoreEl) {
  let lastTitleVisible: boolean | null = null;
  let lastGameoverVisible: boolean | null = null;
  let lastFlash = -1;
  let lastFinalScore = "";
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
      // Title overlay: shown only on the READY screen. Same pattern as the
      // HUD — strict read of state.status, no input handling here.
      const wantTitle = s.status === "ready";
      if (titleEl && lastTitleVisible !== wantTitle) {
        titleEl.style.display = wantTitle ? "flex" : "none";
        lastTitleVisible = wantTitle;
      }
      // Game-over overlay: shown on any terminal state.
      const wantGameover =
        s.status === "gameover" || s.status === "lost" || s.status === "won";
      if (gameoverEl && lastGameoverVisible !== wantGameover) {
        gameoverEl.style.display = wantGameover ? "flex" : "none";
        lastGameoverVisible = wantGameover;
      }
      if (finalScoreEl && wantGameover && score !== lastFinalScore) {
        finalScoreEl.textContent = score;
        lastFinalScore = score;
      }
      // Hit-flash overlay: opacity tracks hitFlashTicks with an EXPONENTIAL
      // decay curve (#205). The tick counter still drives lifetime (so the
      // engine contract is unchanged from #91), but the alpha mapping is
      // ×DAMAGE_FLASH_DECAY (0.85) per tick from peak — sharp BITE up
      // front, then a long tail. Curve shape (peak=HIT_FLASH_TICKS):
      //   tick 1 ≈ 0.85, tick 6 ≈ 0.38, tick 12 ≈ 0.14, tick 0 = 0.
      // The opacity is then scaled by the prior 0.5 cap so the overlay
      // never fully obscures the play field — matching #91's intent.
      if (hitFlashEl && s.hitFlashTicks !== lastFlash) {
        let op = 0;
        if (s.hitFlashTicks > 0) {
          // Ticks elapsed since peak (0 the tick after the pulse arms, up
          // to HIT_FLASH_TICKS-1 just before it expires). Using
          // HIT_FLASH_TICKS - hitFlashTicks gives 1, 2, ... — matching the
          // spec's curve where tick 1 ≈ 0.85.
          const t = HIT_FLASH_TICKS - s.hitFlashTicks;
          op = 0.5 * Math.pow(DAMAGE_FLASH_DECAY, t);
        }
        hitFlashEl.style.opacity = String(op);
        lastFlash = s.hitFlashTicks;
      }
    }
    requestAnimationFrame(tickHud);
  };
  requestAnimationFrame(tickHud);
}

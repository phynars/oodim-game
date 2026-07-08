// Bootstrap: find the canvas, hand it to the Engine, start the loop.
// All real behavior lives in src/game/*. This file stays tiny on purpose —
// see docs/ARCHITECTURE.md.
import { Engine } from "./game/engine";
import {
  DAMAGE_FLASH_DECAY,
  HIT_FLASH_TICKS,
  PICKUP_FLASH_DECAY_PER_TICK,
  PICKUP_FLASH_TICKS,
  PICKUP_KIND_TINT,
  PICKUP_STAT_POP_DECAY,
  PICKUP_STAT_POP_PEAK,
  PICKUP_STAT_POP_PEAK_TICK,
} from "./game/types";

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
const pausedEl = document.querySelector<HTMLElement>('[data-overlay="paused"]');
const gameoverEl = document.querySelector<HTMLElement>(
  '[data-overlay="gameover"]',
);
const hitFlashEl = document.querySelector<HTMLElement>(
  '[data-overlay="hit-flash"]',
);
const finalScoreEl = document.querySelector<HTMLElement>(
  '[data-overlay="final-score"]',
);
// Pickup-flash vignette (#230). A tinted edge gradient that fades over the
// pickup's flash window. The center stays clear (radial-gradient with a
// transparent inner stop in CSS) so the corridor is readable — the player's
// seeing the gift, not getting interrupted. Color is set per pickup kind
// via PICKUP_KIND_TINT.
const pickupFlashEl = document.querySelector<HTMLElement>(
  '[data-overlay="pickup-flash"]',
);
// Pickup MESSAGE slot (#281). One HUD line — "Patched up." / "Plate. Strap
// it on." / "More rounds." — written from `__doom.pickupMessage` and faded
// over the flash window. Same read-only consumer pattern as every other
// HUD element: state is truth, this just mirrors it.
const pickupMessageEl = document.querySelector<HTMLElement>(
  '[data-hud="pickup-message"]',
);

if (healthEl && armorEl && ammoEl && scoreEl) {
  let lastTitleVisible: boolean | null = null;
  let lastPausedVisible: boolean | null = null;
  let lastGameoverVisible: boolean | null = null;
  let lastFlash = -1;
  let lastFinalScore = "";
  // Cache the last-written pickup message so we don't churn textContent /
  // opacity each rAF when nothing moved (idle frames are common — the
  // message holds for ~24 ticks then sits null forever).
  let lastPickupMessage: string | null = "";
  let lastPickupMessageTicks = -1;
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
      // Pause overlay: shown only when paused. Strict read-only mirror of the
      // engine status, same as title/game-over.
      const wantPaused = s.status === "paused";
      if (pausedEl && lastPausedVisible !== wantPaused) {
        pausedEl.style.display = wantPaused ? "flex" : "none";
        lastPausedVisible = wantPaused;
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
      // Pickup-flash vignette + stat-pop (#230). Vignette alpha decays
      // exponentially from the moment the flash arms; the matching stat
      // readout (health/armor/ammo) scales 1.0 → PICKUP_STAT_POP_PEAK over
      // the first PICKUP_STAT_POP_PEAK_TICK ticks (linear ramp), then
      // exponentially returns to 1.0 over the remaining ticks. The two
      // halves of the curve land in one CSS transform per frame.
      if (pickupFlashEl) {
        if (s.pickupFlashTicks > 0 && s.pickupKindFlash) {
          // Ticks elapsed since arm: 0 at arm, rises to PICKUP_FLASH_TICKS-1.
          const t = PICKUP_FLASH_TICKS - s.pickupFlashTicks;
          const alpha = Math.pow(PICKUP_FLASH_DECAY_PER_TICK, t) * 0.35;
          pickupFlashEl.style.opacity = String(alpha);
          // Vignette tint via the radial-gradient's CSS variable (set in
          // index.html). Cheaper than rebuilding background-image strings
          // each frame.
          pickupFlashEl.style.setProperty(
            "--pickup-tint",
            PICKUP_KIND_TINT[s.pickupKindFlash],
          );
        } else if (pickupFlashEl.style.opacity !== "0") {
          // Resting state — overlay fully transparent. Guard with a string
          // compare so we don't churn the CSS engine when nothing changed.
          pickupFlashEl.style.opacity = "0";
        }
      }
      // Pickup MESSAGE slot (#281). Mirror `__doom.pickupMessage` into the
      // slot's textContent and fade opacity over the flash window. Same
      // exponential decay shape as the vignette (#230) so line and tint
      // breathe together — one beat, one voice. When the counter is at 0
      // we clear textContent (the line is GONE, not just transparent) so
      // the slot's aria-live region doesn't re-announce a stale line.
      if (pickupMessageEl) {
        if (s.pickupMessage !== lastPickupMessage) {
          pickupMessageEl.textContent = s.pickupMessage ?? "";
          lastPickupMessage = s.pickupMessage;
        }
        if (s.pickupMessageTicks !== lastPickupMessageTicks) {
          let op = 0;
          if (s.pickupMessageTicks > 0) {
            const t = PICKUP_FLASH_TICKS - s.pickupMessageTicks;
            op = Math.pow(PICKUP_FLASH_DECAY_PER_TICK, t);
          }
          pickupMessageEl.style.opacity = String(op);
          lastPickupMessageTicks = s.pickupMessageTicks;
        }
      }
      // Stat-pop on the matching readout. The scale lives on the
      // [data-hud=health|armor|ammo] cell directly via inline transform
      // (no GPU layer thrash — one transform per frame on one element).
      const statEls: Record<"health" | "armor" | "ammo", HTMLElement | null> = {
        health: healthEl,
        armor: armorEl,
        ammo: ammoEl,
      };
      for (const kind of ["health", "armor", "ammo"] as const) {
        const el = statEls[kind];
        if (!el) continue;
        let scale = 1;
        if (s.pickupKindFlash === kind && s.pickupFlashTicks > 0) {
          const t = PICKUP_FLASH_TICKS - s.pickupFlashTicks;
          scale =
            t <= PICKUP_STAT_POP_PEAK_TICK
              ? 1 + (PICKUP_STAT_POP_PEAK - 1) * (t / PICKUP_STAT_POP_PEAK_TICK)
              : 1 +
                (PICKUP_STAT_POP_PEAK - 1) *
                  Math.pow(PICKUP_STAT_POP_DECAY, t - PICKUP_STAT_POP_PEAK_TICK);
        }
        // Inline transform — only write when the value actually moved
        // (compare to the existing string) to keep idle frames cheap.
        const want = scale === 1 ? "" : `scale(${scale.toFixed(4)})`;
        if (el.style.transform !== want) el.style.transform = want;
      }
    }
    requestAnimationFrame(tickHud);
  };
  requestAnimationFrame(tickHud);
}

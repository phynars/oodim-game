import { expect, test, type Page } from "@playwright/test";

/**
 * Served-page feel gate: a player pointer action must visibly wake the
 * interaction-confirm channel. This deliberately never drives __game
 * input; __game is read only after the rendered controls receive the
 * clicks, and the CSS-var peak is captured by an in-page rAF sampler.
 *
 * WHICH GESTURE wakes the confirm envelope? The confirm channel fires
 * from `triggerKioskFeedback` (aftersign/main.js:3321), which is only
 * called by `deliverPacket` (aftersign/main.js:3691) — wired to
 * `#deliverButton`, NOT `#packetButton`. The packet-open tap advances
 * the beat to `packet-choice`; the DELIVERY tap on `#deliverButton` is
 * what wakes the 220ms confirm pulse. Sibling specs use the same
 * two-tap flow (`io-ledger-line-served.spec.ts:63/75`,
 * `durable-return-session-phone-playtest.spec.ts:134`).
 *
 * Constants are pinned against the shipped feel token
 * (`aftersign/src/interactionConfirmFeel.js` — `INTERACTION_CONFIRM_FEEL`,
 * consumed at `aftersign/main.js:653` as `CONFIRM_FEEDBACK` and spread
 * onto `state.interaction.confirmFeedback` at main.js:869-870 and
 * :3823-3828):
 *   durationMs: 220
 *   easing:     "easeOutCubic"
 *
 * ------- Why an in-page rAF sampler on the STATE MIRROR, and why we
 * assert off `reticleScale` (monotonic) instead of `hudShakeX` (wobbly) -------
 *
 * Two races, two fixes:
 *
 * 1. CDP round-trip race (#1768 draft 5, Soren):
 *    `page.evaluate(() => getComputedStyle(...))` round-trips 40-100ms
 *    on SwiftShader in CI and can miss the 220ms envelope entirely.
 *    Fix: read the envelope off `state.interaction.confirmFeedback`
 *    (the mirror `aftersign/main.js` writes on the same frame
 *    `.active` flips at :4171) INSTEAD of round-tripping through
 *    `getComputedStyle`. Same values, no CDP round-trip.
 *
 * 2. Frame-sampling race on a wobbly channel (#1768 draft 6→7, Soren):
 *    `hudShakeX = Math.round(wobble * hudShakePx)` where
 *    `wobble = falloff * sin(progress * π * 6)`
 *    (aftersign/src/interactionConfirmFeel.js:34-37). The sine crosses
 *    zero SIX times across the 220ms envelope; on SwiftShader at
 *    10-20fps the rAF sampler catches only 2-4 frames inside the
 *    envelope, and those frames can land on/near zero-crossings — so
 *    `peakShakeXAbs` reads 0 even though `.active` was true for the
 *    full 220ms. Fix: assert off `peakReticleScale`, which is
 *    monotonically `> 1` while the envelope is active:
 *      reticleScale = 1 + falloff * (reticleScalePeak - 1)
 *    and `falloff = 1 - easeOutCubic(progress) > 0` for every
 *    `progress < 1`. No zero-crossings, no frame-timing dependency —
 *    any live frame proves the HUD moved.
 *
 * The mirror keys the sampler reads (main.js writes them right after
 * `confirmFeedback.active = confirmProgress < 1`):
 *   confirmFeedback.hudShakeX     — same number stamped into --confirm-shake-x (wobbly; NOT asserted)
 *   confirmFeedback.hudLiftY      — same number stamped into --confirm-shake-y (wobbly; NOT asserted)
 *   confirmFeedback.reticleScale  — same number stamped into --confirm-reticle-scale (monotonic; ASSERTED)
 */

const WAIT_MS = 15_000;
const COLD_START_MS = 30_000;

// Mirror the sibling `waitForReady` shape used across
// `aftersign/e2e/*.spec.ts` — poll `window.__game.scene.ready` until
// the input adapters have attached before we synthesize any gesture.
async function waitForReady(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.scene?.ready === true),
      { timeout: WAIT_MS },
    )
    .toBe(true);
}

type ConfirmHighWater = {
  peakShakeXAbs: number;
  peakShakeYAbs: number;
  peakReticleScale: number;
  sampleCount: number;
  liveFrames: number;
  everActive: boolean;
  everDecayed: boolean;
  lastActive: boolean;
  lastFeedback: {
    active: boolean;
    durationMs: number;
    easing: string;
  } | null;
};

async function installConfirmHighWater(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & {
      __confirmHighWater?: ConfirmHighWater;
      __confirmHighWaterRafId?: number;
      __game?: {
        interaction?: {
          confirmFeedback?: {
            active: boolean;
            durationMs: number;
            easing: string;
            hudShakeX?: number;
            hudLiftY?: number;
            reticleScale?: number;
          };
        };
      };
    };
    // Reset if a prior test in the same worker installed one.
    if (typeof w.__confirmHighWaterRafId === "number") {
      cancelAnimationFrame(w.__confirmHighWaterRafId);
    }
    w.__confirmHighWater = {
      peakShakeXAbs: 0,
      peakShakeYAbs: 0,
      peakReticleScale: 0,
      sampleCount: 0,
      liveFrames: 0,
      everActive: false,
      everDecayed: false,
      lastActive: false,
      lastFeedback: null,
    };
    const highWater = w.__confirmHighWater!;
    const step = () => {
      highWater.sampleCount += 1;
      // #1768 draft 6 (Soren's REQUEST_CHANGES): read shake off the
      // envelope mirror on `state.interaction.confirmFeedback` — the
      // game writes it on the SAME frame `.active` flips (main.js
      // right after `confirmFeedback.active = confirmProgress < 1`)
      // and it holds the exact same `confirmEnvelope.hudShakeX` value
      // the CSS-var stamp uses at main.js:4159. No CDP round-trip
      // through `getComputedStyle`, so no render-timing race on
      // SwiftShader.
      const feedback = w.__game?.interaction?.confirmFeedback ?? null;
      const active = feedback?.active === true;
      const shakeX = typeof feedback?.hudShakeX === "number" ? feedback.hudShakeX : 0;
      const shakeY = typeof feedback?.hudLiftY === "number" ? feedback.hudLiftY : 0;
      const reticle = typeof feedback?.reticleScale === "number" ? feedback.reticleScale : 1;
      highWater.lastActive = active;
      if (feedback) {
        // Clone: the runtime mutates the same object in place across
        // frames (main.js writes .active/.remainingMs/.hudShakeX/…
        // every render tick), so we snapshot rather than retain the
        // live reference.
        highWater.lastFeedback = {
          active,
          durationMs: feedback.durationMs,
          easing: feedback.easing,
        };
      }
      if (active) {
        highWater.everActive = true;
        highWater.liveFrames += 1;
        const shakeXAbs = Math.abs(shakeX);
        const shakeYAbs = Math.abs(shakeY);
        if (shakeXAbs > highWater.peakShakeXAbs) highWater.peakShakeXAbs = shakeXAbs;
        if (shakeYAbs > highWater.peakShakeYAbs) highWater.peakShakeYAbs = shakeYAbs;
        if (reticle > highWater.peakReticleScale) highWater.peakReticleScale = reticle;
      } else if (highWater.everActive) {
        highWater.everDecayed = true;
      }
      w.__confirmHighWaterRafId = requestAnimationFrame(step);
    };
    w.__confirmHighWaterRafId = requestAnimationFrame(step);
  });
}

async function readConfirmHighWater(page: Page): Promise<ConfirmHighWater> {
  return page.evaluate(() => {
    const w = window as Window & { __confirmHighWater?: ConfirmHighWater };
    if (!w.__confirmHighWater) {
      throw new Error("confirm high-water was not installed");
    }
    return { ...w.__confirmHighWater };
  });
}

test.describe("AFTERSIGN delivery confirm feel", () => {
  test("a packet delivery gives the player a visible 220ms confirm pulse", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Absolute-relative path against the vite preview server. baseURL
    // is `http://localhost:4374/aftersign/` (aftersign/playwright.config.ts)
    // but relative `page.goto("/")` resolves to `http://localhost:4374/`
    // — the server root, which does NOT serve the aftersign app.
    // Sibling specs consistently `goto("/aftersign/…")`; match that
    // shape.  A fresh `?slot=` keeps each run on a clean save.
    const slot = `packet-confirm-feedback-played-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    // Step 1 — packet-open: tap `#packetButton` to advance the beat to
    // `packet-choice`. This gesture does NOT fire the confirm envelope
    // (see file header): triggerKioskFeedback is wired to deliverPacket
    // only. We tap it here to reveal `#deliverButton`, then install the
    // sampler and drive the delivery gesture.
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    await packetButton.click();

    // Step 2 — wait for the delivery control to appear (packet-choice
    // beat). Sibling specs (`io-ledger-line-served.spec.ts:70`,
    // `durable-return-session-phone-playtest.spec.ts:134`) use the same
    // `#deliverButton` selector for this beat.
    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toBeVisible({ timeout: WAIT_MS });

    // Install the in-page rAF sampler BEFORE the delivery click.  The
    // confirm envelope is 220ms and its rendered `--confirm-shake-x`
    // peak lives in the first ~100ms — the sampler must be running
    // before the gesture or the crest is gone by the time we start
    // reading (same race the sibling failure-sting spec documents).
    await installConfirmHighWater(page);

    await deliverButton.click();

    // Wait for the confirm pulse to have BOTH lit up AND decayed.  This is the
    // exact state contract at `aftersign/main.js:4170-4175`:
    // `confirmFeedback.active = confirmProgress < 1` flips false when
    // the 220ms envelope closes.  We poll the page-side accumulator
    // directly instead of racing CDP round-trips against the envelope.
    await expect
      .poll(
        async () => {
          const hw = await readConfirmHighWater(page);
          return hw.everActive === true && hw.everDecayed === true;
        },
        { timeout: WAIT_MS },
      )
      .toBe(true);

    const highWater = await readConfirmHighWater(page);

    // Feel-constant assertion: pinned against `INTERACTION_CONFIRM_FEEL`
    // (aftersign/src/interactionConfirmFeel.js), consumed at main.js:653
    // and spread onto state at main.js:869-870, 3823-3828.  We read
    // `lastFeedback` — the last snapshot the sampler captured while the
    // envelope was live — because the runtime mutates the same object
    // in place across frames.
    expect(highWater.lastFeedback).toMatchObject({
      durationMs: 220,
      easing: "easeOutCubic",
    });

    // The envelope actually MOVED the HUD.  Draft 7 (Soren's
    // REQUEST_CHANGES on draft 6): the mirror kills the CDP round-trip
    // race but NOT the frame-sampling race.  `hudShakeX` is
    // `Math.round(wobble * hudShakePx)` where
    // `wobble = falloff * sin(progress * π * 6)` — the sine crosses
    // zero six times across the 220ms envelope, and on SwiftShader CI
    // at ~10-20fps the rAF sampler catches only 2-4 frames inside the
    // envelope.  Those frames can land on/near zero-crossings, so
    // `peakShakeXAbs` reads 0 even though `.active` was true for the
    // full 220ms (CI red on drafts 1-6).
    //
    // Fix: assert off `peakReticleScale`, a MONOTONIC field of the
    // same envelope.  Per `aftersign/src/interactionConfirmFeel.js`,
    //   reticleScale = 1 + falloff * (reticleScalePeak - 1)
    // and `falloff = 1 - easeOutCubic(progress)`.  For every
    // `progress < 1` (i.e. every frame where `.active === true`),
    // `falloff > 0`, so `reticleScale > 1`.  No zero-crossings, no
    // frame-timing dependency — ANY live frame the sampler catches
    // proves the envelope moved.
    //
    // `> 1` is the structural floor: reticleScale peaks at
    // `reticleScalePeak = 1.08` but we don't pin the amplitude (that
    // would couple the test to the feel-token value).  What we prove
    // is "the HUD moved", which is the reviewer's exact ask.
    expect(highWater.peakReticleScale).toBeGreaterThan(1);
    expect(highWater.everActive).toBe(true);
    expect(highWater.everDecayed).toBe(true);
    expect(highWater.liveFrames).toBeGreaterThanOrEqual(1);
  });
});

declare global {
  interface Window {
    __game?: {
      scene?: {
        ready?: boolean;
        beat?: string;
      };
      interaction?: {
        confirmFeedback?: {
          active: boolean;
          durationMs: number;
          easing: string;
          hudShakeX?: number;
          hudLiftY?: number;
          reticleScale?: number;
        };
      };
    };
  }
}

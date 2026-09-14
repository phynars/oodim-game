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
 * ------- Why an in-page rAF sampler on the STATE MIRROR (not the CSS var) -------
 * The `--confirm-shake-x` CSS custom property is stamped from
 *   `confirmEnvelope.hudShakeX = Math.round(wobble * feel.hudShakePx)`
 * (aftersign/src/interactionConfirmFeel.js:48) where
 * `wobble = falloff * sin(progress * π * 6)`. Across the 220ms envelope
 * the sine crosses zero SIX times and the falloff decays to ~0.125 by
 * t≈110ms — so a `page.evaluate(() => getComputedStyle(...))` poll that
 * round-trips 40-100ms on SwiftShader in CI can land on a zero-crossing
 * OR past the t=220ms hard-reset at `aftersign/main.js:3857`. That's
 * not flake — it's structural, and #1768 draft 5 REQUEST_CHANGES from
 * Soren spelled out the fix: read the envelope off
 * `state.interaction.confirmFeedback` (the mirror `aftersign/main.js`
 * writes on the same frame `.active` flips at :4171) INSTEAD of
 * round-tripping through `getComputedStyle`. Same value, no render-
 * timing dependency.
 *
 * The mirror keys the sampler reads (main.js writes them right after
 * `confirmFeedback.active = confirmProgress < 1`):
 *   confirmFeedback.hudShakeX     — same number stamped into --confirm-shake-x
 *   confirmFeedback.hudLiftY      — same number stamped into --confirm-shake-y
 *   confirmFeedback.reticleScale  — same number stamped into --confirm-reticle-scale
 *
 * The in-page rAF loop still walks frame-by-frame (so we don't miss the
 * crest between two CDP probes), but each sample reads three plain
 * numbers off a JS object the game's own render tick just wrote —
 * which kills the SwiftShader race the reviewer called out.
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

    // The envelope actually MOVED the HUD.  Peak-abs is captured on
    // every rAF tick that saw `confirmFeedback.active === true`, so it
    // survives:
    //   • the six zero-crossings of `sin(progress * π * 6)` — we
    //     high-water the crest across all live frames, not one probe,
    //   • the `Math.round(wobble * hudShakePx)` snap-to-zero after
    //     t≈110ms — the peak is captured in the first quarter,
    //   • the main.js:3857 hard-reset — we sample DURING the envelope,
    //     not after.
    // Draft 6 (Soren's REQUEST_CHANGES on draft 5): the peak comes off
    // `confirmFeedback.hudShakeX` (the envelope mirror the game writes
    // next to `.active`), NOT `getComputedStyle(--confirm-shake-x)` —
    // same number, no CDP round-trip, no SwiftShader render-timing
    // race.
    // >= 1 is intentionally the floor: the rendered wobble crest is
    // `Math.round(wobble * feel.hudShakePx)` — up to ~feel.hudShakePx
    // — but we don't want to pin exact px counts (that couples the
    // test to the feel-token amplitude).  What we're proving is
    // "not zero" — the reviewer's exact ask.
    expect(highWater.peakShakeXAbs).toBeGreaterThanOrEqual(1);
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

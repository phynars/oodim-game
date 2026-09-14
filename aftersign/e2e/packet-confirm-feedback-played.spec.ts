import { expect, test, type Page } from "@playwright/test";

/**
 * Served-page feel gate: a player pointer action must visibly wake the
 * interaction-confirm channel. This deliberately never drives __game
 * input; __game is read only after the rendered control receives the
 * click, and the CSS-var peak is captured by an in-page rAF sampler.
 *
 * Constants are pinned against the shipped feel token
 * (`aftersign/src/interactionConfirmFeel.js` — `INTERACTION_CONFIRM_FEEL`,
 * consumed at `aftersign/main.js:653` as `CONFIRM_FEEDBACK` and spread
 * onto `state.interaction.confirmFeedback` at main.js:869-870 and
 * :3823-3828):
 *   durationMs: 220
 *   easing:     "easeOutCubic"
 *
 * ------- Why an in-page rAF sampler (not a CDP getComputedStyle poll) -------
 * The `--confirm-shake-x` CSS custom property is `Math.round(wobble * 10)px`
 * where `wobble = falloff * sin(progress * π * 6)` (see the packet-cancel
 * failure-sting sibling's header comment for the same shape on the failure
 * channel). Across the 220ms envelope:
 *   • the sine crosses zero SIX times (progress * π * 6 gives 6 half-cycles),
 *   • the exponential falloff decays to ~0.125 by t≈110ms, so past that the
 *     product rounds to 0 or ±1,
 *   • at t=220ms `aftersign/main.js:3857` HARD-RESETS the var back to `0px`.
 * A `page.evaluate(() => getComputedStyle(...))` poll round-trips 40-100ms
 * on SwiftShader in CI, so a two-probe poll can land on a zero-crossing OR
 * past the reset. That's not flake — it's structural, and Soren's #1768
 * REQUEST_CHANGES calls it out explicitly.
 *
 * Fix (same shape the sibling `packet-cancel-failure-sting-played.spec.ts`
 * already ships): install an in-page rAF loop BEFORE the gesture, walk the
 * envelope frame-by-frame in the page context, high-water the peak
 * `|--confirm-shake-x|` there, and read the accumulator ONCE after the
 * state mirror (`confirmFeedback.active`) has flipped back to false.
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
    const root = document.documentElement;
    const step = () => {
      highWater.sampleCount += 1;
      const style = getComputedStyle(root);
      const shakeXRaw = style.getPropertyValue("--confirm-shake-x").replace("px", "").trim();
      const shakeYRaw = style.getPropertyValue("--confirm-shake-y").replace("px", "").trim();
      const reticleRaw = style.getPropertyValue("--confirm-reticle-scale").trim();
      const shakeX = Number(shakeXRaw || "0");
      const shakeY = Number(shakeYRaw || "0");
      const reticle = Number(reticleRaw || "1");
      const feedback = w.__game?.interaction?.confirmFeedback ?? null;
      const active = feedback?.active === true;
      highWater.lastActive = active;
      if (feedback) {
        // Clone: the runtime mutates the same object in place across
        // frames (aftersign/main.js:4171-4172 writes .active/.remainingMs
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

test.describe("AFTERSIGN packet confirm feel", () => {
  test("a packet confirmation gives the player a visible 220ms confirm pulse", async ({ page }) => {
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

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });

    // Install the in-page rAF sampler BEFORE the click.  The confirm
    // envelope is 220ms and its rendered `--confirm-shake-x` peak lives
    // in the first ~100ms — the sampler must be running before the
    // gesture or the crest is gone by the time we start reading (same
    // race the sibling failure-sting spec documents).
    await installConfirmHighWater(page);

    await packetButton.click();

    // Wait for the sting to have BOTH lit up AND decayed.  This is the
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
    //   • the `Math.round(wobble * 10)` snap-to-zero after t≈110ms —
    //     the peak is captured in the first quarter of the envelope,
    //   • the main.js:3857 hard-reset — we sample DURING the envelope,
    //     not after.
    // >= 1 is intentionally the floor: the rendered wobble crest is
    // `Math.round(0..1 * 10)` = up to 10px, but we don't want to pin
    // exact px counts (that couples the test to SwiftShader render
    // timing).  What we're proving is "not zero" — the reviewer's
    // exact ask.
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
        };
      };
    };
  }
}

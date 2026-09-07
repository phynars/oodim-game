import { expect, test } from "@playwright/test";

// Feel numbers must match DEFAULT_FAILURE_STING_FEEL in the game engine.
// The sting is a 180ms envelope: hudShake wobble decays wobble→0 by t=180ms
// (main.js:3899-3904), CSS `--confirm-shake-x` / `--confirm-shake-y` are
// written from that live wobble, and `.failure-sting` opacity is driven from
// flashAlpha which also decays to 0. Iterations #1641-#1645 documented that
// a single-snapshot CSS read is ~3 CDP round-trips past sting start
// (~235ms on SwiftShader) — past the 180ms envelope — so the CSS values
// have already reset by the time Playwright reads them.
//
// Fix (Soren review on #1657):
//   1. Install an in-page rAF high-water sampler at gesture time that
//      records the PEAK |shakeX|, shakeY, and flash opacity observed
//      across every animation frame from cancel until decay. The
//      sampler runs synchronously inside the game's own rAF pump, so
//      it cannot miss the 180ms window regardless of CDP latency.
//   2. Poll-gate the `failureFeedback` read on `active === true` (not
//      just `lastAction`), and merge state + peak CSS reads into ONE
//      `page.evaluate` so the snapshot is atomic against rAF.
//   3. Use a fresh `?slot=` query param for save isolation — every
//      sibling spec does this.
const FAILURE_STING_FEEL = {
  durationMs: 180,
  hudShakePx: 8,
  hudDropPx: 2,
  flashAlpha: 0.34,
  easing: "easeOutQuad",
};

test.describe("packet cancel failure sting", () => {
  test("plays a visible 180ms sting when the player cancels the packet drag", async ({ page }) => {
    // Fresh slot — save-isolation requirement flagged by sibling specs
    // (aftersign-job-take-feel.playtest.spec.ts and friends).
    const slot = `packet-cancel-sting-${Date.now()}`;
    await page.goto(`/?slot=${slot}`);

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();

    // Install the in-page rAF high-water sampler BEFORE the gesture, so
    // it's already looping when the sting starts. It records the peak
    // |shakeX|, shakeY, and flash opacity across every animation frame,
    // then stops itself once the sting decays. This is exactly the
    // pattern Soren pointed at: "restore the in-page rAF high-water
    // sampler the old spec had — that's exactly what it was for."
    await page.evaluate(() => {
      const w = window as unknown as {
        __stingPeak?: {
          shakeX: number;
          shakeY: number;
          flashOpacity: number;
          frames: number;
          stopped: boolean;
        };
        __game?: {
          interaction?: { failureFeedback?: { active?: boolean } };
        };
      };
      w.__stingPeak = { shakeX: 0, shakeY: 0, flashOpacity: 0, frames: 0, stopped: false };
      const root = document.documentElement;
      const readNum = (name: string) =>
        Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
      let sawActive = false;
      let inactiveFrames = 0;
      const tick = () => {
        if (w.__stingPeak!.stopped) return;
        const sting = document.querySelector<HTMLElement>(".failure-sting");
        const shakeX = Math.abs(readNum("--confirm-shake-x"));
        const shakeY = readNum("--confirm-shake-y");
        const opacity = sting
          ? Number.parseFloat(getComputedStyle(sting).opacity) || 0
          : 0;
        if (shakeX > w.__stingPeak!.shakeX) w.__stingPeak!.shakeX = shakeX;
        if (shakeY > w.__stingPeak!.shakeY) w.__stingPeak!.shakeY = shakeY;
        if (opacity > w.__stingPeak!.flashOpacity) w.__stingPeak!.flashOpacity = opacity;
        w.__stingPeak!.frames += 1;
        const active = w.__game?.interaction?.failureFeedback?.active === true;
        if (active) sawActive = true;
        if (sawActive && !active) {
          inactiveFrames += 1;
          if (inactiveFrames > 3) {
            w.__stingPeak!.stopped = true;
            return;
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const buttonBox = await packetButton.boundingBox();
    expect(buttonBox, "packet button has a rendered hit target").not.toBeNull();

    const startX = buttonBox!.x + buttonBox!.width / 2;
    const startY = buttonBox!.y + buttonBox!.height / 2;

    // Real page.mouse events on the visible button — a genuine
    // player-caused drift-cancel, not a driven __game.input.* poke.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 34, startY, { steps: 5 });
    await page.mouse.up();

    // Poll-gate the state read on `active === true` (not just
    // lastAction), then read state + peak CSS in ONE page.evaluate so
    // the snapshot is atomic against the rAF pump. lastAction stays
    // "packet-cancelled" indefinitely, so gating on it alone lets the
    // read land post-decay.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = window as unknown as {
              __game?: {
                interaction?: {
                  lastAction?: string;
                  failureFeedback?: { active?: boolean };
                };
              };
            };
            return (
              w.__game?.interaction?.lastAction === "packet-cancelled" &&
              w.__game?.interaction?.failureFeedback?.active === true
            );
          }),
        { message: "failure sting fires and is live", timeout: 1000 },
      )
      .toBe(true);

    // Give the rAF sampler time to observe the peak of the envelope.
    // The envelope is 180ms; wait 220ms so decay has begun and the
    // sampler has captured the high-water mark from earlier frames.
    await page.waitForTimeout(220);

    const snapshot = await page.evaluate(() => {
      const w = window as unknown as {
        __game?: {
          interaction?: {
            failureFeedback?: {
              active?: boolean;
              kind?: string;
              durationMs?: number;
              hudShakePx?: number;
              hudDropPx?: number;
              flashAlpha?: number;
              easing?: string;
            };
          };
        };
        __stingPeak?: {
          shakeX: number;
          shakeY: number;
          flashOpacity: number;
          frames: number;
        };
      };
      const feedback = w.__game?.interaction?.failureFeedback;
      return {
        feedback: feedback
          ? {
              active: feedback.active,
              kind: feedback.kind,
              durationMs: feedback.durationMs,
              hudShakePx: feedback.hudShakePx,
              hudDropPx: feedback.hudDropPx,
              flashAlpha: feedback.flashAlpha,
              easing: feedback.easing,
            }
          : null,
        peak: w.__stingPeak ?? null,
      };
    });

    // Feel constants match the engine's DEFAULT_FAILURE_STING_FEEL
    // verbatim. `active: true` is safe here because we merged the read
    // into the same evaluate that captures the peak — but the peak is
    // the load-bearing check for "did the sting actually render".
    expect(snapshot.feedback).toMatchObject({
      kind: "packet-cancelled",
      ...FAILURE_STING_FEEL,
    });

    expect(snapshot.peak, "rAF sampler ran").not.toBeNull();
    expect(snapshot.peak!.frames).toBeGreaterThan(0);
    expect(snapshot.peak!.shakeX).toBeGreaterThan(0);
    expect(snapshot.peak!.shakeX).toBeLessThanOrEqual(FAILURE_STING_FEEL.hudShakePx);
    expect(snapshot.peak!.shakeY).toBeGreaterThanOrEqual(0);
    expect(snapshot.peak!.shakeY).toBeLessThanOrEqual(FAILURE_STING_FEEL.hudDropPx);
    expect(snapshot.peak!.flashOpacity).toBeGreaterThan(0);
    expect(snapshot.peak!.flashOpacity).toBeLessThanOrEqual(FAILURE_STING_FEEL.flashAlpha);

    // Envelope releases within its declared window.
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              (window as unknown as {
                __game?: {
                  interaction?: { failureFeedback?: { active?: boolean } };
                };
              }).__game?.interaction?.failureFeedback?.active ?? false,
          ),
        { message: "failure sting releases after its decay window", timeout: 1200 },
      )
      .toBe(false);
  });
});

declare global {
  interface Window {
    __game?: {
      interaction?: {
        lastAction?: string;
        failureFeedback?: {
          active?: boolean;
          kind?: string;
          durationMs?: number;
          hudShakePx?: number;
          hudDropPx?: number;
          flashAlpha?: number;
          easing?: string;
        };
      };
    };
  }
}

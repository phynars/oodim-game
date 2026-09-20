// #1854: Capture the target-loss prompt only after the game reports scene readiness.
// SwiftShader cold boot may replace boot-time DOM nodes before the played release,
// so every sampler frame re-queries `#targetLossPrompt` rather than caching a
// pre-boot reference (which was the peak==0 flake root cause).
//
// History anchor: #700 / #706 / #1751 / #1755 / #1758 / #1841 / #1854.
//
// The title of this test — "clears the aim reticle immediately and fades its
// prompt" — is a contract. Do NOT strip the aim-reticle / fade-to-zero /
// Io-voice assertions to quiet the flake; the played dimension IS the point
// (see #1854 scope: no test.skip, no test.fixme, no pure-lane conversion).
import { expect, test } from "@playwright/test";
import { IO_TARGET_LOSS_LINE } from "../src/ioVoice.js";

test("packet target loss clears the aim reticle immediately and fades its prompt", async ({ page }) => {
  // baseURL is `http://localhost:4374/aftersign/` (see playwright config).
  // `/` would resolve to the vite preview root, which does NOT serve the
  // aftersign bundle — `window.__game` never publishes and `scene.ready`
  // never flips. `packet-confirm-feedback-played.spec.ts` documents this
  // exact trap; keep the path anchored on the aftersign base URL.
  await page.goto("/aftersign/");
  await page.waitForFunction(
    () => window.__game?.scene?.ready === true,
    undefined,
    { timeout: 60_000 },
  );

  // Prompt must be mounted post-readiness. If it isn't, the runtime stamp
  // from `main.js` never landed and every downstream assertion is meaningless
  // — fail loudly here rather than let the sampler read a phantom 0.
  await page.evaluate(() => {
    const prompt = document.querySelector("#targetLossPrompt");
    if (!(prompt instanceof HTMLElement)) {
      throw new Error("#targetLossPrompt was not mounted after scene readiness");
    }

    let peak = 0;
    let stopped = false;
    let sawActive = false;
    let sawNeutralReticle = false;
    const sample = () => {
      if (stopped) return;
      // Re-query every frame — the boot may re-parent/replace the node
      // after `scene.ready` fires (root cause of the #1854 flake).
      const current = document.querySelector("#targetLossPrompt");
      if (current instanceof HTMLElement) {
        peak = Math.max(peak, Number(getComputedStyle(current).opacity));
      }
      const reticle = document.querySelector("#aimReticle");
      if (reticle instanceof HTMLElement) {
        if (reticle.getAttribute("data-target-loss-active") === "true") {
          sawActive = true;
          // "clears immediately" — during the envelope, the reticle's
          // transform is the neutral CSS default (no lingering aim skew).
          const t = getComputedStyle(reticle).transform;
          if (t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)") {
            sawNeutralReticle = true;
          }
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.__targetLossOpacityPeak = () => peak;
    window.__targetLossSawActive = () => sawActive;
    window.__targetLossSawNeutralReticle = () => sawNeutralReticle;
    window.__stopTargetLossOpacitySampler = () => {
      stopped = true;
    };
  });

  const packet = page.locator('[data-aftersign-tap-choice="packet"]');
  await packet.click();

  // (a) The envelope was observed — peak > 0.5 proves the fade played.
  await expect
    .poll(() => page.evaluate(() => window.__targetLossOpacityPeak?.() ?? 0))
    .toBeGreaterThan(0.5);

  // (b) The reticle went into target-loss-active state and its transform
  //     was neutral during the envelope ("clears the aim reticle immediately").
  await expect
    .poll(() => page.evaluate(() => window.__targetLossSawActive?.() === true))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__targetLossSawNeutralReticle?.() === true))
    .toBe(true);

  // (c) Io-voice contract from #1829 — the served DOM text equals the
  //     canonical constant, proving `main.js` stamped from `./src/ioVoice.js`.
  await expect(page.locator("#targetLossPrompt")).toHaveText(IO_TARGET_LOSS_LINE);

  // Stop the sampler and prove the prompt fades all the way back to 0
  // past the envelope — "fades its prompt" in the title.
  await page.evaluate(() => window.__stopTargetLossOpacitySampler?.());
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector("#targetLossPrompt");
          return el instanceof HTMLElement
            ? Number(getComputedStyle(el).opacity)
            : NaN;
        }),
      { timeout: 3000 },
    )
    .toBe(0);
  await expect(page.locator("#aimReticle")).toHaveAttribute(
    "data-target-loss-active",
    "false",
  );
});

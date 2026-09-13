import { expect, test } from "@playwright/test";

// #1723 — target-loss FEEL contract, played end-to-end on the served
// page. The player's press-and-release on `#packetButton` is the
// gesture that owns the "had a target → lost it" edge; the visible
// `#aimReticle` snaps to its neutral transform IN THE SAME FRAME as
// the release (no residue from a held target), while
// `#targetLossPrompt` fades linearly from 1 to 0 over the 100ms
// envelope authored in `targetLossFeedback.ts`.
//
// Selectors are the shipped ids in `aftersign/index.html`
// (`#aimReticle`, `#targetLossPrompt`) — NOT `#reticle`, which does
// not exist in the served markup. The prior draft of this spec used
// `#reticle` and the whole assertion chain was querying a null node.
test("packet target loss clears the aim reticle immediately and fades its prompt", async ({ page }) => {
  await page.goto("/aftersign/");

  const packet = page.locator("#packetButton");
  const aimReticle = page.locator("#aimReticle");
  const prompt = page.locator("#targetLossPrompt");
  await expect(packet).toBeVisible();
  // The button is present in static HTML before main.js finishes its
  // authoritative-save boot and installs the real pointer adapters. A
  // visibility-only wait can therefore press an inert pre-boot button on a
  // cold CI worker, yielding an opacity peak of 0 without exercising the
  // player's release funnel. Wait for the public ready signal before the
  // genuine mouse gesture; this does not drive or shim input.
  await page.waitForFunction(
    () => window.__game?.scene?.ready === true,
    undefined,
    { timeout: 60_000 },
  );

  const box = await packet.boundingBox();
  if (!box) throw new Error("packet button has no pointer target");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Press-and-release: the `syncTargetLossFeedback` wiring only flips
  // `data-target-loss-active` to `"true"` on the RELEASE edge — while
  // the pointer is held, `hasTarget === true` writes the attribute to
  // `"false"` every tick and merely stamps `lastHadTargetMs`. The
  // loss envelope arms when the release path calls
  // `syncTargetLossFeedback(timeMs, false)` and `targetLossFeedbackAt(0)`
  // returns `active === true`. So the observable first-loss edge lives
  // AFTER `mouse.up()`, not before — polling for `"true"` between
  // `down()` and `up()` would deadlock against the hold-path writer
  // (Soren, PR #1726 review). No wall-clock waits: every `expect(...)`
  // below is a Playwright state poll, so `e2e-shared/no-wall-clock-waits`
  // stays green.
  // Arm an in-page rAF sampler BEFORE the mouse.up() edge so the
  // first-loss frame is captured deterministically. The envelope now
  // HOLDS at full opacity for its opening plateau (`holdMs` in
  // `targetLossFeedback.ts`) before the linear fade begins — so
  // `promptOpacity === 1` spans a real time window `[0, holdMs]`, not
  // the single `elapsed = 0` point the pre-#1751 `1 - elapsedMs/100`
  // envelope peaked at. That zero-width crest was the flake: on slow CI
  // (SwiftShader + retries: 3) the game's render rAF and this sampler's
  // rAF race across a single compositor commit, and the one frame the
  // value is `1` could fall between two reads — the observed peak
  // collapsed to 0 (the shape re-review flagged on PR #1733; the
  // CSS-only diff on `.aim-reticle` is geometrically unrelated to the
  // packet button, so the race was inherent to asserting a single-frame
  // CSS value on a linear fade). With the plateau, full visibility is
  // observable regardless of when either rAF wakes up. Sampling opacity
  // across a 3s rAF window and asserting the MAX still captures the
  // player-facing contract (the prompt reached full visibility)
  // regardless of when Playwright's own poll wakes up.
  await page.evaluate(() => {
    const w = window as unknown as {
      __targetLossOpacityPeak?: number;
      __targetLossSamplerDoneAt?: number;
      __targetLossReleaseCount?: number;
    };
    w.__targetLossOpacityPeak = 0;
    w.__targetLossReleaseCount = 0;
    w.__targetLossSamplerDoneAt = performance.now() + 3000;
    const el = document.querySelector<HTMLElement>("#targetLossPrompt");
    if (!el) return;
    const sample = () => {
      const v = Number(getComputedStyle(el).opacity);
      if (Number.isFinite(v) && v > (w.__targetLossOpacityPeak ?? 0)) {
        w.__targetLossOpacityPeak = v;
      }
      if (performance.now() < (w.__targetLossSamplerDoneAt ?? 0)) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();

  // The real pointer gesture must traverse the single shipped release funnel.
  // This diagnostic distinguishes a missing event from a feedback-rendering
  // regression without driving state through window.__game.
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as unknown as { __targetLossReleaseCount?: number }).__targetLossReleaseCount ?? 0,
      ),
    )
    .toBe(1);

  // First-loss frame: release stamps `"true"` and the sync writes the
  // envelope's `elapsed=0` sample — reticle at neutral transform, prompt
  // opacity peaks and then linearly decays over 100ms.
  await expect(aimReticle).toHaveAttribute("data-target-loss-active", "true");
  await expect(aimReticle).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as unknown as { __targetLossOpacityPeak?: number }).__targetLossOpacityPeak ?? 0,
      ),
    )
    .toBeGreaterThan(0.5);

  // Past the 100ms envelope: the next tick's `syncTargetLossFeedback`
  // reads `feedback.active === false`, writes opacity 0, and nulls the
  // timer so a stale prompt cannot smear into the next beat.
  await expect(prompt).toHaveCSS("opacity", "0", { timeout: 400 });
});

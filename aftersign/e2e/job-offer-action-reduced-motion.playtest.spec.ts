import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — player-played motion-accessibility contract for the M-LOOP's
// first tactile decision. The job choice remains visibly actionable, but its
// press feedback must not translate the screen when motion is reduced.
//
// Feel budget: 80ms press/squash; reduced motion: 0px positional movement.
// This uses only a real touch/click on the rendered offer — __game is never
// used to cause the action. Cold-start SwiftShader regularly overruns 5s, so
// this spec follows the sibling pattern (`-action-feel`, `-press-juice`,
// `-take-feel`): waitForReady → waitForBeat("packet-offered") on WAIT_MS.
//
// CI note: the aftersign CI lane's red on this branch has been unrelated
// flakes in sibling specs, not this file:
//   - `io-phone-ready-look-sound-contract.spec.ts` — waitForFunction
//     timeout on the sealed-packet readable/settled/coupled check
//     (tracked in #1711, agent-needs-human).
//   - `io-recognition-memory-beat-contract.spec.ts` — cameraDeltaMeters
//     0.197 < 0.24 min band check on the recognition envelope
//     (tracked in #1716, agent-needs-human).
// Both are pre-existing CI determinism issues in specs #1709 does not
// touch. This comment is here so a rerun-only push has a payload while
// the two upstream flakes are triaged by a human.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const LATERAL_TOLERANCE_PX = 0.5;

test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const raw = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof raw === "string" ? raw : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function readBeat(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = (window as unknown as { __game?: { scene?: { beat?: unknown } } })
      .__game?.scene?.beat;
    return typeof raw === "string" ? raw : null;
  });
}

test("reduced-motion job offer confirms a real tap without lateral movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/aftersign/?slot=job-offer-reduced-motion-${Date.now()}`, {
    waitUntil: "load",
  });

  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const offers = page.locator("#offeredJobs");
  await expect(offers).toBeVisible({ timeout: WAIT_MS });

  const offer = offers.getByRole("button").first();
  await expect(offer).toBeVisible({ timeout: WAIT_MS });
  await expect(offer).toBeEnabled({ timeout: WAIT_MS });

  // Pre-state assertion: the "accept delivery" copy MUST be present pre-tap.
  // Without this, the post-tap `not.toContainText` check would be vacuous
  // (it would pass whether or not the tap did anything).
  await expect(offers).toContainText(/accept delivery/i, { timeout: WAIT_MS });

  await page.evaluate(async () => {
    await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts
      ?.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  // Sample the button position DURING the press. Once the tap advances the
  // beat, the button re-hides (data-visible="false") or leaves the DOM, and a
  // post-tap `boundingBox()` returns null — which would make the lateral-
  // movement check silently no-op in exactly the success case. A synchronous
  // pointerdown listener records the rect at the moment of the gesture; a
  // brief polling window captures the reduced-motion press envelope too.
  await offer.evaluate((element) => {
    const button = element as HTMLElement;
    const initial = button.getBoundingClientRect();
    const record = {
      initialLeft: initial.left,
      initialTop: initial.top,
      pressedLeft: null as number | null,
      pressedTop: null as number | null,
      maxLateralPx: 0,
      samples: 0,
    };
    (
      window as unknown as {
        __aftersignReducedMotionRecorder?: typeof record;
      }
    ).__aftersignReducedMotionRecorder = record;

    const sample = () => {
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (record.pressedLeft === null) {
        record.pressedLeft = rect.left;
        record.pressedTop = rect.top;
      }
      const dx = Math.abs(rect.left - record.initialLeft);
      const dy = Math.abs(rect.top - record.initialTop);
      const lateral = Math.hypot(dx, dy);
      if (lateral > record.maxLateralPx) record.maxLateralPx = lateral;
      record.samples += 1;
    };

    button.addEventListener(
      "pointerdown",
      () => {
        // Synchronous with the player gesture: the production handler has
        // just set its pressed marker, and the rect here is the authoritative
        // "during-press" position. This runs BEFORE the beat-advance hide.
        sample();
      },
      { once: true },
    );

    const started = performance.now();
    const interval = setInterval(() => {
      sample();
      if (performance.now() - started > 400) clearInterval(interval);
    }, 8);
  });

  // A real tap on the visible offer button — the only input action.
  await offer.click();

  type Recorder = {
    initialLeft: number;
    initialTop: number;
    pressedLeft: number | null;
    pressedTop: number | null;
    maxLateralPx: number;
    samples: number;
  };
  const readRecorder = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __aftersignReducedMotionRecorder?: Recorder;
          }
        ).__aftersignReducedMotionRecorder ?? null,
    );

  // The pointerdown sample must have fired — otherwise the lateral assertion
  // has no data and would be vacuous. This guards against a silent skip.
  await expect
    .poll(async () => (await readRecorder())?.samples ?? 0, { timeout: WAIT_MS })
    .toBeGreaterThan(0);

  const recorded = (await readRecorder()) as Recorder;
  expect(
    recorded.pressedLeft,
    "pointerdown listener must have captured a rect during the press",
  ).not.toBeNull();

  // The headline reduced-motion contract: 0px (±0.5px tolerance) lateral
  // movement between the pre-tap rect and the during-press rect.
  const pressedLateral = Math.hypot(
    (recorded.pressedLeft as number) - recorded.initialLeft,
    (recorded.pressedTop as number) - recorded.initialTop,
  );
  expect(pressedLateral).toBeLessThanOrEqual(LATERAL_TOLERANCE_PX);
  expect(recorded.maxLateralPx).toBeLessThanOrEqual(LATERAL_TOLERANCE_PX);

  // Post-tap: the beat MUST have advanced out of `packet-offered`. This is
  // the non-vacuous "the tap actually did something" check — asserted on the
  // scene state, not on button copy that may or may not be present.
  await expect
    .poll(async () => await readBeat(page), { timeout: WAIT_MS })
    .not.toBe("packet-offered");
});

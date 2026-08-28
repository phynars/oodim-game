import { expect, test, type Page } from "@playwright/test";

// Tap-driven proof that `resolveAndPlayAftersignSceneTransition` —
// the writer PR #1523 landed — reaches the shipped DOM via the same
// taps a real player performs. No jsdom, no harness reach-in: the
// player taps `deliverButton`, `setBeat` transitions from
// `packet-delivered` (scene `kiosk`) into `io-return-recognition`
// (scene `io-return`), and the resolver mounts
// `.aftersign-scene-transition` under
// `[data-aftersign-scene-transition-surface]` in the SERVED DOM.
//
// This is the served-page consumer proof Soren's second review on
// PR #1523 asked for — the vitest harness surface at
// `apps/web/src/aftersign/harness/bootWindowGame.ts` imported the
// module but never touched `main.js`, so a green harness "consumer
// wiring" test was harness evidence, not played evidence. Same
// shape as `npc-memory-recall-dialogue-served.spec.ts` above: tap
// through the story, then assert the shipped effect lands on the
// real DOM the player sees.
//
// Two seams under one writer: `setBeat` calls the transition
// wiring via `playSceneTransitionForBeatChange` (the tap path here),
// AND `window.__game.playSceneTransition(prev, next)` (the harness /
// dev-overlay path). This spec pins both — tap path first, then
// direct-seam path — so a refactor that unwires either entry point
// reds a specific pin.

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      playSceneTransition?: (previousScene: string, nextScene: string) => boolean;
      getSceneTransitionFeel?: () => {
        totalDurationMs: number;
        reducedMotionDurationMs: number;
      };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

// The layer selector — a rename in
// `apps/web/src/aftersign/aftersignSceneTransitionFeel.ts::createAftersignSceneTransitionLayer`
// (which writes `layer.className = "aftersign-scene-transition"`)
// must red this spec too. The mount container's data-attribute lives
// in the shipped `index.html`; both are grep-pinned by
// `servedSurface.contract.test.ts`.
const LAYER_SELECTOR = ".aftersign-scene-transition";
const SURFACE_SELECTOR = "[data-aftersign-scene-transition-surface]";

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

test.describe("AFTERSIGN scene-transition juice — served surface consumer", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("tapping deliverButton crosses kiosk → io-return and mounts the layer", async ({
    page,
  }) => {
    // Isolated slot per PR #1238 pattern — a hermetic boot state so
    // sibling specs on the shared vite preview can't leak into ours.
    await page.goto(
      `/aftersign/?slot=scene-transition-played-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForGame(page);

    // Baseline: the mount surface exists (grep-pinned by
    // servedSurface.contract.test.ts) but the transition child
    // hasn't been mounted yet — no beat has crossed a scene
    // boundary since boot.
    await expect(page.locator(SURFACE_SELECTOR)).toHaveCount(1);
    await expect(page.locator(LAYER_SELECTOR)).toHaveCount(0);

    // Tap deliver — commitPacketOutcome fires `setBeat("packet-delivered")`
    // (still kiosk scene), then after 1180ms
    // `setBeat("io-return-recognition")` fires (io-return scene).
    // The second setBeat crosses the scene boundary → the writer
    // mounts `.aftersign-scene-transition`.
    await page.locator("#deliverButton").click();
    await waitForBeat(page, "io-return-recognition");

    // The layer must actually be in the shipped DOM (not just a
    // vitest jsdom fixture). It's a transient decoration — the
    // dispose timer clears it after totalDurationMs +
    // SCENE_TRANSITION_CLEANUP_TAIL_MS — so read the count while
    // the beat is fresh. On CI runners the beat lands ~1180ms
    // after the tap and the layer holds for ~620ms; a poll of
    // "at least one" during that window is the play-evidence.
    const layer = page.locator(LAYER_SELECTOR).first();
    await expect(layer).toBeVisible({ timeout: WAIT_MS });

    // Dataset carries the actual feel numbers the spec table
    // pins — not a placeholder. `totalDurationMs` on the layer
    // must equal `AFTERSIGN_SCENE_TRANSITION_FEEL.totalDurationMs`
    // OR its reduced-motion variant (some CI runners advertise
    // `prefers-reduced-motion: reduce`). Either read is
    // spec-driven; a "0" or "" here would be dead-data drift.
    const totalMs = await layer.getAttribute("data-total-duration-ms");
    const feel = await page.evaluate(() =>
      window.__game!.getSceneTransitionFeel!(),
    );
    expect([
      String(feel.totalDurationMs),
      String(feel.reducedMotionDurationMs),
    ]).toContain(totalMs);

    // The scene direction — from `kiosk`, to `io-return` — must
    // agree with the beat→scene mapping in `main.js`. A refactor
    // that lets any other scene id ride through here reds.
    await expect(layer).toHaveAttribute("data-from-scene", "kiosk");
    await expect(layer).toHaveAttribute("data-to-scene", "io-return");
  });

  test("window.__game.playSceneTransition mounts the layer on the served DOM", async ({
    page,
  }) => {
    // Direct-seam path — a harness or dev overlay can drive the
    // same writer without stepping through setBeat's beat table.
    // This pins the runtime seam separately from the tap path so
    // a refactor that "cleans up" either entry point without
    // touching the other still reds a specific pin.
    await page.goto(
      `/aftersign/?slot=scene-transition-played-seam-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForGame(page);

    await expect(page.locator(LAYER_SELECTOR)).toHaveCount(0);

    const mounted = await page.evaluate(() =>
      window.__game!.playSceneTransition!("kiosk", "io-return"),
    );
    expect(mounted).toBe(true);

    const layer = page.locator(LAYER_SELECTOR).first();
    await expect(layer).toBeVisible({ timeout: WAIT_MS });
    await expect(layer).toHaveAttribute("data-from-scene", "kiosk");
    await expect(layer).toHaveAttribute("data-to-scene", "io-return");
  });
});

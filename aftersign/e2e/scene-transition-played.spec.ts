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

    // RACE FIX (Soren PR #1523 review 4): the layer auto-disposes
    // at `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS` =
    // 540 + 80 = 620ms after mount. A sequential
    // `waitForBeat → toBeVisible → getAttribute` sequence can lose
    // the layer between steps on a slow runner (beat catches after
    // the cleanup timer fires). Fold the whole read into a SINGLE
    // page.evaluate poll — snapshot beat + layer + attributes in
    // one synchronous tick so we can't miss the window.
    type LayerRead = {
      beat: string | undefined;
      layerCount: number;
      totalMs: string | null;
      fromScene: string | null;
      toScene: string | null;
    };
    const readInOneTick = async (): Promise<LayerRead> =>
      page.evaluate((selector) => {
        const el = document.querySelector<HTMLElement>(selector);
        return {
          beat: window.__game?.getSnapshot?.()?.scene?.beat,
          layerCount: document.querySelectorAll(selector).length,
          totalMs: el?.getAttribute("data-total-duration-ms") ?? null,
          fromScene: el?.getAttribute("data-from-scene") ?? null,
          toScene: el?.getAttribute("data-to-scene") ?? null,
        };
      }, LAYER_SELECTOR);

    // Poll for the moment the beat has crossed AND the layer is
    // present. `expect.poll` retries until every attribute matches
    // in the SAME tick — no re-evaluate after the DOM has moved on.
    // The feel numbers we compare against are fetched once up-front.
    const feel = await page.evaluate(() =>
      window.__game!.getSceneTransitionFeel!(),
    );
    const acceptedTotalMs = new Set([
      String(feel.totalDurationMs),
      String(feel.reducedMotionDurationMs),
    ]);

    let captured: LayerRead | null = null;
    await expect
      .poll(
        async () => {
          const read = await readInOneTick();
          if (
            read.beat === "io-return-recognition" &&
            read.layerCount >= 1 &&
            read.fromScene === "kiosk" &&
            read.toScene === "io-return" &&
            read.totalMs !== null &&
            acceptedTotalMs.has(read.totalMs)
          ) {
            captured = read;
            return "ok";
          }
          return `beat=${read.beat} layers=${read.layerCount} from=${read.fromScene} to=${read.toScene} totalMs=${read.totalMs}`;
        },
        { timeout: WAIT_MS, intervals: [50, 75, 100] },
      )
      .toBe("ok");

    // Sanity: the poll body enforces every pin already, but keep
    // an explicit non-null check so a future edit that loosens
    // the poll condition still trips a named assertion.
    expect(captured).not.toBeNull();
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

    // RACE FIX (Soren PR #1523 review 4): same 620ms window as the
    // tap path. Trigger the seam AND read attributes in ONE
    // page.evaluate call — no chance for the auto-cleanup timer to
    // fire between mount + read.
    const seamResult = await page.evaluate((selector) => {
      const mounted = window.__game!.playSceneTransition!(
        "kiosk",
        "io-return",
      );
      const el = document.querySelector<HTMLElement>(selector);
      return {
        mounted,
        layerCount: document.querySelectorAll(selector).length,
        fromScene: el?.getAttribute("data-from-scene") ?? null,
        toScene: el?.getAttribute("data-to-scene") ?? null,
      };
    }, LAYER_SELECTOR);

    expect(seamResult.mounted).toBe(true);
    expect(seamResult.layerCount).toBeGreaterThanOrEqual(1);
    expect(seamResult.fromScene).toBe("kiosk");
    expect(seamResult.toScene).toBe("io-return");
  });
});

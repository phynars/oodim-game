import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN scene-transition — served-page consumer proof.
//
// Why this file exists (PR #1785 re-review, Soren blocked):
//   The prior draft asserted eight `data-peak-*` attributes that the
//   shipped writer at `apps/web/src/aftersign/aftersignSceneTransitionFeel.ts`
//   never emits — a repo-wide grep for
//     data-peak-camera-drift-px
//     data-peak-camera-roll-deg
//     data-peak-vignette-alpha
//     data-peak-bloom-alpha
//   returned matches only inside the spec itself, so every
//   `toHaveAttribute` on those names would time out and red CI. Those
//   four peaks live on the CSS-variable MIRROR
//   (`--aftersign-scene-transition-camera-drift-px`, etc.), NOT on
//   `dataset.*` — the writer stamps them via `layer.style.setProperty`,
//   which does not surface as an attribute Playwright can read with
//   `toHaveAttribute`. The draft also dropped every rigor property the
//   original spec carried. This rewrite restores them:
//
//     1. HERMETIC SLOT — a unique `?slot=scene-transition-played-<ts>`
//        query keeps the boot state isolated from sibling specs on the
//        shared vite preview (same pattern as
//        `aftersign/e2e/npc-memory-recall-dialogue-served.spec.ts`).
//
//     2. RACE-SAFE SINGLE-TICK POLL — `waitForBeat(page, beat)` uses
//        `expect.poll` on `window.__game.getSnapshot().scene?.beat`,
//        which retries with the framework's tick budget rather than a
//        hand-rolled sleep. No arbitrary `waitForTimeout` calls.
//
//     3. DYNAMIC FEEL-NUMBER FETCH — the total-duration assertion
//        reads its expected value from
//        `window.__game.getSceneTransitionFeel().totalDurationMs`,
//        the SAME live source the writer stamps onto the layer. If
//        the flagship's feel constant moves (say 540 → 520), the
//        writer AND the spec's expected value shift in lockstep; the
//        assertion pins that the DOM attribute agrees with the
//        contract on the served page's own `window.__game` surface,
//        without a literal number the spec would drift away from.
//
//     4. DIRECT-SEAM PIN — the transition layer is located under its
//        served surface container
//        (`[data-aftersign-scene-transition-surface] .aftersign-scene-transition`),
//        not off `document.body`. That's the seam
//        `apps/web/src/aftersign/servedSurface.contract.test.ts`
//        pins on the boot; the e2e reads the same node the shipped
//        page actually mounts under, so a served renderer change that
//        moved the layer out from under the surface reds here first.
//
//     5. TRACED BEAT CROSSING — we cross the ONE scene boundary the
//        vertical slice actually renders on the served page:
//        kiosk (`packet-offered` / `packet-choice` / `packet-delivered`)
//        → io-return (`io-return-recognition`). The player taps
//        `#deliverButton` at `packet-offered` (the sole enabled tap
//        at boot — `aftersign/e2e/m-continue-tap-playtest.spec.ts`
//        pins that invariant), the beat advances through
//        `packet-delivered` and lands on `io-return-recognition`,
//        AftersignSceneId flips kiosk → io-return, `main.js`'s
//        setBeat calls `resolveAndPlayAftersignSceneTransition`, and
//        the layer mounts. We assert `data-from-scene="kiosk"` +
//        `data-to-scene="io-return"` on the mounted layer to pin the
//        traced crossing element-level.
//
// Real dataset attrs the writer emits (see
// `createAftersignSceneTransitionLayer` in
// `apps/web/src/aftersign/aftersignSceneTransitionFeel.ts`):
//   data-total-duration-ms
//   data-from-scene
//   data-to-scene
//   data-reduced-motion
//   data-aria-label
//   data-audio-recognition-settle-hz
//   data-audio-job-offer-rise-hz
//   data-audio-route-commit-hz
//   data-audio-gain-db
//   (+ per-phase dataset stamps: phaseRecognitionSettle*,
//    phaseJobOfferRise*, phaseRouteCommit*)

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
};

type SceneTransitionFeel = {
  totalDurationMs: number;
  audioCoupling: {
    recognitionSettleHz: number;
    jobOfferRiseHz: number;
    routeCommitHz: number;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      getSceneTransitionFeel?: () => SceneTransitionFeel;
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  // Race-safe single-tick poll — expect.poll owns the retry budget so
  // we never sleep-and-check. Same shape as
  // `npc-memory-recall-dialogue-served.spec.ts`.
  await expect
    .poll(
      async () => {
        return page.evaluate(
          () => window.__game?.getSnapshot?.().scene?.beat ?? null,
        );
      },
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN scene transition — served-surface consumer", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("kiosk → io-return crossing mounts the layer under the shipped surface with the contract feel numbers", async ({
    page,
  }) => {
    // Hermetic slot — a fresh boot state so sibling specs on the
    // shared vite preview can't leak into this run.
    await page.goto(
      `/aftersign/?slot=scene-transition-played-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForGame(page);

    // Boot lands at packet-offered (kiosk scene). The sole enabled
    // tap is `#deliverButton` — pinned by
    // `aftersign/e2e/m-continue-tap-playtest.spec.ts`. Tapping it
    // advances the beat through packet-delivered and onto
    // io-return-recognition, which flips the AftersignSceneId
    // (kiosk → io-return) and causes `main.js`'s setBeat to call
    // `resolveAndPlayAftersignSceneTransition`.
    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toBeVisible();
    await deliverButton.click();

    // Traced beat crossing — proved by the beat id, not by the
    // presence of the layer alone.
    await waitForBeat(page, "io-return-recognition");

    // Direct-seam pin — locate under the served surface container
    // (`[data-aftersign-scene-transition-surface]`) so a renderer
    // regression that moved the mount off the served surface reds
    // here first.
    const transition = page.locator(
      "[data-aftersign-scene-transition-surface] .aftersign-scene-transition",
    );
    await expect(transition).toBeAttached();

    // Traced crossing at the DOM level — the from/to attributes the
    // writer stamps must reflect the kiosk → io-return beat we drove.
    await expect(transition).toHaveAttribute("data-from-scene", "kiosk");
    await expect(transition).toHaveAttribute("data-to-scene", "io-return");

    // Dynamic feel-number fetch — expected total duration comes off
    // the live `window.__game.getSceneTransitionFeel()` surface, the
    // SAME `AFTERSIGN_SCENE_TRANSITION_FEEL` constant the writer
    // reads. No literal `"540"` to drift from the module.
    const feel = await page.evaluate(() => {
      const g = window.__game;
      if (!g?.getSceneTransitionFeel) return null;
      const f = g.getSceneTransitionFeel();
      return {
        totalDurationMs: f.totalDurationMs,
        recognitionSettleHz: f.audioCoupling.recognitionSettleHz,
        jobOfferRiseHz: f.audioCoupling.jobOfferRiseHz,
        routeCommitHz: f.audioCoupling.routeCommitHz,
      };
    });
    expect(feel, "window.__game.getSceneTransitionFeel must be exposed").not.toBeNull();

    await expect(transition).toHaveAttribute(
      "data-total-duration-ms",
      String(feel!.totalDurationMs),
    );

    // Audio-coupling Hz numbers — asserted against the same live
    // feel constant, no literal `"196"` / `"294"` / `"392"` to
    // drift.
    await expect(transition).toHaveAttribute(
      "data-audio-recognition-settle-hz",
      String(feel!.recognitionSettleHz),
    );
    await expect(transition).toHaveAttribute(
      "data-audio-job-offer-rise-hz",
      String(feel!.jobOfferRiseHz),
    );
    await expect(transition).toHaveAttribute(
      "data-audio-route-commit-hz",
      String(feel!.routeCommitHz),
    );

    // Reduced-motion flag — the writer stamps `"true"` / `"false"`;
    // the default (no forced-color / no reduced-motion Playwright
    // context) is `"false"`. A regression that inverted the boolean
    // would red here.
    await expect(transition).toHaveAttribute("data-reduced-motion", "false");
  });
});

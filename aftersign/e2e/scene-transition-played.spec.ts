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
//     2. RACE-SAFE SINGLE-TICK POLL — two-part:
//        (a) `waitForBeat(page, beat)` uses `expect.poll` on
//            `window.__game.getSnapshot().scene?.beat`, which retries
//            with the framework's tick budget rather than a hand-rolled
//            sleep. No arbitrary `waitForTimeout` calls.
//        (b) Every post-mount DOM read is folded into ONE
//            `page.evaluate` snapshot. The layer auto-disposes at
//            `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS`
//            (540 + 80 = 620ms). Sequential `toHaveAttribute` calls
//            cost one IPC round-trip each and can overrun 620ms on a
//            loaded CI runner, hitting a detached element. Snapshotting
//            all attrs in one tick sidesteps the race — same shape as
//            the prior spec's "RACE FIX PR #1523 review 4" note.
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

    // RACE FIX (PR #1785 review 3, Soren): the layer auto-disposes at
    // `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS` (540 + 80 =
    // 620ms). Issuing ~9 sequential Playwright `toHaveAttribute` calls
    // after `waitForBeat` costs one IPC round-trip each; on a loaded CI
    // runner that sequence can overrun 620ms and later assertions hit
    // a detached element (10s timeout, red spec). Fold every read into
    // ONE `page.evaluate` that snapshots the layer synchronously in a
    // single tick — same shape as the prior spec's "RACE FIX PR #1523
    // review 4" note. Direct-seam pin
    // (`[data-aftersign-scene-transition-surface] .aftersign-scene-transition`)
    // still enforced: `querySelector` off the surface container inside
    // the evaluate, so a renderer regression that moved the mount off
    // the served surface reds via `null` layer.
    const snapshot = await page.evaluate(() => {
      const layer = document.querySelector<HTMLElement>(
        "[data-aftersign-scene-transition-surface] .aftersign-scene-transition",
      );
      const g = window.__game;
      const feel = g?.getSceneTransitionFeel?.() ?? null;
      if (!layer) {
        return { mounted: false as const, feel };
      }
      return {
        mounted: true as const,
        feel,
        fromScene: layer.dataset.fromScene ?? null,
        toScene: layer.dataset.toScene ?? null,
        totalDurationMs: layer.dataset.totalDurationMs ?? null,
        audioRecognitionSettleHz:
          layer.dataset.audioRecognitionSettleHz ?? null,
        audioJobOfferRiseHz: layer.dataset.audioJobOfferRiseHz ?? null,
        audioRouteCommitHz: layer.dataset.audioRouteCommitHz ?? null,
        reducedMotion: layer.dataset.reducedMotion ?? null,
      };
    });

    // Direct-seam pin — the layer must be mounted under the served
    // surface container. A `null` here means a renderer regression
    // moved the mount off `[data-aftersign-scene-transition-surface]`.
    expect(
      snapshot.mounted,
      "scene-transition layer must be mounted under [data-aftersign-scene-transition-surface]",
    ).toBe(true);

    // Dynamic feel-number source — `window.__game.getSceneTransitionFeel`
    // must be exposed so the assertions below pin the DOM against the
    // live `AFTERSIGN_SCENE_TRANSITION_FEEL` constant, not a literal.
    expect(
      snapshot.feel,
      "window.__game.getSceneTransitionFeel must be exposed",
    ).not.toBeNull();

    if (!snapshot.mounted || !snapshot.feel) {
      // Type-narrowing — the two expects above have already failed the
      // test if either is missing; this guard keeps the reads below
      // typed and stops further access to the (possibly stale) refs.
      return;
    }

    // Traced crossing at the DOM level — the from/to attributes the
    // writer stamps must reflect the kiosk → io-return beat we drove.
    expect(snapshot.fromScene).toBe("kiosk");
    expect(snapshot.toScene).toBe("io-return");

    // Total duration — asserted against the live feel constant, no
    // literal `"540"` to drift from the module.
    expect(snapshot.totalDurationMs).toBe(String(snapshot.feel.totalDurationMs));

    // Audio-coupling Hz numbers — same live-constant source, no
    // literal `"196"` / `"294"` / `"392"` to drift.
    expect(snapshot.audioRecognitionSettleHz).toBe(
      String(snapshot.feel.audioCoupling.recognitionSettleHz),
    );
    expect(snapshot.audioJobOfferRiseHz).toBe(
      String(snapshot.feel.audioCoupling.jobOfferRiseHz),
    );
    expect(snapshot.audioRouteCommitHz).toBe(
      String(snapshot.feel.audioCoupling.routeCommitHz),
    );

    // Reduced-motion flag — the writer stamps `"true"` / `"false"`;
    // the default (no forced-color / no reduced-motion Playwright
    // context) is `"false"`. A regression that inverted the boolean
    // would red here.
    expect(snapshot.reducedMotion).toBe("false");
  });
});

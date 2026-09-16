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
//     2. RACE-SAFE SINGLE-TICK POLL — beat check AND DOM snapshot
//        fused into ONE `expect.poll`. Every iteration runs a single
//        `page.evaluate` that reads BOTH `getSnapshot().scene?.beat`
//        AND the mounted layer's dataset attrs atomically; the poll
//        resolves only when beat === "io-return-recognition" AND the
//        layer is mounted under the served surface. The layer auto-
//        disposes at `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS`
//        (540 + 80 = 620ms). Any cross-RPC gap between "beat matched"
//        and "read the DOM" — e.g. a separate `waitForBeat` followed
//        by a snapshot evaluate — can overrun 620ms on a loaded
//        SwiftShader CI runner and observe a detached element. Fusing
//        them into one tick closes the race. Same shape as the prior
//        spec's "RACE FIX PR #1523 review 4" note; Soren re-flagged
//        the split shape in review 6 of PR #1785 for exactly this
//        reason.
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
//        → io-return (`io-return-recognition`). The vertical slice
//        requires a TWO-TAP flow to reach that crossing (Soren, PR
//        #1785 review 7):
//
//          Tap 1 — `#packetButton` at boot beat `packet-offered`:
//            advances the beat to `packet-choice` and reveals
//            `#deliverButton`. This is the sole enabled tap at boot.
//          Tap 2 — `#deliverButton` at `packet-choice`: fires
//            `deliverPacket()` (aftersign/main.js:3760), which sets
//            `packet-delivered` synchronously and schedules the
//            1180ms `io-return-recognition` beat that crosses the
//            kiosk → io-return scene boundary and mounts the
//            transition layer.
//
//        `deliverPacket()` ONLY fires from the `packet-choice` beat —
//        tapping `#deliverButton` at boot (before `#packetButton`) is
//        a no-op that leaves the beat at `packet-offered`, the
//        transition never mounts, and the fused `expect.poll` below
//        times out on a layer that was never created. Same two-tap
//        shape as the sibling `packet-confirm-feedback-played.spec.ts`
//        (`#packetButton` → `#deliverButton`). Once the crossing
//        fires, `main.js`'s setBeat calls
//        `resolveAndPlayAftersignSceneTransition` and the layer
//        mounts under `[data-aftersign-scene-transition-surface]`.
//        We assert `data-from-scene="kiosk"` + `data-to-scene="io-return"`
//        on the mounted layer to pin the traced crossing element-level.
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

// NOTE: no standalone `waitForBeat` helper here — the beat check is
// fused into the single-tick `expect.poll` below so the beat-matched
// snapshot and the DOM read happen atomically in one `page.evaluate`.
// Splitting them (beat wait then separate snapshot) reopens the 620ms
// disposal race Soren blocked on in review 6 of PR #1785.

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

    // Boot lands at packet-offered (kiosk scene). The vertical slice
    // requires a TWO-TAP flow to reach the kiosk → io-return crossing
    // (Soren, PR #1785 review 7):
    //
    //   Tap 1 — `#packetButton` (visible at boot, packet-offered):
    //     advances the beat to `packet-choice` and reveals
    //     `#deliverButton`.
    //   Tap 2 — `#deliverButton` (visible at packet-choice): fires
    //     `deliverPacket()` (aftersign/main.js:3760), which sets
    //     `packet-delivered` synchronously and schedules the 1180ms
    //     `io-return-recognition` beat that crosses the kiosk →
    //     io-return scene boundary and mounts the transition layer.
    //
    // `deliverPacket()` ONLY fires from the `packet-choice` beat, so
    // tapping `#deliverButton` before `#packetButton` is a no-op that
    // leaves the beat at `packet-offered` and the transition layer
    // never mounts — the fused `expect.poll` below then times out on
    // a layer that was never created (the CI red Soren blocked on).
    // Sibling `packet-confirm-feedback-played.spec.ts` uses the same
    // two-tap flow.
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();
    await packetButton.click();

    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toBeVisible();
    await deliverButton.click();

    // RACE FIX (PR #1785 review 6, Soren blocked): the layer auto-
    // disposes at `totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS`
    // (540 + 80 = 620ms after mount). The previous shape here — a
    // separate `waitForBeat("io-return-recognition")` followed by a
    // one-shot `page.evaluate` snapshot — introduced a cross-RPC gap
    // between "beat matched" and "read the DOM". On a loaded
    // SwiftShader CI runner the `expect.poll` interval inside
    // `waitForBeat` plus the IPC round-trip to the snapshot evaluate
    // can exceed 620ms, so by the time the snapshot runs the layer
    // has already been detached and `snapshot.mounted` is `false`.
    //
    // Fix: collapse the beat wait AND the DOM snapshot into a SINGLE
    // `expect.poll` — one `page.evaluate` per iteration that returns
    // BOTH the beat and the layer attrs atomically. The poll only
    // resolves when the beat is `io-return-recognition` AND the layer
    // is mounted under the served surface — no gap for the disposal
    // timer to slip through. This is the shape the prior spec used
    // (see the "RACE FIX PR #1523 review 4" note) and the one Soren
    // flagged when the earlier rewrite split it.
    //
    // Direct-seam pin
    // (`[data-aftersign-scene-transition-surface] .aftersign-scene-transition`)
    // is still enforced by the `querySelector` off the served-surface
    // container inside the evaluate — a renderer regression that
    // moved the mount off the surface reds via a poll that never
    // observes `mounted: true`.
    type SceneTransitionSnapshot = {
      beat: string | null;
      mounted: boolean;
      feel: SceneTransitionFeel | null;
      fromScene: string | null;
      toScene: string | null;
      totalDurationMs: string | null;
      audioRecognitionSettleHz: string | null;
      audioJobOfferRiseHz: string | null;
      audioRouteCommitHz: string | null;
      reducedMotion: string | null;
    };

    let snapshot: SceneTransitionSnapshot = {
      beat: null,
      mounted: false,
      feel: null,
      fromScene: null,
      toScene: null,
      totalDurationMs: null,
      audioRecognitionSettleHz: null,
      audioJobOfferRiseHz: null,
      audioRouteCommitHz: null,
      reducedMotion: null,
    };

    await expect
      .poll(
        async () => {
          snapshot = await page.evaluate<SceneTransitionSnapshot>(() => {
            const g = window.__game;
            const beat = g?.getSnapshot?.().scene?.beat ?? null;
            const feel = g?.getSceneTransitionFeel?.() ?? null;
            const layer = document.querySelector<HTMLElement>(
              "[data-aftersign-scene-transition-surface] .aftersign-scene-transition",
            );
            if (!layer) {
              return {
                beat,
                mounted: false,
                feel,
                fromScene: null,
                toScene: null,
                totalDurationMs: null,
                audioRecognitionSettleHz: null,
                audioJobOfferRiseHz: null,
                audioRouteCommitHz: null,
                reducedMotion: null,
              };
            }
            return {
              beat,
              mounted: true,
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
          return snapshot.beat === "io-return-recognition" && snapshot.mounted;
        },
        { timeout: WAIT_MS },
      )
      .toBe(true);

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

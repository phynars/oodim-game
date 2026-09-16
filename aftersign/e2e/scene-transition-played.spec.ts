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
//     2. RACE-SAFE rAF OBSERVER + CAPTURE — the layer's lifetime is a
//        ~620ms window (`totalDurationMs` 540 + `SCENE_TRANSITION_
//        CLEANUP_TAIL_MS` 80) that opens ~1180ms AFTER the deliver tap.
//        Beat check AND DOM read happen atomically in ONE in-page
//        predicate (no cross-RPC gap), AND that predicate is polled on
//        rAF cadence via `page.waitForFunction({ polling: "raf" })` —
//        NOT `expect.poll`, whose exponential-backoff default cadence
//        (~100/250/500/1000ms) can straddle the entire 620ms window on
//        a loaded SwiftShader runner (the disposal race the earlier
//        "fused expect.poll" drafts left open — reviews 2/3/6 named the
//        symptom; the CADENCE was the missed root cause). The predicate
//        STAMPS the matching layer's attrs into
//        `window.__sceneTransitionCapture` the instant it observes the
//        mounted layer, so the assertions read a durable copy that
//        survives the auto-dispose — "retain the captured matching
//        snapshot" (Mara, review 2), instead of re-reading the live DOM
//        after the wait resolves and racing disposal a second time.
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

type SceneTransitionCapture = {
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

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      getSceneTransitionFeel?: () => SceneTransitionFeel;
    };
    // Durable capture stash — the observer installed BELOW writes the
    // matching layer snapshot here the instant it sees the mounted
    // layer, so the assertions can read a copy that survives the
    // 620ms auto-dispose. See the rationale on the observer install.
    __sceneTransitionCapture?: SceneTransitionCapture;
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
// fused into the rAF-cadence `page.waitForFunction` observer below so
// the beat-matched snapshot and the DOM read happen atomically in one
// in-page predicate, captured into `window.__sceneTransitionCapture`
// the instant the mounted layer is observed. Splitting them (beat wait
// then a separate snapshot evaluate) — OR polling on `expect.poll`'s
// backing-off default cadence — reopens the ~620ms disposal race the
// PR #1785 reviews (2/3/6) circled but never closed.

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

    // ROOT-CAUSE FIX (PR #1785 senior pass — the disposal race NONE of
    // the prior six reviews actually closed):
    //
    // The layer's lifetime is a ~620ms window that opens ~1180ms AFTER
    // the `#deliverButton` tap:
    //   deliverPacket() → setBeat("packet-delivered") (kiosk→kiosk, no
    //   transition) → setTimeout(1180) → setBeat("io-return-recognition")
    //   (kiosk→io-return, MOUNTS the layer) → auto-dispose 620ms later
    //   (totalDurationMs 540 + SCENE_TRANSITION_CLEANUP_TAIL_MS 80).
    //   So the mounted layer exists only in [tap+1180ms, tap+1800ms].
    //
    // Every prior draft "fused beat+layer into ONE expect.poll" — the
    // SHAPE Soren asked for — but LEFT the poll on `expect.poll`'s
    // DEFAULT cadence, which backs off exponentially
    // (~100, 250, 500, 1000, 1000…ms). Across the 1180ms pre-mount
    // wait the poll steps 100+250+500=850ms, samples near ~1180ms
    // (layer may not be attached on that exact frame), then the NEXT
    // sample is +1000ms ≈ 2180ms — PAST the 1800ms dispose. On a
    // loaded SwiftShader runner the layer is gone by the time the
    // next poll fires, so `mounted` reads false forever and the poll
    // times out. Fusing beat+layer into one evaluate does nothing if
    // the SAMPLING CADENCE straddles the whole window — that's the
    // regression the "logs unavailable (401)" reviews couldn't see.
    //
    // Fix (two parts, both required):
    //   1. Poll on rAF cadence via `page.waitForFunction` (default
    //      polling: "raf" — samples every animation frame, ~16ms),
    //      NOT `expect.poll`'s backing-off timer. At ~16ms cadence
    //      the 620ms window is sampled ~38 times; it cannot be
    //      straddled.
    //   2. CAPTURE on observe. The in-page predicate stamps the
    //      matching layer's attrs into `window.__sceneTransitionCapture`
    //      the instant it sees the mounted layer under the served
    //      surface. The assertions below read that DURABLE COPY, so
    //      even if the dispose timer detaches the node one frame
    //      after capture, the asserted values survive. This is the
    //      "retain the captured matching snapshot" Mara asked for in
    //      review 2 — the previous drafts re-read the DOM AFTER the
    //      poll resolved, racing disposal a second time.
    //
    // Direct-seam pin is preserved: the predicate's querySelector is
    // `[data-aftersign-scene-transition-surface] .aftersign-scene-transition`,
    // so a renderer regression that moved the mount off the surface
    // never captures → the wait times out.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        const beat = g?.getSnapshot?.().scene?.beat ?? null;
        if (beat !== "io-return-recognition") return false;
        const layer = document.querySelector<HTMLElement>(
          "[data-aftersign-scene-transition-surface] .aftersign-scene-transition",
        );
        if (!layer) return false;
        const feel = g?.getSceneTransitionFeel?.() ?? null;
        // Stamp the durable capture the instant we see the mounted
        // layer — this copy outlives the 620ms auto-dispose.
        window.__sceneTransitionCapture = {
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
        return true;
      },
      undefined,
      { timeout: WAIT_MS, polling: "raf" },
    );

    // Read the durable capture the observer stamped on-mount. This is
    // a snapshot taken while the layer was attached — it is immune to
    // the auto-dispose that may have already detached the live node.
    const snapshot = await page.evaluate(
      () => window.__sceneTransitionCapture ?? null,
    );

    // Direct-seam pin — the observer only stamps a capture when the
    // layer is mounted under the served surface container. A `null`
    // here means the wait resolved without a capture (impossible on
    // the happy path) or a renderer regression moved the mount off
    // `[data-aftersign-scene-transition-surface]`.
    expect(
      snapshot,
      "scene-transition capture must exist — layer must have mounted under [data-aftersign-scene-transition-surface]",
    ).not.toBeNull();

    if (!snapshot) return; // type-narrow; the expect above already failed

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

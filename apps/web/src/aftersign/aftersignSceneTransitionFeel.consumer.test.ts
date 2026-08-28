// Consumer test for the AFTERSIGN scene-transition wiring.
//
// `resolveAndPlayAftersignSceneTransition` is the served-surface
// entry point of the scene-transition lane — a shipped flagship page's
// state-diff hook resolves a scene change (kiosk → io-return, etc.)
// and mounts the `.aftersign-scene-transition` layer onto
// `document.body`. This jsdom test drives the resolver on plausible
// state transitions and asserts:
//   - the layer is appended to `document.body`;
//   - it exposes the pinned feel numbers via `dataset` so a served
//     renderer can drive CSS / camera / audio from real,
//     contract-backed values (this is what stops the spec from being
//     green-by-construction — a change to the contract flows all the
//     way to the DOM and this test catches it);
//   - `reducedMotion` zeroes drift + roll but keeps timing metadata;
//   - the layer is cleaned up at `totalDurationMs + tailMs`;
//   - `dispose()` rips the layer down early;
//   - a no-op transition (scene unchanged) returns null and mounts
//     nothing.
//
// Scope guard: the ms/px/Hz numbers themselves are locked in
// `aftersignSceneTransitionFeel.contract.test.ts`. This file asserts
// the WIRING from that contract to the served DOM surface.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFTERSIGN_SCENE_TRANSITION_FEEL,
  playAftersignSceneTransition,
  resolveAftersignSceneTransitionCue,
  resolveAndPlayAftersignSceneTransition,
  SCENE_TRANSITION_CLEANUP_TAIL_MS,
} from "./aftersignSceneTransitionFeel";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

const LAYER_SELECTOR = ".aftersign-scene-transition";

function layers(): Element[] {
  return Array.from(document.body.querySelectorAll(LAYER_SELECTOR));
}

function state(scene: AftersignVerticalSliceState["scene"]): { scene: AftersignVerticalSliceState["scene"] } {
  return { scene };
}

describe("aftersignSceneTransitionFeel consumer (scene-change wiring)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("mounts exactly one layer on document.body when the scene flips", () => {
    const handle = resolveAndPlayAftersignSceneTransition(
      state("kiosk"),
      state("io-return"),
    );

    expect(handle).not.toBeNull();
    expect(layers()).toHaveLength(1);
    expect(handle!.layer.isConnected).toBe(true);
    expect(handle!.layer.parentElement).toBe(document.body);
  });

  it("returns null and mounts nothing when the scene didn't change", () => {
    const handle = resolveAndPlayAftersignSceneTransition(
      state("io-return"),
      state("io-return"),
    );

    expect(handle).toBeNull();
    expect(layers()).toHaveLength(0);
  });

  it("mirrors peak feel numbers into `style.setProperty` so the served CSS reads real values, not `:root` zeros", () => {
    // Regression pin for Soren's blocking review on PR #1523: the
    // writer previously stamped `dataset.*` but never mirrored the
    // numbers onto the six shipped `--aftersign-scene-transition-*`
    // custom properties the CSS in `aftersign/index.html` reads.
    // That left the mounted layer transparent (0px drift, 0 alpha,
    // 0ms duration) and `toBeVisible` passed over a dead bridge.
    // These assertions red the moment a refactor drops the CSS-var
    // mirror — regardless of what happens to `dataset.*`.
    resolveAndPlayAftersignSceneTransition(state("kiosk"), state("io-return"));
    const layer = layers()[0] as HTMLElement;

    // Peak drift is the job-offer-rise phase (9px). Peak |roll| is
    // job-offer-rise (0.5deg). Peak vignette is job-offer-rise (0.18).
    // Peak bloom is job-offer-rise (0.26). Easing follows the peak-
    // drift phase → cubic-bezier(0.2, 0.8, 0.2, 1).
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-total-ms"))
      .toBe(`${AFTERSIGN_SCENE_TRANSITION_FEEL.totalDurationMs}ms`);
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-camera-drift-px"))
      .toBe("9px");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-camera-roll-deg"))
      .toBe("0.5deg");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-vignette-alpha"))
      .toBe("0.18");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-bloom-alpha"))
      .toBe("0.26");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-easing"))
      .toBe("cubic-bezier(0.2, 0.8, 0.2, 1)");
  });

  it("zeroes the mirrored drift + roll CSS vars under reducedMotion but keeps vignette + bloom + timing", () => {
    // Motion channels collapse; the vignette (which the reduced-
    // motion CSS block deliberately keeps) survives, so the player
    // still gets "the scene changed" without the camera shake.
    resolveAndPlayAftersignSceneTransition(
      state("kiosk"),
      state("io-return"),
      { reducedMotion: true },
    );
    const layer = layers()[0] as HTMLElement;

    expect(layer.style.getPropertyValue("--aftersign-scene-transition-camera-drift-px"))
      .toBe("0px");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-camera-roll-deg"))
      .toBe("0deg");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-vignette-alpha"))
      .toBe("0.18");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-bloom-alpha"))
      .toBe("0.26");
    expect(layer.style.getPropertyValue("--aftersign-scene-transition-total-ms"))
      .toBe(`${AFTERSIGN_SCENE_TRANSITION_FEEL.reducedMotionDurationMs}ms`);
  });

  it("carries the pinned scene-transition contract on the mounted layer's dataset", () => {
    resolveAndPlayAftersignSceneTransition(state("kiosk"), state("io-return"));

    const layer = layers()[0] as HTMLElement;

    // Top-level timing + audio coupling — driven straight from the spec.
    expect(layer.dataset.totalDurationMs).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.totalDurationMs),
    );
    expect(layer.dataset.audioRecognitionSettleHz).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.recognitionSettleHz),
    );
    expect(layer.dataset.audioJobOfferRiseHz).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.jobOfferRiseHz),
    );
    expect(layer.dataset.audioRouteCommitHz).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.routeCommitHz),
    );
    expect(layer.dataset.audioGainDb).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.gainDb),
    );

    // Per-phase payloads. The dataset keys mirror the phase ids
    // (recognition-settle → phaseRecognitionSettle…) so a rendered
    // camera/vignette component can pick them up by name.
    expect(layer.dataset.phaseRecognitionSettleDurationMs).toBe("180");
    expect(layer.dataset.phaseRecognitionSettleCameraDriftPx).toBe("4");
    expect(layer.dataset.phaseJobOfferRiseCameraDriftPx).toBe("9");
    expect(layer.dataset.phaseJobOfferRiseCameraRollDeg).toBe("0.5");
    expect(layer.dataset.phaseRouteCommitDelayMs).toBe("360");
    expect(layer.dataset.phaseRouteCommitEasing).toBe(
      "cubic-bezier(0.16, 1, 0.3, 1)",
    );

    // From/to scene labels — the served renderer uses these to pick
    // the correct background / portrait pair.
    expect(layer.dataset.fromScene).toBe("kiosk");
    expect(layer.dataset.toScene).toBe("io-return");
    expect(layer.getAttribute("aria-hidden")).toBe("true");
  });

  it("supports mounting to a caller-provided root instead of document.body", () => {
    const stage = document.createElement("section");
    stage.id = "aftersign-stage";
    document.body.appendChild(stage);

    const handle = resolveAndPlayAftersignSceneTransition(
      state("io-return"),
      state("orra-return"),
      { root: stage },
    );

    expect(handle!.layer.parentElement).toBe(stage);
    expect(layers()).toHaveLength(1);
  });

  it("zeroes drift + roll under reducedMotion but keeps audio + tempo metadata", () => {
    resolveAndPlayAftersignSceneTransition(
      state("kiosk"),
      state("io-return"),
      { reducedMotion: true },
    );

    const layer = layers()[0] as HTMLElement;
    expect(layer.dataset.reducedMotion).toBe("true");
    expect(layer.dataset.phaseRecognitionSettleCameraDriftPx).toBe("0");
    expect(layer.dataset.phaseJobOfferRiseCameraDriftPx).toBe("0");
    expect(layer.dataset.phaseRouteCommitCameraDriftPx).toBe("0");
    expect(layer.dataset.phaseRecognitionSettleCameraRollDeg).toBe("0");
    expect(layer.dataset.phaseJobOfferRiseCameraRollDeg).toBe("0");

    // Audio coupling + reduced-motion duration must survive.
    expect(layer.dataset.totalDurationMs).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.reducedMotionDurationMs),
    );
    expect(layer.dataset.audioRouteCommitHz).toBe(
      String(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.routeCommitHz),
    );
  });

  it("cleans up the served layer at totalDurationMs + tailMs", () => {
    resolveAndPlayAftersignSceneTransition(state("kiosk"), state("io-return"));
    expect(layers()).toHaveLength(1);

    const { totalDurationMs } = AFTERSIGN_SCENE_TRANSITION_FEEL;

    vi.advanceTimersByTime(totalDurationMs + SCENE_TRANSITION_CLEANUP_TAIL_MS - 1);
    expect(layers()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(0);
  });

  it("cleans up on the reduced-motion tempo when reducedMotion is set", () => {
    resolveAndPlayAftersignSceneTransition(
      state("kiosk"),
      state("io-return"),
      { reducedMotion: true },
    );
    expect(layers()).toHaveLength(1);

    // At the FULL-motion tempo the layer would still be up; at the
    // reduced-motion tempo it must already be gone.
    vi.advanceTimersByTime(
      AFTERSIGN_SCENE_TRANSITION_FEEL.reducedMotionDurationMs +
        SCENE_TRANSITION_CLEANUP_TAIL_MS,
    );
    expect(layers()).toHaveLength(0);
  });

  it("dispose() rips the layer down early and cancels the auto-cleanup", () => {
    const handle = resolveAndPlayAftersignSceneTransition(
      state("kiosk"),
      state("io-return"),
    );
    expect(handle).not.toBeNull();
    expect(layers()).toHaveLength(1);

    handle!.dispose();
    expect(layers()).toHaveLength(0);

    vi.advanceTimersByTime(
      AFTERSIGN_SCENE_TRANSITION_FEEL.totalDurationMs +
        SCENE_TRANSITION_CLEANUP_TAIL_MS +
        200,
    );
    expect(layers()).toHaveLength(0);

    expect(() => handle!.dispose()).not.toThrow();
  });

  it("plays a pre-resolved cue without re-running the resolver", () => {
    const cue = resolveAftersignSceneTransitionCue(
      state("kiosk"),
      state("io-return"),
    );
    expect(cue).not.toBeNull();
    const handle = playAftersignSceneTransition(cue!);

    expect(handle.cue).toBe(cue);
    expect(handle.feel).toBe(AFTERSIGN_SCENE_TRANSITION_FEEL);
    expect(layers()).toHaveLength(1);
  });
});

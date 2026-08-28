// Consumer test for the AFTERSIGN scene-transition wiring on the
// SERVED harness surface. This is the test that answers Soren's
// blocking-review question ("no rendered component reads these
// numbers"): we boot the actual `window.__game` harness that ships to
// the page, call `meetNpc("io")` to change the scene from `kiosk` →
// `io-return`, and assert that:
//   - the `.aftersign-scene-transition` layer really landed on
//     `document.body` (there's a rendered implementor, not a
//     spec-with-no-consumer);
//   - the mounted layer's `dataset` carries the exact spec numbers
//     from `AFTERSIGN_SCENE_TRANSITION_FEEL` (a change to the pure
//     contract must break this DOM read, so the test is NOT
//     green-by-construction — the numbers travel from the const,
//     through the harness, through the resolver, into a real DOM
//     node);
//   - a first meet with no scene change is a no-op (the transition
//     is armed by the SCENE flip, not by every meet);
//   - `getSceneTransitionHandle()` exposes the same handle the DOM
//     read finds, so a page-side renderer can pull the pinned feel
//     numbers without walking the DOM if it doesn't want to.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AFTERSIGN_SCENE_TRANSITION_FEEL,
} from "../aftersignSceneTransitionFeel";
import { bootAftersignWindowGame } from "./bootWindowGame";

const LAYER_SELECTOR = ".aftersign-scene-transition";

function layers(): HTMLElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>(LAYER_SELECTOR),
  );
}

describe("aftersign window-game harness — scene-transition wiring", () => {
  beforeEach(() => {
    // Every test boots a fresh harness with `bootAftersignWindowGame()`,
    // so the only carry-over risk is DOM: a prior test's scene-transition
    // layer could linger on document.body if its auto-cleanup timer
    // hasn't fired. Nuke it so each assertion counts only THIS test's
    // mounted layers.
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts the scene-transition layer on document.body when meetNpc('io') flips the scene", () => {
    const game = bootAftersignWindowGame();
    expect(layers()).toHaveLength(0);
    expect(game.getSceneTransitionHandle()).toBeNull();

    game.meetNpc("io");

    // The scene really changed (kiosk → io-return), so the harness
    // mounted a layer on document.body — the served page's camera /
    // vignette / audio renderer now has a real DOM node to read
    // dataset numbers off.
    expect(layers()).toHaveLength(1);

    const handle = game.getSceneTransitionHandle();
    expect(handle).not.toBeNull();
    expect(handle!.layer).toBe(layers()[0]);
    expect(handle!.layer.parentElement).toBe(document.body);
  });

  it("drives the mounted layer's dataset from AFTERSIGN_SCENE_TRANSITION_FEEL — spec change breaks this read", () => {
    const game = bootAftersignWindowGame();
    game.meetNpc("io");
    const layer = layers()[0]!;

    // Total tempo + audio coupling — these come STRAIGHT from the
    // contract. If a future edit drifts totalDurationMs or the
    // arpeggio Hz, this assertion breaks. That's exactly what stops
    // the spec from being green-by-construction: the numbers now
    // travel out of the const, through the harness, through the
    // resolver, into the DOM.
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

    // Per-phase payloads — recognition-settle → job-offer-rise →
    // route-commit. A renderer picks these up by phase name and drives
    // camera drift + roll + vignette from real numbers.
    expect(layer.dataset.phaseRecognitionSettleDurationMs).toBe("180");
    expect(layer.dataset.phaseRecognitionSettleCameraDriftPx).toBe("4");
    expect(layer.dataset.phaseJobOfferRiseCameraDriftPx).toBe("9");
    expect(layer.dataset.phaseJobOfferRiseCameraRollDeg).toBe("0.5");
    expect(layer.dataset.phaseRouteCommitDelayMs).toBe("360");

    // From / to labels so the renderer picks the correct backdrop.
    expect(layer.dataset.fromScene).toBe("kiosk");
    expect(layer.dataset.toScene).toBe("io-return");
  });

  it("chains transitions when the scene flips again (io-return → orra-return)", () => {
    const game = bootAftersignWindowGame();

    game.meetNpc("io");
    expect(layers()[0]!.dataset.fromScene).toBe("kiosk");
    expect(layers()[0]!.dataset.toScene).toBe("io-return");

    game.meetNpc("orra");
    // The first transition was disposed by the second call — only
    // ONE transition layer is live at a time (chained transitions
    // don't stack overlapping envelopes fighting for the camera).
    const live = layers();
    expect(live.length).toBeLessThanOrEqual(1);

    const handle = game.getSceneTransitionHandle();
    expect(handle).not.toBeNull();
    expect(handle!.layer.dataset.fromScene).toBe("io-return");
    expect(handle!.layer.dataset.toScene).toBe("orra-return");
  });

  it("does NOT mount a layer when meetNpc is a same-scene no-op", () => {
    const game = bootAftersignWindowGame();

    game.meetNpc("io"); // kiosk → io-return, mounts
    expect(layers()).toHaveLength(1);
    const firstHandle = game.getSceneTransitionHandle();
    expect(firstHandle).not.toBeNull();

    // Meeting Io again doesn't change scene — no new transition
    // fires, the prior handle stands. The renderer sees no new
    // camera envelope.
    game.meetNpc("io");
    expect(game.getSceneTransitionHandle()).toBe(firstHandle);
  });

  it("exposes the pinned feel contract via getSceneTransitionFeel for renderer imports", () => {
    const game = bootAftersignWindowGame();
    // The accessor returns the same const the DOM dataset was
    // driven from — a page-side camera component can pull the feel
    // numbers off the harness without re-importing the module.
    expect(game.getSceneTransitionFeel()).toBe(AFTERSIGN_SCENE_TRANSITION_FEEL);
  });
});

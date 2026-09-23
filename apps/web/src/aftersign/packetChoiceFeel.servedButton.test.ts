// Served-button consumer test for the packet-choice feedback token.
//
// The pure gesture judge `evaluatePacketChoiceGesture` emits one of
// four terminal feedback tokens (`"seal-strain" | "seal-break" |
// "seal-safe" | "previewed"`) that classify a release. Prior to this
// PR that vocabulary lived only in the pure module — the served
// `#packetButton` carried no attribute reflecting it, so a
// near-threshold `seal-break` release, an inspect-only `seal-strain`
// release, a preserve `seal-safe` tap, and a sub-preview `previewed`
// glance were all visually indistinguishable to the player.
//
// This test closes that gap by:
//
//   (1) Loading the REAL served `aftersign/index.html` — not a
//       synthetic `document.createElement("div")` — so the writer
//       runs against the same `#packetButton` element the shipped
//       page renders.
//   (2) Driving a gesture-summary tuple that lands each of the four
//       feedback tokens through the pure judge
//       `evaluatePacketChoiceGesture`, then handing the resulting
//       `PacketChoiceDecision` to `applyPacketChoiceFeedback` on the
//       real button.
//   (3) Asserting the served button's `dataset.packetFeedback`
//       matches the judge's token for every case, and that
//       non-committing decisions (`"none" | "inspect"`) CLEAR any
//       prior stamp instead of leaving stale terminal state.
//
// Registered in `apps/web/src/aftersign/vitest.config.ts`'s include
// list so it actually runs in the aftersign blocking lane. See
// HANDOFF-1760.md for why "consumer wired on the served surface"
// is the decisive test — a pure test alone would pass while the
// player-visible surface still lost the distinction.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyPacketChoiceFeedback,
  DEFAULT_PACKET_CHOICE_FEEL,
  evaluatePacketChoiceGesture,
  PACKET_CHOICE_FEEDBACK_VALUES,
  type PacketChoiceFeedbackValue,
  type PacketChoiceGesture,
} from "./packetChoiceFeel";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

// Gesture summaries that land each terminal feedback token through
// the pure judge. The numbers are anchored to
// `DEFAULT_PACKET_CHOICE_FEEL` so a drift in the shipped thresholds
// reds this fixture BEFORE any player-visible drift.
type FeedbackCase = {
  readonly feedback: PacketChoiceFeedbackValue;
  readonly gesture: PacketChoiceGesture;
};

const feedbackCases: readonly FeedbackCase[] = [
  {
    // A deliberate hold well past `openHoldMs` = 420ms. The pure
    // judge routes through the pure release-forgiveness contract
    // and returns `feedback: "seal-break"`.
    feedback: "seal-break",
    gesture: {
      kind: "hold",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.openHoldMs + 40,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    },
  },
  {
    // A tap inside `preserveTapMaxMs` = 180ms but above
    // `previewTapMaxMs` = 60ms. The pure judge accepts it as the
    // preserve commit and returns `feedback: "seal-safe"`.
    feedback: "seal-safe",
    gesture: {
      kind: "tap",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs - 20,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    },
  },
  {
    // A tap inside `previewTapMaxMs` = 60ms — a preview glance, not
    // a commit. Returns `feedback: "previewed"`.
    feedback: "previewed",
    gesture: {
      kind: "tap",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs - 10,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    },
  },
  {
    // A hold that overshoots the preserve-tap window and lands short
    // of the open-hold + release-grace window: inspect-only.
    // Returns `feedback: "seal-strain"`.
    feedback: "seal-strain",
    gesture: {
      kind: "tap",
      durationMs:
        DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs +
        DEFAULT_PACKET_CHOICE_FEEL.releaseGraceMs +
        20,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    },
  },
];

describe("packet-choice feedback stamp on the served #packetButton", () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
  });

  afterEach(() => {
    dom.window.close();
  });

  it("renders the #packetButton element in the served static markup", () => {
    // Sanity: the button the writer targets must exist in the
    // shipped HTML. A refactor that renames the id (or drops the
    // seal button entirely) reds here before the writer is even
    // exercised.
    const doc = dom.window.document;
    const packetButton = doc.getElementById("packetButton");
    expect(packetButton, "served page must render #packetButton").not.toBeNull();
    expect(packetButton?.tagName.toLowerCase()).toBe("button");
    // No packet-feedback stamp is present at page load — the
    // writer is the SOLE source of the attribute.
    expect(packetButton?.dataset.packetFeedback).toBeUndefined();
  });

  it("stamps each of the four feedback tokens on the shipped #packetButton", () => {
    // For every terminal feedback case, run the exact pure judge
    // that inputAdapters.js runs on the served release funnel, then
    // hand the decision to the writer against the REAL served
    // button. Asserts the round-trip end-to-end: gesture summary →
    // pure decision → DOM stamp.
    for (const { feedback, gesture } of feedbackCases) {
      const doc = new JSDOM(readServedIndexHtml()).window.document;
      const packetButton = doc.getElementById("packetButton") as HTMLElement;
      expect(packetButton).not.toBeNull();

      const decision = evaluatePacketChoiceGesture(
        gesture,
        DEFAULT_PACKET_CHOICE_FEEL,
      );
      expect(
        decision.feedback,
        `pure judge must classify the "${feedback}" fixture correctly`,
      ).toBe(feedback);

      const stamped = applyPacketChoiceFeedback(packetButton, decision);
      expect(stamped).toBe(feedback);
      expect(packetButton.dataset.packetFeedback).toBe(feedback);
    }
  });

  it("clears the stamp when a non-committing decision follows a terminal one", () => {
    // A cancelled gesture (or an off-seal release) returns
    // `feedback: "none"`; a drag-away returns `feedback: "inspect"`.
    // Both must CLEAR any stale terminal marker on the seal — a
    // player who cancels after a preserve-tap should not see the
    // `seal-safe` visual linger into the next attempt.
    const doc = dom.window.document;
    const packetButton = doc.getElementById("packetButton") as HTMLElement;

    // First: land a terminal `seal-safe` stamp.
    const preserveDecision = evaluatePacketChoiceGesture(
      {
        kind: "tap",
        durationMs: DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs - 20,
        travelPx: 0,
        startedOnSeal: true,
        endedOnSeal: true,
      },
      DEFAULT_PACKET_CHOICE_FEEL,
    );
    expect(preserveDecision.feedback).toBe("seal-safe");
    applyPacketChoiceFeedback(packetButton, preserveDecision);
    expect(packetButton.dataset.packetFeedback).toBe("seal-safe");

    // Then: a cancel decision must wipe it.
    const cancelDecision = evaluatePacketChoiceGesture(
      {
        kind: "cancel",
        durationMs: 100,
        travelPx: 0,
        startedOnSeal: true,
        endedOnSeal: true,
      },
      DEFAULT_PACKET_CHOICE_FEEL,
    );
    expect(cancelDecision.feedback).toBe("none");
    const cleared = applyPacketChoiceFeedback(packetButton, cancelDecision);
    expect(cleared).toBeNull();
    expect(packetButton.dataset.packetFeedback).toBeUndefined();
  });

  it("clears the stamp for an inspect (dragged-away) decision", () => {
    // A drag past `maxCommitTravelPx` returns
    // `feedback: "inspect"` — also non-committing, also must clear.
    const doc = dom.window.document;
    const packetButton = doc.getElementById("packetButton") as HTMLElement;

    // Seed a stale stamp so the assertion isn't vacuous.
    packetButton.dataset.packetFeedback = "seal-break";

    const dragDecision = evaluatePacketChoiceGesture(
      {
        kind: "drag",
        durationMs: 100,
        travelPx: DEFAULT_PACKET_CHOICE_FEEL.maxCommitTravelPx + 5,
        startedOnSeal: true,
        endedOnSeal: true,
      },
      DEFAULT_PACKET_CHOICE_FEEL,
    );
    expect(dragDecision.feedback).toBe("inspect");
    applyPacketChoiceFeedback(packetButton, dragDecision);
    expect(packetButton.dataset.packetFeedback).toBeUndefined();
  });

  it("exports every terminal feedback token from the shipped module", () => {
    // The four-value union is the contract between the pure judge,
    // the writer, and downstream CSS/e2e consumers. A drift here —
    // adding a fifth token without updating the writer — must red
    // this pin.
    expect(new Set(PACKET_CHOICE_FEEDBACK_VALUES)).toEqual(
      new Set(["seal-strain", "seal-break", "seal-safe", "previewed"]),
    );
  });
});

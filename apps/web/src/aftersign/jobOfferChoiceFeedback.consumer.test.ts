// Consumer test for `aftersign/src/jobOfferChoiceFeedback.js` — the
// main.js-facing wrapper that acknowledges the player's offer tap on
// the exact rendered button.
//
// This test is the trip-wire Soren's PR #1890 REQUEST_CHANGES demanded:
//
//   1. Vocabulary correctness — the wrapper accepts `routeRisk` in the
//      served vocabulary (`"low" | "medium" | "high"` — the values
//      `packages/aftersign/src/computeOfferedJobs.ts::OFFER_BY_ID`
//      actually emits) and maps them to the shipped feel table's
//      three-tone axis (`safe | risky | consequence`).
//
//   2. RENDERED outcome — the previous draft stamped invented CSS vars
//      and dataset attributes that NO served CSS read. This test
//      asserts the wrapper writes ONLY the `data-aftersign-job-risk`
//      attribute + the `--aftersign-job-offer-*` custom properties
//      the SHIPPED CSS block installs and reads, and that toggling
//      `.is-aftersign-job-offer-pressing` produces the pressed-scale
//      transform payload the served surface renders.
//
// Scope guard: does NOT re-pin the ms/px numbers here — those are
// owned by `apps/web/src/aftersign/ioJobOfferActionFeel.ts` and its
// own consumer test. This test asserts EQUALITY against that shipped
// table, so drift in either half reds this + the sibling consumer.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AFTERSIGN_JOB_OFFER_ACTION_FEEL,
  AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
} from "./ioJobOfferActionFeel";
import {
  applyJobOfferChoiceFeedback,
  getJobOfferChoiceFeedback,
} from "../../../../aftersign/src/jobOfferChoiceFeedback.js";

// jsdom returns custom-property values with a leading space — trim
// every read (same reason as returnToneChoiceFeel.consumer.test.ts +
// ioJobOfferActionFeel.consumer.test.ts).
const cssVar = (el: HTMLElement, name: string): string =>
  el.style.getPropertyValue(name).trim();

// The three axes below are the ONLY `routeRisk` values that reach the
// served offer button. Testing the wrapper with the CALL SITE's actual
// vocabulary is what pins the contract; feeding it `"safe"/"risky"`
// here would be tautological against the internal translation and
// would let the vocabulary-mismatch bug ship (PR #1890 review).
const ROUTE_RISK_TO_TONE = [
  ["low", "safe"],
  ["medium", "risky"],
  ["high", "consequence"],
] as const;

describe("jobOfferChoiceFeedback (main.js consumer)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head
      .querySelectorAll('style[data-aftersign-job-offer-action-feel="true"]')
      .forEach((node) => node.remove());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  describe("getJobOfferChoiceFeedback (pure resolver)", () => {
    for (const [routeRisk, tone] of ROUTE_RISK_TO_TONE) {
      it(`translates routeRisk=${routeRisk} to the ${tone} feel row`, () => {
        const feedback = getJobOfferChoiceFeedback(routeRisk);
        expect(feedback.tone).toBe(tone);
        // Equality against the shipped table — the wrapper is a
        // thin spread over `AFTERSIGN_JOB_OFFER_ACTION_FEEL[tone]`.
        expect(feedback.durationMs).toBe(
          AFTERSIGN_JOB_OFFER_ACTION_FEEL[tone].durationMs,
        );
        expect(feedback.pressScale).toBe(
          AFTERSIGN_JOB_OFFER_ACTION_FEEL[tone].pressScale,
        );
        expect(feedback.liftPx).toBe(
          AFTERSIGN_JOB_OFFER_ACTION_FEEL[tone].liftPx,
        );
      });
    }

    it("collapses an unknown routeRisk to the safe envelope, not a stronger tone", () => {
      const feedback = getJobOfferChoiceFeedback("unknown");
      expect(feedback.tone).toBe("safe");
      expect(feedback.pressScale).toBe(
        AFTERSIGN_JOB_OFFER_ACTION_FEEL.safe.pressScale,
      );
    });
  });

  describe("applyJobOfferChoiceFeedback (rendered outcome)", () => {
    it("installs the shipped CSS block on first call (idempotent)", () => {
      const button = document.createElement("button");
      document.body.append(button);

      applyJobOfferChoiceFeedback(button, "low");
      applyJobOfferChoiceFeedback(button, "medium");
      applyJobOfferChoiceFeedback(button, "high");

      const styles = document.head.querySelectorAll(
        'style[data-aftersign-job-offer-action-feel="true"]',
      );
      expect(styles).toHaveLength(1);
      // The installed CSS references the vars the wrapper stamps —
      // this is what makes the applied half a rendered outcome, not
      // a dead invented vocabulary.
      expect(styles[0]!.textContent).toContain(
        "--aftersign-job-offer-press-scale",
      );
      expect(styles[0]!.textContent).toContain("--aftersign-job-offer-lift");
      expect(styles[0]!.textContent).toContain(
        AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
      );
    });

    for (const [routeRisk, tone] of ROUTE_RISK_TO_TONE) {
      it(`stamps data-aftersign-job-risk="${tone}" and the shipped CSS vars for routeRisk=${routeRisk}`, () => {
        const button = document.createElement("button");
        document.body.append(button);

        applyJobOfferChoiceFeedback(button, routeRisk);

        expect(button.getAttribute("data-aftersign-job-risk")).toBe(tone);

        const feel = AFTERSIGN_JOB_OFFER_ACTION_FEEL[tone];
        expect(cssVar(button, "--aftersign-job-offer-duration")).toBe(
          `${feel.durationMs}ms`,
        );
        expect(cssVar(button, "--aftersign-job-offer-press-scale")).toBe(
          String(feel.pressScale),
        );
        expect(cssVar(button, "--aftersign-job-offer-lift")).toBe(
          `${feel.liftPx}px`,
        );
        expect(cssVar(button, "--aftersign-job-offer-glow")).toBe(
          String(feel.glowAlpha),
        );
      });
    }

    it("does NOT stamp the invented --aftersign-job-choice-* vocabulary", () => {
      // Regression pin on PR #1890's first draft: those custom
      // properties had no CSS consumer on the served surface, so any
      // future re-introduction is dead-on-arrival by construction.
      const button = document.createElement("button");
      document.body.append(button);

      applyJobOfferChoiceFeedback(button, "high");

      expect(cssVar(button, "--aftersign-job-choice-duration")).toBe("");
      expect(cssVar(button, "--aftersign-job-choice-lift")).toBe("");
      expect(cssVar(button, "--aftersign-job-choice-scale")).toBe("");
      expect(button.dataset.aftersignJobChoiceGlow).toBeUndefined();
      expect(button.dataset.aftersignJobChoiceActive).toBeUndefined();
    });

    it("toggles the pressed class ON immediately and OFF after durationMs", () => {
      const button = document.createElement("button");
      document.body.append(button);

      applyJobOfferChoiceFeedback(button, "medium");

      // On immediately — the acknowledgement lands in the same input
      // frame the player's tap resolves.
      expect(
        button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
      ).toBe(true);

      const risky = AFTERSIGN_JOB_OFFER_ACTION_FEEL.risky;
      // Just before the deadline the pressed class is still on.
      vi.advanceTimersByTime(risky.durationMs - 1);
      expect(
        button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
      ).toBe(true);

      // At/after the deadline the CSS transition has had time to
      // land the pressed transform; wrapper clears the marker so
      // the button eases back to rest.
      vi.advanceTimersByTime(2);
      expect(
        button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
      ).toBe(false);
    });

    it("returns null and does nothing when button is nullish", () => {
      // Defensive path — main.js's `armJobOfferFeel` callback runs
      // against `this` button, but a future refactor could pass a
      // handle that's already been GC'd. Fail closed, not loud.
      expect(applyJobOfferChoiceFeedback(null, "low")).toBeNull();
      expect(applyJobOfferChoiceFeedback(undefined, "low")).toBeNull();
    });
  });
});

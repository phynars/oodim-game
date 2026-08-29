// Served-surface consumer for the `#offeredJobs` job-offer buttons.
//
// Why this file exists (PR #1533 re-review, Soren blocked):
//   The first draft of this slice shipped `aftersign/src/jobOfferActionFeel.ts`
//   + a self-invoking test. Grep confirmed no other file imported
//   `getAvailableJobOfferActions` / `summarizeAvailableJobIds` —
//   `aftersign/main.js` renders job offers from the CANONICAL selector
//   at `packages/aftersign/src/computeOfferedJobs.ts` (see the
//   `import { selectIoJobOffers } from "../packages/aftersign/src/computeOfferedJobs"`
//   line in main.js and the button-stamp loop that writes
//   `<button id="job-offer-<jobId>" data-aftersign-tap-choice="offer-<jobId>">`
//   into `#offeredJobs`). So the added module was orphan code, and
//   its "44px tap target" assertion compared a constant against a
//   constant — no rendered affordance a player touches.
//
// This file replaces that with a real served-surface pin, in the
// same idiom as `routeRiskMemory.consumer.test.ts` +
// `tapChoiceFeel.consumer.test.ts`:
//
//   1. Load the REAL `aftersign/index.html` into JSDOM, find the
//      shipped `#offeredJobs` container.
//   2. Reproduce the exact `main.js` button-stamp (id, attrs, text)
//      for the ids `selectIoJobOffers(memory)` returns, so any drift
//      between served-render and this pin reds this test AND the
//      sibling e2e `aftersign/e2e/job-offers-played.spec.ts`.
//   3. Stub each rendered button's `getBoundingClientRect` (jsdom
//      returns 0×0 by default) and drive `assertAftersignTapChoiceSurfaces`
//      against the container. That's the same runtime contract the
//      served page uses via `window.__game.getTapChoiceFeelReport()`
//      — not a constant-against-constant claim.
//   4. Pin memory divergence on the rendered DOM: fresh memory →
//      `job-safe-delivery`; completed-prior-outcome memory →
//      `job-night-transfer` + `job-signed-receipt`, safe default
//      absent. Same divergence the e2e plays through beats; here
//      it's pinned at the render seam so a refactor that unwires
//      either half reds fast.
//   5. Regression pin: shrink ONE offer button below 44px on either
//      axis and confirm `assertAftersignTapChoiceSurfaces` flags THAT
//      offer's label with a real shortfall — proves the assertion
//      responds to real rect dimensions, not a canned "ok".
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (three.js + full scene graph).
//     The button-stamp logic is small enough to mirror inline; the
//     end-to-end played traversal is covered by the sibling
//     `aftersign/e2e/job-offers-played.spec.ts`.
//   - Does NOT re-assert the primitive `selectIoJobOffers` mapping
//     — that lives in `computeOfferedJobs.test.ts` beside the primitive.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  selectIoJobOffers,
  type IoJobOffer,
  type PlayerMemory,
} from "../../../../packages/aftersign/src/computeOfferedJobs";
import {
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  AFTERSIGN_TOUCH_FEEL,
  assertAftersignTapChoiceSurfaces,
} from "./tapChoiceFeel";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const TAP_MIN = AFTERSIGN_TOUCH_FEEL.minimumTargetPx;

const stubRect = (el: HTMLElement, width: number, height: number): void => {
  // jsdom's default `getBoundingClientRect` is a zero-sized DOMRect
  // regardless of the element's styles. Stub per-element with the
  // dimensions the layout claims — same discipline as the sibling
  // `tapChoiceFeel.consumer.test.ts`.
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
};

/**
 * Mirror of the button-stamp `aftersign/main.js` runs at the
 * `packet-offered` beat (see the `for (const offer of offers)` loop
 * around main.js line 1772). Keeps the id / attribute / textContent
 * shape in lockstep so a rename here reds beside the e2e that walks
 * the shipped selectors.
 */
function renderOfferedJobs(
  container: HTMLElement,
  offers: readonly IoJobOffer[],
  targetWidth: number = TAP_MIN,
  targetHeight: number = TAP_MIN,
): HTMLButtonElement[] {
  const doc = container.ownerDocument;
  // Clear (idempotency + "off-beat clears children" contract).
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.setAttribute("data-visible", "true");
  // Preserve the shipped label span sibling so we're rendering into
  // the actual served shape, not an emptied node.
  const label = doc.createElement("span");
  label.className = "route-choice-label";
  label.textContent = "Offered jobs";
  container.appendChild(label);

  const rendered: HTMLButtonElement[] = [];
  for (const offer of offers) {
    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("id", `job-offer-${offer.id}`);
    button.setAttribute("data-aftersign-tap-choice", `offer-${offer.id}`);
    button.setAttribute("data-offered-job-id", offer.id);
    button.setAttribute("data-offered-job-risk", offer.routeRisk);
    button.setAttribute("data-route-risk", offer.routeRisk);
    button.textContent = `${offer.label} · ${offer.routeRisk} risk`;
    stubRect(button, targetWidth, targetHeight);
    container.appendChild(button);
    rendered.push(button);
  }
  return rendered;
}

describe("#offeredJobs served-surface tap-target contract (drives real aftersign/index.html)", () => {
  let dom: JSDOM;
  let offeredJobs: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
    const container = dom.window.document.querySelector("#offeredJobs");
    if (!(container instanceof dom.window.HTMLElement)) {
      throw new Error(
        "served aftersign/index.html must host a #offeredJobs container",
      );
    }
    offeredJobs = container as unknown as HTMLElement;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hosts the shipped #offeredJobs container the main.js renderer stamps into", () => {
    // Baseline: if the served page loses the container, every
    // memory-gated job button has nowhere to render. Fires first
    // so the failure points at the DOM contract, not the renderer.
    expect(offeredJobs).not.toBeNull();
    expect(
      offeredJobs.hasAttribute("data-aftersign-offered-jobs-surface"),
    ).toBe(true);
    // Off-beat the container is present but hidden — matches the
    // shipped `data-visible="false"` idle state.
    expect(offeredJobs.getAttribute("data-visible")).toBe("false");
  });

  it("renders the safe-default offer on a fresh memory and the completed set after a delivery — divergent, tappable, 44px on both axes", () => {
    // === FRESH: no priorOutcome → safe-default only. ===
    const freshOffers = selectIoJobOffers(undefined);
    const freshButtons = renderOfferedJobs(offeredJobs, freshOffers);

    // The button-stamp landed real tappable nodes on the shipped
    // container, with the same `[data-aftersign-tap-choice]`
    // vocabulary the served tap-choice selector walks.
    expect(freshButtons.length).toBe(1);
    expect(offeredJobs.querySelector("#job-offer-job-safe-delivery"))
      .not.toBeNull();
    expect(
      offeredJobs.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
    ).toHaveLength(1);

    // Tap-target contract: every rendered offer meets 44px on both
    // axes, measured through the shipped assertion — the same one
    // `window.__game.getTapChoiceFeelReport()` calls at runtime.
    const freshReport = assertAftersignTapChoiceSurfaces(offeredJobs);
    expect(freshReport.ok).toBe(true);
    expect(freshReport.surfaceCount).toBe(1);
    expect(freshReport.failures).toEqual([]);
    expect(freshReport.results.map((r) => r.label)).toEqual([
      "offer-job-safe-delivery",
    ]);
    expect(freshReport.results[0]).toMatchObject({
      widthPx: TAP_MIN,
      heightPx: TAP_MIN,
      shortfallPx: 0,
      ok: true,
    });

    // === RETURNING: priorOutcome=completed → completed set. ===
    const completedMemory: PlayerMemory = { priorOutcome: "completed" };
    const completedOffers = selectIoJobOffers(completedMemory);
    const completedButtons = renderOfferedJobs(offeredJobs, completedOffers);

    expect(completedButtons.length).toBe(2);
    expect(offeredJobs.querySelector("#job-offer-job-night-transfer"))
      .not.toBeNull();
    expect(offeredJobs.querySelector("#job-offer-job-signed-receipt"))
      .not.toBeNull();
    // The divergence pin — safe-default is GONE, replaced by the
    // completed set. Same acceptance shape the sibling
    // `job-offers-played.spec.ts` asserts through real beats.
    expect(offeredJobs.querySelector("#job-offer-job-safe-delivery"))
      .toBeNull();

    const completedReport = assertAftersignTapChoiceSurfaces(offeredJobs);
    expect(completedReport.ok).toBe(true);
    expect(completedReport.surfaceCount).toBe(2);
    expect(completedReport.results.map((r) => r.label)).toEqual([
      "offer-job-night-transfer",
      "offer-job-signed-receipt",
    ]);
    for (const result of completedReport.results) {
      expect(result.widthPx).toBe(TAP_MIN);
      expect(result.heightPx).toBe(TAP_MIN);
      expect(result.shortfallPx).toBe(0);
    }

    // Cross-run divergence: the two renders offer DIFFERENT id sets.
    const freshIds = freshOffers.map((o) => o.id);
    const completedIds = completedOffers.map((o) => o.id);
    expect(freshIds).not.toEqual(completedIds);
  });

  it("routes a real .click() on a rendered offer through the button's tap-choice attribute", () => {
    const freshOffers = selectIoJobOffers(undefined);
    const [safeButton] = renderOfferedJobs(offeredJobs, freshOffers);

    const taps: string[] = [];
    safeButton.addEventListener("click", (event) => {
      const target = event.currentTarget as HTMLElement;
      taps.push(target.getAttribute("data-aftersign-tap-choice") ?? "");
    });

    // Real click on the real served node — mirrors the tap the
    // sibling e2e drives against the shipped page.
    safeButton.click();

    expect(taps).toEqual(["offer-job-safe-delivery"]);
  });

  it("flags an undersized offer button with a real shortfall — the 44px pin is on live rects, not a constant", () => {
    // Regression: renderer bug shrinks ONE offer's height to 40px.
    // The assertion must (a) still return ok=false, (b) name the
    // affected offer's `data-aftersign-tap-choice` label, (c) report
    // the exact shortfall.
    const offers = selectIoJobOffers({ priorOutcome: "completed" });
    const buttons = renderOfferedJobs(offeredJobs, offers);
    // Squish the second offer's HEIGHT by 4px.
    stubRect(buttons[1], TAP_MIN, TAP_MIN - 4);

    const report = assertAftersignTapChoiceSurfaces(offeredJobs);
    expect(report.ok).toBe(false);
    expect(report.surfaceCount).toBe(2);
    expect(report.failures).toHaveLength(1);

    const failure = report.failures[0];
    expect(failure.label).toBe("offer-job-signed-receipt");
    expect(failure.widthPx).toBe(TAP_MIN);
    expect(failure.heightPx).toBe(TAP_MIN - 4);
    expect(failure.shortfallPx).toBe(4);
    expect(failure.minimumTargetPx).toBe(TAP_MIN);

    // Width-axis shortfall symmetry — squish the first offer's WIDTH
    // instead and confirm the failure reports the width dimension.
    stubRect(buttons[0], TAP_MIN - 6, TAP_MIN);
    stubRect(buttons[1], TAP_MIN, TAP_MIN); // repair the second

    const widthReport = assertAftersignTapChoiceSurfaces(offeredJobs);
    expect(widthReport.ok).toBe(false);
    expect(widthReport.failures).toHaveLength(1);
    expect(widthReport.failures[0].label).toBe(
      "offer-job-night-transfer",
    );
    expect(widthReport.failures[0].widthPx).toBe(TAP_MIN - 6);
    expect(widthReport.failures[0].shortfallPx).toBe(6);
  });

  it("clears the offered-jobs surface between renders — no stale nodes leak across beats", () => {
    // Off-beat, main.js clears `#offeredJobs.firstChild` in a loop.
    // Mirror that here: render the completed set, then re-render
    // the fresh set, and confirm the completed buttons are gone.
    renderOfferedJobs(offeredJobs, selectIoJobOffers({ priorOutcome: "completed" }));
    expect(offeredJobs.querySelectorAll("button").length).toBe(2);

    renderOfferedJobs(offeredJobs, selectIoJobOffers(undefined));
    expect(offeredJobs.querySelectorAll("button").length).toBe(1);
    expect(offeredJobs.querySelector("#job-offer-job-night-transfer"))
      .toBeNull();
    expect(offeredJobs.querySelector("#job-offer-job-signed-receipt"))
      .toBeNull();
    expect(offeredJobs.querySelector("#job-offer-job-safe-delivery"))
      .not.toBeNull();
  });
});

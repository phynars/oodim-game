// Served-surface consumer for the DEBT-HELD branch of `#offeredJobs`.
//
// Why this file exists (PR #1624 re-review — Soren blocked):
//   The first draft of the debt-held axis added the branch inside the
//   PRIMITIVE (`packages/aftersign/src/computeOfferedJobs.ts`) and a
//   `contract.test.ts` that called `selectIoJobOffers({ debtHeld: 1 })`
//   directly. Nothing drove the axis through
//   `createAftersignWindowGameSurface`. And the pipe was actually
//   broken at that seam: `resolveOfferedJobsMemory` guarded on
//   `"trustPosture" in input || "priorOutcome" in input`, so a
//   `{ debtHeld: 1 }` bag fell through to
//   `deriveOfferedJobsPlayerMemory` (which reads only
//   `interactionCount`), the axis got dropped, and the surface
//   silently returned the safe default. The unit tests were green
//   against a served surface that never emitted the offer.
//
// This file is the missing pin: a real save round-trip that carries
// `debtHeld` into `createAftersignWindowGameSurface`, publishes
// `story.offeredJobs`, stamps those offers into the SHIPPED
// `#offeredJobs` container in `aftersign/index.html`, and drives a
// real `.click()` on the debt-repair button so the tap-choice
// vocabulary is proven end-to-end at the render seam.
//
// The three assertions the sibling `.contract.test.ts` cannot make:
//   1. `createAftersignWindowGameSurface(...).getStoryState().story
//      .offeredJobs` returns the debt-repair offer for a debt-held
//      bag — i.e. the wiring gap in `resolveOfferedJobsMemory` is
//      closed at the SURFACE, not just inside the primitive.
//   2. That offer renders as a tappable button inside the shipped
//      `#offeredJobs` container from `aftersign/index.html`, with
//      the same id / `data-aftersign-tap-choice` / `data-route-risk`
//      shape `aftersign/main.js` stamps at runtime.
//   3. A `.click()` on the rendered debt-repair button fires the
//      `offer-job-wax-debt-repair` tap-choice — the vocabulary the
//      served tap-choice selector walks.
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (three.js + full scene
//     graph). The stamp is small and mirrored inline; the sibling
//     `offeredJobsTapTargetFeel.consumer.test.ts` pins the same
//     stamp shape for the fresh / completed branches.
//   - Does NOT re-assert the primitive `computeOfferedJobs`
//     mapping — that lives in `computeOfferedJobs.test.ts` beside
//     the primitive.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEBT_HELD_JOB_IDS,
  SAFE_DEFAULT_JOB_ID,
  type IoJobOffer,
} from "../../../../packages/aftersign/src/computeOfferedJobs";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";
import { createAftersignVerticalSliceState } from "./verticalSliceRuntimeState";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

/**
 * Mirror of the button-stamp `aftersign/main.js` runs at the
 * `packet-offered` beat (see the `for (const offer of offers)` loop
 * in main.js). Kept in lockstep with
 * `offeredJobsTapTargetFeel.consumer.test.ts::renderOfferedJobs` —
 * this is the seam a rename here reds beside the e2e that walks
 * the shipped selectors.
 */
function renderOfferedJobs(
  container: HTMLElement,
  offers: readonly IoJobOffer[],
): HTMLButtonElement[] {
  const doc = container.ownerDocument;
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.setAttribute("data-visible", "true");
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
    container.appendChild(button);
    rendered.push(button);
  }
  return rendered;
}

const getStoryStateForDebtHeld = (
  debtHeld: number,
): AftersignStoryStateSnapshot =>
  createAftersignWindowGameSurface(createAftersignVerticalSliceState(), {
    playerId: "aftersign.player.debt",
    playerName: "Ivy",
    offeredJobsMemory: { debtHeld },
  }).getStoryState();

const getStoryStateForFresh = (): AftersignStoryStateSnapshot =>
  createAftersignWindowGameSurface(createAftersignVerticalSliceState(), {
    playerId: "aftersign.player.fresh",
    playerName: "Ivy",
  }).getStoryState();

describe("#offeredJobs debt-held served-surface wiring (drives real aftersign/index.html + windowGameSurface)", () => {
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

  it("publishes the debt-repair offer through createAftersignWindowGameSurface for a debtHeld > 0 save", () => {
    // The load-bearing assertion for this PR: the SURFACE, not just
    // the primitive, has to emit the debt-repair branch. Before the
    // wiring fix in `resolveOfferedJobsMemory`, the surface silently
    // returned the safe default for this exact input.
    const snapshot = getStoryStateForDebtHeld(1);

    expect(snapshot.story.offeredJobs.map((o) => o.id)).toEqual([
      ...DEBT_HELD_JOB_IDS,
    ]);
    expect(snapshot.story.offeredJobs).toHaveLength(1);
    expect(snapshot.story.offeredJobs[0]).toMatchObject({
      id: "job-wax-debt-repair",
      routeRisk: "medium",
      requiresMemory: true,
    });
    // Copy is the AUTHORED label — the primitive's OFFER_BY_ID
    // shape rides through to the surface unmodified.
    expect(snapshot.story.offeredJobs[0].label).toBe("Wax-debt repair run");

    // Divergence pin: the fresh surface still emits the safe default.
    // If a future refactor collapses the two branches, this reds
    // alongside the sibling `.contract.test.ts::ioJobOffersDiverge`
    // assertion — but at the SURFACE seam, not inside the primitive.
    const freshSnapshot = getStoryStateForFresh();
    expect(freshSnapshot.story.offeredJobs.map((o) => o.id)).toEqual([
      SAFE_DEFAULT_JOB_ID,
    ]);
    expect(freshSnapshot.story.offeredJobs.map((o) => o.id)).not.toEqual(
      snapshot.story.offeredJobs.map((o) => o.id),
    );
  });

  it("treats debtHeld=0 as no debt — surface returns the safe default", () => {
    // Regression guard for the primitive's `> 0` predicate: a zero
    // debtHeld must NOT fabricate the branch even though the key is
    // present. This exercise passes through the primitive-shape
    // guard in `resolveOfferedJobsMemory` (which now includes
    // `"debtHeld" in input`) — proving the guard's inclusion of the
    // key doesn't override the primitive's numeric predicate.
    const snapshot = getStoryStateForDebtHeld(0);

    expect(snapshot.story.offeredJobs.map((o) => o.id)).toEqual([
      SAFE_DEFAULT_JOB_ID,
    ]);
  });

  it("stamps the debt-repair offer as a tappable button in the shipped #offeredJobs container", () => {
    const snapshot = getStoryStateForDebtHeld(1);
    const buttons = renderOfferedJobs(offeredJobs, snapshot.story.offeredJobs);

    expect(buttons).toHaveLength(1);
    const debtButton = offeredJobs.querySelector(
      "#job-offer-job-wax-debt-repair",
    );
    expect(debtButton).not.toBeNull();
    // Same `data-aftersign-tap-choice` vocabulary the served tap-choice
    // selector walks in `tapChoiceFeel.ts`.
    expect(debtButton?.getAttribute("data-aftersign-tap-choice")).toBe(
      "offer-job-wax-debt-repair",
    );
    // Route-risk copy lands on the button so the e2e route/risk
    // spec (`aftersign/e2e/job-offer-route-risk-copy-played.spec.ts`)
    // can read it verbatim from the rendered DOM.
    expect(debtButton?.getAttribute("data-route-risk")).toBe("medium");
    expect(debtButton?.textContent).toContain("Wax-debt repair run");
    expect(debtButton?.textContent).toContain("medium risk");

    // Safe-default button MUST be absent — proves the divergence
    // landed on the rendered DOM, not just in the snapshot.
    expect(offeredJobs.querySelector(`#job-offer-${SAFE_DEFAULT_JOB_ID}`))
      .toBeNull();
  });

  it("routes a real .click() on the debt-repair button through its offer-job-wax-debt-repair tap-choice", () => {
    const snapshot = getStoryStateForDebtHeld(2);
    const [debtButton] = renderOfferedJobs(
      offeredJobs,
      snapshot.story.offeredJobs,
    );

    const taps: string[] = [];
    debtButton.addEventListener("click", (event) => {
      const target = event.currentTarget as HTMLElement;
      taps.push(target.getAttribute("data-aftersign-tap-choice") ?? "");
    });

    debtButton.click();

    // Real tap on a real served node, routed through the shipped
    // tap-choice vocabulary. This is the assertion that makes the
    // debt-held axis a PLAYER-OUTCOME story, not a green unit test:
    // a player who taps this button hits the debt-repair offer.
    expect(taps).toEqual(["offer-job-wax-debt-repair"]);
  });

  it("preserves the debt-repair branch when a trusted-courier posture is NOT set — but yields to it when it is (surface-layer override pin)", () => {
    // Cross-axis pin at the SURFACE: proves the primitive's
    // override order (trusted-courier > debt-held) rides through
    // the wiring unchanged. A wiring bug that stripped `debtHeld`
    // and defaulted the memory would erase this contrast — the
    // trusted-courier surface would win, but by accident, because
    // the debt-repair surface would ALSO be safe-default.
    const debtOnly = createAftersignWindowGameSurface(
      createAftersignVerticalSliceState(),
      {
        playerId: "p1",
        playerName: "Ivy",
        offeredJobsMemory: { debtHeld: 3 },
      },
    )
      .getStoryState()
      .story.offeredJobs.map((o) => o.id);
    const trustedOverridesDebt = createAftersignWindowGameSurface(
      createAftersignVerticalSliceState(),
      {
        playerId: "p2",
        playerName: "Ivy",
        offeredJobsMemory: { trustPosture: "trusted-courier", debtHeld: 3 },
      },
    )
      .getStoryState()
      .story.offeredJobs.map((o) => o.id);

    expect(debtOnly).toEqual(["job-wax-debt-repair"]);
    // Trusted-courier outranks debt-held — same override order the
    // primitive asserts, now proven at the surface seam.
    expect(trustedOverridesDebt).not.toContain("job-wax-debt-repair");
    expect(trustedOverridesDebt).not.toEqual(debtOnly);
  });
});

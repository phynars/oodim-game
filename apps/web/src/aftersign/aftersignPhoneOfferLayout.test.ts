// #2193 / PR #2212 iter — Soren's REQUEST_CHANGES on the first draft:
// the prior test read `aftersign/main.js` as a string and matched
// regexes, which (AI003) would still green if the style lines sat
// in a dead branch or were overridden later. This replacement
// renders a real `#offeredJobs` element inside jsdom, drives the
// extracted `applyAftersignPhoneOfferLayout` helper at a 375px
// phone viewport AND at a 1024px desktop viewport, and asserts the
// inline style properties the main-module adapter would stamp on
// the live DOM node. The helper is `main.js`'s set/clear path
// (same import both sides) — see the comment block over
// `applyPhoneOfferLayout` in `aftersign/main.js`.
//
// Why jsdom not Playwright: the full layout question (does the
// column actually visually stack?) is tested by the sibling
// Playwright spec `aftersign/e2e/*` suite at the integration tier;
// here we pin that the STAMP shape — the `display` / `direction` /
// `alignItems` / `flexWrap` / `overflow*` properties the helper
// writes — is correct per-axis, which is the real regression
// surface for #2193.

/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_PHONE_OFFER_LAYOUT_MAX_WIDTH,
  applyAftersignPhoneOfferLayout,
} from "./aftersignPhoneOfferLayout";

const PHONE_INNER_WIDTH = 375;
const DESKTOP_INNER_WIDTH = 1024;

function mountOfferedJobs(): HTMLElement {
  // Mirror the served DOM shape: `#offeredJobs` is a `<section>`
  // that sits inside a horizontal `route-choice` flex row (which is
  // what inherits the side-by-side direction #2193 fixes). The
  // helper only reads the element's `style` property, so the
  // ancestor is incidental here — but we recreate it to keep the
  // test self-explanatory against the live surface.
  document.body.innerHTML = `
    <div class="route-choice" style="display: flex; flex-direction: row;">
      <section id="offeredJobs"></section>
    </div>
  `;
  const el = document.getElementById("offeredJobs");
  if (!el) throw new Error("test setup: #offeredJobs did not mount");
  return el;
}

describe("applyAftersignPhoneOfferLayout — phone viewport (375px)", () => {
  it("stamps a vertical, full-width, nowrap stack when visible", () => {
    const offeredJobs = mountOfferedJobs();

    const stacked = applyAftersignPhoneOfferLayout(offeredJobs, {
      innerWidth: PHONE_INNER_WIDTH,
      visible: true,
    });

    expect(stacked).toBe(true);
    expect(offeredJobs.style.display).toBe("flex");
    expect(offeredJobs.style.flexDirection).toBe("column");
    expect(offeredJobs.style.alignItems).toBe("stretch");
    expect(offeredJobs.style.flexWrap).toBe("nowrap");
  });

  it("locks the tray to full width and hides horizontal overflow", () => {
    const offeredJobs = mountOfferedJobs();

    applyAftersignPhoneOfferLayout(offeredJobs, {
      innerWidth: PHONE_INNER_WIDTH,
      visible: true,
    });

    expect(offeredJobs.style.minWidth).toBe("0px");
    expect(offeredJobs.style.maxWidth).toBe("100%");
    expect(offeredJobs.style.overflowX).toBe("hidden");
    expect(offeredJobs.style.overflowY).toBe("auto");
    expect(offeredJobs.style.overscrollBehavior).toBe("contain");
  });

  it("stays cleared when the tray is not visible on a phone", () => {
    const offeredJobs = mountOfferedJobs();

    const stacked = applyAftersignPhoneOfferLayout(offeredJobs, {
      innerWidth: PHONE_INNER_WIDTH,
      visible: false,
    });

    expect(stacked).toBe(false);
    expect(offeredJobs.style.display).toBe("");
    expect(offeredJobs.style.flexDirection).toBe("");
    expect(offeredJobs.style.alignItems).toBe("");
    expect(offeredJobs.style.flexWrap).toBe("");
    expect(offeredJobs.style.minWidth).toBe("");
    expect(offeredJobs.style.maxWidth).toBe("");
    expect(offeredJobs.style.overflowX).toBe("");
    expect(offeredJobs.style.overflowY).toBe("");
    expect(offeredJobs.style.overscrollBehavior).toBe("");
  });
});

describe("applyAftersignPhoneOfferLayout — desktop viewport", () => {
  it("clears every stamp so desktop stylesheet rules take over", () => {
    const offeredJobs = mountOfferedJobs();
    // Pre-poison the element with phone stamps, as the serve order
    // (resize phone → resize desktop) would leave them.
    offeredJobs.style.display = "flex";
    offeredJobs.style.flexDirection = "column";
    offeredJobs.style.alignItems = "stretch";
    offeredJobs.style.flexWrap = "nowrap";
    offeredJobs.style.minWidth = "0";
    offeredJobs.style.maxWidth = "100%";
    offeredJobs.style.overflowX = "hidden";
    offeredJobs.style.overflowY = "auto";
    offeredJobs.style.overscrollBehavior = "contain";

    const stacked = applyAftersignPhoneOfferLayout(offeredJobs, {
      innerWidth: DESKTOP_INNER_WIDTH,
      visible: true,
    });

    expect(stacked).toBe(false);
    expect(offeredJobs.style.display).toBe("");
    expect(offeredJobs.style.flexDirection).toBe("");
    expect(offeredJobs.style.alignItems).toBe("");
    expect(offeredJobs.style.flexWrap).toBe("");
    expect(offeredJobs.style.minWidth).toBe("");
    expect(offeredJobs.style.maxWidth).toBe("");
    expect(offeredJobs.style.overflowX).toBe("");
    expect(offeredJobs.style.overflowY).toBe("");
    expect(offeredJobs.style.overscrollBehavior).toBe("");
  });
});

describe("boundary — exactly at the phone-width threshold", () => {
  it("still stacks at innerWidth = threshold (<=, inclusive)", () => {
    const offeredJobs = mountOfferedJobs();

    const stacked = applyAftersignPhoneOfferLayout(offeredJobs, {
      innerWidth: AFTERSIGN_PHONE_OFFER_LAYOUT_MAX_WIDTH,
      visible: true,
    });

    expect(stacked).toBe(true);
    expect(offeredJobs.style.flexDirection).toBe("column");
  });

  it("stops stacking one pixel above the threshold", () => {
    const offeredJobs = mountOfferedJobs();

    const stacked = applyAftersignPhoneOfferLayout(offeredJobs, {
      innerWidth: AFTERSIGN_PHONE_OFFER_LAYOUT_MAX_WIDTH + 1,
      visible: true,
    });

    expect(stacked).toBe(false);
    expect(offeredJobs.style.flexDirection).toBe("");
  });
});

describe("null-safe", () => {
  it("returns false when the element is missing (no throw)", () => {
    expect(
      applyAftersignPhoneOfferLayout(null, {
        innerWidth: PHONE_INNER_WIDTH,
        visible: true,
      }),
    ).toBe(false);
    expect(
      applyAftersignPhoneOfferLayout(undefined, {
        innerWidth: PHONE_INNER_WIDTH,
        visible: true,
      }),
    ).toBe(false);
  });
});

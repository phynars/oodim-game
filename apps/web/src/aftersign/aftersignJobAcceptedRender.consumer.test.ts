// Consumer test — mounts a fragment matching the served
// `aftersign/index.html` shape (a `#line` paragraph inside a
// dialogue container), then exercises the acceptance writer against
// it and asserts the sibling paragraph lands with the exact copy
// from `aftersignJobAcceptedCopy.js`.
//
// Why this exists: PR #1884's first draft asserted the acceptance
// line against `#line` (owned by the beat dialogue table — see
// `io-phone-ready-look-sound-contract.spec.ts`). Mara's REQUEST_CHANGES
// cited AI007 (spec asserting behavior no production code produces).
// This bundle plus `aftersign/main.js`'s `packet-offered` render path
// and the retargeted tap-driven e2e
// (`aftersign/e2e/aftersign-job-take-feel.playtest.spec.ts`) close
// the wire-in. Same shape as PR #1874's
// `ioSecondPacketPointerRender.consumer.test.ts` — a sibling
// paragraph next to `#line`, never an overwrite.

import { describe, expect, it, beforeEach } from "vitest";

import {
  JOB_TAKE_ACK_LINE_DATA_ATTR,
  JOB_TAKE_ACK_LINE_ID,
  stampJobAcceptedLine,
} from "./aftersignJobAcceptedRender.ts";
import {
  aftersignJobAcceptedLine,
} from "./aftersignJobAcceptedCopy.js";

function mountLineFixture(): void {
  document.body.innerHTML = `
    <main>
      <p id="speaker"></p>
      <p id="line">Keep it sealed if you want the city to trust you.</p>
      <div id="afterLine"></div>
    </main>
  `;
}

describe("aftersignJobAcceptedRender served consumer", () => {
  beforeEach(() => {
    mountLineFixture();
  });

  it("inserts a sibling paragraph directly after #line with the safe-delivery ack copy", () => {
    const line = aftersignJobAcceptedLine("job-safe-delivery");
    const el = stampJobAcceptedLine(document, "job-safe-delivery", line);

    expect(el).not.toBeNull();
    const ack = document.getElementById(JOB_TAKE_ACK_LINE_ID);
    expect(ack).not.toBeNull();
    expect(ack!.textContent).toBe(line);
    expect(ack!.getAttribute(JOB_TAKE_ACK_LINE_DATA_ATTR)).toBe(
      "job-safe-delivery",
    );
    // Sibling directly after #line — not inside it, not appended to body.
    const lineEl = document.getElementById("line");
    expect(lineEl!.nextElementSibling).toBe(ack);
  });

  it("stamps the sealed-return ack copy on a subsequent jobId", () => {
    const line = aftersignJobAcceptedLine("job-sealed-return");
    stampJobAcceptedLine(document, "job-sealed-return", line);
    const ack = document.getElementById(JOB_TAKE_ACK_LINE_ID);
    expect(ack!.textContent).toBe(line);
    expect(ack!.textContent).toContain("Sealed return");
    expect(ack!.getAttribute(JOB_TAKE_ACK_LINE_DATA_ATTR)).toBe(
      "job-sealed-return",
    );
  });

  it("does NOT overwrite #line textContent (the beat dialogue table owns that)", () => {
    const beatLine = document.getElementById("line")!.textContent;
    const ackLine = aftersignJobAcceptedLine("job-safe-delivery");
    stampJobAcceptedLine(document, "job-safe-delivery", ackLine);
    // #line text is unchanged — the ack is a NEW paragraph, not an
    // overwrite. This preserves the contract-pinned invariant on
    // `state.npcs.io.lastLine` / `#line` textContent.
    expect(document.getElementById("line")!.textContent).toBe(beatLine);
    expect(document.getElementById(JOB_TAKE_ACK_LINE_ID)!.textContent).toBe(
      ackLine,
    );
  });

  it("reuses the same paragraph on a subsequent stamp (no duplicate elements)", () => {
    stampJobAcceptedLine(
      document,
      "job-safe-delivery",
      aftersignJobAcceptedLine("job-safe-delivery"),
    );
    stampJobAcceptedLine(
      document,
      "job-sealed-return",
      aftersignJobAcceptedLine("job-sealed-return"),
    );
    const acks = document.querySelectorAll(`#${JOB_TAKE_ACK_LINE_ID}`);
    expect(acks.length).toBe(1);
    expect(acks[0]!.getAttribute(JOB_TAKE_ACK_LINE_DATA_ATTR)).toBe(
      "job-sealed-return",
    );
    expect(acks[0]!.textContent).toBe(
      aftersignJobAcceptedLine("job-sealed-return"),
    );
  });

  it("clears the transient ack without changing the primary dialogue", () => {
    const originalLine = document.getElementById("line")!.textContent;
    stampJobAcceptedLine(
      document,
      "job-safe-delivery",
      aftersignJobAcceptedLine("job-safe-delivery"),
    );
    expect(stampJobAcceptedLine(document, null, "")).toBeNull();
    expect(document.getElementById(JOB_TAKE_ACK_LINE_ID)).toBeNull();
    expect(document.getElementById("line")!.textContent).toBe(originalLine);
    // A second clear on already-cleared state is a no-op.
    expect(stampJobAcceptedLine(document, null, "")).toBeNull();
  });

  it("falls back to the default line for an unknown jobId without leaking template tokens", () => {
    const line = aftersignJobAcceptedLine("job-not-authored");
    stampJobAcceptedLine(document, "job-not-authored", line);
    const ack = document.getElementById(JOB_TAKE_ACK_LINE_ID);
    expect(ack!.textContent).toBe(line);
    expect(ack!.textContent).not.toMatch(/\{|\}|undefined|null/);
  });

  it("does not mutate the DOM on an unchanged render frame", () => {
    const line = aftersignJobAcceptedLine("job-safe-delivery");
    stampJobAcceptedLine(document, "job-safe-delivery", line);
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    stampJobAcceptedLine(document, "job-safe-delivery", line);
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });
});

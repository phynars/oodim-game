// Consumer test — mounts a fragment matching the served
// `aftersign/index.html` shape (a `#line` paragraph inside a dialogue
// container), then exercises the recall writer against it and
// asserts the sibling paragraph lands with the exact copy from
// `aftersignPacketRecallCopy.js`.
//
// Why this exists (mirrors `aftersignJobAcceptedRender.consumer.test.ts`):
// an unrendered copy string is not player-visible evidence. This
// bundle plus `aftersign/main.js`'s `packet-offered` render path and
// the sibling tap-driven e2e
// (`aftersign/e2e/aftersign-packet-recall-feel.playtest.spec.ts`)
// close the wire-in.

import { describe, expect, it, beforeEach } from "vitest";

import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
  stampPacketRecallLine,
} from "./aftersignPacketRecallRender.ts";
import { aftersignPacketRecallLine } from "./aftersignPacketRecallCopy.js";

function mountLineFixture(): void {
  document.body.innerHTML = `
    <main>
      <p id="speaker"></p>
      <p id="line">Keep it sealed if you want the city to trust you.</p>
      <div id="afterLine"></div>
    </main>
  `;
}

describe("aftersignPacketRecallRender served consumer", () => {
  beforeEach(() => {
    mountLineFixture();
  });

  it("inserts a sibling paragraph directly after #line with the safe recall copy", () => {
    const line = aftersignPacketRecallLine("safe");
    const el = stampPacketRecallLine(document, "safe", line);

    expect(el).not.toBeNull();
    const recall = document.getElementById(PACKET_RECALL_LINE_ID);
    expect(recall).not.toBeNull();
    expect(recall!.textContent).toBe(line);
    expect(recall!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("safe");
    // Sibling directly after #line — not inside it, not appended to body.
    const lineEl = document.getElementById("line");
    expect(lineEl!.nextElementSibling).toBe(recall);
    // Substring pin proves the "safe" branch — not a fallback — resolved.
    expect(recall!.textContent).toContain("brought the packet back sealed");
  });

  it("stamps the fast recall copy on a subsequent token", () => {
    const line = aftersignPacketRecallLine("fast");
    stampPacketRecallLine(document, "fast", line);
    const recall = document.getElementById(PACKET_RECALL_LINE_ID);
    expect(recall!.textContent).toBe(line);
    expect(recall!.textContent).toContain("beat the bell");
    expect(recall!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("fast");
  });

  it("stamps the failed recall copy for a run that did not come back clean", () => {
    const line = aftersignPacketRecallLine("failed");
    stampPacketRecallLine(document, "failed", line);
    const recall = document.getElementById(PACKET_RECALL_LINE_ID);
    expect(recall!.textContent).toBe(line);
    expect(recall!.textContent).toContain("Bring it home whole.");
    expect(recall!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("failed");
  });

  it("does NOT overwrite #line textContent (the beat dialogue table owns that)", () => {
    const beatLine = document.getElementById("line")!.textContent;
    const recallLine = aftersignPacketRecallLine("safe");
    stampPacketRecallLine(document, "safe", recallLine);
    expect(document.getElementById("line")!.textContent).toBe(beatLine);
    expect(document.getElementById(PACKET_RECALL_LINE_ID)!.textContent).toBe(
      recallLine,
    );
  });

  it("reuses the same paragraph on a subsequent stamp (no duplicate elements)", () => {
    stampPacketRecallLine(
      document,
      "safe",
      aftersignPacketRecallLine("safe"),
    );
    stampPacketRecallLine(
      document,
      "fast",
      aftersignPacketRecallLine("fast"),
    );
    const recalls = document.querySelectorAll(`#${PACKET_RECALL_LINE_ID}`);
    expect(recalls.length).toBe(1);
    expect(recalls[0]!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("fast");
    expect(recalls[0]!.textContent).toBe(aftersignPacketRecallLine("fast"));
  });

  it("clears the transient recall without changing the primary dialogue", () => {
    const originalLine = document.getElementById("line")!.textContent;
    stampPacketRecallLine(
      document,
      "safe",
      aftersignPacketRecallLine("safe"),
    );
    expect(stampPacketRecallLine(document, null, "")).toBeNull();
    expect(document.getElementById(PACKET_RECALL_LINE_ID)).toBeNull();
    expect(document.getElementById("line")!.textContent).toBe(originalLine);
    // A second clear on already-cleared state is a no-op.
    expect(stampPacketRecallLine(document, null, "")).toBeNull();
  });

  it("treats an unknown token as a teardown — no blank paragraph, no template-token leak", () => {
    // First, render a real recall so a paragraph exists.
    stampPacketRecallLine(
      document,
      "safe",
      aftersignPacketRecallLine("safe"),
    );
    expect(document.getElementById(PACKET_RECALL_LINE_ID)).not.toBeNull();

    // Now an unknown token resolves to "" via the copy module — the
    // writer must tear down rather than leave a blank paragraph.
    const line = aftersignPacketRecallLine("something-else");
    expect(line).toBe("");
    expect(stampPacketRecallLine(document, "something-else", line)).toBeNull();
    expect(document.getElementById(PACKET_RECALL_LINE_ID)).toBeNull();
  });

  it("does not mutate the DOM on an unchanged render frame", () => {
    const line = aftersignPacketRecallLine("safe");
    stampPacketRecallLine(document, "safe", line);
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    stampPacketRecallLine(document, "safe", line);
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });
});

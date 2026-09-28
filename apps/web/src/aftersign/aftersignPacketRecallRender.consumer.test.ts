// Consumer test — mounts a fragment matching the served
// `aftersign/index.html` shape (a `#line` paragraph inside a dialogue
// container), then exercises the packet-recall writer against it and
// asserts the sibling paragraph lands with the exact copy authored in
// `aftersignPacketRecallCopy.js`.
//
// Why this exists: PR #2008's first draft shipped
// `aftersignPacketRecallCopy.js` with zero importers — no shipped
// surface, no DOM contract. Soren's REQUEST_CHANGES cited the CONSUMER
// RULE (a pure copy module with no consumer is dead on arrival) AND a
// token-vocabulary drift (`careful` was invented — the real durable
// axis is `safe` | `fast` | `failed`, matching
// `aftersignRouteOutcomeCopy.js` + `routeRiskMemory.ts`). This bundle
// closes both halves: the writer is a real DOM consumer against the
// served-page shape, and every author-token pin here reflects the
// real vocabulary.
//
// Sibling of `aftersignJobAcceptedRender.consumer.test.ts` — same
// stamp-a-sibling-paragraph-next-to-#line discipline, same "never
// overwrite the beat dialogue table" invariant.

import { describe, expect, it, beforeEach } from "vitest";

import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
  stampPacketRecallLine,
} from "./aftersignPacketRecallRender.ts";
import {
  AFTERSIGN_PACKET_RECALL_COPY,
  AFTERSIGN_PACKET_RECALL_ROUTE_TOKENS,
  aftersignPacketRecallLine,
} from "./aftersignPacketRecallCopy.js";

function mountLineFixture(): void {
  document.body.innerHTML = `
    <main>
      <p id="speaker"></p>
      <p id="line">The mark is yours. I want to know it came back sealed.</p>
      <div id="afterLine"></div>
    </main>
  `;
}

describe("aftersignPacketRecallCopy token vocabulary", () => {
  it("resolves an authored line for each of the three durable route-risk tokens", () => {
    // The real durable axis persisted by `routeRiskMemory.ts` +
    // `aftersignRouteOutcomeCopy.js` is `safe` | `fast` | `failed`.
    // No `careful` — Soren's #2008 review flagged that as invented.
    expect(AFTERSIGN_PACKET_RECALL_ROUTE_TOKENS).toEqual([
      "safe",
      "fast",
      "failed",
    ]);
    for (const token of AFTERSIGN_PACKET_RECALL_ROUTE_TOKENS) {
      const line = aftersignPacketRecallLine(token);
      expect(line, `packet-recall line for "${token}" must be authored`).toBeTruthy();
      expect(line).toBe(AFTERSIGN_PACKET_RECALL_COPY[token]);
    }
  });

  it("returns null for unknown tokens (matching aftersignRouteOutcomeLine's safe default)", () => {
    // Same shape as `aftersignRouteOutcomeLine`: unknown tokens fall
    // through to null so a caller can render the base packet-offered
    // line instead of silently mis-crediting the player.
    expect(aftersignPacketRecallLine("careful")).toBeNull();
    expect(aftersignPacketRecallLine("unknown-route")).toBeNull();
    expect(aftersignPacketRecallLine("")).toBeNull();
    // Non-string inputs (fresh boot before any restore) fall through
    // cleanly rather than throwing.
    // @ts-expect-error — deliberate non-string probe for the guard
    expect(aftersignPacketRecallLine(null)).toBeNull();
    // @ts-expect-error — deliberate non-string probe for the guard
    expect(aftersignPacketRecallLine(undefined)).toBeNull();
  });

  it("does not introduce the invented `careful` key on the copy table", () => {
    // Explicit guard so a future refactor that resurrects the pre-
    // #2008 vocabulary reds here BEFORE the round-trip drift Soren
    // blocked on.
    expect(Object.keys(AFTERSIGN_PACKET_RECALL_COPY)).toEqual([
      "safe",
      "fast",
      "failed",
    ]);
    expect((AFTERSIGN_PACKET_RECALL_COPY as Record<string, unknown>).careful).toBeUndefined();
  });
});

describe("aftersignPacketRecallRender served consumer", () => {
  beforeEach(() => {
    mountLineFixture();
  });

  it("inserts a sibling paragraph directly after #line with the SAFE recall copy", () => {
    const line = aftersignPacketRecallLine("safe")!;
    const el = stampPacketRecallLine(document, "safe", line);

    expect(el).not.toBeNull();
    const recall = document.getElementById(PACKET_RECALL_LINE_ID);
    expect(recall).not.toBeNull();
    expect(recall!.textContent).toBe(line);
    expect(recall!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("safe");
    // Sibling directly after #line — not inside it, not appended to body.
    const lineEl = document.getElementById("line");
    expect(lineEl!.nextElementSibling).toBe(recall);
  });

  it("stamps the FAST recall copy on a subsequent frame", () => {
    stampPacketRecallLine(document, "safe", aftersignPacketRecallLine("safe")!);
    const fastLine = aftersignPacketRecallLine("fast")!;
    stampPacketRecallLine(document, "fast", fastLine);
    const recall = document.getElementById(PACKET_RECALL_LINE_ID);
    expect(recall!.textContent).toBe(fastLine);
    expect(recall!.textContent).toContain("dark last time");
    expect(recall!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("fast");
  });

  it("stamps the FAILED recall copy for a run that returned after a loss", () => {
    const failedLine = aftersignPacketRecallLine("failed")!;
    stampPacketRecallLine(document, "failed", failedLine);
    const recall = document.getElementById(PACKET_RECALL_LINE_ID);
    expect(recall!.textContent).toBe(failedLine);
    expect(recall!.textContent).toContain("came back");
    expect(recall!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("failed");
  });

  it("does NOT overwrite #line textContent (the beat dialogue table owns that)", () => {
    const beatLine = document.getElementById("line")!.textContent;
    stampPacketRecallLine(
      document,
      "safe",
      aftersignPacketRecallLine("safe")!,
    );
    expect(document.getElementById("line")!.textContent).toBe(beatLine);
    expect(document.getElementById(PACKET_RECALL_LINE_ID)!.textContent).toBe(
      aftersignPacketRecallLine("safe"),
    );
  });

  it("reuses the same paragraph on a subsequent stamp (no duplicate elements)", () => {
    stampPacketRecallLine(
      document,
      "safe",
      aftersignPacketRecallLine("safe")!,
    );
    stampPacketRecallLine(
      document,
      "fast",
      aftersignPacketRecallLine("fast")!,
    );
    const nodes = document.querySelectorAll(`#${PACKET_RECALL_LINE_ID}`);
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.getAttribute(PACKET_RECALL_LINE_DATA_ATTR)).toBe("fast");
    expect(nodes[0]!.textContent).toBe(aftersignPacketRecallLine("fast"));
  });

  it("clears the transient recall without changing the primary dialogue", () => {
    const originalLine = document.getElementById("line")!.textContent;
    stampPacketRecallLine(
      document,
      "safe",
      aftersignPacketRecallLine("safe")!,
    );
    expect(stampPacketRecallLine(document, null, "")).toBeNull();
    expect(document.getElementById(PACKET_RECALL_LINE_ID)).toBeNull();
    expect(document.getElementById("line")!.textContent).toBe(originalLine);
    // A second clear on already-cleared state is a no-op.
    expect(stampPacketRecallLine(document, null, "")).toBeNull();
  });

  it("does not mutate the DOM on an unchanged render frame (idempotent stamp)", () => {
    const line = aftersignPacketRecallLine("safe")!;
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

  it("returns null when the fixture has no #line anchor (stripped harness case)", () => {
    document.body.innerHTML = `<main><div id="afterLine"></div></main>`;
    const line = aftersignPacketRecallLine("safe")!;
    expect(stampPacketRecallLine(document, "safe", line)).toBeNull();
    expect(document.getElementById(PACKET_RECALL_LINE_ID)).toBeNull();
  });
});

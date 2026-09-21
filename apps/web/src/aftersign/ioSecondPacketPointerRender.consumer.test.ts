// Consumer test — mounts a fragment matching the served
// `aftersign/index.html` shape (a `#line` paragraph inside a
// dialogue container), then exercises the pointer writer against it
// and asserts the sibling paragraph lands with the exact copy from
// `ioSecondPacketResponseVoice.ts`.
//
// Why this exists: PR #1874's first draft added
// `ioSecondPacketResponseVoice.ts` without a shipped consumer —
// Soren's REQUEST_CHANGES cited AI006 (unconsumed surface). This
// bundle plus `aftersign/main.js`'s accepted-choice render path
// and the tap-driven e2e
// (`aftersign/e2e/io-second-packet-response-pointer-served.spec.ts`)
// close the wire-in.

import { describe, expect, it, beforeEach } from "vitest";

import {
  IO_SECOND_PACKET_POINTER_DATA_ATTR,
  IO_SECOND_PACKET_POINTER_ID,
  stampIoSecondPacketPointer,
} from "./ioSecondPacketPointerRender.ts";
import {
  ioSecondPacketResponseLine,
} from "../../../../aftersign/src/ioSecondPacketResponseVoice.ts";

function mountLineFixture(): void {
  document.body.innerHTML = `
    <main>
      <p id="speaker"></p>
      <p id="line">You came back quiet. I can work with quiet.</p>
      <div id="afterLine"></div>
    </main>
  `;
}

describe("ioSecondPacketPointerRender served consumer", () => {
  beforeEach(() => {
    mountLineFixture();
  });

  it("inserts a sibling paragraph directly after #line with the accept-path pointer copy", () => {
    const line = ioSecondPacketResponseLine("accept-second-packet");
    const el = stampIoSecondPacketPointer(document, "accept-second-packet", line);

    expect(el).not.toBeNull();
    const pointer = document.getElementById(IO_SECOND_PACKET_POINTER_ID);
    expect(pointer).not.toBeNull();
    expect(pointer!.textContent).toBe(line);
    expect(pointer!.getAttribute(IO_SECOND_PACKET_POINTER_DATA_ATTR)).toBe(
      "accept-second-packet",
    );
    // Sibling directly after #line — not inside it, not appended to body.
    const lineEl = document.getElementById("line");
    expect(lineEl!.nextElementSibling).toBe(pointer);
  });

  it("stamps the ask-path pointer copy on the ask-what-changed choice", () => {
    const line = ioSecondPacketResponseLine("ask-what-changed");
    stampIoSecondPacketPointer(document, "ask-what-changed", line);
    const pointer = document.getElementById(IO_SECOND_PACKET_POINTER_ID);
    expect(pointer!.textContent).toBe(line);
    expect(pointer!.textContent).toContain("Saint Orra");
    expect(pointer!.getAttribute(IO_SECOND_PACKET_POINTER_DATA_ATTR)).toBe(
      "ask-what-changed",
    );
  });

  it("does NOT overwrite #line textContent (the beat dialogue table owns that)", () => {
    const beatLine = document.getElementById("line")!.textContent;
    const pointerLine = ioSecondPacketResponseLine("accept-second-packet");
    stampIoSecondPacketPointer(document, "accept-second-packet", pointerLine);
    // #line text is unchanged — the pointer is a NEW paragraph, not
    // an overwrite. This preserves the contract-pinned invariant on
    // `state.npcs.io.lastLine` / `#line` textContent.
    expect(document.getElementById("line")!.textContent).toBe(beatLine);
    expect(document.getElementById(IO_SECOND_PACKET_POINTER_ID)!.textContent).toBe(pointerLine);
  });

  it("reuses the same paragraph on a subsequent stamp (no duplicate elements)", () => {
    stampIoSecondPacketPointer(
      document,
      "accept-second-packet",
      ioSecondPacketResponseLine("accept-second-packet"),
    );
    stampIoSecondPacketPointer(
      document,
      "ask-what-changed",
      ioSecondPacketResponseLine("ask-what-changed"),
    );
    const pointers = document.querySelectorAll(
      `#${IO_SECOND_PACKET_POINTER_ID}`,
    );
    expect(pointers.length).toBe(1);
    expect(pointers[0]!.getAttribute(IO_SECOND_PACKET_POINTER_DATA_ATTR)).toBe(
      "ask-what-changed",
    );
    expect(pointers[0]!.textContent).toBe(
      ioSecondPacketResponseLine("ask-what-changed"),
    );
  });

  it("clears transient copy without changing the primary dialogue", () => {
    const originalLine = document.getElementById("line")!.textContent;
    stampIoSecondPacketPointer(document, "accept-second-packet", "Saint Orra");
    expect(stampIoSecondPacketPointer(document, null, "")).toBeNull();
    expect(document.getElementById(IO_SECOND_PACKET_POINTER_ID)).toBeNull();
    expect(document.getElementById("line")!.textContent).toBe(originalLine);
    expect(stampIoSecondPacketPointer(document, null, "")).toBeNull();
  });

  it("does not mutate the DOM on an unchanged render frame", () => {
    stampIoSecondPacketPointer(document, "accept-second-packet", "Saint Orra");
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    stampIoSecondPacketPointer(document, "accept-second-packet", "Saint Orra");
    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });
});

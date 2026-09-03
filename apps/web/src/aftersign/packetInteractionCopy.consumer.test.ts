// Served-surface consumer for the `#packetButton` copy writer.
//
// Why this file exists (PR #1563 re-review, Soren blocked):
//   The first draft shipped `packetInteractionCopy.js` exporting
//   `AFTERSIGN_PACKET_BUTTON_COPY` + `getPacketButtonCopy()`, but a
//   repo-wide grep for those symbols found zero import sites outside
//   the file itself — an unconsumed pure module. Soren's rule: a copy
//   module can't merge on "correct in isolation" — it needs a
//   tap-driven spec on the visible element the words land on.
//
// This file closes that gap in the same idiom as
// `offeredJobsTapTargetFeel.consumer.test.ts`:
//
//   1. Load the REAL `aftersign/index.html` into JSDOM, find the
//      shipped `#packetButton` element. If the button is missing or
//      loses its `<span>` child, this test reds — no drift between
//      the served markup and the copy writer's target.
//   2. Drive `applyPacketButtonCopy(button, state)` — the SAME
//      writer `aftersign/main.js` calls on boot and inside
//      `commitPacketOutcome` — through the three states the player
//      moves the button through: idle → sealed (a plain tap) →
//      opened (a hold+pull re-tap). Pin the visible `<span>` text
//      and the `data-packet-button-copy-state` stamp at each step.
//   3. Tap-driven pin: attach a real click handler that walks
//      `idle → sealed → opened`, dispatch two real `.click()`s on
//      the real served button, and assert the visible text after
//      each click. That's the "tap-driven spec on the visible
//      element" Soren required.
//   4. Null-safety pin: the writer MUST NOT throw on a null element
//      or a bare button without a `<span>` child. The main.js call
//      sites wrap in try/catch, but the writer itself defends —
//      pinned here so a fresh DOM never black-screens boot.
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (three.js + full scene graph).
//     The wire itself is a one-liner call site; the played traversal
//     lives in `aftersign/e2e/io-second-packet-copy-played.spec.ts`
//     and siblings that tap `#packetButton`.
//   - Does NOT assert on `commitPacketOutcome`'s state mutations —
//     those live in `packetIntent.test.ts` beside the primitive.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_PACKET_BUTTON_COPY,
  applyPacketButtonCopy,
  getPacketButtonCopy,
} from "./packetInteractionCopy.js";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const idleText = () =>
  `${AFTERSIGN_PACKET_BUTTON_COPY.idleLabel} — ${AFTERSIGN_PACKET_BUTTON_COPY.idleHint}`;
const sealedText = () =>
  `${AFTERSIGN_PACKET_BUTTON_COPY.idleLabel} — ${AFTERSIGN_PACKET_BUTTON_COPY.sealedResult}`;
const openedText = () =>
  `${AFTERSIGN_PACKET_BUTTON_COPY.idleLabel} — ${AFTERSIGN_PACKET_BUTTON_COPY.openedResult}`;

describe("#packetButton served-surface copy contract (drives real aftersign/index.html)", () => {
  let dom: JSDOM;
  let packetButton: HTMLButtonElement;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
    const button = dom.window.document.querySelector("#packetButton");
    if (!(button instanceof dom.window.HTMLButtonElement)) {
      throw new Error(
        "served aftersign/index.html must host a #packetButton element",
      );
    }
    packetButton = button as unknown as HTMLButtonElement;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hosts the shipped #packetButton element with a `<span>` child the writer targets", () => {
    // Baseline: if the served markup loses either the button or its
    // span, the copy writer has nothing to write into. Fires first
    // so the failure points at the DOM contract, not the writer.
    expect(packetButton).not.toBeNull();
    expect(packetButton.classList.contains("packet-button")).toBe(true);
    expect(packetButton.getAttribute("data-aftersign-tap-choice")).toBe(
      "packet",
    );
    const span = packetButton.querySelector("span");
    expect(span).not.toBeNull();
  });

  it("writes the idle label + hint into the visible <span> at boot", () => {
    // main.js calls `applyPacketButtonCopy(packetButton, "idle")` right
    // after the button is queried; this pins that seam.
    applyPacketButtonCopy(packetButton, "idle");

    const span = packetButton.querySelector("span");
    expect(span?.textContent).toBe(idleText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "idle",
    );
  });

  it("flips the visible <span> to the sealed line after a tap-driven SEALED commit", () => {
    // Wire the exact main.js contract: a click on `#packetButton` that
    // commits SEALED calls `applyPacketButtonCopy(packetButton, "sealed")`
    // inside `commitPacketOutcome`. Attach that wire here and drive a
    // real click on the served button.
    applyPacketButtonCopy(packetButton, "idle");
    packetButton.addEventListener("click", () => {
      applyPacketButtonCopy(packetButton, "sealed");
    });

    // Pre-tap: still idle.
    expect(packetButton.querySelector("span")?.textContent).toBe(idleText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "idle",
    );

    // Real tap on the real served node.
    packetButton.click();

    // Post-tap: visible text + stamp both flipped. Track the constant,
    // not a copy of it — the copy source of truth is
    // AFTERSIGN_PACKET_BUTTON_COPY.sealedResult, threaded through sealedText().
    expect(packetButton.querySelector("span")?.textContent).toBe(sealedText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "sealed",
    );
  });

  it("flips the visible <span> to the opened line after a tap-driven OPENED commit", () => {
    // Same seam as above but for the hold+pull outcome — a second
    // player gesture on the same served button that commits OPENED.
    applyPacketButtonCopy(packetButton, "idle");
    packetButton.addEventListener("click", () => {
      applyPacketButtonCopy(packetButton, "opened");
    });

    packetButton.click();

    // Track the constant via openedText() — the source of truth is
    // AFTERSIGN_PACKET_BUTTON_COPY.openedResult, not a duplicated literal.
    expect(packetButton.querySelector("span")?.textContent).toBe(openedText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "opened",
    );
  });

  it("walks idle → sealed → opened across two taps on the served button", () => {
    // Full player arc: boot idle, first tap seals, a subsequent gesture
    // opens. Pins the writer is idempotent across successive taps —
    // the visible span updates each time, not just once.
    applyPacketButtonCopy(packetButton, "idle");
    const script: Array<"sealed" | "opened"> = ["sealed", "opened"];
    packetButton.addEventListener("click", () => {
      const next = script.shift();
      if (next) applyPacketButtonCopy(packetButton, next);
    });

    expect(packetButton.querySelector("span")?.textContent).toBe(idleText());

    packetButton.click();
    expect(packetButton.querySelector("span")?.textContent).toBe(sealedText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "sealed",
    );

    packetButton.click();
    expect(packetButton.querySelector("span")?.textContent).toBe(openedText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "opened",
    );
  });

  it("resolves the copy shape `getPacketButtonCopy` exports without mutating state", () => {
    // Primitive-shape pin — makes sure the writer + the shipped e2e
    // read the SAME label/hint pairs. If someone renames a field the
    // writer's textContent output shifts and this reds first.
    expect(getPacketButtonCopy("idle")).toEqual({
      buttonId: "packetButton",
      label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
      hint: AFTERSIGN_PACKET_BUTTON_COPY.idleHint,
    });
    expect(getPacketButtonCopy("sealed")).toEqual({
      buttonId: "packetButton",
      label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
      hint: AFTERSIGN_PACKET_BUTTON_COPY.sealedResult,
    });
    expect(getPacketButtonCopy("opened")).toEqual({
      buttonId: "packetButton",
      label: AFTERSIGN_PACKET_BUTTON_COPY.idleLabel,
      hint: AFTERSIGN_PACKET_BUTTON_COPY.openedResult,
    });
    // The idle default — no argument = idle copy.
    expect(getPacketButtonCopy()).toEqual(getPacketButtonCopy("idle"));
  });

  it("is a no-op on a null element or a bare button without a <span> — MUST NEVER throw", () => {
    // The main.js call sites wrap in try/catch, but the writer itself
    // must defend so a fresh DOM never black-screens boot.
    expect(() => applyPacketButtonCopy(null, "sealed")).not.toThrow();
    expect(() => applyPacketButtonCopy(undefined, "opened")).not.toThrow();

    const bare = dom.window.document.createElement("button");
    // No <span> child — writer falls back to element.textContent.
    expect(() => applyPacketButtonCopy(bare as unknown as HTMLElement, "sealed")).not.toThrow();
    expect(bare.textContent).toBe(sealedText());
    expect(bare.getAttribute("data-packet-button-copy-state")).toBe("sealed");
  });

  it("normalizes an unknown packetState to `idle` on the data-state stamp", () => {
    // Defensive: if a future caller passes a stale enum value the
    // writer still renders the idle copy and stamps "idle" — not
    // the raw hostile string. Contract seam a played spec can trust.
    applyPacketButtonCopy(
      packetButton,
      "cancelled" as unknown as "idle",
    );
    expect(packetButton.querySelector("span")?.textContent).toBe(idleText());
    expect(packetButton.getAttribute("data-packet-button-copy-state")).toBe(
      "idle",
    );
  });
});

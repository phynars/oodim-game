import { describe, expect, it, vi } from "vitest";

import { renderAftersignDialogue } from "../../../../aftersign/src/aftersignDialogueRenderer.js";

/**
 * Ordering contract for `renderAftersignDialogue`.
 *
 * Why this file exists (Soren's review of PR #2279): `syncIoLine()` is what
 * writes `state.npcs.io.lastLine` (aftersign/main.js:1780). The extracted
 * helper MUST read the dialogue line AFTER `syncIoLine()` runs — otherwise,
 * on the render where the beat changes, the DOM receives the previous line.
 *
 * The original `renderText()` guaranteed this by calling `syncIoLine()`
 * before dereferencing `state.npcs.io.lastLine`. The extraction preserves
 * that guarantee by taking a `getDialogueLine` GETTER (invoked after
 * `syncIoLine()`), not an eagerly-evaluated `dialogueLine` value.
 */
describe("renderAftersignDialogue — ordering contract", () => {
  it("reads the dialogue line AFTER syncIoLine runs, so beat-change renders see the fresh line", () => {
    // The simulated state mirrors main.js: syncIoLine mutates
    // `state.npcs.io.lastLine` from the stale value to the fresh one.
    const state = { npcs: { io: { lastLine: "stale (pre-sync)" } } };

    const callOrder: string[] = [];
    const syncIoLine = vi.fn(() => {
      callOrder.push("syncIoLine");
      state.npcs.io.lastLine = "fresh (post-sync)";
    });
    const stampBeat = vi.fn(() => {
      callOrder.push("stampBeat");
    });
    const setTextContentIfChanged = vi.fn((_el, _value) => {
      callOrder.push("setTextContentIfChanged");
    });

    const line = { id: "line" };
    const speaker = { id: "speaker" };

    renderAftersignDialogue({
      beat: "io-return-recognition",
      line,
      speaker,
      speakerName: "Io",
      // The getter is the fix: it defers the read until after syncIoLine.
      getDialogueLine: () => state.npcs.io.lastLine,
      syncIoLine,
      stampBeat,
      setTextContentIfChanged,
    });

    // syncIoLine must run first.
    expect(callOrder[0]).toBe("syncIoLine");

    // The DOM write for the line element must receive the POST-sync value.
    const lineWriteCall = setTextContentIfChanged.mock.calls.find(
      ([el]) => el === line,
    );
    expect(lineWriteCall).toBeDefined();
    expect(lineWriteCall?.[1]).toBe("fresh (post-sync)");
  });

  it("stamps the beat on the line element with the provided beat value", () => {
    const state = { npcs: { io: { lastLine: "x" } } };
    const stampBeat = vi.fn();
    const line = { id: "line" };
    const speaker = { id: "speaker" };

    renderAftersignDialogue({
      beat: "packet-delivered",
      line,
      speaker,
      speakerName: "Io",
      getDialogueLine: () => state.npcs.io.lastLine,
      syncIoLine: vi.fn(),
      stampBeat,
      setTextContentIfChanged: vi.fn(),
    });

    expect(stampBeat).toHaveBeenCalledWith(line, "packet-delivered");
  });

  it("writes the speaker name to the speaker element", () => {
    const state = { npcs: { io: { lastLine: "x" } } };
    const setTextContentIfChanged = vi.fn();
    const line = { id: "line" };
    const speaker = { id: "speaker" };

    renderAftersignDialogue({
      beat: "io-return-recognition",
      line,
      speaker,
      speakerName: "Io",
      getDialogueLine: () => state.npcs.io.lastLine,
      syncIoLine: vi.fn(),
      stampBeat: vi.fn(),
      setTextContentIfChanged,
    });

    const speakerWrite = setTextContentIfChanged.mock.calls.find(
      ([el]) => el === speaker,
    );
    expect(speakerWrite?.[1]).toBe("Io");
  });
});

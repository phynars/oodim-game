// Parity + consumer test for `resolveAftersignRememberingNpcDialogue`.
//
// This locks two invariants the reviewer rejected the first pass over:
//
//   1. No forked copy. Every line the resolver returns must equal the
//      canonical string from `packages/aftersign/src/ioReturningSession.ts`
//      (or the web-side `ioFirstSessionCopy.ts` first-session line for
//      Io's first-contact beat). If the package rewrites a line, this
//      test inherits automatically — a re-paraphrase in the resolver
//      fails loudly here.
//
//   2. Live consumer. The `bootAftersignWindowGame()` harness exposes
//      the resolver as `getRememberingNpcDialogue`. We assert against
//      the shipped harness (not the resolver in isolation) so the
//      "unconsumed pure addition" smell that closed #1163 / #1171-v1
//      cannot come back.

import { describe, expect, it } from "vitest";

import {
  chooseIoReturningSessionLine,
  ioReturningSessionLines,
  orraRecognitionLines,
} from "../../../../packages/aftersign/src/ioReturningSession";
import { bootAftersignWindowGame } from "./harness/bootWindowGame";
import { getIoFirstSessionLine } from "./ioFirstSessionCopy";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  resolveAftersignRememberingNpcDialogue,
  restoreAftersignDurableSave,
} from "./verticalSliceState";

describe("resolveAftersignRememberingNpcDialogue — package sourcing", () => {
  it("sources Io's returning line from ioReturningSession (sealed fork)", () => {
    const first = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const returning = meetIoForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(first, 3)),
    );

    const dialogue = resolveAftersignRememberingNpcDialogue(returning, "io");

    expect(dialogue.recognizesPlayer).toBe(true);
    expect(dialogue.lines).toEqual([
      chooseIoReturningSessionLine({ packetOutcome: "sealed" }),
    ]);
    // Belt-and-suspenders: the resolved string IS the package's authored
    // `sealedPacket` line, not a paraphrase.
    expect(dialogue.lines[0]).toBe(ioReturningSessionLines.sealedPacket);
  });

  it("sources Io's returning line from ioReturningSession (opened fork)", () => {
    const first = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const returning = meetIoForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(first, 4)),
    );

    const dialogue = resolveAftersignRememberingNpcDialogue(returning, "io");

    expect(dialogue.lines).toEqual([ioReturningSessionLines.openedPacket]);
  });

  it("sources Io's first-contact line from ioFirstSessionCopy (no fork)", () => {
    const firstMeeting = meetIoForAftersignSlice(createAftersignVerticalSliceState());

    const dialogue = resolveAftersignRememberingNpcDialogue(firstMeeting, "io");

    expect(dialogue.recognizesPlayer).toBe(false);
    expect(dialogue.lines).toEqual([getIoFirstSessionLine("arrival")]);
  });

  it("falls back to the package's bare-return line when Io recognizes the player but no packet outcome survived the restore", () => {
    // First meeting with no packet choice at all → restore drops
    // ioRecognizesPlayer to false; second meet flips it back on. The
    // state has ioRecognizesPlayer=true but packetOutcome=null, which
    // is exactly the shape chooseIoReturningSessionLine handles with
    // its bareReturn arm (#731).
    const firstMeeting = meetIoForAftersignSlice(createAftersignVerticalSliceState());
    const returning = meetIoForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(firstMeeting, 6)),
    );

    const dialogue = resolveAftersignRememberingNpcDialogue(returning, "io");

    expect(dialogue.recognizesPlayer).toBe(true);
    expect(dialogue.lines).toEqual([ioReturningSessionLines.bareReturn]);
  });

  it("sources Orra's returning line from orraRecognitionLines", () => {
    const first = meetOrraForAftersignSlice(
      recordAftersignOrraAction(createAftersignVerticalSliceState(), "answered-saint-orra"),
    );
    const returning = meetOrraForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(first, 5)),
    );

    const dialogue = resolveAftersignRememberingNpcDialogue(returning, "orra");

    expect(dialogue.recognizesPlayer).toBe(true);
    expect(dialogue.lines).toEqual([orraRecognitionLines.recognition]);
  });

  it("sources Orra's first-contact line from orraRecognitionLines", () => {
    const firstMeeting = meetOrraForAftersignSlice(createAftersignVerticalSliceState());

    const dialogue = resolveAftersignRememberingNpcDialogue(firstMeeting, "orra");

    expect(dialogue.recognizesPlayer).toBe(false);
    expect(dialogue.lines).toEqual([orraRecognitionLines.firstContact]);
  });
});

describe("bootAftersignWindowGame — remembering-NPC dialogue is a shipped surface", () => {
  it("routes getRememberingNpcDialogue through the resolver", () => {
    const harness = bootAftersignWindowGame();

    // Fresh state — Io has not met the player yet.
    const before = harness.getRememberingNpcDialogue("io");
    expect(before.recognizesPlayer).toBe(false);
    expect(before.lines).toEqual([getIoFirstSessionLine("arrival")]);

    // Simulate a save + restore + re-meet so Io recognizes the player.
    harness.meetNpc("io");
    const saved = harness.save();
    harness.load(saved);
    harness.meetNpc("io");

    const after = harness.getRememberingNpcDialogue("io");
    expect(after.recognizesPlayer).toBe(true);
    // With no packet outcome recorded, the returning line falls through
    // to the package's bareReturn — exactly what the resolver contract
    // above locks in.
    expect(after.lines).toEqual([ioReturningSessionLines.bareReturn]);
  });

  it("routes Orra through the same shipped surface", () => {
    const harness = bootAftersignWindowGame();

    expect(harness.getRememberingNpcDialogue("orra").lines).toEqual([
      orraRecognitionLines.firstContact,
    ]);

    harness.meetNpc("orra");
    harness.load(harness.save());
    harness.meetNpc("orra");

    expect(harness.getRememberingNpcDialogue("orra").lines).toEqual([
      orraRecognitionLines.recognition,
    ]);
  });
});

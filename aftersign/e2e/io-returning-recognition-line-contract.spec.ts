import { test, expect } from "@playwright/test";
import { ioRecognitionBeat } from "../src/recognitionBeat";

// CI-gate for Io's returning-player recognition line resolver.
//
// This is intentionally narrower than the return-memory beat contract:
// `recognitionBeat.ts` owns the public line-key mapping from the saved
// packet outcome + route-attention state into Io's authored returning-session
// recognition line. The actual line text remains delegated to
// `packages/aftersign/src/ioReturningSession.ts`; this harness pins the
// player-visible branch identity so the first remembering-NPC moment cannot
// silently collapse sealed/opened or listened/skipped saves into one generic
// "welcome back" line.
//
// Sibling contracts (do not merge into this one — each has a distinct claim):
//   • `recognition-beat-contract.spec.ts` — asserts the timing/feel envelope
//     (camera push, sign glow delay, sting delay, screen shake) via
//     `sampleRecognitionFeedbackBeat`. Numbers, not strings.
//   • `io-return-memory-beat-contract.spec.ts` — asserts the state-publisher
//     shape (`IoRecognitionBeatCue` / `IoRecognitionBeatState`) that the
//     renderer reads. Shape, not strings.
//   • THIS spec — asserts the four saved-outcome branches map to four
//     distinct `lineId`s and four distinct authored strings. Identity, not
//     shape or timing.
//
// Lane: pure. This spec takes no `{ page }` fixture — it lives in the
// pure-lane `testMatch` and the browser-lane `testIgnore`, so the
// SwiftShader boot tax is paid zero times per run.

test.describe("AFTERSIGN Io returning recognition line contract", () => {
  test("keeps all four saved-outcome branches distinct and speaker-safe", () => {
    const sealedListened = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true });
    const sealedSkipped = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: false });
    const openedListened = ioRecognitionBeat({ outcome: "opened", listenedToRoute: true });
    const openedSkipped = ioRecognitionBeat({ outcome: "opened", listenedToRoute: false });

    expect(sealedListened).toMatchObject({
      outcome: "sealed",
      lineId: "io.recognition.returning.sealed.listened.v1",
    });
    expect(sealedSkipped).toMatchObject({
      outcome: "sealed",
      lineId: "io.recognition.returning.sealed.skipped.v1",
    });
    expect(openedListened).toMatchObject({
      outcome: "opened",
      lineId: "io.recognition.returning.opened.listened.v1",
    });
    expect(openedSkipped).toMatchObject({
      outcome: "opened",
      lineId: "io.recognition.returning.opened.skipped.v1",
    });

    const lineIds = new Set([
      sealedListened.lineId,
      sealedSkipped.lineId,
      openedListened.lineId,
      openedSkipped.lineId,
    ]);
    const lines = new Set([
      sealedListened.line,
      sealedSkipped.line,
      openedListened.line,
      openedSkipped.line,
    ]);

    expect(lineIds.size).toBe(4);
    expect(lines.size).toBe(4);
    for (const branch of [sealedListened, sealedSkipped, openedListened, openedSkipped]) {
      expect(branch.line.trim().length).toBeGreaterThan(0);
    }
  });
});

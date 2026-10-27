// Pins the failed-route packet-recall line Io actually speaks to the
// player on return, and proves the line is REACHABLE (not dead copy).
//
// Review context — PR #2427 (Mara F1 / F2):
//   F1: the first attempt edited `aftersignRouteOutcomeCopy.js :: failed`.
//       That entry is unreachable — the shipped caller in
//       `aftersign/main.js` gates `aftersignRouteOutcomeLine` on
//       `routeMemory.succeeded === true`, so the outcome-line's `failed`
//       key never fires. The LIVE failed-route line the player hears is
//       in `aftersignPacketRecallCopy.js :: failed`, resolved via
//       `aftersignPacketRecallToken({ succeeded: false })`.
//   F2: the previous verification did NOT assert the revised sentence
//       verbatim. This spec does.
//
// #2458: the fragile carry is still recorded as a FAILED fast run
// (`succeeded: false`, #2401 — it unlocks `repair-the-loss`), but its
// recall names the fragile carry. The played writer of the generic
// `failed` recall is `repair-the-loss`; legacy route-only failed saves
// also resolve to `failed`.

import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_PACKET_RECALL_COPY,
  aftersignPacketRecallLine,
  aftersignPacketRecallToken,
} from "./aftersignPacketRecallCopy.js";

const FAILED_LINE_VERBATIM =
  "Io remembers the split seal you brought back. The next packet stays on the hook until you mend this loss; leave it torn, and the damage follows the next delivery.";

const FRAGILE_LINE_VERBATIM =
  "Io remembers how carefully you carried the fragile packet. It still came back torn. She leaves the next one with you: mend what was torn before you carry again.";

describe("failed-route recall names what the dark actually took (#2427)", () => {
  it("the failed entry matches the authored sentence verbatim", () => {
    expect(AFTERSIGN_PACKET_RECALL_COPY.failed).toBe(FAILED_LINE_VERBATIM);
  });

  it("durable anchors — 'mend' and 'damage' — are preserved", () => {
    // These two words carry the moral posture Io adopts on failure:
    // not bad luck, something to repair. A rewrite that drops them
    // silently changes what the game is saying about failure.
    expect(AFTERSIGN_PACKET_RECALL_COPY.failed).toMatch(/\bmend\b/);
    expect(AFTERSIGN_PACKET_RECALL_COPY.failed).toMatch(/\bdamage\b/);
  });

  it("the line is REACHABLE via the live writer (repair-the-loss → succeeded:false)", () => {
    // `aftersign/main.js` onChoose records `repair-the-loss` as
    //   { lastRoute: <prior route>, succeeded: false, lastAction: "repair-the-loss" }
    // That memory must resolve to `"failed"` on either prior route —
    // route token → live line, no mock, no gate.
    for (const lastRoute of ["safe", "fast"]) {
      const token = aftersignPacketRecallToken({
        lastRoute,
        succeeded: false,
        lastAction: "repair-the-loss",
      });
      expect(token).toBe("failed");
      expect(aftersignPacketRecallLine(token)).toBe(FAILED_LINE_VERBATIM);
    }
  });

  it("a failed fragile carry recalls the fragile line, not the generic failure (#2458)", () => {
    // The served writer records the fragile carry as
    //   { lastRoute: "fast", succeeded: false, lastAction: "carry-a-fragile-packet" }
    // Durable state says the run failed; the resolver names the action.
    const token = aftersignPacketRecallToken({
      lastRoute: "fast",
      succeeded: false,
      lastAction: "carry-a-fragile-packet",
    });
    expect(token).toBe("fragile");
    expect(aftersignPacketRecallLine(token)).toBe(AFTERSIGN_PACKET_RECALL_COPY.fragile);
    expect(aftersignPacketRecallLine(token)).not.toBe(FAILED_LINE_VERBATIM);
  });

  it("safe + succeeded:false also resolves to the failed recall line", () => {
    // Older saves (and the seeded aftersign-failed-route-memory-contract
    // fixture) use `{ lastRoute: "safe", succeeded: false }`.
    const token = aftersignPacketRecallToken({
      lastRoute: "safe",
      succeeded: false,
    });
    expect(token).toBe("failed");
    expect(aftersignPacketRecallLine(token)).toBe(FAILED_LINE_VERBATIM);
  });

  it("fast + succeeded:false with no lastAction (legacy save) resolves to failed", () => {
    const token = aftersignPacketRecallToken({ lastRoute: "fast", succeeded: false });
    expect(token).toBe("failed");
    expect(aftersignPacketRecallLine(token)).toBe(FAILED_LINE_VERBATIM);
  });

  it("the outcome-line module's `failed` entry remains unreachable (F1 note)", async () => {
    // Guard rail: if some future refactor wires
    // `aftersignRouteOutcomeLine("failed")`, this test should FAIL loud
    // so a reviewer re-sees the F1 split (outcome-line vs recall-line)
    // and consciously picks which surface speaks on failure.
    const { aftersignRouteOutcomeLine } = await import(
      "./aftersignRouteOutcomeCopy.js"
    );
    const outcome = aftersignRouteOutcomeLine("failed");
    expect(outcome).not.toBe(FAILED_LINE_VERBATIM);
  });
});

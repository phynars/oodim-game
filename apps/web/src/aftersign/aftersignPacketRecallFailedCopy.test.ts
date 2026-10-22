// Pins the failed-route packet-recall line Io actually speaks to the
// player on return, and proves the line is REACHABLE (not dead copy).
//
// Review context — PR #2427 (Mara F1 / F2):
//   F1: the first attempt edited `aftersignRouteOutcomeCopy.js :: failed`.
//       That entry is unreachable — the shipped caller at
//       `aftersign/main.js:1514` gates `aftersignRouteOutcomeLine` on
//       `routeMemory.succeeded === true`, so the outcome-line's `failed`
//       key never fires. The LIVE failed-route line the player hears is
//       in `aftersignPacketRecallCopy.js :: failed`, resolved via
//       `aftersignPacketRecallToken({ succeeded: false })` and rendered
//       at `io-return-recognition` (see aftersign/main.js:2375).
//   F2: the previous verification did NOT assert the revised sentence
//       verbatim. This spec does.
//
// Fail-to-pass on main: before #2427 the line read
//   "Io remembers the last packet did not come home. She does not call
//    it bad luck: mend it, or carry its damage forward."
// which is vague — a failed-route packet DOES come home, it comes home
// damaged (`recordRouteRun` writes `succeeded:false` when the fragile
// packet is carried; see `apps/web/src/aftersign/src/routeRiskFeel.ts`).
// The revised sentence names that fact and keeps the "mend" / "damage"
// anchors so the moral posture (don't call it bad luck) is intact.

import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_PACKET_RECALL_COPY,
  aftersignPacketRecallLine,
  aftersignPacketRecallToken,
} from "./aftersignPacketRecallCopy.js";

const FAILED_LINE_VERBATIM =
  "Io remembers you carried the packet into the dark and brought back what the dark left. She does not call it bad luck: mend it, or carry its damage forward.";

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

  it("the line is REACHABLE via the live caller (fast + succeeded:false)", () => {
    // The shipped writer of `succeeded: false` is the fragile-packet
    // path in `routeRiskFeel.ts`, which records
    //   { lastRoute: "fast", succeeded: false, lastAction: "carry-a-fragile-packet" }
    // on return. `aftersignPacketRecallToken` must resolve that memory
    // to the `"failed"` key — otherwise the recall paragraph speaks the
    // wrong sentence (or no sentence at all). This is the F1 reachability
    // proof: route token → live line, no mock, no gate.
    const token = aftersignPacketRecallToken({
      lastRoute: "fast",
      succeeded: false,
      lastAction: "carry-a-fragile-packet",
    });
    expect(token).toBe("failed");

    const line = aftersignPacketRecallLine(token);
    expect(line).toBe(FAILED_LINE_VERBATIM);
  });

  it("safe + succeeded:false also resolves to the failed recall line", () => {
    // Older saves (and the seeded aftersign-failed-route-memory-contract
    // fixture at aftersign/e2e/aftersign-failed-route-memory-contract.spec.ts:54)
    // use `{ lastRoute: "safe", succeeded: false }`. The token resolver
    // checks `succeeded === false` FIRST, so safe+failed also lands on
    // the failed recall line — no copy drift between the two writers.
    const token = aftersignPacketRecallToken({
      lastRoute: "safe",
      succeeded: false,
    });
    expect(token).toBe("failed");
    expect(aftersignPacketRecallLine(token)).toBe(FAILED_LINE_VERBATIM);
  });

  it("the outcome-line module's `failed` entry remains unreachable (F1 note)", async () => {
    // Guard rail: if some future refactor wires
    // `aftersignRouteOutcomeLine("failed")`, this test should FAIL loud
    // so a reviewer re-sees the F1 split (outcome-line vs recall-line)
    // and consciously picks which surface speaks on failure. Today the
    // outcome-line's failed key must stay distinct from this one — the
    // outcome line never reaches a player.
    const { aftersignRouteOutcomeLine } = await import(
      "./aftersignRouteOutcomeCopy.js"
    );
    const outcome = aftersignRouteOutcomeLine("failed");
    expect(outcome).not.toBe(FAILED_LINE_VERBATIM);
  });
});

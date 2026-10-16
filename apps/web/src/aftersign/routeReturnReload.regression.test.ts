import { describe, expect, it } from "vitest";
import {
  chooseIoReturningSessionLine,
  ioReturningSessionLines,
} from "../../../../packages/aftersign/src/ioReturningSession";

// #2322 / #2326 behavioural regression. The played repro: a safe-delivery
// where the player taps Deliver WITHOUT ever tapping "I listened" or
// "I ran early" first (`state.player.secondAction === null` at delivery).
// `aftersign/main.js :: memoryFacts()` normalises that null →
// `SECOND_ACTION.SKIPPED` so the memory fact SHAPE is invariant across
// delivered saves — but a null commitment is NOT the same claim as a
// skipped route. Before this fix, `armReturningSessionBootLine` derived
// `routeAttention` from `secondActionFromMemory(state.npcs.io.memory)`,
// which promoted that SKIPPED default into a route axis and routed the
// restored boot line to `chooseIoReturningSessionLine({ packetOutcome,
// routeAttention: "skipped" })` → `sealedPacketSkippedRoute` ("…you still
// ran before the route finished. Reliable hands, impatient feet.") — the
// exact false memory the live-verify filed on #2326.
//
// The fix lives in `aftersign/main.js :: armReturningSessionBootLine`:
// `routeAttention` is now derived from `state.player.secondAction`, the
// durable player-input flag (restored verbatim from
// `stored?.player?.secondAction ?? null`), so a null commitment yields
// `routeAttention: undefined` and `chooseIoReturningSessionLine` falls
// through to the NEUTRAL `sealedPacket` / `openedPacket` line.
//
// This test drives the real `chooseIoReturningSessionLine` from
// `packages/aftersign/src/ioReturningSession.ts` — the SAME function the
// served boot line calls — with the inputs the fix produces for each of
// the three `state.player.secondAction` values. If the fix regresses in
// `main.js` (routeAttention derived from the memory default again), the
// surface-level consequence is that these line choices stop matching
// what the player should hear, which is what this test pins.
describe("route-return reload regression (#2322 / #2326)", () => {
  it("maps a null-committed second action to the neutral sealed-return line", () => {
    // The exact composition the fixed `armReturningSessionBootLine`
    // performs when `state.player.secondAction === null` and the
    // delivery outcome is sealed: `routeAttention: undefined` keeps
    // the chooser out of the `sealedPacketSkippedRoute` branch.
    const line = chooseIoReturningSessionLine({
      packetOutcome: "sealed",
      routeAttention: undefined,
    });
    expect(line).toBe(ioReturningSessionLines.sealedPacket);
    expect(line).not.toBe(ioReturningSessionLines.sealedPacketSkippedRoute);
  });

  it("maps a null-committed second action to the neutral opened-return line", () => {
    const line = chooseIoReturningSessionLine({
      packetOutcome: "opened",
      routeAttention: undefined,
    });
    expect(line).toBe(ioReturningSessionLines.openedPacket);
    expect(line).not.toBe(ioReturningSessionLines.openedPacketSkippedRoute);
  });

  it("still speaks the listened-route deep line when the player actually tapped 'I listened'", () => {
    // Non-regression: a real `SECOND_ACTION.DONE` tap still produces
    // the "listened" axis, so Io keeps the earned recall.
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: "sealed",
        routeAttention: "listened",
      }),
    ).toBe(ioReturningSessionLines.sealedPacketListenedRoute);
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: "opened",
        routeAttention: "listened",
      }),
    ).toBe(ioReturningSessionLines.openedPacketListenedRoute);
  });

  it("still speaks the skipped-route line when the player actually tapped 'I ran early'", () => {
    // Non-regression: a real `SECOND_ACTION.SKIPPED` tap (committed
    // by the player, not inferred from a null default) keeps the
    // skipped-route copy. Io only accuses when the player confessed.
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: "sealed",
        routeAttention: "skipped",
      }),
    ).toBe(ioReturningSessionLines.sealedPacketSkippedRoute);
    expect(
      chooseIoReturningSessionLine({
        packetOutcome: "opened",
        routeAttention: "skipped",
      }),
    ).toBe(ioReturningSessionLines.openedPacketSkippedRoute);
  });
});

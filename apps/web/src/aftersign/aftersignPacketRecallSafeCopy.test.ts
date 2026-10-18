// Pins the "safe" packet-recall line's second half.
//
// The original copy ended "Take the next packet." — a flat hand-off that
// never named what the safe route *earned*: a route the player kept lit
// by bringing the packet home sealed. The revised line names both the
// kept lamp Io is holding for the player ("lamp burning") AND the lit
// route the memory is about ("keep the route lit"), closing the loose
// referent review called out on #2334.
//
// Fail-to-pass: on main the line still reads "Take the next packet." and
// contains neither "lamp burning" nor "keep the route lit" — this spec
// fails there and passes on the fix. The pinned "brought the packet back
// sealed" phrase (owned by `aftersignPacketRecallRender.consumer.test.ts`)
// is left intact.
import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_PACKET_RECALL_COPY,
  aftersignPacketRecallLine,
  aftersignPacketRecallToken,
} from "./aftersignPacketRecallCopy.js";

describe("safe route recall names the lit route the player earned (#2334)", () => {
  it("the safe line names the kept lamp AND keeping the route lit", () => {
    const line = AFTERSIGN_PACKET_RECALL_COPY.safe;
    // Durable anchor — Io is still holding the lamp for the next run.
    expect(line).toMatch(/lamp burning/);
    // The fix: the second clause names the lit route, not a loose "it".
    expect(line).toMatch(/keep the route lit/);
    // Guard against the old flat hand-off creeping back in.
    expect(line).not.toMatch(/Take the next packet\.$/);
  });

  it("safe-route token still resolves to the authored safe line", () => {
    const line = aftersignPacketRecallLine(
      aftersignPacketRecallToken({ lastRoute: "safe", succeeded: true }),
    );
    expect(line).toBe(AFTERSIGN_PACKET_RECALL_COPY.safe);
    expect(line).toMatch(/keep the route lit/);
  });
});

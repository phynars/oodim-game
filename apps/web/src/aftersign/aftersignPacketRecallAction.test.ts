// #2164 regression: Io must recall the action the player actually took.
import { describe, expect, it } from "vitest";

import {
  aftersignPacketRecallLine,
  aftersignPacketRecallToken,
} from "./aftersignPacketRecallCopy.js";

const recall = (routeRisk: Record<string, unknown> | null) =>
  aftersignPacketRecallLine(aftersignPacketRecallToken(routeRisk));

describe("packet-offered recall keys on lastAction (#2164)", () => {
  it("carry-a-fragile-packet recalls the fragile packet, never the bell or shortcut", () => {
    const line = recall({ lastRoute: "fast", succeeded: true, lastAction: "carry-a-fragile-packet" });
    expect(line).toMatch(/fragile packet/i);
    expect(line).not.toMatch(/bell/i);
    expect(line).not.toMatch(/shortcut/i);
  });

  it("take-the-shortcut still recalls beating the bell", () => {
    const line = recall({ lastRoute: "fast", succeeded: true, lastAction: "take-the-shortcut" });
    expect(line).toMatch(/beat the bell/i);
  });

  it("old fast saves without lastAction get a neutral line naming no action", () => {
    const line = recall({ lastRoute: "fast", succeeded: true });
    expect(line).not.toBe("");
    expect(line).not.toMatch(/bell|shortcut|fragile/i);
  });

  it("no memory tears down (empty line)", () => {
    expect(recall(null)).toBe("");
  });
});

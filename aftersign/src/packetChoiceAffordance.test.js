import { describe, expect, it } from "vitest";
import { PACKET_CHOICE_AFFORDANCE } from "./packetChoiceAffordance.js";

describe("packet choice affordance", () => {
  it("makes the irreversible memory consequence explicit before delivery", () => {
    expect(PACKET_CHOICE_AFFORDANCE).toContain("Io will remember");
    expect(PACKET_CHOICE_AFFORDANCE).toContain("seal stayed whole");
  });
});

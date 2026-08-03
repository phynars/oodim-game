import { describe, expect, it } from "vitest";

import {
  ORRA_MEMORY_LINES,
  selectOrraMemoryLines,
  type OrraMemoryReference,
} from "./orra-memory-lines.ts";

// This test guards the SHIM contract: orra-memory-lines re-exports the
// canonical beats from orra-recognition-beat with a fact-driven selector.
// If the shim ever drifts back into a parallel string module, these
// assertions will fail loudly.
describe("Orra memory lines (shim over orra-recognition-beat)", () => {
  it("keeps each line tied to explicit remembered facts including orra.met", () => {
    expect(ORRA_MEMORY_LINES).not.toHaveLength(0);

    for (const line of ORRA_MEMORY_LINES) {
      expect(line.id).toMatch(/^orra-/);
      expect(line.text).toContain(".");
      expect(line.rememberedFacts).toContain("orra.met");
      expect(line.rememberedFacts.length).toBeGreaterThan(1);
    }
  });

  it("only selects lines whose remembered facts are all present", () => {
    const remembered = new Set<OrraMemoryReference>([
      "orra.met",
      "orra.player_took_signal",
      "orra.player_waited",
    ]);

    expect(selectOrraMemoryLines(remembered).map((line) => line.id)).toEqual([
      "orra-return-signal-taken",
      "orra-return-waited",
    ]);
  });

  it("does not let Orra invent a return memory before she met the player", () => {
    const remembered = new Set<OrraMemoryReference>([
      "orra.player_took_signal",
      "orra.player_waited",
      "orra.player_named_debt",
    ]);

    expect(selectOrraMemoryLines(remembered)).toEqual([]);
  });
});

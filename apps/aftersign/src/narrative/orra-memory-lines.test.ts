import {
  ORRA_MEMORY_LINES,
  selectOrraMemoryLines,
  type OrraMemoryReference,
} from "./orra-memory-lines";

describe("Orra memory lines", () => {
  it("keeps each line tied to explicit remembered facts", () => {
    expect(ORRA_MEMORY_LINES).not.toHaveLength(0);

    for (const line of ORRA_MEMORY_LINES) {
      expect(line.id).toMatch(/^orra-/);
      expect(line.text).toContain(".");
      expect(line.references).toContain("orra.met");
      expect(line.references.length).toBeGreaterThan(1);
    }
  });

  it("only selects lines whose references are all remembered", () => {
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

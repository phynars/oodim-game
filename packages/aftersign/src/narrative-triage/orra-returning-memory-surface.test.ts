import { describe, expect, it } from "vitest";

import {
  ORRA_MEMORY_LINES,
  selectOrraMemoryLines,
  selectOrraRecognitionBeat,
  type OrraMemoryReference,
} from "./orra-memory-lines.ts";
import {
  ORRA_RETURNING_BEATS,
  selectOrraRecognitionBeat as selectFromCanonical,
} from "./orra-recognition-beat.ts";

// The reconciliation contract: the memory-lines shim and the canonical
// recognition-beat module MUST speak with one voice. This test proves the
// shim is not a parallel string module — every beat exposed by memory-lines
// is the SAME OBJECT REFERENCE as the beat in orra-recognition-beat, and
// every returning beat surfaced by either selector uses the same six texts,
// the same six IDs, and the same fact-token vocabulary.
describe("Orra returning-memory surface — one voice, one contract", () => {
  it("re-exports the canonical returning beats by reference (no fork)", () => {
    expect(ORRA_MEMORY_LINES).toBe(ORRA_RETURNING_BEATS);
  });

  it("re-exports the canonical selector by reference (no fork)", () => {
    expect(selectOrraRecognitionBeat).toBe(selectFromCanonical);
  });

  it("routes each remembered-facts set to the beat the recognition selector would speak", () => {
    const cases: ReadonlyArray<{
      remembered: readonly OrraMemoryReference[];
      state: Parameters<typeof selectOrraRecognitionBeat>[0];
      expectedId: string;
    }> = [
      {
        remembered: ["orra.met", "orra.player_took_signal"],
        state: { hasMetOrra: true, signal: "taken" },
        expectedId: "orra-return-signal-taken",
      },
      {
        remembered: ["orra.met", "orra.player_left_signal"],
        state: { hasMetOrra: true, signal: "left" },
        expectedId: "orra-return-signal-left",
      },
      {
        remembered: ["orra.met", "orra.player_waited"],
        state: { hasMetOrra: true, pace: "waited" },
        expectedId: "orra-return-waited",
      },
      {
        remembered: ["orra.met", "orra.player_rushed"],
        state: { hasMetOrra: true, pace: "rushed" },
        expectedId: "orra-return-rushed",
      },
      {
        remembered: ["orra.met", "orra.player_named_debt"],
        state: { hasMetOrra: true, debt: "named" },
        expectedId: "orra-debt-named",
      },
      {
        remembered: ["orra.met", "orra.player_refused_debt"],
        state: { hasMetOrra: true, debt: "refused" },
        expectedId: "orra-debt-refused",
      },
    ];

    for (const { remembered, state, expectedId } of cases) {
      const rememberedSet = new Set<OrraMemoryReference>(remembered);
      const [memoryLine] = selectOrraMemoryLines(rememberedSet);
      const recognitionBeat = selectOrraRecognitionBeat(state);

      expect(memoryLine).toBeDefined();
      expect(memoryLine?.id).toBe(expectedId);
      expect(memoryLine).toBe(recognitionBeat);
      expect(memoryLine?.text).toBe(recognitionBeat.text);
      expect(memoryLine?.rememberedFacts).toBe(recognitionBeat.rememberedFacts);
    }
  });

  it("guards against a parallel string module: no returning beat text appears anywhere else in the shim", () => {
    // If someone re-introduces `orra-memory-lines.ts` as a string-forking
    // module, ORRA_MEMORY_LINES will stop being identical to
    // ORRA_RETURNING_BEATS and this reference check will break. The check
    // above (`toBe(ORRA_RETURNING_BEATS)`) is the primary guard; this
    // secondary check enforces the six-beat count so a partial fork can't
    // sneak in either.
    expect(ORRA_MEMORY_LINES).toHaveLength(6);
    expect(new Set(ORRA_MEMORY_LINES.map((beat) => beat.text)).size).toBe(6);
    expect(new Set(ORRA_MEMORY_LINES.map((beat) => beat.id)).size).toBe(6);
  });
});

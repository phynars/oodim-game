import { test, expect } from "@playwright/test";
import {
  ioMemoryResponseLinesFor,
  IO_MEMORY_RESPONSE_LINES,
  runIoMemoryResponseChecks,
} from "../src/npcMemoryDialogue";
import {
  NPC_MEMORY_FACT_ID,
  PLAYER_MEMORY_FLAG,
} from "../src/npcMemoryFlagSchema";

// Pure CI-gate for the NPC-memory dialogue dispatcher. Mirrors the shape
// of `io-return-memory-beat-contract.spec.ts`: no browser boot, no Worker.
//
// This is the "prove served Io lines route through it" surface Soren asked
// for on PR #1228 — `runIoMemoryResponseChecks()` exhaustively invokes
// `ioMemoryResponseLinesFor()` across every branch, so the exports stop
// being orphan strings and become live behavior with a failing test on
// drift.

test.describe("AFTERSIGN NPC memory dialogue contract", () => {
  test("runIoMemoryResponseChecks executes every branch without throwing", () => {
    expect(() => runIoMemoryResponseChecks()).not.toThrow();
  });

  test("first-meeting is the only line for a player with no intro flag", () => {
    const lines = ioMemoryResponseLinesFor({
      playerFlags: {},
      npcMemoryFacts: [],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe(IO_MEMORY_RESPONSE_LINES.firstMeeting.id);
    expect(lines[0].speaker).toBe("Io");
  });

  test("intro-seen + sealed packet emits the sealed-memory line", () => {
    const lines = ioMemoryResponseLinesFor({
      playerFlags: { [PLAYER_MEMORY_FLAG.IO_INTRO_SEEN]: true },
      npcMemoryFacts: [
        {
          kind: "delivery-outcome",
          predicate: "delivered-blue-packet",
          object: "sealed",
          id: NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_SEALED,
        },
      ],
    });
    const ids = lines.map((line: { id: string }) => line.id);
    expect(ids).toContain(IO_MEMORY_RESPONSE_LINES.remembersSealedPacket.id);
    expect(ids).not.toContain(IO_MEMORY_RESPONSE_LINES.remembersOpenedPacket.id);
  });

  test("intro-seen + opened + kiosk-done emits both memory lines", () => {
    const lines = ioMemoryResponseLinesFor({
      playerFlags: { [PLAYER_MEMORY_FLAG.IO_INTRO_SEEN]: true },
      npcMemoryFacts: [
        {
          kind: "delivery-outcome",
          predicate: "delivered-blue-packet",
          object: "opened",
          id: NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_OPENED,
        },
        {
          kind: "route-attention",
          predicate: "kiosk-second-action",
          object: "done",
          id: NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_DONE,
        },
      ],
    });
    const ids = lines.map((line: { id: string }) => line.id);
    expect(ids).toContain(IO_MEMORY_RESPONSE_LINES.remembersOpenedPacket.id);
    expect(ids).toContain(IO_MEMORY_RESPONSE_LINES.remembersSecondActionDone.id);
    expect(ids).not.toContain(IO_MEMORY_RESPONSE_LINES.remembersNoDurableFact.id);
  });

  test("intro-seen with only malformed facts falls back to the no-durable-fact line", () => {
    const lines = ioMemoryResponseLinesFor({
      playerFlags: { [PLAYER_MEMORY_FLAG.IO_INTRO_SEEN]: true },
      npcMemoryFacts: [
        // Missing predicate — must not slip through `isKnownNpcMemoryFact`.
        {
          kind: "delivery-outcome",
          object: "sealed",
          id: NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_SEALED,
        },
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe(IO_MEMORY_RESPONSE_LINES.remembersNoDurableFact.id);
  });

  test("every NPC_MEMORY_FACT_ID has a corresponding IO_MEMORY_RESPONSE_LINES entry", () => {
    const lineIds = Object.values(IO_MEMORY_RESPONSE_LINES).map(
      (line: { id: string }) => line.id,
    );
    for (const factId of Object.values(NPC_MEMORY_FACT_ID) as string[]) {
      const tail = factId.replace(/^io-remembers-/, "");
      const covered = lineIds.some((lineId: string) => lineId.endsWith(tail));
      expect(covered, `fact id ${factId} is uncovered by IO_MEMORY_RESPONSE_LINES`).toBe(true);
    }
  });
});

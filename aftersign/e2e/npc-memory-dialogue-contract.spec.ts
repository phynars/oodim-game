import { test, expect } from "@playwright/test";
import { runIoMemoryResponseChecks } from "../src/npcMemoryDialogue.js";

// CI-gate for the Io NPC-memory dialogue pure contract.
//
// This spec intentionally does NOT use the `{ page }` fixture. The checks
// are pure dispatcher/state contracts and belong on the deterministic pure
// lane (`aftersign/playwright.pure.config.ts`, retries: 0, no browser boot).
//
// The served-surface spec (`npc-memory-dialogue-served.spec.ts`) now stays
// focused on tap-driven beat transitions + DOM lockstep only.

test.describe("AFTERSIGN NPC memory dialogue contract", () => {
  test("runIoMemoryResponseChecks executes every pure NPC-memory invariant without throwing", async () => {
    expect(() => runIoMemoryResponseChecks()).not.toThrow();
  });
});

import { test, expect } from "@playwright/test";
import { runIoReturnMemoryBeatChecks } from "../src/ioReturnMemoryBeat";

// CI-gate for Io's first returning-player memory beat.
//
// This stays in the pure lane: no browser boot, no Worker, no SwiftShader.
// The vertical slice can wire the same builder into the kiosk scene later;
// this spec exists so the remembering-NPC contract is already executable.

test.describe("AFTERSIGN Io return-memory beat contract", () => {
  test("runIoReturnMemoryBeatChecks executes first-visit and returning-player invariants without throwing", () => {
    expect(() => runIoReturnMemoryBeatChecks()).not.toThrow();
  });
});

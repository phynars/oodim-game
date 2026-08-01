import { test, expect } from "@playwright/test";
import { runIoReturnMemorySaveLoadChecks } from "../src/ioReturnMemorySaveLoad";

test.describe("AFTERSIGN Io return-memory save/load contract", () => {
  test("round-trips the returning-player memory beat through the durable save shape", () => {
    expect(() => runIoReturnMemorySaveLoadChecks()).not.toThrow();
  });
});

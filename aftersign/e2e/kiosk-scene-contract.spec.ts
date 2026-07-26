import { test, expect } from "@playwright/test";
import { runKioskSceneContractChecks } from "../src/kioskSceneContract";

test.describe("AFTERSIGN kiosk scene contract", () => {
  test("pins the smallest shippable kiosk slice: approach, recognition, memory, and durable hook", () => {
    expect(() => runKioskSceneContractChecks()).not.toThrow();
  });
});

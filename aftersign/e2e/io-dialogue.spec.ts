import { expect, test } from "@playwright/test";
import {
  getIoReturningRecognitionLine,
  getIoRouteMemoryLine,
  IO_LINES,
} from "../src/io-dialogue";

test.describe("Io dialogue copy", () => {
  test("recognition lines name the remembered packet outcome without system language", () => {
    expect(getIoReturningRecognitionLine("sealed")).toContain("blue seal, unbroken");
    expect(getIoReturningRecognitionLine("opened")).toContain("The seal did not");

    for (const line of [
      getIoReturningRecognitionLine("sealed"),
      getIoReturningRecognitionLine("opened"),
    ]) {
      expect(line).not.toMatch(/memory|system|save/i);
    }
  });

  test("route memory lines distinguish listened from skipped behavior", () => {
    expect(getIoRouteMemoryLine("listened")).toBe("You listened before you ran. Rare. Keep it.");
    expect(getIoRouteMemoryLine("skipped")).toBe(
      "You found the box anyway. Next run, let me finish saving your life.",
    );

    for (const line of [getIoRouteMemoryLine("listened"), getIoRouteMemoryLine("skipped")]) {
      expect(line).not.toMatch(/memory|system|save/i);
    }
  });

  test("first-session lines keep Io's voice terse and concrete", () => {
    expect(IO_LINES.arrival).toBe("You're above the water. Good. That's qualification one.");
    expect(IO_LINES.packetOffer).toContain("Blue packet");
    expect(IO_LINES.routeInstruction).toContain("brass bell");
  });
});

import { describe, expect, it } from "vitest";
import { nikoRouteLine } from "./nikoThread.js";

describe("nikoRouteLine", () => {
  it("names the first-run safe and risky routes", () => {
    expect(nikoRouteLine({ lastRoute: "safe" }, "blue-packet")).toBe(
      "Niko Thread: You kept to Lit stair — under Io's window. I noticed.",
    );
    expect(nikoRouteLine({ lastRoute: "fast" }, "blue-packet")).toBe(
      "Niko Thread: You took Cut past the bell rope. I noticed.",
    );
  });

  it("falls back to the first-run labels without a stored delivery", () => {
    expect(nikoRouteLine({ lastRoute: "safe" })).toBe(
      "Niko Thread: You kept to Lit stair — under Io's window. I noticed.",
    );
  });

  it("names the red-tag route the player took", () => {
    expect(nikoRouteLine({ lastRoute: "fast" }, "red-tag")).toBe(
      "Niko Thread: You took Behind the shuttered pharmacy. I noticed.",
    );
    expect(nikoRouteLine({ lastRoute: "safe" }, "red-tag")).toBe(
      "Niko Thread: You kept to Long way — past the kiosk. I noticed.",
    );
  });

  it("keeps the no-claim line without a stored route", () => {
    expect(nikoRouteLine(null)).toBe("Niko Thread: I have no route from you to claim.");
  });
});

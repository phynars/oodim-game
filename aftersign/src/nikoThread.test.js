import { describe, expect, it } from "vitest";
import { nikoRouteLine } from "./nikoThread.js";

describe("nikoRouteLine", () => {
  it("names the first-run safe and risky routes", () => {
    expect(nikoRouteLine({ lastRoute: "safe", deliveryId: "blue-packet" })).toBe(
      "Niko Thread: You kept to Lit stair — under Io's window. I noticed.",
    );
    expect(nikoRouteLine({ lastRoute: "fast", deliveryId: "blue-packet" })).toBe(
      "Niko Thread: You took Cut past the bell rope. I noticed.",
    );
  });

  it("names the red-tag route the player took", () => {
    expect(nikoRouteLine({ lastRoute: "fast", deliveryId: "red-tag" })).toBe(
      "Niko Thread: You took Behind the shuttered pharmacy. I noticed.",
    );
  });

  it("keeps the no-claim line without a stored route", () => {
    expect(nikoRouteLine(null)).toBe("Niko Thread: I have no route from you to claim.");
  });
});

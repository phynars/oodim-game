import { describe, expect, it } from "vitest";
import { AFTERSIGN_CONFIRM_FEEL } from "./aftersignConfirmFeel";

function flattenFeelTokens(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenFeelTokens(entry));
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => [key, ...flattenFeelTokens(entry)]);
  }
  return [];
}

describe("AFTERSIGN interaction-confirm sting contract", () => {
  it("pins the player-input accept pulse to a 120ms ease-out-cubic bloom pop and 90ms descending chirp", () => {
    const tokens = flattenFeelTokens(AFTERSIGN_CONFIRM_FEEL).join(" ").toLowerCase();

    expect(tokens).toContain("120");
    expect(tokens).toContain("ease-out-cubic");
    expect(tokens).toContain("1.08");
    expect(tokens).toContain("4");
    expect(tokens).toContain("90");
    expect(tokens).toContain("880");
    expect(tokens).toContain("660");
  });
});

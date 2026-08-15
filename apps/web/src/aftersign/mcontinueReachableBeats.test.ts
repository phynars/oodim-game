import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const servedSource = readFileSync(resolve("aftersign/main.js"), "utf8");

// Deadline: 2026-08-22. Founder bar from docs/flagship/BRIEF.md:
// "The milestone metric is beats reachable on the served page."
// This guard keeps M-CONTINUE anchored to the player-visible AFTERSIGN
// served module, not to contract-only files or narrative harness depth.
describe("M-CONTINUE served-page reachability", () => {
  it("wires the two post-recognition beats into the served AFTERSIGN module", () => {
    expect(servedSource).toContain("io-return-recognition");
    expect(servedSource).toContain("return-tone-choice");
    expect(servedSource).toContain("io-next-job");
  });

  it("keeps the new M-CONTINUE beats ordered after Io's return recognition", () => {
    const recognitionIndex = servedSource.indexOf("io-return-recognition");
    const returnToneIndex = servedSource.indexOf("return-tone-choice");
    const nextJobIndex = servedSource.indexOf("io-next-job");

    expect(recognitionIndex).toBeGreaterThanOrEqual(0);
    expect(returnToneIndex).toBeGreaterThan(recognitionIndex);
    expect(nextJobIndex).toBeGreaterThan(returnToneIndex);
  });
});

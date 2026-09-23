import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const configSource = readFileSync(
  new URL("./vitest.config.ts", import.meta.url),
  "utf8",
);

describe("M-LOOP divergence playtest guard registration", () => {
  it("keeps the served-page divergence guard in the AFTERSIGN unit suite", () => {
    expect(configSource).toContain(
      "aftersignLoopDivergencePlaytestSurface.test.ts",
    );
  });
});

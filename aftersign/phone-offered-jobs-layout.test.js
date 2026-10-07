import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.js", import.meta.url), "utf8");

describe("phone offered-job tray layout", () => {
  it("makes the live offer tray a vertical, full-width stack", () => {
    expect(mainSource).toMatch(/offeredJobs\.style\.display\s*=\s*["']flex["']/);
    expect(mainSource).toMatch(/offeredJobs\.style\.flexDirection\s*=\s*["']column["']/);
    expect(mainSource).toMatch(/offeredJobs\.style\.alignItems\s*=\s*["']stretch["']/);
  });
});

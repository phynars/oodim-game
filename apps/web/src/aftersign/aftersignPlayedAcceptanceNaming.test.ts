import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const ACCEPTANCE_GUARD_PATH = join(
  REPO_ROOT,
  "apps/web/src/aftersign/aftersignMilestoneAcceptanceSurface.test.ts",
);

describe("AFTERSIGN played acceptance guard contract", () => {
  it("keeps the M-CONTINUE milestone proof tied to repo-root playtest specs", () => {
    const source = readFileSync(ACCEPTANCE_GUARD_PATH, "utf8");

    expect(source).toContain('join(REPO_ROOT, "aftersign", "e2e")');
    expect(source).toContain("PLAYTEST_FILE_PATTERN");
    expect(source).toContain("playtest");
    expect(source).toContain("io-return-recognition");
    expect(source).toContain("window.__game.input");
  });
});

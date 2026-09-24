import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");
const PLAYTEST_FILE_PATTERN = /\.playtest\.spec\.(?:ts|js)$/i;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*!?\s*\.\s*input\s*\??\s*\./;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function usesHarnessInput(source: string): boolean {
  return HARNESS_INPUT_PATTERN.test(stripComments(source));
}

function readPlaytestSpecs(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) {
    return [];
  }

  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((fileName) => PLAYTEST_FILE_PATTERN.test(fileName))
    .map((fileName) => ({
      path: join(AFTERSIGN_E2E_DIR, fileName),
      source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
    }));
}

describe("AFTERSIGN flagship playtest harness-input boundary", () => {
  it("rejects a player-facing playtest that chooses through the harness bridge", () => {
    const forbiddenPlaytest = `
      test("delivery", async ({ page }) => {
        await page.evaluate(() => window.__game.input.choose("accept"));
      });
    `;

    expect(usesHarnessInput(forbiddenPlaytest)).toBe(true);
  });

  it("permits a player-facing playtest driven through a rendered-page click", () => {
    const tapDrivenPlaytest = `
      test("delivery", async ({ page }) => {
        await page.getByRole("button", { name: "Accept delivery" }).click();
      });
    `;

    expect(usesHarnessInput(tapDrivenPlaytest)).toBe(false);
  });

  it("leaves non-playtest contract specs free to use the harness bridge", () => {
    const contractSpec = `
      test("input delivery contract", async ({ page }) => {
        await page.evaluate(() => window.__game.input.choose("accept"));
      });
    `;

    expect(PLAYTEST_FILE_PATTERN.test("flagship-phase2-input-delivery-contract.spec.ts")).toBe(false);
    expect(usesHarnessInput(contractSpec)).toBe(true);
  });

  it("keeps every .playtest.spec file free of executable window.__game.input calls", () => {
    const violations = readPlaytestSpecs()
      .filter(({ source }) => usesHarnessInput(source))
      .map(({ path }) => path);

    expect(
      violations,
      [
        "Player-facing .playtest.spec files must use visible page interaction APIs.",
        "window.__game may be read for assertions, but window.__game.input.* is a harness hook.",
      ].join("\n"),
    ).toEqual([]);
  });
});

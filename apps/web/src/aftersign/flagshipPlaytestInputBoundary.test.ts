import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const aftersignE2eDirectory = resolve(process.cwd(), "aftersign/e2e");
const playtestFileName = /\.playtest\.spec\.(?:ts|js)$/;
const harnessInputCall = /\bwindow\s*\.\s*__game\s*\.\s*input\s*\./;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findHarnessInputInPlaytest(source: string): boolean {
  return harnessInputCall.test(stripComments(source));
}

describe("flagship playtest input boundary", () => {
  it("rejects a player-facing playtest fixture that drives input through the game harness", () => {
    expect(
      findHarnessInputInPlaytest(
        'await page.evaluate(() => window.__game.input.choose("take-job"));',
      ),
    ).toBe(true);
  });

  it("permits a player-facing playtest fixture that clicks a rendered control", () => {
    expect(
      findHarnessInputInPlaytest(
        'await page.getByRole("button", { name: "Take job" }).click();',
      ),
    ).toBe(false);
  });

  it("does not mistake documentation comments for executable harness input", () => {
    expect(
      findHarnessInputInPlaytest(
        "// Do not call window.__game.input.choose from a playtest.\nawait button.click();",
      ),
    ).toBe(false);
  });

  it("keeps the harness boundary on playtest-named specs and excludes contract specs", () => {
    expect(playtestFileName.test("flagship-phase2-input-delivery-contract.spec.ts")).toBe(false);
  });

  it("rejects executable harness input in every flagship playtest source file", () => {
    expect(existsSync(aftersignE2eDirectory)).toBe(true);

    const violations = readdirSync(aftersignE2eDirectory)
      .filter((fileName) => playtestFileName.test(fileName))
      .filter((fileName) =>
        findHarnessInputInPlaytest(readFileSync(join(aftersignE2eDirectory, fileName), "utf8")),
      );

    expect(violations).toEqual([]);
  });
});

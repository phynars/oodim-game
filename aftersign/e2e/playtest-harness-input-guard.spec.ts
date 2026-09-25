import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYTEST_SPEC_SUFFIX = ".playtest.spec.ts";
const HARNESS_INPUT_CALL = /\bwindow\.__game!?\.input\.[A-Za-z_$][\w$]*\s*\(/;

type SourceFile = Readonly<{ name: string; source: string }>;

function findPlaytestHarnessInputCalls(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ name }) => name.endsWith(PLAYTEST_SPEC_SUFFIX))
    .filter(({ source }) => HARNESS_INPUT_CALL.test(source))
    .map(({ name }) => name);
}

function readE2eSpecs(): SourceFile[] {
  const e2eDirectory = dirname(fileURLToPath(import.meta.url));
  return readdirSync(e2eDirectory)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => ({ name, source: readFileSync(join(e2eDirectory, name), "utf8") }));
}

test.describe("AFTERSIGN playtest input evidence boundary", () => {
  test("rejects harness input calls in player-facing playtest specs", () => {
    expect(
      findPlaytestHarnessInputCalls([
        {
          name: "forbidden.playtest.spec.ts",
          source: 'await page.evaluate(() => window.__game.input.choose("keep-sealed"));',
        },
      ]),
    ).toEqual(["forbidden.playtest.spec.ts"]);
  });

  test("permits visible page interaction and non-playtest contract harness coverage", () => {
    expect(
      findPlaytestHarnessInputCalls([
        {
          name: "played.playtest.spec.ts",
          source: 'await page.locator("#keep-sealed").click();',
        },
        {
          name: "flagship-phase2-input-delivery-contract.spec.ts",
          source: 'await page.evaluate(() => window.__game.input.choose("keep-sealed"));',
        },
      ]),
    ).toEqual([]);
  });

  test("repository player-facing playtests do not use the harness input bridge", () => {
    expect(findPlaytestHarnessInputCalls(readE2eSpecs())).toEqual([]);
  });
});

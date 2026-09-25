import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const PLAYTEST_SPEC = /\.playtest\.spec\.[cm]?[jt]sx?$/;
const HARNESS_INPUT = /window\.__game\s*!?\s*\.input\s*\./;

export function findHarnessInputInPlaytests(files) {
  return files
    .filter(({ path }) => PLAYTEST_SPEC.test(basename(path)))
    .filter(({ source }) => HARNESS_INPUT.test(source))
    .map(({ path }) => path);
}

async function readPlaytestSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && PLAYTEST_SPEC.test(entry.name))
      .map(async (entry) => {
        const path = join(directory, entry.name);
        return { path, source: await readFile(path, "utf8") };
      }),
  );

  return files;
}

test("playtest harness-input guard rejects window.__game.input.choose", () => {
  const violations = findHarnessInputInPlaytests([
    {
      path: "flagship-delivery.playtest.spec.ts",
      source: 'await page.evaluate(() => window.__game!.input.choose("accept"));',
    },
  ]);

  assert.deepEqual(violations, ["flagship-delivery.playtest.spec.ts"]);
});

test("playtest harness-input guard permits visible-page interaction", () => {
  const violations = findHarnessInputInPlaytests([
    {
      path: "flagship-delivery.playtest.spec.ts",
      source: 'await page.getByRole("button", { name: "Accept" }).click();',
    },
  ]);

  assert.deepEqual(violations, []);
});

test("playtest harness-input guard permits contract-spec harness input", () => {
  const violations = findHarnessInputInPlaytests([
    {
      path: "flagship-phase2-input-delivery-contract.spec.ts",
      source: 'await page.evaluate(() => window.__game!.input.choose("accept"));',
    },
  ]);

  assert.deepEqual(violations, []);
});

test("repository playtests do not invoke the game input harness", async () => {
  const violations = findHarnessInputInPlaytests(
    await readPlaytestSources(fileURLToPath(new URL(".", import.meta.url))),
  );

  assert.deepEqual(
    violations,
    [],
    `Player-facing playtests must use rendered-page interaction, not window.__game.input.*:\n${violations.join("\n")}`,
  );
});

import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const E2E_DIR = new URL(".", import.meta.url);

const PLAYED_ACCEPTANCE_SPEC_PATTERN = /(?:playtest|played).*\.spec\.ts$/;
const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_PATTERN = /^\s*\/\/.*$/gm;
const PLAYER_EVENT_PATTERN = /\.(?:click|tap|press|keyboard\.press|mouse\.click|touchscreen\.tap)\s*\(/;
const INTERNAL_INPUT_PATTERNS = [
  /window\.__game\.input\b/,
  /__game\.input\b/,
  /\.evaluate\([^)]*__game\.input/s,
  /\.evaluateHandle\([^)]*__game\.input/s,
];

test("played acceptance specs use visible player input and do not drive choices through window.__game.input", () => {
  const acceptanceSpecs = readdirSync(E2E_DIR)
    .map((fileName) => join(E2E_DIR.pathname, fileName))
    .filter((filePath) => PLAYED_ACCEPTANCE_SPEC_PATTERN.test(basename(filePath)))
    .filter((filePath) => basename(filePath) !== basename(import.meta.url));

  expect(acceptanceSpecs.length).toBeGreaterThan(0);

  const offenders = acceptanceSpecs.flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8")
      .replace(BLOCK_COMMENT_PATTERN, "")
      .replace(LINE_COMMENT_PATTERN, "");
    const internalInputOffenders = INTERNAL_INPUT_PATTERNS.filter((pattern) =>
      pattern.test(source),
    ).map((pattern) => `${basename(filePath)} drives through ${pattern}`);
    const visibleInputOffenders = PLAYER_EVENT_PATTERN.test(source)
      ? []
      : [`${basename(filePath)} has no visible player event (.tap/.click/.press)`];
    return [...internalInputOffenders, ...visibleInputOffenders];
  });

  expect(offenders).toEqual([]);
});

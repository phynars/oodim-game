import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();
const APPS_WEB_ROOT = join(REPO_ROOT, "apps", "web");

const ACCEPTANCE_FILE_PATTERN = /(?:playtest|acceptance|e2e).*\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const RETURN_RECOGNITION_PATTERN = /io-return-recognition/;
const CONTINUATION_BEAT_PATTERN = /(?:return-tone|next-job|next job|returnTone|nextJob)/i;

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".next", "coverage"].includes(entry.name)) {
        return [];
      }

      return listFiles(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

function readAcceptanceSpecs() {
  return listFiles(APPS_WEB_ROOT)
    .filter((path) => ACCEPTANCE_FILE_PATTERN.test(path))
    .map((path) => ({
      path,
      repoPath: relative(REPO_ROOT, path),
      source: readFileSync(path, "utf8"),
    }));
}

describe("AFTERSIGN milestone acceptance specs", () => {
  it("prove M-CONTINUE by playing the served surface instead of driving window.__game", () => {
    const specs = readAcceptanceSpecs();
    const mContinueSpecs = specs.filter(
      ({ source }) =>
        RETURN_RECOGNITION_PATTERN.test(source) && CONTINUATION_BEAT_PATTERN.test(source),
    );

    expect(
      mContinueSpecs.map(({ repoPath }) => repoPath),
      "M-CONTINUE needs a phone-shaped acceptance/playtest spec that reaches past io-return-recognition into return-tone or next-job beats.",
    ).not.toEqual([]);

    const disqualifiedSpecs = mContinueSpecs.filter(({ source }) =>
      HARNESS_INPUT_PATTERN.test(source),
    );

    expect(
      disqualifiedSpecs.map(({ repoPath }) => repoPath),
      "window.__game is an assertion surface only; milestone acceptance must not cause player actions through __game.input.",
    ).toEqual([]);

    const unplayedSpecs = mContinueSpecs.filter(
      ({ source }) => !PLAYER_EVENT_PATTERN.test(source),
    );

    expect(
      unplayedSpecs.map(({ repoPath }) => repoPath),
      "M-CONTINUE acceptance must use player-visible input events such as tap/click/press/pointer, not only state-machine calls.",
    ).toEqual([]);
  });
});

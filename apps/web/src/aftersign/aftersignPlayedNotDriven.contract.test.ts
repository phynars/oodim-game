import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const APPS_WEB_ROOT = path.join(REPO_ROOT, "apps/web");

const PLAYWRIGHT_ACCEPTANCE_PATTERNS = [
  /aftersign/i,
  /io-return-recognition/i,
  /return-tone/i,
  /next-job/i,
  /m-continue/i,
];

const DISALLOWED_HARNESS_INPUT_PATTERNS = [
  /window\.__game\s*\.\s*input\s*\./,
  /__game\s*\.\s*input\s*\./,
  /page\.evaluate\([^)]*choose/i,
  /page\.evaluate\([^)]*interact/i,
  /page\.evaluate\([^)]*advance/i,
];

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = path.join(root, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage"].includes(entry)) {
        return [];
      }

      return listFiles(absolutePath);
    }

    return [absolutePath];
  });
}

function isPlaywrightCandidate(filePath: string, contents: string): boolean {
  const basename = path.basename(filePath);
  const isSpec = /\.(spec|e2e|playwright)\.[cm]?[tj]s$/.test(basename);
  const importsPlaywright = /@playwright\/test/.test(contents);
  const targetsAftersign = PLAYWRIGHT_ACCEPTANCE_PATTERNS.some((pattern) =>
    pattern.test(filePath) || pattern.test(contents),
  );

  return isSpec && importsPlaywright && targetsAftersign;
}

describe("AFTERSIGN played-not-driven acceptance guard", () => {
  it("keeps served-page acceptance specs from causing player actions through window.__game", () => {
    const candidates = listFiles(APPS_WEB_ROOT)
      .map((filePath) => ({
        filePath,
        contents: readFileSync(filePath, "utf8"),
      }))
      .filter(({ filePath, contents }) => isPlaywrightCandidate(filePath, contents));

    const offenders = candidates.flatMap(({ filePath, contents }) =>
      DISALLOWED_HARNESS_INPUT_PATTERNS.filter((pattern) => pattern.test(contents)).map(
        (pattern) => `${path.relative(REPO_ROOT, filePath)} matches ${pattern}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});

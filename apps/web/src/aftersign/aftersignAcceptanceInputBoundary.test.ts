import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const aftersignRoot = join(repoRoot, "apps", "web", "src", "aftersign");

const existingHarnessDrivenAcceptanceSpecs = new Set([
  "apps/web/src/aftersign/aftersignDurableSaveLoadPlaytestSurface.test.ts",
  "apps/web/src/aftersign/aftersignDurableStoryStateSaveLoadSurface.test.ts",
  "apps/web/src/aftersign/aftersignKioskInteractionLoopSurface.test.ts",
  "apps/web/src/aftersign/aftersignMemoryDivergencePlaytestSurface.test.ts",
  "apps/web/src/aftersign/aftersignMilestoneAcceptanceSurface.test.ts",
  "apps/web/src/aftersign/aftersignPlayedAcceptanceNaming.test.ts",
  "apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts",
  "apps/web/src/aftersign/harness/pointerToRenderLatency.contract.test.ts",
  "apps/web/src/aftersign/harness/windowGameHarnessBoot.test.ts",
  "apps/web/src/aftersign/servedSurface.contract.test.ts",
  "apps/web/src/aftersign/tapConfirmFeel.servedButton.test.ts",
]);

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return walk(path);
    }
    return [path];
  });
}

function isAcceptanceSpec(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return (
    /(?:acceptance|playtest|milestone|served-page).*\.(?:spec|test)\.[cm]?[jt]sx?$/.test(normalized) ||
    (/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(normalized) &&
      /(?:acceptance|playtest|milestone|served page|phone viewport|taps-only|tap-driven)/i.test(
        readFileSync(path, "utf8"),
      ))
  );
}

function usesHarnessInput(source: string): boolean {
  const gameGlobal = ["__", "game"].join("");
  const forbiddenInputPattern = new RegExp(
    `(?:window\\s*\\.\\s*)?${gameGlobal}\\s*\\.\\s*input`,
  );
  return forbiddenInputPattern.test(source);
}

describe("Aftersign served-page acceptance boundary", () => {
  it("prevents new acceptance specs from driving player actions through harness input", () => {
    const acceptanceSpecs = walk(aftersignRoot).filter(isAcceptanceSpec);

    expect(acceptanceSpecs.map((path) => relative(repoRoot, path))).not.toEqual([]);

    const newDrivenSpecs = acceptanceSpecs
      .map((path) => ({ path: relative(repoRoot, path), source: readFileSync(path, "utf8") }))
      .filter(({ path, source }) =>
        !existingHarnessDrivenAcceptanceSpecs.has(path) && usesHarnessInput(source),
      )
      .map(({ path }) => path);

    expect(newDrivenSpecs).toEqual([]);
  });
});

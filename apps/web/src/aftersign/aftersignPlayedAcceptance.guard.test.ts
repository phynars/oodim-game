import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "../../../../..");
const APPS_WEB_ROOT = join(REPO_ROOT, "apps/web");

const ACCEPTANCE_TEST_PATTERN = /(?:aftersign|flagship).*\.(?:spec|test)\.(?:ts|js)$/i;
const DRIVEN_INPUT_PATTERN = /window\.__game\.input\.|__game\.input\.|\.evaluate\([^)]*input\.choose|\.evaluate\([^)]*__game/s;

function listTestFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage"].includes(entry)) {
        return [];
      }
      return listTestFiles(path);
    }

    if (!ACCEPTANCE_TEST_PATTERN.test(path)) {
      return [];
    }

    return [path];
  });
}

describe("Aftersign played acceptance guard", () => {
  it("keeps acceptance specs from driving player choices through window.__game.input", () => {
    const offenders = listTestFiles(APPS_WEB_ROOT)
      .filter((path) => !path.endsWith("aftersignPlayedAcceptance.guard.test.ts"))
      .filter((path) => DRIVEN_INPUT_PATTERN.test(readFileSync(path, "utf8")))
      .map((path) => relative(REPO_ROOT, path));

    expect(offenders).toEqual([]);
  });
});

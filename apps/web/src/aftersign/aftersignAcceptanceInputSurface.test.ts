import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "coverage", "playwright-report", "test-results"]);

const AFTERSIGN_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(AFTERSIGN_DIR, "..", "..", "..", "..");
const SCAN_ROOTS = [
  join(REPO_ROOT, "apps", "web", "src", "aftersign"),
  join(REPO_ROOT, "apps", "web", "tests"),
  join(REPO_ROOT, "apps", "web", "e2e"),
].filter((path) => existsSync(path));

function listSourceFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(root, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...listSourceFiles(absolutePath));
      }
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function lineNumberFor(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

describe("AFTERSIGN acceptance input surface", () => {
  it("keeps milestone playtests from causing player actions through window.__game.input", () => {
    const forbiddenUsages: string[] = [];
    const forbiddenPattern = /window\s*\.\s*__game\s*\.\s*input\s*\./g;

    for (const file of SCAN_ROOTS.flatMap(listSourceFiles)) {
      if (file === fileURLToPath(import.meta.url)) {
        continue;
      }

      const source = readFileSync(file, "utf8");
      const stat = statSync(file);

      for (const match of source.matchAll(forbiddenPattern)) {
        forbiddenUsages.push(
          `${relative(REPO_ROOT, file)}:${lineNumberFor(source, match.index ?? 0)} (${stat.size} bytes)`,
        );
      }
    }

    expect(forbiddenUsages).toEqual([]);
  });
});

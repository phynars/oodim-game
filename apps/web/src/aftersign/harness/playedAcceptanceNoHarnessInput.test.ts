import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const candidateRoots = [
  'apps/web/e2e',
  'apps/web/tests',
  'apps/web/src/aftersign',
  'tests',
].map((path) => join(repoRoot, path));

const acceptanceFilePattern = /(?:aftersign|m-continue|milestone|acceptance|playtest).+\.(?:spec|test)\.(?:ts|tsx|js|jsx)$/i;
const harnessInputPattern = /window\.__game\s*\.\s*input|__game\s*\.\s*input|evaluate\s*\([^)]*__game[^)]*\.input/is;

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') {
        continue;
      }
      files.push(...walkFiles(path));
      continue;
    }

    if (stats.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function acceptanceSpecs(): string[] {
  return candidateRoots.flatMap(walkFiles).filter((path) => acceptanceFilePattern.test(relative(repoRoot, path)));
}

describe('AFTERSIGN played acceptance boundary', () => {
  it('does not let acceptance specs cause player actions through window.__game.input', () => {
    const offenders = acceptanceSpecs().filter((path) => harnessInputPattern.test(readFileSync(path, 'utf8')));

    expect(offenders.map((path) => relative(repoRoot, path))).toEqual([]);
  });
});

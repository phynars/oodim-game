import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const aftersignRoot = join(here, '..');

const acceptanceNamePattern = /(?:acceptance|playtest|served|phone|continue|milestone).*\.(?:spec|test)\.(?:ts|tsx|js|jsx)$/i;
const harnessInputPattern = /window\.__game\.input\.|__game\.input\.|evaluate\([^)]*=>[\s\S]{0,240}?(?:window\.)?__game\.input\./m;

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  const entries = readdirSync(root).sort();
  const files: string[] = [];

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;

    const absolute = join(root, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      files.push(...walkFiles(absolute));
      continue;
    }

    if (/\.(?:spec|test)\.(?:ts|tsx|js|jsx)$/.test(entry)) {
      files.push(absolute);
    }
  }

  return files;
}

describe('AFTERSIGN played acceptance guard', () => {
  it('keeps player-facing acceptance specs from causing actions through window.__game.input', () => {
    const acceptanceSpecs = walkFiles(aftersignRoot).filter((file) => acceptanceNamePattern.test(file));
    const offenders = acceptanceSpecs
      .filter((file) => file !== fileURLToPath(import.meta.url))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        if (!harnessInputPattern.test(source)) return [];
        return [relative(aftersignRoot, file)];
      });

    expect(offenders).toEqual([]);
  });
});

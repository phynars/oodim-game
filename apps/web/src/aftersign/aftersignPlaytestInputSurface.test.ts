import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const AFTERSIGN_E2E_DIR = path.join(REPO_ROOT, 'aftersign', 'e2e');

function listPlaytestSpecs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listPlaytestSpecs(fullPath);
      if (entry.isFile() && /playtest.*\.spec\.ts$/i.test(entry.name)) return [fullPath];
      return [];
    })
    .sort();
}

describe('Aftersign played acceptance specs', () => {
  test('drive player actions through the rendered surface, not window.__game input hooks', () => {
    const specs = listPlaytestSpecs(AFTERSIGN_E2E_DIR);

    expect(specs.length, 'expected at least one Aftersign playtest spec under aftersign/e2e').toBeGreaterThan(0);

    const offenders = specs
      .map((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        const callsHarnessInput = /window\.__game\s*\.\s*input\s*\./.test(source) || /__game\s*\.\s*input\s*\./.test(source);
        return callsHarnessInput ? path.relative(REPO_ROOT, filePath) : null;
      })
      .filter((filePath): filePath is string => filePath !== null);

    expect(
      offenders,
      'playtest specs are acceptance evidence: use taps/clicks/keys on visible elements; reserve window.__game for assertions only',
    ).toEqual([]);
  });
});

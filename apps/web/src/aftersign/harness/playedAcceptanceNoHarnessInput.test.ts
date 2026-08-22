import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

// The M-CONTINUE / IO-CONTINUE played-acceptance specs live at the
// repo-root `aftersign/e2e/` tree — NOT under `apps/web/`.  The sibling
// guard `aftersignMilestoneAcceptanceSurface.test.ts` documents this
// pitfall (scanning the wrong root makes assertions pass vacuously).
// Follow the same convention here: anchor on `aftersign/e2e/` from
// `process.cwd()` (repo root when vitest is invoked from the workspace
// root) OR two directories up from `apps/web/` when invoked package-
// locally, so this guard works under both invocation shapes.
const REPO_ROOT = process.cwd();
const CANDIDATE_ROOTS = [
  join(REPO_ROOT, 'aftersign', 'e2e'),
  join(REPO_ROOT, '..', '..', 'aftersign', 'e2e'),
];

// PLAYED-NOT-DRIVEN acceptance taxonomy.  Three categories self-identify
// as specs that must prove a beat is reachable via the visible DOM (not
// via the harness input seam):
//
//   *.playtest.spec.ts        — playtest acceptance (tap / pointer)
//   *-served*.spec.ts         — served-surface acceptance
//   *-played.spec.ts          — played-beat acceptance
//
// Contract specs (`*-contract.spec.ts`, save-load, regression) are NOT
// in this taxonomy — they legitimately pin the input seam itself.
//
// We check EACH category for vacuity independently.  If any category
// ever empties out, the OR-across-basenames check would silently pass
// on the surviving categories alone, masking the exact regression this
// guard exists to catch.  Per-category `.toBeGreaterThan(0)` closes that.
type PlayedCategory = {
  key: 'playtest' | 'served' | 'played';
  label: string;
  matches: (fileBasename: string) => boolean;
};

const PLAYED_CATEGORIES: PlayedCategory[] = [
  {
    key: 'playtest',
    label: '*.playtest.spec.ts',
    matches: (name) => /\.playtest\.spec\.[cm]?tsx?$/i.test(name),
  },
  {
    key: 'served',
    label: '*-served*.spec.ts',
    matches: (name) => /-served[^/]*\.spec\.[cm]?tsx?$/i.test(name),
  },
  {
    key: 'played',
    label: '*-played.spec.ts',
    matches: (name) => /-played\.spec\.[cm]?tsx?$/i.test(name),
  },
];

// Any read/write of `__game.input` — direct property access, bracket
// access, or inside a `page.evaluate` string body — is disallowed in a
// played acceptance.  We keep the pattern intentionally broad to catch
// evasions like `window["__game"].input`, `w["__game"].input`, and
// template-string harness drives.
const HARNESS_INPUT_PATTERN = /(?:(?:window|w)\s*(?:\.\s*__game|\[\s*["']__game["']\s*\])|__game)\s*(?:\.\s*input|\[\s*["']input["']\s*\])/;

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
        continue;
      }
      files.push(...walkFiles(path));
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function resolveAftersignE2eRoot(): string | null {
  for (const root of CANDIDATE_ROOTS) {
    if (existsSync(root) && statSync(root).isDirectory()) {
      return root;
    }
  }
  return null;
}

type PlayedSpec = {
  path: string;
  repoPath: string;
  source: string;
  category: PlayedCategory['key'];
};

function readPlayedSpecs(): PlayedSpec[] {
  const root = resolveAftersignE2eRoot();
  if (!root) {
    return [];
  }

  const specs: PlayedSpec[] = [];
  for (const path of walkFiles(root)) {
    const name = basename(path);
    const category = PLAYED_CATEGORIES.find(({ matches }) => matches(name));
    if (!category) {
      continue;
    }
    specs.push({
      path,
      // Report paths relative to the repo root even when we resolved
      // via the `../../` candidate — so failure messages are stable
      // regardless of vitest's cwd.
      repoPath: relative(join(root, '..', '..'), path),
      source: readFileSync(path, 'utf8'),
      category: category.key,
    });
  }
  return specs;
}

describe('AFTERSIGN played acceptance boundary', () => {
  it('recognizes direct and bracketed harness-input access', () => {
    expect(HARNESS_INPUT_PATTERN.test('window.__game.input.choose()')).toBe(true);
    expect(HARNESS_INPUT_PATTERN.test('window["__game"].input.choose()')).toBe(true);
    expect(HARNESS_INPUT_PATTERN.test("w['__game']['input'].choose()")).toBe(true);
  });

  it('allows assertion-only reads from window.__game outside the input bridge', () => {
    expect(HARNESS_INPUT_PATTERN.test('window.__game.state.currentBeat')).toBe(false);
    expect(HARNESS_INPUT_PATTERN.test('window["__game"].story.beatId')).toBe(false);
    expect(HARNESS_INPUT_PATTERN.test('const surface = await page.evaluate(() => window.__game.state)')).toBe(false);
  });

  it('locates the aftersign/e2e/ tree (guard is not vacuous)', () => {
    // Fail loudly if the scan target moved.  Without this, deleting
    // or renaming `aftersign/e2e/` would silently make the boundary
    // assertion below pass with zero inputs — exactly the failure
    // mode Mara flagged on the previous revision.
    expect(resolveAftersignE2eRoot(), 'aftersign/e2e/ not found under REPO_ROOT or ../../ from cwd').not.toBeNull();
  });

  // PER-CATEGORY vacuity guards.  If ANY of the three played-not-driven
  // basename categories ever empties out (e.g. someone renames every
  // `*-served-*.spec.ts` to a different pattern), the OR-across-categories
  // boundary check below would silently pass on the surviving categories
  // alone.  We check each one independently so the corpus of every
  // category is proven non-empty before we trust the boundary check.
  for (const category of PLAYED_CATEGORIES) {
    it(`finds at least one ${category.label} spec under aftersign/e2e/`, () => {
      const specs = readPlayedSpecs().filter((spec) => spec.category === category.key);
      expect(
        specs.map(({ repoPath }) => repoPath),
        `expected at least one ${category.label} under aftersign/e2e/`,
      ).not.toEqual([]);
    });
  }

  it('no played/served/playtest spec drives player input through window.__game.input', () => {
    const offenders = readPlayedSpecs()
      .filter(({ source }) => HARNESS_INPUT_PATTERN.test(source))
      .map(({ repoPath, category }) => `${repoPath} [${category}]`);

    expect(
      offenders,
      [
        'Played acceptance specs (playtest / *-served* / *-played) must drive input via',
        'visible DOM events (tap/click/press/pointer/etc.), not through window.__game.input.*',
        '— that surface is assertion-only in a played acceptance.  If you need to pin the',
        'input SEAM itself, put that assertion in a *-contract.spec.ts (allowed by design).',
        'Offenders:',
        ...offenders.map((path) => `  - ${path}`),
      ].join('\n'),
    ).toEqual([]);
  });
});

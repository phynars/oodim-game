import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

// A PLAYED acceptance spec proves a phone player can reach a beat via
// the visible DOM.  Its file name conveys that intent — the surface it
// exercises is what a player would tap.  We enforce the boundary on
// files that self-identify as PLAYED (name contains `playtest`); the
// harness-driven `*-served-beats.spec.ts` siblings are allowed to
// drive `window.__game.input.*` because they pin the state machine
// independently of DOM copy.
const PLAYTEST_FILE_PATTERN = /playtest\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/i;

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

function readPlaytestSpecs(): Array<{ path: string; repoPath: string; source: string }> {
  const root = resolveAftersignE2eRoot();
  if (!root) {
    return [];
  }

  return walkFiles(root)
    .filter((path) => PLAYTEST_FILE_PATTERN.test(path))
    .map((path) => ({
      path,
      // Report paths relative to the repo root even when we resolved
      // via the `../../` candidate — so failure messages are stable
      // regardless of vitest's cwd.
      repoPath: relative(join(root, '..', '..'), path),
      source: readFileSync(path, 'utf8'),
    }));
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

  it('finds at least one *playtest* spec under aftersign/e2e/', () => {
    // Second vacuity guard: even if the tree exists, an empty result
    // set would let the boundary check below pass trivially.
    const specs = readPlaytestSpecs();
    expect(
      specs.map(({ repoPath }) => repoPath),
      'expected at least one *playtest.spec.ts under aftersign/e2e/',
    ).not.toEqual([]);
  });

  it('no *playtest* spec drives player input through window.__game.input', () => {
    const offenders = readPlaytestSpecs()
      .filter(({ source }) => HARNESS_INPUT_PATTERN.test(source))
      .map(({ repoPath }) => repoPath);

    expect(
      offenders,
      [
        'Played acceptance specs must drive input via visible DOM events (tap/click/press/pointer/etc.),',
        'not through window.__game.input.*  — that surface is assertion-only in a played acceptance.',
        'Offenders:',
        ...offenders.map((path) => `  - ${path}`),
      ].join('\n'),
    ).toEqual([]);
  });
});

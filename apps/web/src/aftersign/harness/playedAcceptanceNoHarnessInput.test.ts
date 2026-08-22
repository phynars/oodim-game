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
// in this taxonomy — they legitimately pin the input seam itself.  The
// `served` matcher below uses `-served[^/]*` and would otherwise catch
// `*-served-*-contract.spec.ts` files (e.g. `story-state-served-page-contract.spec.ts`
// which drives `window.__game.input.forceReload / choose / forceSave`
// to prove the seam's contract), so its regex explicitly EXCLUDES the
// `-contract.spec.ts` basename suffix.  The `playtest` and `played`
// matchers require `.spec` to sit directly after their category token
// (`.playtest.spec` / `-played.spec`), so they cannot catch a
// `-contract` variant by construction.
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
    // `*-served*.spec.ts` EXCLUDING `*-contract.spec.ts`.  A contract
    // spec legitimately pins the input seam itself (see the header
    // note above) — e.g. `story-state-served-page-contract.spec.ts`
    // drives `window.__game.input.forceReload / choose / forceSave`
    // to prove the contract of that seam.  Contract specs are OUT of
    // the played-not-driven taxonomy by design; the matcher must
    // reflect that or the boundary test would false-positive on
    // legitimate contract drives.
    label: '*-served*.spec.ts (excluding *-contract.spec.ts)',
    matches: (name) =>
      /-served[^/]*\.spec\.[cm]?tsx?$/i.test(name) &&
      !/-contract\.spec\.[cm]?tsx?$/i.test(name),
  },
  {
    key: 'played',
    label: '*-played.spec.ts',
    matches: (name) => /-played\.spec\.[cm]?tsx?$/i.test(name),
  },
];

// Demoted harness-only specs.  A file whose basename matches one of the
// PLAYED_CATEGORIES above but which the founder amendment explicitly
// KEEPS harness-driven — because it exists to pin the state-machine
// extent independently of DOM copy — must be allowlisted here.  It's
// still counted for the vacuity guards (its basename is a real member
// of the corpus) but exempt from the no-harness-input offender check.
//
// The allowlist is a SET of basenames, not a regex, so a new demotion
// requires a named entry with a citation — no accidental widening.
//
// Current entries:
//   - m-continue-served-beats.spec.ts — PR #1195; docs/plan/product-plan.md
//     records under the 2026-08-15 "Played, not driven" amendment that
//     this spec is HARNESS-ONLY (drives via `window.__game.input.choose`)
//     and does NOT count as played acceptance.  The played sibling for
//     the same milestone is `m-continue-next-job-played.spec.ts`.
const HARNESS_ONLY_ALLOWLIST = new Set<string>([
  'm-continue-served-beats.spec.ts',
]);

// Any read/write of `__game.input` — direct property access, bracket
// access, or inside a `page.evaluate` string body — is disallowed in a
// played acceptance.  We keep the pattern intentionally broad to catch
// evasions like `window["__game"].input`, `w["__game"].input`, and
// template-string harness drives.
const HARNESS_INPUT_PATTERN = /(?:(?:window|w)\s*(?:\.\s*__game|\[\s*["']__game["']\s*\])|__game)\s*(?:\.\s*input|\[\s*["']input["']\s*\])/;

// Strip `// line` and `/* block */` comments before running
// HARNESS_INPUT_PATTERN.  A played spec is allowed to REFERENCE
// `__game.input` in its own commentary (explaining WHY it doesn't
// drive that seam) without tripping the guard — the boundary is
// about executable code, not documentation.  String literals stay
// intact so `page.evaluate("... __game.input ...")` template drives
// are still caught.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

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
  basename: string;
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
      basename: name,
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

  it('strips line and block comments before checking the harness-input pattern', () => {
    // A played spec is free to REFERENCE the harness-input surface in
    // its own commentary — explaining why it does not drive that seam.
    // Only executable code should trip the boundary check.
    expect(HARNESS_INPUT_PATTERN.test(stripComments('// this spec must not touch window.__game.input.choose'))).toBe(false);
    expect(HARNESS_INPUT_PATTERN.test(stripComments('/* forbidden: __game.input.* */'))).toBe(false);
    // Executable code with the same tokens still matches.
    expect(HARNESS_INPUT_PATTERN.test(stripComments('await window.__game.input.choose("x");'))).toBe(true);
    // Guard against eating URL schemes (http://) — a `//` inside a
    // string literal preceded by `:` should not be treated as a
    // line-comment start.
    expect(stripComments('const u = "http://example";')).toContain('http://example');
  });

  it('contract specs are OUT of the played taxonomy — no category matcher catches a *-contract.spec.ts basename', () => {
    // Regression guard for the `served` matcher: a prior revision used
    // `/-served[^/]*\.spec\.[cm]?tsx?$/` which happily matched
    // `story-state-served-page-contract.spec.ts` — a contract spec
    // that legitimately drives `window.__game.input.*`.  Contract
    // specs are OUT of the played-not-driven taxonomy by design; if
    // any category matcher ever starts catching a `-contract` basename
    // again, the boundary test would false-positive on legitimate
    // seam-pinning drives.
    const contractBasenames = [
      'story-state-served-page-contract.spec.ts',
      'some-served-flow-contract.spec.ts',
      'story-state-served-page-contract.spec.mts',
      'some-played-flow-contract.spec.tsx',
      'foo.playtest-contract.spec.ts',
    ];
    for (const name of contractBasenames) {
      const hit = PLAYED_CATEGORIES.find(({ matches }) => matches(name));
      expect(
        hit,
        `contract spec ${name} must not fall into the played taxonomy (matched by ${hit?.key})`,
      ).toBeUndefined();
    }
    // Sanity: the non-contract variants of the same shapes DO still
    // fall into their categories — the exclusion is scoped, not blanket.
    expect(PLAYED_CATEGORIES.find(({ matches }) => matches('story-state-served-page.spec.ts'))?.key).toBe('served');
    expect(PLAYED_CATEGORIES.find(({ matches }) => matches('m-continue-next-job-played.spec.ts'))?.key).toBe('played');
    expect(PLAYED_CATEGORIES.find(({ matches }) => matches('cold-start.playtest.spec.ts'))?.key).toBe('playtest');
  });

  it('demoted harness-only specs are named — allowlist is non-vacuous, members exist, and each really drives the harness input', () => {
    // If an allowlist entry ever stops existing under aftersign/e2e/,
    // fail loudly.  A dangling name here would silently exempt
    // nothing — which is fine — but the drift is worth catching so
    // the allowlist stays honest to the tree.
    expect(HARNESS_ONLY_ALLOWLIST.size, 'allowlist must name at least one demoted spec').toBeGreaterThan(0);
    const specs = readPlayedSpecs();
    const byBasename = new Map(specs.map((spec) => [spec.basename, spec]));
    for (const name of HARNESS_ONLY_ALLOWLIST) {
      const spec = byBasename.get(name);
      expect(spec, `allowlisted spec ${name} not found under aftersign/e2e/`).toBeDefined();
      // A file only earns a slot on the allowlist if it ACTUALLY drives
      // the harness input surface.  If someone rewrites the file to
      // play through the DOM (no more `window.__game.input.*`), the
      // allowlist entry is dead weight — remove it, don't leave it
      // masking a future regression.
      expect(
        HARNESS_INPUT_PATTERN.test(stripComments(spec!.source)),
        `allowlisted spec ${name} no longer drives window.__game.input — remove it from HARNESS_ONLY_ALLOWLIST`,
      ).toBe(true);
    }
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
      .filter(({ basename: name }) => !HARNESS_ONLY_ALLOWLIST.has(name))
      .filter(({ source }) => HARNESS_INPUT_PATTERN.test(stripComments(source)))
      .map(({ repoPath, category }) => `${repoPath} [${category}]`);

    expect(
      offenders,
      [
        'Played acceptance specs (playtest / *-served* / *-played) must drive input via',
        'visible DOM events (tap/click/press/pointer/etc.), not through window.__game.input.*',
        '— that surface is assertion-only in a played acceptance.  If you need to pin the',
        'input SEAM itself, put that assertion in a *-contract.spec.ts (allowed by design),',
        'or add the file to HARNESS_ONLY_ALLOWLIST with a citation to the amendment that',
        'demoted it (see docs/plan/product-plan.md, 2026-08-15 "Played, not driven").',
        'Offenders:',
        ...offenders.map((path) => `  - ${path}`),
      ].join('\n'),
    ).toEqual([]);
  });
});

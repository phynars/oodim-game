import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP acceptance must prove the flagship's load-bearing memory mechanic on
// the served page. The bar is divergence: two different memory records produce
// different tappable actions, by taps only, on a phone-shaped viewport.
function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/e2e directory.");
}

const REPO_ROOT = findRepoRoot(process.cwd());
const AFTERSIGN_E2E_DIR = join(REPO_ROOT, "aftersign", "e2e");
const SERVED_MAIN_PATH = join(REPO_ROOT, "aftersign", "main.js");

const PHONE_VIEWPORT_PATTERN = /(?:width\s*:\s*3[0-9]{2}\s*,\s*height\s*:\s*(?:6[0-9]{2}|7[0-9]{2}|8[0-9]{2}|9[0-9]{2})|iphone|pixel|mobile|isMobile\s*:\s*true|hasTouch\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const PLAYER_EVENT_GLOBAL_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/g;
const VISIBLE_ACTION_PATTERN = /\b(?:getByRole|getByLabelText|locator)\s*\([^\n]*(?:button|link|menuitem|checkbox|radio|tab|option|action|job|route|price|shortcut)/i;
const DIFFERENT_ACTIONS_PATTERN = /(?:different|divergent|not\.toEqual|not\.toStrictEqual|toHaveCount\s*\(\s*2|available actions|tappable actions|job offers|open routes|prices)/i;
const TWO_SAVE_STATES_PATTERN = /save[-\s]?slots?|save[-\s]?states?|memory\s+records?|two[-\s]?rounds?|looped\s+return|priorOutcome|packet\.delivered|completed\s+set|safe[-\s]?default|returnReason|returnAnswerTone|packetOutcome|firstSave|secondSave|trusted|distrusted|riskTaken|riskAvoided|prior\s+outcomes|trust\s+posture/i;
const COMPLETED_ROUND_PATTERN = /(?:complete|finish|deliver|return)[\s\S]{0,100}(?:round|job|route|delivery)|(?:round|job|route|delivery)[\s\S]{0,100}(?:complete|finish|deliver|return)/gi;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const DIALOGUE_ONLY_PATTERN = /(?:getByText|toContainText|textContent)[\s\S]{0,200}(?:different|divergent|not\.toEqual|not\.toStrictEqual)/i;
// The acceptance witness must read the offer tray's durable posture and locate
// a concrete button. Generic prose about two jobs is not element-level proof.
const DIVERGENCE_TRAY_PATTERN = /data-mloop-divergence-memory/;
const OFFER_BUTTON_PATTERN = /data-offered-job-id/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
}

function stripCommentsAndStrings(source: string): string {
  return stripComments(source)
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''");
}

// The M-LOOP played-acceptance surface must scan every category of e2e file
// that can legitimately host the played-acceptance witness. The historical
// filter admitted only `playtest.*.spec.*` / `*.playtest.spec.*`, which
// silently excluded the two other categories we ship played-acceptance
// evidence under: `*-played.spec.*` (tap-driven behavioural specs) and
// `*-served*.spec.*` (specs that assert against the shipped renderer). The
// scanner is a gate on the search space, not a gate on the witness — the
// witness discipline is enforced by `provesRenderedMloopDivergence` below.
// If the scanner is too narrow, a compliant spec renders invisible and the
// registration test reds even though a passing witness exists on disk.
const PLAYTEST_FILENAME_PATTERN =
  /(?:playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$|-played\.spec\.(?:ts|js)$|-served[^.]*\.spec\.(?:ts|js)$)/i;

function readAftersignPlaytestSpecs(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) return [];
  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((fileName) => PLAYTEST_FILENAME_PATTERN.test(fileName))
    .map((fileName) => ({
      path: join(AFTERSIGN_E2E_DIR, fileName),
      source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
    }));
}

function countMatches(pattern: RegExp, source: string): number {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].length;
}

function matchesLoopDivergencePlaytest(source: string): boolean {
  const uncommented = stripComments(source);
  const code = stripCommentsAndStrings(source);
  return (
    PHONE_VIEWPORT_PATTERN.test(uncommented) &&
    PLAYER_EVENT_PATTERN.test(uncommented) &&
    VISIBLE_ACTION_PATTERN.test(uncommented) &&
    DIFFERENT_ACTIONS_PATTERN.test(uncommented) &&
    TWO_SAVE_STATES_PATTERN.test(uncommented) &&
    HARNESS_READ_PATTERN.test(uncommented) &&
    !HARNESS_INPUT_PATTERN.test(code) &&
    !DIALOGUE_ONLY_PATTERN.test(uncommented)
  );
}

function provesTwoPlayedRounds(source: string): boolean {
  const uncommented = stripComments(source);
  return (
    matchesLoopDivergencePlaytest(source) &&
    countMatches(COMPLETED_ROUND_PATTERN, uncommented) >= 2 &&
    countMatches(PLAYER_EVENT_GLOBAL_PATTERN, stripCommentsAndStrings(source)) >= 4
  );
}

function provesRenderedMloopDivergence(source: string): boolean {
  // The two DOM tokens (`data-mloop-divergence-memory` on the tray,
  // `data-offered-job-id` on the rendered offered button) only appear on
  // the served divergence tray + its offered-button children. A spec that
  // reads both is, by construction, exercising the divergent memory branch
  // through the shipped renderer — no separate "two save states" prose is
  // needed on top. We keep the phone-viewport + no-harness-input + no
  // dialogue-only discipline (the load-bearing invariants of the M-LOOP
  // played-acceptance surface) and require at least one real player-event
  // call, so the spec actually taps rather than merely reading attributes.
  //
  // These two DOM tokens only appear inside locator/getAttribute string
  // literals, so we must NOT strip strings — use stripComments to keep
  // them visible.
  const uncommented = stripComments(source);
  const code = stripCommentsAndStrings(source);
  return (
    PHONE_VIEWPORT_PATTERN.test(uncommented) &&
    !HARNESS_INPUT_PATTERN.test(code) &&
    !DIALOGUE_ONLY_PATTERN.test(uncommented) &&
    DIVERGENCE_TRAY_PATTERN.test(uncommented) &&
    OFFER_BUTTON_PATTERN.test(uncommented) &&
    countMatches(PLAYER_EVENT_GLOBAL_PATTERN, code) >= 1
  );
}

const FIXTURE_COMPLIANT_SPEC = [
  "import { expect, test } from '@playwright/test';",
  "test.use({ viewport: { width: 390, height: 844 } });",
  "test('two memory records produce different tappable actions', async ({ page }) => {",
  "  await page.goto('/aftersign/?slot=A&priorOutcome=packet.delivered');",
  "  const first = await page.locator(`[data-mloop-divergence-memory] button[data-offered-job-id]`).getAttribute('data-offer-fingerprint');",
  "  await page.getByRole('button', { name: /accept/i }).tap();",
  "  await page.goto('/aftersign/?slot=B&trust=trusted');",
  "  const second = await page.locator(`[data-mloop-divergence-memory] button[data-offered-job-id]`).getAttribute('data-offer-fingerprint');",
  "  expect(first).not.toEqual(second);",
  "  const beat = await page.evaluate(() => window.__game?.scene?.beat);",
  "  expect(beat).toBeDefined();",
  "});",
].join("\n");

const FIXTURE_TWO_ROUND_SPEC = [
  FIXTURE_COMPLIANT_SPEC,
  "await page.getByRole('button', { name: /take round one route/i }).tap();",
  "await page.getByRole('button', { name: /deliver round one job/i }).tap();",
  "await page.getByRole('button', { name: /take return route/i }).tap();",
  "await page.getByRole('button', { name: /deliver return job/i }).tap();",
].join("\n");

describe("matchesLoopDivergencePlaytest contract", () => {
  it("admits a synthetic spec that satisfies every baseline gate", () => {
    expect(matchesLoopDivergencePlaytest(FIXTURE_COMPLIANT_SPEC)).toBe(true);
  });

  it("requires visible interaction through two completed rounds", () => {
    expect(provesTwoPlayedRounds(FIXTURE_COMPLIANT_SPEC)).toBe(false);
    expect(provesTwoPlayedRounds(FIXTURE_TWO_ROUND_SPEC)).toBe(true);
  });

  it("requires the actual divergence tray and offered-job buttons, not generic action prose", () => {
    // Baseline compliant spec + the two DOM tokens is enough — the tokens
    // themselves are the divergence witness (they only exist on the served
    // divergence tray and its rendered offered buttons).
    expect(provesRenderedMloopDivergence(FIXTURE_COMPLIANT_SPEC)).toBe(true);
    // Drop the offered-button token → the tray witness is orphaned.
    expect(provesRenderedMloopDivergence(
      FIXTURE_COMPLIANT_SPEC.replaceAll("data-offered-job-id", "data-generic-action"),
    )).toBe(false);
    // Drop the tray token → the offered-button is not proven to be inside
    // the divergence tray.
    expect(provesRenderedMloopDivergence(
      FIXTURE_COMPLIANT_SPEC.replaceAll("data-mloop-divergence-memory", "data-some-marker"),
    )).toBe(false);
    // Reach into `window.__game.input.*` instead of tapping → not played.
    expect(provesRenderedMloopDivergence(
      `${FIXTURE_COMPLIANT_SPEC}\nawait page.evaluate(() => window.__game.input.click('foo'));\n`,
    )).toBe(false);
    // Strip every real player-event call → no played evidence.
    expect(provesRenderedMloopDivergence(
      FIXTURE_COMPLIANT_SPEC.replace(
        /await page\.getByRole\('button', \{ name: \/accept\/i \}\)\.tap\(\);\n/,
        "",
      ),
    )).toBe(false);
  });

  it("does not let comments stand in for an executable divergence witness", () => {
    const commentedOutEvidence = FIXTURE_COMPLIANT_SPEC
      .replace("&priorOutcome=packet.delivered", "")
      .replace("expect(first).not.toEqual(second);", "expect(first).toBeDefined();")
      .replace("two memory records produce different tappable actions", "two visits reach the offer")
      .replace("const beat = await page.evaluate(() => window.__game?.scene?.beat);", "const beat = 'packet-offered';")
      .concat("\n// two memory records, packet.delivered, different tappable actions, window.__game\n");
    expect(matchesLoopDivergencePlaytest(commentedOutEvidence)).toBe(false);
  });

  it.each([
    { gate: "PHONE_VIEWPORT", mutate: (s: string) => s.replace(/test\.use\([^\n]*\n/, "") },
    { gate: "PLAYER_EVENT", mutate: (s: string) => s.replace(/  await page\.getByRole[^\n]*\n/, "") },
    { gate: "VISIBLE_ACTION", mutate: (s: string) => s.replace(/locator\(`\[data-mloop-divergence-memory\] button\[data-offered-job-id\]`\)/g, "evaluate(() => [])").replace(/page\.getByRole\('button', \{ name: \/accept\/i \}\)\.tap\(\)/, "page.touchscreen.tap(1, 1)") },
    { gate: "DIFFERENT_ACTIONS", mutate: (s: string) => s.replace("expect(first).not.toEqual(second);", "expect(first).toBeDefined();").replace("two memory records produce different tappable actions", "two visits land on the packet-offered beat") },
    { gate: "TWO_SAVE_STATES", mutate: (s: string) => s.replace("&priorOutcome=packet.delivered", "").replace("&trust=trusted", "").replace("two memory records produce different tappable actions", "two visits produce different tappable actions") },
    { gate: "HARNESS_READ", mutate: (s: string) => s.replace("  const beat = await page.evaluate(() => window.__game?.scene?.beat);", "  const beat = 'packet-offered';") },
    { gate: "HARNESS_INPUT", mutate: (s: string) => `${s}\nawait page.evaluate(() => window.__game.input.click('foo'));\n` },
    { gate: "DIALOGUE_ONLY", mutate: (s: string) => `${s}\nawait expect(page.getByText('accept the job')).not.toEqual(page.getByText('reject'));\n` },
  ])("rejects when the $gate gate is not satisfied", ({ mutate }) => {
    expect(matchesLoopDivergencePlaytest(mutate(FIXTURE_COMPLIANT_SPEC))).toBe(false);
  });
});

describe("AFTERSIGN M-LOOP divergence played acceptance surface", () => {
  it("has one phone playtest proving rendered divergent offered-job actions through two completed rounds without harness input", () => {
    const playtests = readAftersignPlaytestSpecs();
    // The milestone requires both properties from the same played witness:
    // two completed rounds and rendered, tappable divergence. Finding one
    // spec for each would permit a state-only round test to launder a
    // separate one-tap offer check into acceptance evidence.
    const fullLoopPlaytest = playtests.find(({ source }) =>
      provesRenderedMloopDivergence(source) && provesTwoPlayedRounds(source),
    );
    expect(fullLoopPlaytest?.path).toBeDefined();
  });

  it("keeps the divergent offer witness wired into the served page", () => {
    const main = readFileSync(SERVED_MAIN_PATH, "utf8");
    expect(main).toContain('import { fingerprintJobOfferAction } from "../packages/aftersign/src/jobOfferActionFingerprint"');
    expect(main).toContain('button.setAttribute(\n        "data-offer-fingerprint",\n        fingerprintJobOfferAction(offer).semanticKey,\n      );');
    expect(main).toContain('armJobOfferFeel(button, () => {');
    expect(main).toContain('offeredJobs.appendChild(button);');
  });
});

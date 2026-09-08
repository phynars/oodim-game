import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP acceptance must prove the flagship's load-bearing memory mechanic on
// the served page. The bar is divergence: two different memory records produce
// different tappable actions, by taps only, on a phone-shaped viewport.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

// Phone-viewport signal. The flagship specs (m-loop-divergence.playtest,
// memory-divergence-phone-playtest, m-continue-*, reset-route-risk-isolation)
// all write the labeled Playwright shape
//   `viewport: { width: 390, height: 844 }` or `{ width: 375, height: 812 }`,
// where the width and height numbers are NOT adjacent — `height:` sits in the
// gap. A bare `390\s*,\s*844` fails on that shape. Match on the labeled
// shape (`width: 3XX, height: 8XX`) plus the platform/keyword fallbacks.
const PHONE_VIEWPORT_PATTERN = /(?:width\s*:\s*3[0-9]{2}\s*,\s*height\s*:\s*(?:6[0-9]{2}|7[0-9]{2}|8[0-9]{2}|9[0-9]{2})|iphone|pixel|mobile|isMobile\s*:\s*true|hasTouch\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ACTION_PATTERN = /\b(?:getByRole|getByLabelText|locator)\s*\([^\n]*(?:button|link|menuitem|checkbox|radio|tab|option|action|job|route|price|shortcut)/i;
const DIFFERENT_ACTIONS_PATTERN = /(?:different|divergent|not\.toEqual|not\.toStrictEqual|toHaveCount\s*\(\s*2|available actions|tappable actions|job offers|open routes|prices)/i;
// Two-save-state signal. Real shipped specs write "two save slots" and
// "two different memory records" — neither of which is adjacent — so
// adjacency across a `\s+` gap would find nothing. Match on the tokens
// that DO appear in the flagship specs (`m-loop-divergence.playtest.spec.ts`,
// `m-loop-e1-two-round-playtest.spec.ts`,
// `memory-divergence-phone-playtest.spec.ts`,
// `m-loop-divergent-offered-actions.playtest.spec.ts`,
// `m-loop-e1-phone-action-divergence.spec.ts`): "save slot(s)",
// "save-state(s)", "memory record(s)", "two round(s)", and the
// memory-branch axis names both specs use (priorOutcome / packet /
// returnReason / completed set / safe default / looped return).
const TWO_SAVE_STATES_PATTERN = /save[-\s]?slots?|save[-\s]?states?|memory\s+records?|two[-\s]?rounds?|looped\s+return|priorOutcome|packet\.delivered|completed\s+set|safe[-\s]?default|returnReason|returnAnswerTone|packetOutcome|firstSave|secondSave|trusted|distrusted|riskTaken|riskAvoided|prior\s+outcomes|trust\s+posture/i;
// Harness-input rejection must fire on CODE, not on prose. The flagship
// specs document their abstinence in a header comment that contains the
// literal `window.__game.input.*` — that substring would trip the raw-
// source check and reject the very specs the guard is meant to admit.
// Strip //-comments, /* ... */ comments, and string/template literals
// before applying HARNESS_INPUT_PATTERN. Mirrors the sibling helper in
// `aftersignMemoryDivergencePlaytestSurface.test.ts`.
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const DIALOGUE_ONLY_PATTERN = /(?:getByText|toContainText|textContent)[\s\S]{0,200}(?:different|divergent|not\.toEqual|not\.toStrictEqual)/i;

function stripCommentsAndStrings(source: string): string {
  // Order matters: block comments before line comments before strings.
  // Disjoint alternatives inside the template-literal branch (CodeQL
  // js/redos): escape | ${...} | lone $ | anything-but-`-\-$ — no
  // char is consumable two ways, so matching is linear.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1")
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''");
}

function readAftersignPlaytestSpecs(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) {
    return [];
  }

  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((fileName) => /playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$/i.test(fileName))
    .map((fileName) => ({
      path: join(AFTERSIGN_E2E_DIR, fileName),
      source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
    }));
}

function matchesLoopDivergencePlaytest(source: string): boolean {
  // Only the harness-input rejection needs comment/string stripping — a
  // `toBeVisible` inside a comment is still evidence of intent, but a
  // `__game.input.` inside a comment is documentation of abstinence.
  const code = stripCommentsAndStrings(source);

  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ACTION_PATTERN.test(source) &&
    DIFFERENT_ACTIONS_PATTERN.test(source) &&
    TWO_SAVE_STATES_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(code) &&
    !DIALOGUE_ONLY_PATTERN.test(source)
  );
}

describe("stripCommentsAndStrings ordering", () => {
  // The replace-chain order (block comments → line comments → template
  // literals → double-quoted → single-quoted) is load-bearing: it is what
  // lets the M-LOOP guard admit a spec whose HEADER COMMENT documents
  // abstinence with the literal `window.__game.input.*`. If a future edit
  // reorders the chain (e.g. strings first, or line-before-block), the
  // false-positive that this PR fixed silently returns. These assertions
  // pin the guarantee.
  it("strips a // __game.input. comment so HARNESS_INPUT_PATTERN no longer matches", () => {
    const source = [
      "// M-LOOP specs must NOT drive the game via window.__game.input.click(),",
      "// window.__game.input.press(), or any __game.input.* channel.",
      "await page.getByRole('button', { name: /accept/i }).tap();",
    ].join("\n");

    expect(HARNESS_INPUT_PATTERN.test(source)).toBe(true);
    expect(HARNESS_INPUT_PATTERN.test(stripCommentsAndStrings(source))).toBe(false);
  });

  it("strips a /* __game.input. */ block comment", () => {
    const source = "/* forbidden: window.__game.input.click() */ const x = 1;";

    expect(HARNESS_INPUT_PATTERN.test(source)).toBe(true);
    expect(HARNESS_INPUT_PATTERN.test(stripCommentsAndStrings(source))).toBe(false);
  });

  it("strips a string-literal '__game.input.' so a documented-in-a-string mention does not trip the guard", () => {
    const doubleQuoted = 'const banned = "window.__game.input.click";';
    const singleQuoted = "const banned = 'window.__game.input.click';";
    const templated = "const banned = `window.__game.input.click`;";

    expect(HARNESS_INPUT_PATTERN.test(stripCommentsAndStrings(doubleQuoted))).toBe(false);
    expect(HARNESS_INPUT_PATTERN.test(stripCommentsAndStrings(singleQuoted))).toBe(false);
    expect(HARNESS_INPUT_PATTERN.test(stripCommentsAndStrings(templated))).toBe(false);
  });

  it("does NOT strip a real __game.input. call site", () => {
    const source = "await page.evaluate(() => window.__game.input.click('foo'));";

    expect(HARNESS_INPUT_PATTERN.test(stripCommentsAndStrings(source))).toBe(true);
  });

  it("does not treat a URL's // as a line comment (`:` guard preserves protocol)", () => {
    // The line-comment strip skips `//` preceded by `:` (or a quote/backtick/
    // backslash) so that `https://example.com` in code is not chopped.
    const source = "const url = https://example.com/window.__game.input.click;";

    // The tail after `//` should survive the strip because of the `:` guard.
    expect(stripCommentsAndStrings(source)).toContain("__game.input.click");
  });
});

// Synthetic 8-gate-satisfying fixture. Each line is annotated with the
// gate it exercises so a future edit that removes a gate-hit is visible
// at the point of change (not two files away in the pattern list).
const FIXTURE_COMPLIANT_SPEC = [
  "// M-LOOP divergence playtest — abstains from window.__game.input.click().", //   HARNESS_INPUT (in comment, must be stripped)
  "import { expect, test } from '@playwright/test';",
  "test.use({ viewport: { width: 390, height: 844 } });", //                         PHONE_VIEWPORT (390,844)
  "test('two memory records produce different tappable actions', async ({ page }) => {",
  "  await page.goto('/aftersign/?slot=A');",
  "  const first = await page.locator(`button[data-aftersign-job-take]`).allTextContents();", // VISIBLE_ACTION (locator(`button…`))
  "  await page.getByRole('button', { name: /accept/i }).tap();", //                 PLAYER_EVENT (.tap()) + VISIBLE_ACTION (getByRole button)
  "  // priorOutcome=packet.delivered, looped return: safe-default falls off completed set", // TWO_SAVE_STATES (priorOutcome/packet.delivered/looped return/safe-default/completed set)
  "  await page.goto('/aftersign/?slot=B');",
  "  const second = await page.locator(`button[data-aftersign-job-take]`).allTextContents();",
  "  expect(first).not.toEqual(second); // different tappable actions", //           DIFFERENT_ACTIONS (not.toEqual + 'different')
  "  const beat = await page.evaluate(() => window.__game?.scene?.beat);", //        HARNESS_READ (__game) — read-only
  "  expect(beat).toBeDefined();",
  "});",
].join("\n");

describe("matchesLoopDivergencePlaytest contract", () => {
  // Positive fixture: an 8-gate-compliant spec must admit. Without this
  // test, every gate could silently drift (e.g. a pattern edit that
  // stops matching real flagship vocabulary) and the FS-scan test below
  // would just say "no compliant spec found" without pinpointing the
  // regressed gate. The negative-fixture matrix below then proves each
  // gate is INDIVIDUALLY load-bearing.
  it("admits a synthetic spec that satisfies every gate", () => {
    expect(matchesLoopDivergencePlaytest(FIXTURE_COMPLIANT_SPEC)).toBe(true);
  });

  // Negative-fixture matrix. Each mutation removes exactly one gate's
  // evidence from the compliant fixture; the guard must reject. If a
  // future refactor collapses two gates into one, the case for the
  // removed gate will start FAILING (admit=true) — a visible signal
  // that the gate is no longer independently enforced.
  it.each([
    // Strip phone viewport line.
    { gate: "PHONE_VIEWPORT", mutate: (s: string) => s.replace(/test\.use\([^\n]*\n/, "") },
    // Strip .tap() and getByRole('button'...) call — kills PLAYER_EVENT.
    // The remaining locator(`button…`) still satisfies VISIBLE_ACTION.
    {
      gate: "PLAYER_EVENT",
      mutate: (s: string) => s.replace(/  await page\.getByRole[^\n]*\n/, ""),
    },
    // Strip both locator(`button…`) calls AND the getByRole button call
    // — kills VISIBLE_ACTION. PLAYER_EVENT still satisfied by tap()…
    // wait, tap was on getByRole; drop that too and re-add a raw touchscreen.tap.
    {
      gate: "VISIBLE_ACTION",
      mutate: (s: string) =>
        s
          .replace(/locator\(`button\[data-aftersign-job-take\]`\)/g, "evaluate(() => [])")
          .replace(/page\.getByRole\('button', \{ name: \/accept\/i \}\)\.tap\(\)/, "page.touchscreen.tap(1, 1)"),
    },
    // Kill DIFFERENT_ACTIONS tokens (`different`, `not.toEqual`, and the
    // `tappable actions` phrase in the test title).
    {
      gate: "DIFFERENT_ACTIONS",
      mutate: (s: string) =>
        s
          .replace(
            "expect(first).not.toEqual(second); // different tappable actions",
            "expect(first).toBeDefined();",
          )
          .replace(
            "two memory records produce different tappable actions",
            "two memory records land on the packet-offered beat",
          ),
    },
    // Strip every TWO_SAVE_STATES token in the fixture (both the
    // comment tokens AND the "memory records" phrase in the test title).
    {
      gate: "TWO_SAVE_STATES",
      mutate: (s: string) =>
        s
          .replace(
            "  // priorOutcome=packet.delivered, looped return: safe-default falls off completed set",
            "  // outcome recorded, return visit: default action reshuffled",
          )
          .replace(
            "two memory records produce different tappable actions",
            "two visits produce different tappable actions",
          ),
    },
    // Kill __game evaluate — HARNESS_READ gate.
    {
      gate: "HARNESS_READ",
      mutate: (s: string) =>
        s
          .replace(
            "  const beat = await page.evaluate(() => window.__game?.scene?.beat);",
            "  const beat = 'packet-offered';",
          )
          .replace(
            "// M-LOOP divergence playtest — abstains from window.__game.input.click().",
            "// M-LOOP divergence playtest — abstains from harness input.",
          ),
    },
    // Move the __game.input.click into REAL code (not a comment) — must reject.
    {
      gate: "HARNESS_INPUT (as code, not comment)",
      mutate: (s: string) => s + "\nawait page.evaluate(() => window.__game.input.click('foo'));\n",
    },
    // Add a dialogue-only divergence assertion — DIALOGUE_ONLY_PATTERN kills.
    {
      gate: "DIALOGUE_ONLY",
      mutate: (s: string) =>
        s + "\nawait expect(page.getByText('accept the job')).not.toEqual(page.getByText('reject'));\n",
    },
  ])("rejects when the $gate gate is not satisfied", ({ mutate }) => {
    const mutated = mutate(FIXTURE_COMPLIANT_SPEC);
    expect(matchesLoopDivergencePlaytest(mutated)).toBe(false);
  });
});

describe("AFTERSIGN M-LOOP divergence played acceptance surface", () => {
  it("has a phone playtest proving two memory records produce different tappable actions without harness input", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesLoopDivergencePlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP acceptance must be played, not driven, and must prove mechanical divergence.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - seeds or reaches two different save-slots / save-states / memory records,",
        "  - drives the served page only through visible player events (tap/click/press/pointer/etc.),",
        "  - asserts different AVAILABLE TAPPABLE ACTIONS (jobs, routes, prices, shortcuts), not dialogue-only text,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.* (comments documenting abstinence are fine).",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

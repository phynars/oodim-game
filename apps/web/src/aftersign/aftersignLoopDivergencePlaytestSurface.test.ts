import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP is not a dialogue-depth milestone. The founder bar is divergence:
// two different memory records must produce different AVAILABLE ACTIONS on the
// served page, proven by a taps-only phone playtest. Keep this guard near the
// served-surface tests so a pure state-machine proof cannot pass acceptance.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;
const MEMORY_SEED_PATTERN = /(?:seed|storageState|localStorage|sessionStorage|memory|save|returning|trusted|debt|outcome|prior|priorOutcome|packet\.delivered)/i;
const DIVERGENCE_PATTERN = /(?:divergen|different|not\s*\.\s*toEqual\s*\(|not\s*\.\s*toBe\s*\(|toHaveCount|available actions|job offers|tappable actions|prices|routes|computeOfferedJobs|offeredJobs|offeredJobIds)/i;
const ELEMENT_LEVEL_ACTION_PATTERN = /(?:getByRole\s*\(\s*["']button|getByLabelText|data-testid|#job-offer|offeredJobs|offeredJobIds|computeOfferedJobs|locator\s*\(\s*["'][^"']*(?:button|option|choice|job|route|price|offer|action))/i;
const TWO_ROUND_PATTERN = /(?:round\s*[12]\b|round-[12]\b|second round|two consecutive|complete two|next round|roundTwo|round-2|two[-\s]?round|looped\s+return)/i;

function stripCommentsAndStrings(source: string): string {
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
  const code = stripCommentsAndStrings(source);

  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ASSERTION_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(code) &&
    MEMORY_SEED_PATTERN.test(source) &&
    DIVERGENCE_PATTERN.test(source) &&
    ELEMENT_LEVEL_ACTION_PATTERN.test(source) &&
    TWO_ROUND_PATTERN.test(source)
  );
}

describe("AFTERSIGN M-LOOP divergence played acceptance surface", () => {
  it("has a phone playtest proving memory changes available tappable actions, not just dialogue", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesLoopDivergencePlaytest(source));

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP acceptance must prove divergence on the served page, played not driven.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - drives the served page only through visible player events (tap/click/press/pointer/etc.),",
        "  - seeds or creates two different memory/save states,",
        "  - asserts different AVAILABLE TAPPABLE ACTIONS at the element level (jobs, prices, or routes),",
        "  - extends the standing playtest through two consecutive rounds,",
        "  - reads window.__game only as an assertion surface, and",
        "  - takes no input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

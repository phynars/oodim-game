import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/e2e directory.");
}

function playtestSources(): string[] {
  const directory = join(findRepoRoot(process.cwd()), "aftersign", "e2e");
  return readdirSync(directory)
    .filter((file) => /playtest.*\.spec\.ts$/i.test(file))
    .map((file) => readFileSync(join(directory, file), "utf8"));
}

const hasPhoneViewport = /viewport\s*:\s*\{[^}]*width\s*:\s*(?:3\d{2}|4\d{2})[^}]*height\s*:/is;
const hasVisiblePlayerAction = /(?:\.click\(|\.tap\(|mouse\.click\(|touchscreen\.tap\()/i;
const hasVisibleAssertion = /expect\([^\n]+\)\.(?:toBeVisible|toContainText|toHaveText|toHaveCount)/i;
const readsGameOnly = /window\.__game/i;
const drivesGame = /window\.__game\s*\.\s*input\s*\./i;
const hasTwoSaveStates = /(?:first|safe|trusted|opened)[\s\S]{0,160}(?:second|risk|trusted|opened)|(?:second|risk|trusted|opened)[\s\S]{0,160}(?:first|safe|trusted|opened)/i;
const hasDivergentActions = /(?:different|divergent|not\.toEqual|not\.toBe|not\.toContain)[\s\S]{0,240}(?:button|role|action|offer)|(?:button|role|action|offer)[\s\S]{0,240}(?:different|divergent|not\.toEqual|not\.toBe|not\.toContain)/i;
const hasTwoRounds = /(?:two|2|second)\s+(?:consecutive\s+)?rounds?|round\s*(?:one|1)[\s\S]{0,400}round\s*(?:two|2)/i;

describe("AFTERSIGN M-LOOP divergence played acceptance surface", () => {
  it("keeps a phone playtest for divergent, tappable memory consequences", () => {
    const source = playtestSources().find((candidate) =>
      hasPhoneViewport.test(candidate) &&
      hasVisiblePlayerAction.test(candidate) &&
      hasVisibleAssertion.test(candidate) &&
      readsGameOnly.test(candidate) &&
      !drivesGame.test(candidate) &&
      hasTwoSaveStates.test(candidate) &&
      hasDivergentActions.test(candidate) &&
      hasTwoRounds.test(candidate),
    );

    expect(source, [
      "M-LOOP requires one phone-shaped, taps-only playtest that:",
      "- reads window.__game only for assertions, never for input;",
      "- plays from two distinct persisted memory states;",
      "- proves different tappable available actions, not merely dialogue; and",
      "- completes two consecutive rounds.",
    ].join("\n")).toBeDefined();
  });
});

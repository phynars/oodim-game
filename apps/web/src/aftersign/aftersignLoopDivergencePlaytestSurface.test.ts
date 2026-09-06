import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const e2eDir = join(repoRoot, "aftersign/e2e");

function executableSource(source: string): string {
  return source
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function readPlaytestSpecs(): Array<{ file: string; source: string; executable: string }> {
  if (!existsSync(e2eDir)) {
    return [];
  }

  return readdirSync(e2eDir)
    .filter((file) => /playtest.*\.spec\.(ts|js)$/.test(file))
    .map((file) => {
      const source = readFileSync(join(e2eDir, file), "utf8");
      return { file, source, executable: executableSource(source) };
    });
}

function isMloopDivergenceTwoRoundCandidate(source: string): boolean {
  return /M-LOOP/i.test(source) && /divergence/i.test(source) && /two\s+rounds?|two\s+consecutive\s+rounds?/i.test(source);
}

function hasPhoneViewport(source: string): boolean {
  return /(isMobile\s*:\s*true|hasTouch\s*:\s*true|viewport\s*:\s*\{\s*width\s*:\s*(3[0-9]{2}|4[0-9]{2})\s*,\s*height\s*:\s*(6[0-9]{2}|7[0-9]{2}|8[0-9]{2}|9[0-9]{2}))/i.test(source);
}

function hasVisiblePlayerInput(executable: string): boolean {
  return /\.(tap|click|press)\(|touchscreen\.tap\(/.test(executable);
}

function hasNoHarnessInput(executable: string): boolean {
  return !/window\.__game\.input\s*\./.test(executable);
}

function hasVisibleAssertions(executable: string): boolean {
  return /(toBeVisible\(|getByRole\(|getByText\(|locator\()/.test(executable);
}

function hasTwoMemoryStates(source: string): boolean {
  return /(two|2)\s+(distinct\s+)?(memory|save)|first[-\s]?time.*trusted|trusted.*opened|save[-\s]?states?|first[-\s]?visit[\s\S]*return(ing)?|round\s*1[\s\S]*(same\s+memory|memory\s+record)[\s\S]*round\s*2/i.test(source);
}

function hasActionDivergence(source: string): boolean {
  return /(different|divergent)\s+(visible\s+|available\s+)?(tappable\s+)?(action\s+set|actions?)|action[-\s]?ids?|job\s+offers?|routes?|prices?/i.test(source);
}

function hasElementLevelActionEvidence(executable: string): boolean {
  return /(data-testid|role\s*:\s*["']button|aria-label|toHaveAttribute\(|id\^=|job-offer-|data-choice-id|data-return-reason)/i.test(executable);
}

function hasTwoRoundCoverage(source: string): boolean {
  return /two\s+consecutive\s+rounds?|round\s+one[\s\S]*round\s+two|round\s*1[\s\S]*round\s*2|complete\s+two\s+rounds?/i.test(source);
}

describe("AFTERSIGN M-LOOP served-surface playtest guard", () => {
  it("requires a taps-only phone playtest proving memory-divergent tappable actions and two rounds", () => {
    const specs = readPlaytestSpecs();

    expect(
      specs.length,
      "M-LOOP acceptance needs a served-page e2e under aftersign/e2e/*playtest*.spec.ts",
    ).toBeGreaterThan(0);

    const candidates = specs.filter(({ source }) => isMloopDivergenceTwoRoundCandidate(source));

    expect(
      candidates.map(({ file }) => file),
      "one playtest spec must explicitly cover M-LOOP divergence and two consecutive rounds",
    ).not.toHaveLength(0);

    const compliant = candidates.filter(({ source, executable }) =>
      hasPhoneViewport(source) &&
      hasVisiblePlayerInput(executable) &&
      hasNoHarnessInput(executable) &&
      hasVisibleAssertions(executable) &&
      hasTwoMemoryStates(source) &&
      hasActionDivergence(source) &&
      hasElementLevelActionEvidence(executable) &&
      hasTwoRoundCoverage(source),
    );

    expect(
      compliant.map(({ file }) => file),
      "one M-LOOP playtest must be phone-shaped, taps-only, read-only for window.__game input, visible, seeded across divergent memory/save states, element-level, and two-round complete",
    ).not.toHaveLength(0);
  });
});

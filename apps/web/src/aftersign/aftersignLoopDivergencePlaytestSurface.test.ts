import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");
const e2eDir = path.join(repoRoot, "aftersign/e2e");

function readPlaytestSpecs(): Array<{ path: string; source: string }> {
  if (!fs.existsSync(e2eDir)) return [];

  return fs
    .readdirSync(e2eDir)
    .filter((entry) => /playtest.*\.spec\.ts$/i.test(entry))
    .map((entry) => {
      const specPath = path.join(e2eDir, entry);
      return {
        path: specPath,
        source: fs.readFileSync(specPath, "utf8"),
      };
    });
}

function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function has(pattern: RegExp, source: string): boolean {
  return pattern.test(source);
}

describe("M-LOOP divergence playtest surface", () => {
  it("requires a played, phone-viewport acceptance spec for memory-driven divergent tappable actions", () => {
    const specs = readPlaytestSpecs();

    expect(
      specs.length,
      "Expected at least one aftersign/e2e/*playtest*.spec.ts file to carry the played acceptance evidence.",
    ).toBeGreaterThan(0);

    const matchingSpecs = specs.filter(({ source }) => {
      const executable = stripCommentsAndStrings(source);

      const mobileViewport =
        has(/isMobile\s*:\s*true/i, source) ||
        has(/hasTouch\s*:\s*true/i, source) ||
        has(/viewport\s*:\s*\{\s*width\s*:\s*(3[0-9]{2}|4[0-9]{2})/i, source);

      const visiblePlayerInput =
        has(/\.tap\s*\(/i, source) ||
        has(/touchscreen\.tap\s*\(/i, source) ||
        has(/\.click\s*\(/i, source) ||
        has(/keyboard\.press\s*\(/i, source);

      const visibleAssertion =
        has(/toBeVisible\s*\(/i, source) ||
        has(/getBy(Role|Text|TestId|LabelText)\s*\(/i, source) ||
        has(/locator\s*\(/i, source);

      const readsWindowGame = has(/window\.__game/i, source);
      const drivesWindowGameInput = has(/window\s*\.\s*__game\s*\.\s*input\s*\./i, executable);

      const twoMemoryStates =
        has(/memory[^\n]*(first|safe|new|fresh)[\s\S]*memory[^\n]*(trust|trusted|opened|risk|debt)/i, source) ||
        has(/seed[^\n]*(first|safe|new|fresh)[\s\S]*seed[^\n]*(trust|trusted|opened|risk|debt)/i, source) ||
        has(/save[^\n]*(first|safe|new|fresh)[\s\S]*save[^\n]*(trust|trusted|opened|risk|debt)/i, source);

      const divergentAvailableActions =
        has(/diverg(ent|ence)|different\s+(available\s+)?(tappable\s+)?actions?/i, source) &&
        has(/data-(action|choice|job)|role\s*:\s*["']button|button/i, source);

      const elementLevelEvidence =
        has(/data-(action|choice|job)/i, source) ||
        has(/getByRole\s*\(\s*["']button/i, source);

      const twoRoundCoverage =
        has(/two\s+(consecutive\s+)?rounds|round\s*2|second\s+round|complete[^\n]*round[\s\S]*complete[^\n]*round/i, source);

      return (
        mobileViewport &&
        visiblePlayerInput &&
        visibleAssertion &&
        readsWindowGame &&
        !drivesWindowGameInput &&
        twoMemoryStates &&
        divergentAvailableActions &&
        elementLevelEvidence &&
        twoRoundCoverage
      );
    });

    expect(
      matchingSpecs.map((spec) => path.relative(repoRoot, spec.path)),
      [
        "Expected an aftersign playtest spec that proves the founder's M-LOOP bar:",
        "- phone/mobile viewport",
        "- player actions via visible tap/click/key events, never window.__game.input.*",
        "- window.__game used only as an assertion surface",
        "- two divergent memory/save states",
        "- different AVAILABLE tappable actions proven at element level",
        "- standing playtest extended through two consecutive rounds",
      ].join("\n"),
    ).not.toHaveLength(0);
  });
});

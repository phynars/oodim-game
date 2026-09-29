import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (true) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    const parent = resolve(directory, "..");
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error("Could not find repository-root aftersign/e2e directory.");
}

const AFTERSIGN_E2E_DIR = join(findRepoRoot(process.cwd()), "aftersign", "e2e");
const PLAYTEST_FILE = /(?:playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$|-played\.spec\.(?:ts|js)$)/i;
const PHONE_VIEWPORT = /(?:width\s*:\s*3[0-9]{2}\s*,\s*height\s*:\s*(?:6|7|8|9)[0-9]{2}|mobile|hasTouch\s*:\s*true)/i;
const HARNESS_INPUT = /(?:window\.)?__game\s*\.\s*input\s*\./;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
}

function hasTwoRoundTrayWitness(source: string): boolean {
  const code = stripComments(source);
  const trayReads = code.match(/data-mloop-divergence-memory/g) ?? [];
  const offeredButtonReads = code.match(/data-offered-job-id/g) ?? [];
  const playerEvents = code.match(/\b(?:click|tap|press|touchscreen)\s*\(/g) ?? [];
  const completedRounds = code.match(/(?:deliver|return)[\s\S]{0,120}(?:round|job|route|delivery)|(?:round|job|route|delivery)[\s\S]{0,120}(?:deliver|return)/gi) ?? [];

  return (
    PHONE_VIEWPORT.test(code) &&
    !HARNESS_INPUT.test(code) &&
    trayReads.length >= 2 &&
    offeredButtonReads.length >= 2 &&
    playerEvents.length >= 4 &&
    completedRounds.length >= 2 &&
    /(?:expect\([^\n]*\)\.(?:not\.)?toEqual|expect\([^\n]*\)\.(?:not\.)?toBe)/.test(code)
  );
}

describe("AFTERSIGN M-LOOP two-round divergence played surface", () => {
  it("has one phone playtest that completes two rounds and witnesses the tray branch at both offered-job entries", () => {
    const playtests = readdirSync(AFTERSIGN_E2E_DIR)
      .filter((fileName) => PLAYTEST_FILE.test(fileName))
      .map((fileName) => ({
        path: join(AFTERSIGN_E2E_DIR, fileName),
        source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
      }));

    const witness = playtests.find(({ source }) => hasTwoRoundTrayWitness(source));

    expect(
      witness?.path,
      "M-LOOP requires one played phone spec that completes two rounds, reads data-mloop-divergence-memory and data-offered-job-id at both offered-job entries, and never drives window.__game.input.*.",
    ).toBeDefined();
  });
});

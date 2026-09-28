import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP's played acceptance is not complete at the first divergent offer.
// The founder's bar requires two served rounds completed by player events,
// with the divergence witness on the rendered offered-job tray.
function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/e2e directory.");
}

const E2E_DIRECTORY = join(findRepoRoot(process.cwd()), "aftersign", "e2e");
const PLAYTEST_PATTERN = /(?:playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$|-played\.spec\.(?:ts|js)$|-served[^.]*\.spec\.(?:ts|js)$)/i;
const DIVERGENCE_TRAY = /data-mloop-divergence-memory/;
const OFFERED_BUTTON = /data-offered-job-id/;
const PLAYER_EVENT = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/g;
const ROUND_COMPLETION = /(?:complete|finish|deliver|return)[\s\S]{0,100}(?:round|job|route|delivery)|(?:round|job|route|delivery)[\s\S]{0,100}(?:complete|finish|deliver|return)/gi;
const HARNESS_INPUT = /(?:window\.)?__game\s*\.\s*input\s*\./;

function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1")
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''");
}

function count(pattern: RegExp, source: string): number {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].length;
}

describe("AFTERSIGN M-LOOP two-round played acceptance contract", () => {
  it("keeps one executable phone playtest that proves rendered divergence through two completed rounds", () => {
    const witness = readdirSync(E2E_DIRECTORY)
      .filter((name) => PLAYTEST_PATTERN.test(name))
      .map((name) => ({ name, source: readFileSync(join(E2E_DIRECTORY, name), "utf8") }))
      .find(({ source }) => {
        const executable = stripCommentsAndStrings(source);
        return (
          DIVERGENCE_TRAY.test(source) &&
          OFFERED_BUTTON.test(source) &&
          !HARNESS_INPUT.test(executable) &&
          count(PLAYER_EVENT, executable) >= 4 &&
          count(ROUND_COMPLETION, source) >= 2
        );
      });

    expect(witness?.name).toBeDefined();
  });
});

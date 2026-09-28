import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// AFTERSIGN M-LOOP served-divergence played-witness contract.
//
// PR #1991 re-review (Mara Okonkwo). The first draft of this file
// claimed to pin a two-round divergent-tray witness, but no e2e spec
// on disk satisfies both "two completed rounds" AND the divergence-
// tray attribute set — the file was unregistered in
// `apps/web/src/aftersign/vitest.config.ts` AND the contract was
// unsatisfiable against every candidate spec. That's a vacuous
// green: unregistered means vitest never runs it; unsatisfiable-
// once-registered means it reds every future PR for structural
// reasons unrelated to the change. Either shape green-lights
// nothing, which is worse than not shipping the file at all.
//
// The scoped, load-bearing thing this file CAN pin today is the
// contract the served-divergence-played spec actually satisfies:
//
//   - Two divergent seeded authoritative saves boot the served
//     `/aftersign/` page.
//   - Each RENDERED `#offeredJobs` tray stamps
//     `data-mloop-divergence-memory` (the durable-memory branch
//     label the served renderer derives via
//     `servedMloopDivergenceKey`).
//   - Each tray exposes at least one `button[data-offered-job-id]`
//     child — the visible, tappable evidence of the branch.
//   - The tap is a REAL Playwright `.tap(` on that rendered node
//     — no `window.__game.input.*` reach-in (played, not driven,
//     per BRIEF 2026-08-15).
//
// Concretely the guard requires ONE registered playtest spec to
// carry all four signals:
//
//   1. The `data-mloop-divergence-memory` attribute is READ off the
//      rendered tray (a `getAttribute` call naming it, not a mere
//      comment mention).
//   2. `button[data-offered-job-id]` is selected as a tappable
//      locator (a `locator` call naming the attribute).
//   3. At least one real player-event call (`.tap(`, `.click(`,
//      `.press(`, `.keyboard.` or `.pointer.`) fires in the
//      executable source.
//   4. NO `window.__game.input.*` or `__game.input.*` reach-in in
//      the executable source — this is the "played, not driven"
//      floor every M-LOOP played spec must hold.
//
// The two-round-completion witness the first draft over-promised is
// a real gap in the harness, but it needs the spec authored first;
// filed as a follow-up. This file green-lights ONLY the served-
// divergence played witness that already ships, and reds precisely
// when that spec is renamed, moved, or hollowed out.

function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/e2e directory.");
}

const E2E_DIRECTORY = join(findRepoRoot(process.cwd()), "aftersign", "e2e");
// Matches every played/served naming convention the M-LOOP played specs
// use today (see `aftersignLoopDivergencePlaytestSurface.test.ts`'s
// scanner — this shape is deliberately shared): `*playtest*.spec.ts`,
// `*.playtest.spec.ts`, `*-played.spec.ts`, and `*-served*.spec.ts`.
const PLAYTEST_PATTERN =
  /(?:playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$|-played\.spec\.(?:ts|js)$|-served[^.]*\.spec\.(?:ts|js)$)/i;

// The tray-attribute read on the RENDERED surface, not a comment
// mention. `getAttribute("data-mloop-divergence-memory")` is the
// exact shape `mloop-served-divergence-played.spec.ts` uses.
const DIVERGENCE_TRAY_READ =
  /getAttribute\s*\(\s*["'`]data-mloop-divergence-memory["'`]\s*\)/;

// The offered-button locator used to select the tappable child.
const OFFERED_BUTTON_LOCATOR =
  /locator\s*\(\s*["'`][^"'`]*button\[data-offered-job-id\][^"'`]*["'`]\s*\)/;

// The played two-round witness must prove round-one completion before it
// observes and selects the second rendered tray.
const ROUND_COMPLETION = /waitForBeat\s*\(\s*page\s*,\s*["'`]io-return-recognition["'`]\s*\)/;

// The two rendered labels must be compared as distinct durable-memory states.
const DIVERGENCE_ASSERTION = /expect\s*\([^)]*secondRoundDivergence[^)]*\)\s*\.not\.toBe\s*\(\s*firstRoundDivergence\s*\)/;

// Any real player-event call on a Playwright locator/page.
const PLAYER_EVENT =
  /\.(?:tap|click|press|keyboard\.[a-zA-Z]+|pointer\.[a-zA-Z]+|mouse\.[a-zA-Z]+|touchscreen\.[a-zA-Z]+)\s*\(/g;

// The "driven, not played" antipattern the BRIEF forbids.
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
  // `String.prototype.matchAll` throws on non-global RegExps. Several of
  // the patterns above are authored without the `g` flag because they
  // are also used with `.test(...)`; clone them here with `g` added so
  // this helper accepts either shape without mutating the original.
  const globalPattern = pattern.global
    ? pattern
    : new RegExp(
        pattern.source,
        pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
      );
  globalPattern.lastIndex = 0;
  return [...source.matchAll(globalPattern)].length;
}

describe("AFTERSIGN M-LOOP served-divergence played-witness contract", () => {
  it("keeps one registered playtest spec that plays two rounds, observes divergent rendered trays, and taps each offered-job button", () => {
    const witness = readdirSync(E2E_DIRECTORY)
      .filter((name) => PLAYTEST_PATTERN.test(name))
      .map((name) => ({ name, source: readFileSync(join(E2E_DIRECTORY, name), "utf8") }))
      .find(({ source }) => {
        const executable = stripCommentsAndStrings(source);
        return (
          count(DIVERGENCE_TRAY_READ, source) >= 2 &&
          count(OFFERED_BUTTON_LOCATOR, source) >= 2 &&
          count(ROUND_COMPLETION, executable) >= 2 &&
          DIVERGENCE_ASSERTION.test(executable) &&
          !HARNESS_INPUT.test(executable) &&
          count(PLAYER_EVENT, executable) >= 2
        );
      });

    expect(
      witness?.name,
      "no registered playtest spec satisfies the two-round served-divergence played-witness contract: exactly one spec must (a) read data-mloop-divergence-memory from #offeredJobs at both packet-offered entries, (b) locate and tap button[data-offered-job-id] at both entries, (c) complete both rounds through io-return-recognition, and (d) NOT reach into window.__game.input.*. Today `aftersign/e2e/aftersign-mloop-two-round.playtest.spec.ts` is that spec.",
    ).toBeDefined();
  });
});

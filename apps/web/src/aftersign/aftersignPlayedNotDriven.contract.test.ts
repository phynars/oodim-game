import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// AFTERSIGN played-not-driven guard
// ----------------------------------
// Consumer / subject:
//   The flagship BRIEF says every milestone carries a PLAYTEST spec that
//   drives the SERVED page via visible DOM (Playwright pointer/tap events
//   on rendered elements), NEVER by reaching into `window.__game.input.*`
//   or `page.evaluate` shortcuts.  Contract specs that exist to pin the
//   input SEAM itself (e.g. `flagship-phase2-input-delivery-contract`)
//   legitimately touch that seam — but the acceptance/playtest specs
//   that prove a beat is REACHABLE through the shipped surface must
//   drive it through the DOM, or the beat isn't proven to ship.
//
// This guard has a real corpus today: `aftersign/e2e/` contains
// `*-served*.spec.ts`, `*-played*.spec.ts`, and `*.playtest.spec.ts`
// files that already drive via `button[data-choice-id=...]` clicks
// (see `aftersign/e2e/io-second-packet-copy-served.spec.ts` as the
// exemplar).  If a future edit reaches for `window.__game.input.choose`
// inside one of those files to "unblock" a flaky beat, the acceptance
// contract silently degrades — the spec would then prove that the seam
// works, not that the served page works.  This test fails loudly in
// that case.
//
// Scope:
//   - CANDIDATES: files under `aftersign/e2e/` whose BASENAME matches
//     one of the played-not-driven categories:
//       *.playtest.spec.ts        (all playtest specs)
//       *-served*.spec.ts         (served-surface acceptance)
//       *-played.spec.ts          (played-beat acceptance)
//   - OFFENDERS: candidates that call `window.__game.input.*`,
//     `__game.input.*`, or wrap `input.choose|interact|advance` inside
//     `page.evaluate(...)`.
//   - ALLOWED: contract specs (`*-contract.spec.ts`, regression specs,
//     durable-save-load) — those pin the seam explicitly and are NOT
//     in the played-not-driven category.
//
// LANE: this test runs in the aftersign vitest lane; see
// `apps/web/src/aftersign/vitest.config.ts`.

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const AFTERSIGN_E2E_ROOT = path.join(REPO_ROOT, "aftersign/e2e");

const PLAYED_NOT_DRIVEN_BASENAME_PATTERNS: RegExp[] = [
  /\.playtest\.spec\.[cm]?ts$/,
  /-served[^/]*\.spec\.[cm]?ts$/,
  /-played\.spec\.[cm]?ts$/,
];

const DISALLOWED_HARNESS_INPUT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /window\s*\.\s*__game\s*\.\s*input\s*\./,
    label: "window.__game.input.* access",
  },
  {
    pattern: /__game\s*!?\s*\.\s*input\s*\./,
    label: "__game.input.* access",
  },
  {
    pattern: /page\.evaluate\([^)]*\binput\s*\.\s*(choose|interact|advance|forceSave|forceReload|waitForStoryIdle)\b/,
    label: "page.evaluate(...input.*) shortcut",
  },
];

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = path.join(root, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage"].includes(entry)) {
        return [];
      }

      return listFiles(absolutePath);
    }

    return [absolutePath];
  });
}

function isPlayedNotDrivenCandidate(filePath: string): boolean {
  const basename = path.basename(filePath);
  return PLAYED_NOT_DRIVEN_BASENAME_PATTERNS.some((pattern) => pattern.test(basename));
}

describe("AFTERSIGN played-not-driven acceptance guard", () => {
  it("has a real corpus of played/served/playtest specs to govern", () => {
    // A guard with an empty subject is vacuous.  If this ever hits zero,
    // either the acceptance-spec taxonomy changed or the scan root moved —
    // the guard must be re-pointed before it can protect anything.
    const candidates = listFiles(AFTERSIGN_E2E_ROOT).filter(isPlayedNotDrivenCandidate);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("keeps played/served/playtest acceptance specs from driving via window.__game.input.*", () => {
    const candidates = listFiles(AFTERSIGN_E2E_ROOT)
      .filter(isPlayedNotDrivenCandidate)
      .map((filePath) => ({
        filePath,
        contents: readFileSync(filePath, "utf8"),
      }));

    const offenders = candidates.flatMap(({ filePath, contents }) =>
      DISALLOWED_HARNESS_INPUT_PATTERNS
        .filter(({ pattern }) => pattern.test(contents))
        .map(({ label }) => `${path.relative(REPO_ROOT, filePath)} — ${label}`),
    );

    expect(
      offenders,
      [
        "Acceptance specs (playtest / served / played) must drive the",
        "flagship through visible DOM (button clicks, taps, keyboard),",
        "not through window.__game.input.* or page.evaluate shortcuts.",
        "If you need to pin the input SEAM itself, put that assertion in",
        "a *-contract.spec.ts (allowed by design) instead.",
      ].join(" "),
    ).toEqual([]);
  });
});

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Structural guard for the M-LOOP memory-divergence phone playtest.
// Mirrors the sibling `aftersignDurableSaveLoadPlaytestSurface.test.ts`
// almost line-for-line — same repo-root scan of `aftersign/e2e/`, same
// played-not-driven contract, one extra signal (divergent action sets
// / offer surface) that separates a memory-divergence proof from any
// other phone playtest.
//
// WHY IT LIVES HERE (and NOT as a vitest `include` glob). The prior
// pass (#1385 first attempt) added a glob
// `apps/web/src/aftersign/**/memory-divergence-phone-playtest.spec.ts`
// to `vitest.config.ts`. That was wrong on three counts caught by
// review (see PR #1405 CHANGES_REQUESTED):
//   1) The target file does not exist — the glob is a no-op, CI
//      never runs anything for it, so the "guard" guards nothing.
//   2) Playtest specs live at repo-root `aftersign/e2e/`, NOT under
//      `apps/web/src/aftersign/**` — the sibling durable-save
//      guard's file-header comment documents this trap explicitly
//      ("scanning the wrong tree makes the assertion pass
//      vacuously"). The include glob points at the wrong tree.
//   3) Playtests are Playwright specs (`import ... from
//      "@playwright/test"`), not vitest tests — even if the glob
//      matched a real file, vitest would fail to load `@playwright/
//      test` and the assertion would blow up for the wrong reason.
// The correct shape — matching the sibling — is a VITEST test that
// scans the Playwright tree from repo-root and asserts SHAPE. That's
// this file. Any regression that deletes or degrades the memory-
// divergence playtest reds this suite loudly and specifically.

// Playtest specs live at repo-root `aftersign/e2e/`, not under apps/web.
// Sibling guard `aftersignDurableSaveLoadPlaytestSurface.test.ts`
// documents this trap: scanning the wrong tree makes the assertion pass
// vacuously (empty list → find() undefined → toBeDefined fails on every
// CI run).
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;

// Memory-divergence-specific signals. A memory-divergence phone
// playtest proves that two runs with DIFFERENT durable-memory records
// produce DIFFERENT visible action sets on the served page. Any one of
// these signals is enough — they're OR'd, not AND'd — because the
// concrete proofs we ship today take slightly different shapes:
//
//   • `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts` uses
//     `expect(saveA.offered).not.toEqual(saveB.offered)` — a direct
//     set-difference assertion between two played runs.
//   • `aftersign/e2e/job-offers-played.spec.ts` uses the
//     `computeOfferedJobs` render surface (`#job-offer-<jobId>`)
//     and asserts the safe-default and completed-set branches
//     render on the appropriate first-visit / looped-return beats.
//
// A future dedicated `memory-divergence-phone-playtest.spec.ts` will
// share at least one of these signals; the guard admits any of them.
const DIVERGENCE_SET_ASSERTION_PATTERN = /not\s*\.\s*toEqual\s*\(/;
const OFFER_SURFACE_PATTERN = /(?:computeOfferedJobs|#job-offer|offeredJobs|offeredJobIds)/;
const DIVERGENCE_KEYWORD_PATTERN = /(?:divergen|memory[-\s]?record|different\s+(?:tappable|visible|action|button|offer))/i;

// A memory-divergence proof must actually EXERCISE two memory branches.
// Grep for at least two mentions of a memory-branching axis (packet
// outcome, return-reason/tone, prior-outcome) — a spec that touches
// only one branch cannot prove divergence.
const MEMORY_BRANCH_AXIS_PATTERN = /(?:packet\.delivered|priorOutcome|returnReason|returnAnswerTone|packetOutcome|kind|evasive|blunt|completed|guarded|failed)/gi;

function readAftersignPlaytestSpecs(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) {
    return [];
  }

  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((fileName) =>
      /(?:playtest|played|divergence).*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$/i.test(
        fileName,
      ),
    )
    .map((fileName) => ({
      path: join(AFTERSIGN_E2E_DIR, fileName),
      source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
    }));
}

function matchesMemoryDivergencePlaytest(source: string): boolean {
  // Base contract — same as the sibling durable-save guard.
  const isPhonePlaytest =
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ASSERTION_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(source);
  if (!isPhonePlaytest) {
    return false;
  }

  // Memory-divergence overlay — any one of the three divergence
  // signals AND at least two mentions of a memory-branch axis
  // (otherwise a single-branch spec would sneak through).
  const hasDivergenceSignal =
    DIVERGENCE_SET_ASSERTION_PATTERN.test(source) ||
    OFFER_SURFACE_PATTERN.test(source) ||
    DIVERGENCE_KEYWORD_PATTERN.test(source);
  if (!hasDivergenceSignal) {
    return false;
  }

  const branchMentions = source.match(MEMORY_BRANCH_AXIS_PATTERN) ?? [];
  return branchMentions.length >= 2;
}

describe("AFTERSIGN memory-divergence phone playtest surface", () => {
  it("has a phone playtest that proves two divergent memory records offer different visible actions, with window.__game read-only", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) =>
      matchesMemoryDivergencePlaytest(source),
    );

    expect(
      matchingPlaytest?.path,
      [
        "M-LOOP memory-divergence acceptance must be played, not driven.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - drives the served page only through visible player events (tap/click/press/pointer/etc.),",
        "  - asserts visible UI for the divergent action set,",
        "  - reads window.__game only as an assertion surface,",
        "  - takes no input through window.__game.input.*,",
        "  - proves that two different memory records (packet outcome, return tone,",
        "    prior-outcome, etc.) yield DIFFERENT visible action sets (via",
        "    `not.toEqual`, the `#job-offer-*` / `computeOfferedJobs` surface, or an",
        "    equivalent divergence assertion).",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

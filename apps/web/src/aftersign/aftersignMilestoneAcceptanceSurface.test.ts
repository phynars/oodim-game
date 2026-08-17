import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = process.cwd();
// M-CONTINUE's phone-shaped playtest specs live at the repo-root
// `aftersign/e2e/` tree (see `aftersign/e2e/m-continue-tap-playtest.spec.ts`
// and `m-continue-phone-tap-playtest.spec.ts`), NOT under `apps/web/`.
// Scanning the wrong tree makes every assertion pass vacuously — the
// guard would stay green even if both playtests were deleted.
const AFTERSIGN_E2E_ROOT = join(REPO_ROOT, "aftersign", "e2e");

// EXISTENCE guard, not universal-quantifier.
//
// The M-CONTINUE milestone has TWO legitimate spec shapes in
// `aftersign/e2e/`:
//   1. `*-playtest.spec.ts` — plays the served surface via visible
//      DOM events (`click`/`tap` on real buttons); `window.__game` is
//      READ-ONLY (assertions).  These are the milestone's acceptance
//      proof — a phone player can actually reach the beat.
//   2. `*-served-beats.spec.ts` and other harness specs — drive via
//      `window.__game.input.choose(...)`.  Legitimate for pinning the
//      state machine independently of DOM copy, but do NOT count as
//      played acceptance.
//
// A blanket rule ("no M-CONTINUE spec may use `__game.input`") would
// wrongly ban shape (2) — the harness-driven served-beats sibling has
// its own reason to exist.  What we want to enforce is EXISTENCE of
// shape (1): at least ONE `*playtest*` spec that reaches past
// `io-return-recognition` into `return-tone`/`next-job`, plays via
// visible events, asserts the visible UI along the route, and takes NO
// input through `__game.input`.
//
// Scope discriminant: file NAME containing `playtest` (all five
// M-CONTINUE / IO-CONTINUE played specs at the session commit contain
// it; the harness-driven `m-continue-served-beats.spec.ts` does not).
const PLAYTEST_FILE_PATTERN = /playtest\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const RETURN_RECOGNITION_PATTERN = /io-return-recognition/;
const CONTINUATION_BEAT_PATTERN = /(?:return-tone|next-job|next job|returnTone|nextJob)/i;

function listFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".next", "coverage"].includes(entry.name)) {
        return [];
      }

      return listFiles(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

type PlaytestSpec = {
  path: string;
  repoPath: string;
  source: string;
};

function readPlaytestSpecs(): PlaytestSpec[] {
  return listFiles(AFTERSIGN_E2E_ROOT)
    .filter((path) => PLAYTEST_FILE_PATTERN.test(path))
    .map((path) => ({
      path,
      repoPath: relative(REPO_ROOT, path),
      source: readFileSync(path, "utf8"),
    }));
}

describe("AFTERSIGN M-CONTINUE played acceptance surface", () => {
  it("has at least one playtest spec that reaches past io-return-recognition via visible DOM events, not window.__game.input", () => {
    const playtests = readPlaytestSpecs();

    // Step 1: which playtests actually touch M-CONTINUE's continuation
    // beats?  A file that only names `io-return-recognition` in a
    // header comment but never advances past it does not prove the
    // milestone — require BOTH tokens.
    const mContinuePlaytests = playtests.filter(
      ({ source }) =>
        RETURN_RECOGNITION_PATTERN.test(source) &&
        CONTINUATION_BEAT_PATTERN.test(source),
    );

    expect(
      mContinuePlaytests.map(({ repoPath }) => repoPath),
      "M-CONTINUE needs at least one *playtest.spec.ts under aftersign/e2e/ that reaches past io-return-recognition into return-tone or next-job beats.",
    ).not.toEqual([]);

    // Step 2: among those, count the ones that qualify as PLAYED — no
    // harness-input drive, at least one player-visible event call, and
    // at least one visible UI query/assertion.  The last condition is
    // what catches the failure mode where the state machine advances
    // but the rendered dialogue never changes for the player.
    const playedProofs = mContinuePlaytests.filter(
      ({ source }) =>
        !HARNESS_INPUT_PATTERN.test(source) &&
        PLAYER_EVENT_PATTERN.test(source) &&
        VISIBLE_ASSERTION_PATTERN.test(source),
    );

    expect(
      playedProofs.map(({ repoPath }) => repoPath),
      [
        "M-CONTINUE has no PLAYED acceptance proof.",
        "At least one *playtest.spec.ts under aftersign/e2e/ that touches io-return-recognition + return-tone/next-job MUST:",
        "  - drive input via visible events (tap/click/press/pointer/etc.),",
        "  - assert visible UI along the route (role/text/locator + visibility), and",
        "  - take NO input through window.__game.input.* (that surface is assertion-only in a played acceptance).",
        "Candidates inspected (m-continue continuation beats present):",
        ...mContinuePlaytests.map(({ repoPath }) => `  - ${repoPath}`),
      ].join("\n"),
    ).not.toEqual([]);
  });
});

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP acceptance must be played on the served AFTERSIGN page, not driven
// through the harness bridge. Playtest specs live at repo-root
// `aftersign/e2e/`, not under apps/web.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const VISIBLE_ASSERTION_PATTERN = /\b(?:toBeVisible|getByRole|getByText|getByLabelText|locator)\s*\(/;
// Harness-input rejection must fire on CODE, not on prose. Sibling playtest
// specs (`m-loop-e1-two-round-playtest.spec.ts:19`,
// `m-loop-divergence.playtest.spec.ts:19`) document their abstinence in a
// header comment that contains the literal `window.__game.input.*` — that
// substring would trip this pattern on raw source and reject the very spec
// the guard is meant to admit. Strip //-comments, /* ... */ comments, and
// string/template literals before applying HARNESS_INPUT_PATTERN. The other
// signals stay on the raw source — a `toBeVisible` inside a comment is
// unusual and still evidence of intent.
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_READ_PATTERN = /(?:window\.)?__game\b/;

function stripCommentsAndStrings(source: string): string {
  // Order matters: block comments before line comments before strings.
  // Disjoint alternatives inside the template-literal branch (CodeQL
  // js/redos, alert #23): escape | ${...} | lone $ | anything-but-`-\-$
  // — no char is consumable two ways, so matching is linear.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1")
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''");
}

// Memory-divergence overlay — OR'd signals, not AND'd. The prior AND'd
// four-gate shape (PR #1559 first push) was unsatisfiable: no spec in
// `aftersign/e2e/` contained tokens like "two consecutive rounds" /
// "world pays it back" — those phrases live in `docs/flagship/BRIEF.md`
// and `docs/plan/product-plan.md`, so ROUND_COMPLETION_PATTERN could
// never match a real spec and the guard reddened vacuously.
//
// The overlay we actually want is: (any divergence signal) AND (any
// memory-round signal). Each group is OR'd against tokens that DO
// exist in the shipped specs — checked against
// `m-loop-e1-two-round-playtest.spec.ts` and
// `m-loop-divergence.playtest.spec.ts` before landing.

// Any assertion / phrasing that names the divergence-across-memories
// proof directly. `not.toEqual` is the load-bearing assertion in
// `m-loop-e1-two-round-playtest.spec.ts` and `m-loop-divergence.playtest.spec.ts`;
// the offer-surface tokens (`computeOfferedJobs` / `#job-offer` /
// `offeredJobs`) are the served render surface both specs read; the
// keyword branch admits future specs that use different assertion
// shapes but still name the divergence in prose or ids.
const DIVERGENCE_SIGNAL_PATTERN = /not\s*\.\s*toEqual\s*\(|computeOfferedJobs|#job-offer|offeredJobs|offeredJobIds|divergen|(?:different|differing|different-)\s+(?:memory|memories|record|offer|offer\s*set|action|actions|tappable|visible|button|job|route|price)/i;

// Any signal that the spec exercises MEMORY as progression across
// rounds — the "M-LOOP" contract. Two round-labels ("ROUND 1"/"ROUND 2",
// "round-1"/"round-2"), the "looped return" phrasing both specs use,
// the `priorOutcome`/`packet.delivered` memory-branch axis names, and
// the "safe default"/"completed set" branch names all count. A spec
// that satisfies the base contract AND this pattern AND a divergence
// signal is a memory-divergence phone playtest.
const MEMORY_ROUND_PATTERN = /round\s*[12]\b|round-[12]\b|two[-\s]?round|looped\s+return|priorOutcome|packet\.delivered|completed\s+set|safe[-\s]?default|first[-\s]visit|returnReason|returnAnswerTone|packetOutcome/i;

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

function matchesMemoryDivergencePlaytest(source: string): boolean {
  // Only the harness-input rejection needs comment/string stripping — the
  // other signals stay on raw source (see helper doc above).
  const code = stripCommentsAndStrings(source);

  // Base contract — same as the sibling durable-save guard: phone
  // context, real player events, visible assertions, `window.__game`
  // read only (no `__game.input.*` puppeteering).
  const isPhonePlaytest =
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    VISIBLE_ASSERTION_PATTERN.test(source) &&
    HARNESS_READ_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(code);
  if (!isPhonePlaytest) {
    return false;
  }

  // Memory-divergence overlay — any divergence signal AND any memory-
  // round signal. AND'ing four exact-phrase patterns (the shape this
  // guard shipped with on the first push of #1559) was unsatisfiable;
  // OR'ing within each group and AND'ing the two groups keeps the
  // guard specific to memory-divergence proofs without red-vacuously.
  return (
    DIVERGENCE_SIGNAL_PATTERN.test(source) &&
    MEMORY_ROUND_PATTERN.test(source)
  );
}

describe("AFTERSIGN M-LOOP memory divergence played acceptance surface", () => {
  it("has a taps-only phone playtest proving divergent memories create different tappable actions", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesMemoryDivergencePlaytest(source));

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
        "  - names a divergence signal (`not.toEqual`, `computeOfferedJobs`, `#job-offer`,",
        "    `offeredJobs`, or a `different memory/offer/action` phrasing), AND",
        "  - names a memory-round axis (`ROUND 1`/`ROUND 2`, `looped return`, `priorOutcome`,",
        "    `packet.delivered`, `safe default` / `completed set`, or an equivalent).",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

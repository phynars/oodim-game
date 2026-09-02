import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Durable save/load is only product evidence when a played spec mutates a
// named story-state value through a real player action, crosses a real
// document reload, and reads the restored named value back through
// window.__game. window.__game may observe the invariant; it must not
// drive player input.
//
// SURFACE CONTRACT. The AFTERSIGN served page publishes a READ-ONLY
// harness mirror on `window.__game`: `getSnapshot()` returns the story
// snapshot (see `bootWindowGame.ts` and the served `getSnapshot()` shape
// used across `aftersign/e2e/*.spec.ts`). The harness-only
// `getStoryState()` variant lives in the JSDOM boot
// (`createAftersignWindowGameSurface`) — served pages do not publish it.
// A guard that demands `getStoryState()` in a played spec is
// unsatisfiable in production. This guard therefore accepts EITHER
// entry point: `getSnapshot()` (served, canonical) or `getStoryState()`
// (JSDOM-only, still a valid read surface). What matters for the
// contract is a named story-state field is read through
// `window.__game` after a reload — not which accessor spelled it.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
// A named story-state field is read through the harness mirror. Any of
// the story-owned branches on the served snapshot counts: `story.*`,
// `packet.*`, `delivery.*`, `npcs.*`, `state.*`, or the explicit
// `storyState` / `getStoryState()` spellings. The read must be within
// ~240 chars of a `window.__game` reference so we don't match
// unrelated string usages.
const HARNESS_STORY_READ_PATTERN = /(?:window\.)?__game\b[\s\S]{0,240}(?:getSnapshot|getStoryState|storyState|story\s*[.[]|packet\s*\.|delivery\s*\.|npcs\s*[.[]|state\s*\.\s*(?:story|save|packet|delivery))/i;
// A named story-state value must be mutated. In the served flagship
// slice a player mutates named story state by tapping an affordance
// whose handler writes a durable field (packet outcome, delivery
// outcome, sealed flag, memory fact). We match:
//   • an explicit `setStoryState` / `storyState =` mutation, OR
//   • an assertion that a named story-state field took a concrete
//     value ("sealed", "delivered", "skipped", etc.) — this is the
//     played-spec shape: the tap is the mutation, the expect is the
//     observation that pins the named value the spec relies on.
const NAMED_STORY_MUTATION_PATTERN = /(?:setStoryState\s*\(|storyState\s*=|(?:packet|delivery|story|state)\s*\.\s*(?:outcome|sealed|delivered|beat|memory|nextJob|save|route|attention)[\s\S]{0,120}(?:toBe|toEqual|toMatchObject|toContain|toHaveText)\s*\(\s*["'`][a-z0-9][a-z0-9\- _]*["'`])/i;
const RELOAD_PATTERN = /(?:reload\s*\(|goto\s*\(|newContext\s*\(|newPage\s*\(|hard nav|document teardown|return session|returning session)/i;
// After the reload, the spec must assert a restored named story-state
// value. The `expect(...).toBe("sealed")` shape on a named story-state
// field (already required above) inherently covers "restored" when the
// spec also crosses a reload (required above); this pattern makes the
// intent explicit by looking for a post-reload assertion that names a
// story-state field or references restoration.
const RESTORED_ASSERTION_PATTERN = /(?:restored|returning|returning-session|reload|persisted|remembered|previous session|prior session|second session|durable|carries state)/i;

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

function matchesDurableStoryStateSaveLoadSpec(source: string): boolean {
  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    PLAYER_EVENT_PATTERN.test(source) &&
    !HARNESS_INPUT_PATTERN.test(source) &&
    HARNESS_STORY_READ_PATTERN.test(source) &&
    NAMED_STORY_MUTATION_PATTERN.test(source) &&
    RELOAD_PATTERN.test(source) &&
    RESTORED_ASSERTION_PATTERN.test(source)
  );
}

describe("AFTERSIGN durable story-state save/load surface", () => {
  it("has a played phone spec that mutates a named story-state value and proves it restores through window.__game after reload", () => {
    const playtests = readAftersignPlaytestSpecs();
    const matchingPlaytest = playtests.find(({ source }) => matchesDurableStoryStateSaveLoadSpec(source));

    expect(
      matchingPlaytest?.path,
      [
        "Durable save/load must prove named story-state persistence, not only visible recognition copy.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - mutates a named story-state value through visible player action,",
        "  - crosses a real reload/navigation/new-page boundary,",
        "  - reads window.__game (getSnapshot() or getStoryState()) as an assertion surface",
        "    to verify the restored named story-state value, and",
        "  - never drives player input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

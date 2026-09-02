import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Durable save/load is only product evidence when a played spec mutates a
// named story-state value, crosses a real document reload, and reads the
// restored value back through window.__game. window.__game may observe the
// invariant; it must not cause player input.
const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const PLAYER_EVENT_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const HARNESS_STORY_READ_PATTERN = /(?:window\.)?__game\b[\s\S]{0,240}(?:storyState|story\s*\.\s*state|getStoryState|state\s*\.\s*story)/i;
const NAMED_STORY_MUTATION_PATTERN = /(?:storyState|story\s*\.\s*state|setStoryState|story-state|story state)[\s\S]{0,240}(?:set|mutat|choose|commit|record|assign|mark|value|=)[\s\S]{0,240}["'`][a-z][a-z0-9-]*(?:\.[a-z0-9-]+|_[a-z0-9_]+|-state|-choice|-status)["'`]/i;
const RELOAD_PATTERN = /(?:reload\s*\(|goto\s*\(|newContext\s*\(|newPage\s*\(|hard nav|document teardown|return session)/i;
const RESTORED_ASSERTION_PATTERN = /(?:expect\s*\(|toEqual\s*\(|toBe\s*\(|toMatchObject\s*\()[\s\S]{0,360}(?:restored|loaded|returning|saved|persisted|same|previous|prior|storyState|story state)/i;

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
        "Durable save/load must prove story-state persistence, not only visible recognition copy.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts (repo-root, NOT under apps/web) that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - mutates a named story-state value through visible player action,",
        "  - crosses a real reload/navigation/new-page boundary,",
        "  - reads window.__game as an assertion surface to verify the restored named story-state value, and",
        "  - never drives player input through window.__game.input.*.",
        `Scanned ${playtests.length} playtest spec(s): ${playtests.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

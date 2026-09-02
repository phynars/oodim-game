import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The kiosk loop is only shippable when it is exercised as a played surface:
// a phone-sized player approaches a kiosk prompt, activates it by real
// tap/keyboard input, and observes a deterministic window.__game event. The
// harness may read window.__game for assertions; it must not drive the loop
// through window.__game.input.*.
const AFTERSIGN_ROOT = join(process.cwd(), "aftersign");
const AFTERSIGN_E2E_DIR = join(AFTERSIGN_ROOT, "e2e");
const AFTERSIGN_MAIN_JS = join(AFTERSIGN_ROOT, "main.js");

const PHONE_VIEWPORT_PATTERN = /(?:375\s*,\s*812|390\s*,\s*844|414\s*,\s*896|iphone|pixel|mobile|isMobile\s*:\s*true)/i;
const KIOSK_SURFACE_PATTERN = /\b(?:kiosk|io\s+booth|service\s+window|packet\s+counter)\b/i;
const PLAYER_ACTIVATION_PATTERN = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/;
const KEYBOARD_ACTIVATION_PATTERN = /\b(?:press|keyboard)\s*\(\s*["'`](?:Enter|Space|KeyE|E| )/i;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;
const GAME_EVENT_READ_PATTERN = /(?:window\.)?__game\b[\s\S]{0,320}(?:events|eventLog|lastEvent|storyEvent|interaction\s*\??\.\s*lastAction)/i;
const DETERMINISTIC_KIOSK_EVENT_PATTERN = /(?:lastAction|event|activated|activation|interact|interaction|emit|emitted|dispatch)[\s\S]{0,520}(?:SAFE_DELIVERY_EVENT_ID|["'`][a-z][a-z0-9]*(?:[.:_-][a-z0-9]+)+["'`])/i;
const ASSERTION_PATTERN = /(?:expect\s*\(|toEqual\s*\(|toBe\s*\(|toContain\s*\(|toMatchObject\s*\()/;

function readFileIfPresent(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readAftersignPlayableSurfaces(): Array<{ path: string; source: string }> {
  const playtests = existsSync(AFTERSIGN_E2E_DIR)
    ? readdirSync(AFTERSIGN_E2E_DIR)
        .filter((fileName) => /(?:playtest|kiosk).*\.spec\.(?:ts|js)$/i.test(fileName))
        .map((fileName) => ({
          path: join(AFTERSIGN_E2E_DIR, fileName),
          source: readFileSync(join(AFTERSIGN_E2E_DIR, fileName), "utf8"),
        }))
    : [];

  const mainSource = readFileIfPresent(AFTERSIGN_MAIN_JS);
  return mainSource
    ? [...playtests, { path: AFTERSIGN_MAIN_JS, source: mainSource }]
    : playtests;
}

function hasPlayedKioskInteractionLoop(source: string): boolean {
  return (
    PHONE_VIEWPORT_PATTERN.test(source) &&
    KIOSK_SURFACE_PATTERN.test(source) &&
    PLAYER_ACTIVATION_PATTERN.test(source) &&
    (KEYBOARD_ACTIVATION_PATTERN.test(source) || /tap|pointer|touchscreen/i.test(source)) &&
    !HARNESS_INPUT_PATTERN.test(source) &&
    GAME_EVENT_READ_PATTERN.test(source) &&
    DETERMINISTIC_KIOSK_EVENT_PATTERN.test(source) &&
    ASSERTION_PATTERN.test(source)
  );
}

describe("AFTERSIGN kiosk interaction loop surface", () => {
  it("has a phone-played kiosk loop with proximity prompt, real activation, and deterministic window.__game event emission", () => {
    const surfaces = readAftersignPlayableSurfaces();
    const matchingSurface = surfaces.find(({ source }) => hasPlayedKioskInteractionLoop(source));

    expect(
      matchingSurface?.path,
      [
        "The kiosk loop must be playable before it becomes product evidence.",
        "Add or update an aftersign/e2e/*playtest*.spec.ts, aftersign/e2e/*kiosk*.spec.ts, or aftersign/main.js path that:",
        "  - uses a phone-shaped/mobile viewport,",
        "  - presents a kiosk/booth/counter proximity prompt,",
        "  - activates the kiosk by real player tap/pointer/keyboard input,",
        "  - reads window.__game only as an assertion surface,",
        "  - asserts a deterministic emitted kiosk event/action id, and",
        "  - never drives activation through window.__game.input.*.",
        `Scanned ${surfaces.length} surface(s): ${surfaces.map(({ path }) => path).join(", ") || "none"}`,
      ].join("\n"),
    ).toBeDefined();
  });
});

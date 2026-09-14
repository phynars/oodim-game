import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AFTERSIGN_E2E_DIR = join(process.cwd(), "aftersign", "e2e");
const PHONE_VIEWPORT_PATTERN = /(?:390\s*,\s*844|375\s*,\s*812|isMobile\s*:\s*true|hasTouch\s*:\s*true)/i;
const OFFER_SELECTION_PATTERN = /(?:offer|job)[\s\S]{0,360}(?:tap|click|pointer|touchscreen)\s*\(/i;
const PACKET_BUTTON_PATTERN = /#packetButton|data-aftersign-[\w-]*packet/i;
const VISIBLE_PACKET_ASSERTION_PATTERN = /(?:expect\s*\([^)]*(?:packetButton|packet|dialogue|textContent|toBeVisible)|toContainText\s*\([^)]*(?:packet|Io))/i;
const HARNESS_INPUT_PATTERN = /(?:window\.)?__game\s*\.\s*input\s*\./;

function playtests(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) return [];
  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((name) => /playtest.*\.spec\.(?:ts|js)$/i.test(name))
    .map((name) => ({ path: join(AFTERSIGN_E2E_DIR, name), source: readFileSync(join(AFTERSIGN_E2E_DIR, name), "utf8") }));
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

describe("AFTERSIGN offer-to-packet played surface", () => {
  it("has a phone playtest that taps an offer then advances the visible packet beat without harness input", () => {
    const matching = playtests().find(({ source }) => {
      const executable = stripComments(source);
      return (
        PHONE_VIEWPORT_PATTERN.test(executable) &&
        OFFER_SELECTION_PATTERN.test(executable) &&
        PACKET_BUTTON_PATTERN.test(executable) &&
        VISIBLE_PACKET_ASSERTION_PATTERN.test(executable) &&
        !HARNESS_INPUT_PATTERN.test(executable)
      );
    });

    expect(
      matching?.path,
      [
        "The offer-to-packet story transition must be proved through the served page.",
        "Add an aftersign/e2e/*playtest*.spec.ts that uses a phone viewport, taps a visible offer, taps #packetButton (or its stable packet control), and asserts the visible packet/dialogue transition.",
        "window.__game may be read for assertions but must not cause either player action.",
      ].join("\n"),
    ).toBeDefined();
  });
});

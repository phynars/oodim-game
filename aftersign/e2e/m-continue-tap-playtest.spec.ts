import { expect, test } from "@playwright/test";

// M-CONTINUE played acceptance (PR #1250, reviewer fix): the terminal
// beat is asserted against the SERVED-PAGE published surface —
// `window.__game.scene.beat` (see aftersign/main.js publishState() at
// line 1023, and the canonical contract in
// aftersign/e2e/story-state-surface-contract.spec.ts). The prior draft
// polled `window.__game.state.story.currentBeat`, which exists on
// neither the served page nor the harness (harness uses
// `getSnapshot().story.beat`), so the assertion collapsed to `null` and
// masked flow regressions — a perpetual-false gate, not a test.
//
// The taps use exact accessible names (regex-anchored with ^...$) so
// a scene with multiple partial matches can't silently pick the wrong
// button; no `.first()` — if a button name drifts the spec reds
// immediately at the tap, not at the terminal poll.

const phoneViewport = { width: 390, height: 844 };

async function visibleDialogueText(page: import("@playwright/test").Page): Promise<string> {
  const snapshot = await page.locator("body").innerText();
  return snapshot.replace(/\s+/g, " ").trim();
}

async function tapExactOption(page: import("@playwright/test").Page, name: RegExp): Promise<void> {
  const option = page.getByRole("button", { name });
  await expect(option).toHaveCount(1);
  await expect(option).toBeVisible();
  await option.tap();
}

test.describe("M-CONTINUE played acceptance", () => {
  test.use({ viewport: phoneViewport, hasTouch: true, isMobile: true });

  test("a phone player can tap past Io's return recognition into the tone fork and next job", async ({ page }) => {
    await page.goto("/aftersign/");

    // Packet gesture → delivery → return to Io.
    await tapExactOption(page, /^Tap the packet$/i);
    await tapExactOption(page, /^Deliver packet$/i);
    await tapExactOption(page, /^Return to Io$/i);

    await expect.poll(() => visibleDialogueText(page)).toMatch(/remember|sealed|packet/i);

    // M-CONTINUE acceptance must be PLAYED, not driven: the tone fork
    // is one of the three exact recognition buttons. We commit "steady"
    // here (the middle/evasive posture) — the assertion below only
    // cares that the flow lands on `io-next-job`, not which tone was
    // picked, so any one of the three exact names would do; we pin
    // one so the spec is deterministic. Switch this line if the
    // authored button copy moves.
    await tapExactOption(page, /^Steady$/i);
    await expect.poll(() => visibleDialogueText(page)).toMatch(/steady|return|remember/i);

    await tapExactOption(page, /^Ask for the next job$/i);
    await expect.poll(() => visibleDialogueText(page)).toMatch(/next job|another job|red tag|orra/i);

    // Terminal assertion against the SERVED-PAGE contract surface
    // (aftersign/main.js:1023 publishState() → window.__game.scene.beat).
    // This is the same read path story-state-surface-contract.spec.ts
    // uses, so if a future refactor moves the beat field, both specs
    // red together and the drift can't be silent.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const maybeGame = (window as typeof window & {
            __game?: { scene?: { beat?: unknown } };
          }).__game;
          return maybeGame?.scene?.beat ?? null;
        }),
      )
      .toBe("io-next-job");
  });
});

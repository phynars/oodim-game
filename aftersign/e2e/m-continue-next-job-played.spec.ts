import { expect, test, type Page } from "@playwright/test";

// M-CONTINUE played acceptance — role-based sibling to
// `m-continue-playtest.spec.ts` / `m-continue-phone-tap-playtest.spec.ts`.
// Those siblings drive the same journey via stable `#id` selectors; this
// spec deliberately drives via `getByRole("button", { name: pattern })`
// so a future refactor that keeps the role + accessible name (but
// changes the DOM ids or the button element wiring) still keeps the
// M-CONTINUE handoff tap-reachable.
//
// PATTERNS ARE PINNED TO THE RENDERED LABELS in `aftersign/main.js`
// (`setTextContentIfChanged` calls under the `isPacketChoiceBeat` /
// `isReturnRecognitionBeat` / `isReturnToneChoiceBeat` branches):
//   - packet-offered      → "Deliver packet"
//   - io-return-recognition → "Kind return" / "Evasive return" / "Blunt return"
//   - return-tone-choice  → "Ask for next job" (single enabled control)
// Loose patterns (e.g. /tone/, /continue/) that don't appear in the
// served copy were the failure mode of PR #1288's first revision — the
// tap couldn't find a button because no rendered label contained those
// words. Keep patterns aligned with the actual `setTextContentIfChanged`
// arguments.
//
// BEAT GATING via `window.__game.getSnapshot()` is READ-ONLY — the
// `playedAcceptanceNoHarnessInput` guard forbids driving `__game.input.*`
// from a played spec (file name matching `playtest`), and this file does
// not match that pattern anyway. Snapshot polling is the same pattern
// the sibling `waitForBeat` uses.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

type FlagshipSnapshot = {
  scene?: { beat?: string };
  story?: {
    beat?: string;
    completedBeats?: string[];
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
    };
  }
}

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

async function tapFirstVisible(page: Page, patterns: RegExp[]): Promise<void> {
  for (const pattern of patterns) {
    const candidate = page.getByRole("button", { name: pattern }).first();
    if (
      (await candidate.isVisible().catch(() => false)) &&
      (await candidate.isEnabled().catch(() => false))
    ) {
      await candidate.tap();
      return;
    }
  }

  throw new Error(
    `No visible+enabled player control matched: ${patterns.map(String).join(", ")}`,
  );
}

test.describe("Aftersign M-CONTINUE played acceptance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player taps by button role from packet-offered into the next-job handoff", async ({
    page,
  }) => {
    // Isolated slot per run — same rationale as the sibling playtests
    // (PR #1238): the default slot maps to a shared server-authoritative
    // save on the vite preview process, so a sibling default-slot spec
    // could leave a mid-story beat behind and this test would boot
    // past packet-offered.
    await page.goto(`/aftersign/?slot=m-continue-next-job-played-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Boot: packet-offered. Only the "Deliver packet" control is
    // enabled at this beat (main.js falls into the ELSE branch —
    // acknowledge/skip are disabled with their default HTML text).
    const boot = await snapshot(page);
    expect(boot.scene?.beat).toBe("packet-offered");
    await tapFirstVisible(page, [/deliver packet/i]);

    // Deliver mints the durable memory facts and advances to
    // io-return-recognition; the three route buttons re-label to the
    // return-tone options (Kind / Evasive / Blunt).
    await waitForBeat(page, "io-return-recognition");
    await tapFirstVisible(page, [/kind return/i, /evasive return/i, /blunt return/i]);

    // return-tone-choice: acknowledge/skip go disabled again; the
    // deliver button re-labels to "Ask for next job".
    await waitForBeat(page, "return-tone-choice");
    await tapFirstVisible(page, [/ask for next job/i]);

    // Terminal beat. Assert via getSnapshot() (read-only) so the
    // played-acceptance boundary stays intact.
    const nextJob = await waitForBeat(page, "io-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");

    const completed = nextJob.story?.completedBeats;
    expect(Array.isArray(completed)).toBe(true);
    expect(completed).toEqual(
      expect.arrayContaining(["return-tone-choice", "io-next-job"]),
    );
  });
});

import { expect, test, type Page } from "@playwright/test";

// Tap-driven proof that `findAftersignNpcMemoryRecallLine` — the
// module PR #1343 landed — reaches the shipped `#line` DOM element
// via the same taps a real player performs. No jsdom, no harness
// reach-in: the player taps deliver → acknowledges the route →
// asks for the next job, and Io opens the `io-next-job` beat by
// SPEAKING the recall line the dialogue table authored for the
// packet fork.
//
// This is the served-page consumer proof Soren's second review on
// #1343 asked for — the vitest harness surface at
// `apps/web/src/aftersign/windowGameSurface.ts` is imported only by
// `bootWindowGame.ts`, so a green harness "consumer wiring" test is
// harness evidence, not played evidence. Same shape as the #1228 fix
// the author already landed for `ioMemoryResponseLinesFor` (see
// sibling `npc-memory-dialogue-served.spec.ts`).

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
  npcs?: {
    io?: {
      lastLine?: string;
      memory?: Array<{ id?: string; kind?: string; object?: string }>;
    };
  };
  packet?: {
    sealed?: boolean;
    delivered?: boolean;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      input?: {
        choose: (choiceId: string) => Promise<void> | void;
      };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

// Pinned recall assertion text — MUST match
// `apps/web/src/aftersign/npcMemoryRecallDialogue.ts` for the
// respective fork. If the module changes those substrings, this
// spec is the seam that reds — the change author sees the served
// surface consumer needs to move with the module.
const SEALED_ASSERTION_TEXT = "Still sealed.";
const OPENED_ASSERTION_TEXT = "You opened it.";

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

async function walkToNextJob(page: Page): Promise<FlagshipSnapshot> {
  // Deliver → wait for recognition → acknowledge return → ask for
  // next job. Same tap sequence as `npc-memory-dialogue-served.spec.ts`.
  await page.locator("#deliverButton").click();
  await waitForBeat(page, "io-return-recognition");
  await page.locator("#acknowledgeRouteButton").click();
  await waitForBeat(page, "return-tone-choice");
  await page.locator("#deliverButton").click();
  return waitForBeat(page, "io-next-job");
}

test.describe("AFTERSIGN NPC memory recall dialogue — served surface consumer", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("sealed delivery — 'Still sealed.' reaches #line via player taps", async ({ page }) => {
    // Isolated slot per PR #1238 pattern — a hermetic boot state so
    // sibling specs on the shared vite preview can't leak into ours.
    await page.goto(`/aftersign/?slot=npc-memory-recall-served-sealed-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Default posture keeps the packet sealed — the flagship's
    // canonical "kept it sealed" fork. No packetButton tap.
    const nextJob = await walkToNextJob(page);
    expect(nextJob.packet?.sealed).toBe(true);

    // Snapshot lastLine and DOM line must agree (setTextContentIfChanged
    // keeps them in lockstep) and both must carry the sealed recall
    // assertion text.
    const lastLine = nextJob.npcs?.io?.lastLine ?? "";
    expect(lastLine).toContain(SEALED_ASSERTION_TEXT);
    await expect(page.locator("#line")).toContainText(SEALED_ASSERTION_TEXT);
  });

  test("opened delivery — 'You opened it.' reaches #line via player taps", async ({ page }) => {
    await page.goto(`/aftersign/?slot=npc-memory-recall-served-opened-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    // Open the packet via the shipped `input.choose("open-packet")`
    // seam — same served-surface handler tapped through the packet
    // button's drag gesture, but deterministic under Playwright
    // (a hold gesture is timing-sensitive; every sibling spec that
    // needs the OPENED fork on the served page reaches through
    // `input.choose` the same way — see e.g.
    // io-recognition-return-visual-feel.spec.ts).
    await page.evaluate(() => window.__game!.input!.choose("open-packet"));

    const nextJob = await walkToNextJob(page);
    expect(nextJob.packet?.sealed).toBe(false);

    const lastLine = nextJob.npcs?.io?.lastLine ?? "";
    expect(lastLine).toContain(OPENED_ASSERTION_TEXT);
    await expect(page.locator("#line")).toContainText(OPENED_ASSERTION_TEXT);
  });
});

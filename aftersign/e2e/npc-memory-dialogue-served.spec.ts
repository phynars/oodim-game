import { expect, test, type Page } from "@playwright/test";

// Tap-driven proof that `ioMemoryResponseLinesFor` — the exports Soren
// flagged as orphaned on PR #1228 — reach the shipped `#line` DOM
// element via the same taps a real player performs. No jsdom, no
// harness reach-in: the player taps the deliver button, acknowledges
// the route, asks for the next job, and Io opens the next-job beat by
// SPEAKING the memory line the dispatcher authored.
//
// This is the "prove the served surface consumes the module" surface
// Soren's second review said the spec+runner alone did not provide.

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
  player?: {
    flags?: Record<string, boolean>;
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

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

// Verbatim strings from `aftersign/src/npcMemoryDialogue.js` — pinning
// them here (rather than importing) is deliberate: if the dispatcher's
// text drifts, this spec fails, which is exactly the drift guard the
// wiring is supposed to provide.
const SEALED_PACKET_MEMORY_TEXT =
  "Last time, you kept the blue packet sealed. I noticed the restraint.";
const KIOSK_SKIPPED_MEMORY_TEXT =
  "You skipped the second kiosk ping. Sometimes speed is just another kind of answer.";
const NEXT_JOB_PITCH =
  "Good. Keep that shape. I have another delivery, and this one will know if you hesitate.";

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

test.describe("AFTERSIGN NPC memory dialogue — served surface consumer", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("tap-driven walk to io-next-job renders ioMemoryResponseLinesFor text into #line", async ({ page }) => {
    // Clear any prior slot save so we always start at packet-choice.
    await page.goto("/aftersign/");
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("aftersign:kiosk-slice:")) {
          window.localStorage.removeItem(key);
        }
      }
    });
    await page.goto("/aftersign/");
    await waitForGame(page);

    // Deliver the packet sealed (default) with no second-action tap —
    // mints IO_BLUE_PACKET_SEALED + IO_KIOSK_SECOND_ACTION_SKIPPED into
    // durable memory.
    await page.locator("#deliverButton").click();

    const recognition = await waitForBeat(page, "io-return-recognition");
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    // Kind return — advances to return-tone-choice.
    await page.locator("#acknowledgeRouteButton").click();
    await waitForBeat(page, "return-tone-choice");

    // Ask for the next job — advances to io-next-job, where Io opens
    // by speaking the memory-reflection lines.
    await page.locator("#deliverButton").click();
    const nextJob = await waitForBeat(page, "io-next-job");

    // The shipped `#line` element MUST carry the dispatcher's
    // authored memory text. The runtime state's `lastLine` and the
    // rendered DOM text stay in lockstep via `setTextContentIfChanged`.
    const lastLine = nextJob.npcs?.io?.lastLine;
    expect(typeof lastLine).toBe("string");
    expect(lastLine).toContain(SEALED_PACKET_MEMORY_TEXT);
    expect(lastLine).toContain(KIOSK_SKIPPED_MEMORY_TEXT);
    expect(lastLine).toContain(NEXT_JOB_PITCH);

    await expect(page.locator("#line")).toHaveText(lastLine!);
    await expect(page.locator("#line")).toContainText(SEALED_PACKET_MEMORY_TEXT);
    await expect(page.locator("#line")).toContainText(KIOSK_SKIPPED_MEMORY_TEXT);

    // Sanity: the fact ids that FED the reflection are the durable
    // ones the dispatcher was built to consume — no drift between
    // shipped memory and the module's ids.
    const factIds = (nextJob.npcs?.io?.memory ?? [])
      .map((fact) => fact.id)
      .filter((id): id is string => typeof id === "string");
    expect(factIds).toContain("io-remembers-blue-packet-sealed");
    expect(factIds).toContain("io-remembers-kiosk-second-action-skipped");

    // And io_intro_seen has flipped true by boot-tail, which is the
    // branch the dispatcher requires to leave `firstMeeting` behind.
    expect(nextJob.player?.flags?.io_intro_seen).toBe(true);
  });
});

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
// PR #1236: the `io-next-job` line rendered into `#line` is now sourced
// from `story/ioContinueBeats.ts::IO_NEXT_JOB_HANDOFF.line`, not from
// `packages/aftersign/next-job-beat.js::AFTERSIGN_NEXT_JOB_BEAT.line`
// — the two modules had drifted (different strings for the same beat),
// and Soren's review on #1236 pinned the story module as canonical for
// what the served surface actually speaks. The packages/ module keeps
// the beat id + objective (still consumed by the narrative-triage and
// harness layers); this spec updates to the shipped line accordingly.
const NEXT_JOB_PITCH =
  "Take the red tag to Saint Orra. If the pharmacy sign calls you by the wrong name, answer once and only once.";

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
    // ISOLATED SLOT (PR #1238 root-cause fix): this spec used to run on
    // the DEFAULT slot ("local"), which maps to the SHARED
    // server-authoritative save key local-slice-player::local on the
    // vite preview process. The localStorage sweep below only cleared
    // the BROWSER copy — readAuthoritativeSave still returned whatever
    // a sibling spec (m-continue-playtest / m-continue-served-beats,
    // both also on the default slot) had last written to the SERVER
    // store. Under fullyParallel, once choose-return-tone started
    // forceSave()ing (#1234 — writing beat="return-tone-choice" to the
    // server store), this spec could boot into a mid-story beat, its
    // `#deliverButton` tap silently no-op'd off-beat, and waitForBeat
    // timed out at :74-75 — the exact stack CI posted on this PR's red
    // runs. A unique slot per run makes the boot state hermetic (cold
    // server slot + cold localStorage key), same pattern as every
    // slot-parameterized sibling spec.
    await page.goto(`/aftersign/?slot=npc-memory-served-${Date.now()}`, {
      waitUntil: "load",
    });
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

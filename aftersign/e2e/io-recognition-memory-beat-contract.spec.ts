import { expect, test, type Locator, type Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

type RecognitionOutcome = "sealed" | "opened";

type MemoryBeat = {
  kind: "io_packet_return";
  outcome: RecognitionOutcome;
  startedAt: number;
  endedAt: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  inputLockMs: number;
  lineId: string;
};

const BEAT_LIMITS = {
  durationMs: { min: 1100, max: 1350 },
  cameraDeltaMeters: { min: 0.24, max: 0.36 },
  cameraYawDegrees: { min: 3, max: 5 },
  inputLockMsMax: 1220,
} as const;

const ALLOWED_LINE_IDS = [
  "io_return_packet_sealed",
  "io_return_packet_opened",
] as const;

const assertBeatContract = (beat: MemoryBeat) => {
  expect(beat.kind).toBe("io_packet_return");
  expect(beat.outcome === "sealed" || beat.outcome === "opened").toBeTruthy();

  const durationMs = beat.endedAt - beat.startedAt;
  expect(durationMs).toBeGreaterThanOrEqual(BEAT_LIMITS.durationMs.min);
  expect(durationMs).toBeLessThanOrEqual(BEAT_LIMITS.durationMs.max);
  expect(beat.cameraDeltaMeters).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(beat.cameraDeltaMeters).toBeLessThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.max);
  expect(beat.cameraYawDegrees).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraYawDegrees.min);
  expect(beat.cameraYawDegrees).toBeLessThanOrEqual(BEAT_LIMITS.cameraYawDegrees.max);
  expect(beat.inputLockMs).toBeLessThanOrEqual(BEAT_LIMITS.inputLockMsMax);
  expect(ALLOWED_LINE_IDS).toContain(beat.lineId as (typeof ALLOWED_LINE_IDS)[number]);
};

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beat = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(beat).toBeVisible({ timeout: WAIT_MS });
  return beat;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function choosePacketOutcome(page: Page, outcome: RecognitionOutcome): Promise<void> {
  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });

  if (outcome === "sealed") {
    await packet.click();
    return;
  }

  const box = await packet.boundingBox();
  if (!box) throw new Error("#packetButton has no visible bounds");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(x + 12, y);
  await page.waitForTimeout(450);
  await page.mouse.up();
}

// Player path only: the packet gesture and the two visible dialogue choices
// cause every story transition. window.__game is read below after the beat has
// rendered, solely to assert the published memory-beat contract.
async function collectBeat(page: Page, slot: string, outcome: RecognitionOutcome): Promise<MemoryBeat> {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await choosePacketOutcome(page, outcome);
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "skip-kiosk-acknowledge");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");

  // Visible transition proof precedes the assertion-only runtime read.
  await expect(page.locator("#line")).toContainText("I remember you", { timeout: WAIT_MS });

  const handle = await page.waitForFunction(
    ({ expectedOutcome, minDurationMs }) => {
      const beat = (window as Window & {
        __game?: { story?: { memoryBeat?: MemoryBeat | null } };
      }).__game?.story?.memoryBeat ?? null;
      const durationMs = beat ? beat.endedAt - beat.startedAt : 0;
      return beat
        && beat.outcome === expectedOutcome
        && Number.isFinite(durationMs)
        && durationMs >= minDurationMs
        ? beat
        : null;
    },
    { expectedOutcome: outcome, minDurationMs: BEAT_LIMITS.durationMs.min },
    { timeout: WAIT_MS },
  );
  return (await handle.jsonValue()) as MemoryBeat;
}

test("io recognition publishes range-checked story.memoryBeat through rendered controls", async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const sealed = await collectBeat(page, `io-memory-beat-sealed-${Date.now()}`, "sealed");
  assertBeatContract(sealed);

  const opened = await collectBeat(page, `io-memory-beat-opened-${Date.now()}`, "opened");
  assertBeatContract(opened);

  expect([sealed.outcome, opened.outcome].sort()).toEqual(["opened", "sealed"]);
});

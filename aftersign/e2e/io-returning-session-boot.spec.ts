import { expect, test, type Page } from "@playwright/test";

// #957 — returning-session boot recognition.
//
// A DELIVERED save that is reloaded (real page reload, fresh module
// evaluation) must never replay the fresh "clean handoff"
// packet-delivered copy. Since #2747, restoreFlagshipBeat
// (aftersign/flagship-beat-migration.js) promotes a delivered
// packet-delivered save to io-return-recognition on BOTH restore
// paths, so the reload lands directly on the recognition beat and that
// beat's verbatim-asserted strings win over the returning-session boot
// line. The route-attention fact still selects the line tier.
//
// Expected strings come from the CANONICAL copy modules (#595 cleanup,
// #1077): boot lines from packages/aftersign/src/ioReturningSession.ts,
// recognition-beat lines from aftersign/src/ioRecognitionDialogue.ts.
// Never re-pin literals here — copy evolves in those modules only.
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";
import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

const SEALED_LISTENED_LINE = ioReturningSessionLines.sealedPacketListenedRoute;
const SEALED_SKIPPED_LINE = ioReturningSessionLines.sealedPacketSkippedRoute;
// This spec's "listened" flow acknowledges the kiosk route, so the
// recognition beat speaks the DEEP-RECALL tier (route memory present).
const RECOGNITION_SEALED_LISTENED_LINE = expectedIoRecognitionLine("sealed", true);
const RECOGNITION_SEALED_SKIPPED_LINE = expectedIoRecognitionLine("sealed", false);

type GameProbe = {
  version?: number;
  scene?: { ready?: boolean; beat?: string };
  input?: {
    choose: (choiceId: string) => Promise<void> | void;
    forceSave: () => Promise<void> | void;
    waitForStoryIdle: () => Promise<void> | void;
  };
  getSnapshot?: () => {
    scene: { beat: string };
    packet: { delivered: boolean; sealed: boolean };
    npcs: { io: { lastLine: string | null } };
  };
};

declare global {
  interface Window {
    __game?: GameProbe;
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => window.__game!.input!.waitForStoryIdle());
}

async function deliverSealedAndSave(
  page: Page,
  secondActionChoice: "acknowledge-kiosk" | "skip-kiosk-acknowledge",
): Promise<void> {
  await page.evaluate(() => window.__game!.input!.choose("keep-sealed"));
  await page.evaluate(
    (choice) => window.__game!.input!.choose(choice),
    secondActionChoice,
  );
  await page.evaluate(() => window.__game!.input!.choose("deliver-packet"));
  await page.evaluate(() => window.__game!.input!.forceSave());
}

function snapshot(page: Page) {
  return page.evaluate(() => window.__game!.getSnapshot!());
}

test("reloaded delivered save (route listened) boots on Io's returning line, then yields to recognition", async ({ page }) => {
  const slot = `io-return-boot-listened-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`);
  await waitForReady(page);
  await deliverSealedAndSave(page, "acknowledge-kiosk");

  await page.reload();
  await waitForReady(page);

  const booted = await snapshot(page);
  expect(booted.packet.delivered).toBe(true);
  expect(booted.packet.sealed).toBe(true);
  // #2747 — restoreFlagshipBeat promotes a delivered save straight to
  // the recognition beat on reload; packet-delivered is unreachable.
  expect(booted.scene.beat).toBe("io-return-recognition");
  // The recognition beat's verbatim line wins over the boot line.
  expect(booted.npcs.io.lastLine).toBe(RECOGNITION_SEALED_LISTENED_LINE);
  expect(booted.npcs.io.lastLine).not.toBe(SEALED_LISTENED_LINE);
});

test("reloaded delivered save (route skipped) boots on the skipped-route returning line", async ({ page }) => {
  const slot = `io-return-boot-skipped-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`);
  await waitForReady(page);
  await deliverSealedAndSave(page, "skip-kiosk-acknowledge");

  await page.reload();
  await waitForReady(page);

  const booted = await snapshot(page);
  expect(booted.packet.delivered).toBe(true);
  expect(booted.scene.beat).toBe("io-return-recognition");
  // Route memory must be wired from the durable route-attention fact,
  // not inferred from delivery alone — the skipped branch speaks the
  // non-route recognition tier, not the listened deep-recall tier.
  expect(booted.npcs.io.lastLine).toBe(RECOGNITION_SEALED_SKIPPED_LINE);
  expect(booted.npcs.io.lastLine).not.toBe(RECOGNITION_SEALED_LISTENED_LINE);
  expect(booted.npcs.io.lastLine).not.toBe(SEALED_SKIPPED_LINE);
});

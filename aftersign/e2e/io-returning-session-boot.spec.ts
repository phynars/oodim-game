import { expect, test, type Page } from "@playwright/test";

// #957 — returning-session boot recognition.
//
// A DELIVERED save that is reloaded (real page reload, fresh module
// evaluation) must open with Io's RETURNING-SESSION line — chosen by
// chooseIoReturningSessionLine from the durable memory facts (packet
// outcome + route attention) — instead of replaying the fresh
// "clean handoff" packet-delivered copy. Once the player advances to
// the io-return-recognition beat, that beat's own verbatim-asserted
// strings must win unchanged.
//
// Expected strings are pinned verbatim to
// docs/flagship/vertical-slice-script.md §7–§8 via
// packages/aftersign/src/ioReturningSession.ts — do not paraphrase.

const SEALED_LISTENED_LINE =
  "You came back with the blue seal unbroken, and you listened before you ran. That gives me two good facts and no excuses.";
const SEALED_SKIPPED_LINE =
  "You came back with the blue seal unbroken, and you still ran before the route finished. Reliable hands, impatient feet.";
const RECOGNITION_SEALED_LINE =
  "I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.";

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
  await page.goto(`/?slot=${slot}`);
  await waitForReady(page);
  await deliverSealedAndSave(page, "acknowledge-kiosk");

  await page.reload();
  await waitForReady(page);

  const booted = await snapshot(page);
  expect(booted.packet.delivered).toBe(true);
  expect(booted.packet.sealed).toBe(true);
  expect(booted.scene.beat).toBe("packet-delivered");
  expect(booted.npcs.io.lastLine).toBe(SEALED_LISTENED_LINE);

  // Advancing to the recognition beat: its verbatim-asserted line must
  // win over the boot line (the boot line never overrides that beat).
  await page.evaluate(() => window.__game!.input!.choose("return-to-io"));
  await page.evaluate(() => window.__game!.input!.waitForStoryIdle());
  const advanced = await snapshot(page);
  expect(advanced.scene.beat).toBe("io-return-recognition");
  expect(advanced.npcs.io.lastLine).toBe(RECOGNITION_SEALED_LINE);
});

test("reloaded delivered save (route skipped) boots on the skipped-route returning line", async ({ page }) => {
  const slot = `io-return-boot-skipped-${Date.now()}`;
  await page.goto(`/?slot=${slot}`);
  await waitForReady(page);
  await deliverSealedAndSave(page, "skip-kiosk-acknowledge");

  await page.reload();
  await waitForReady(page);

  const booted = await snapshot(page);
  expect(booted.packet.delivered).toBe(true);
  expect(booted.scene.beat).toBe("packet-delivered");
  // routeAttention must be wired from the durable route-attention fact,
  // not inferred from delivery alone — the skipped branch differs.
  expect(booted.npcs.io.lastLine).toBe(SEALED_SKIPPED_LINE);
});

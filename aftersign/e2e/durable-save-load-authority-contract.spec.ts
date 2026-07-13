import { test, expect, type Page } from "@playwright/test";

// Durable save/load contract for the flagship brief's slice-1 invariant.
//
// This is intentionally stricter than a localStorage reload. The flagship
// signature mechanic needs a save/load proof that survives clearing local
// browser state and comes back from the server-authoritative persistence rung.
//
// Expected public surface on window.__game:
//   - version === 1
//   - scene.beat exposes the current story beat
//   - input.choose(choiceId) advances the story
//   - input.waitForStoryIdle() resolves when async story work is idle
//   - input.forceSave({ slot }) persists to the durable backend
//   - input.forceReload({ slot, clearLocalState: true }) reloads from backend
//   - save.authority === "server" after durable save/load
//   - save.lastLoadProof.source === "server" after reload
//   - save.lastLoadProof.revision matches the saved revision

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type SaveAuthority = "server" | "local-fallback";

type SaveProof = {
  source: SaveAuthority;
  slot: string;
  revision: number;
};

type GameSurface = {
  version: 1;
  scene: { beat: string };
  packet: { delivered: boolean; sealed: boolean };
  delivery: { id: "blue-packet"; outcome: string };
  save: {
    slot: string;
    revision: number;
    dirty: boolean;
    authority: SaveAuthority;
    lastLoadProof: SaveProof | null;
  };
  input: {
    choose(choiceId: string): Promise<void>;
    waitForStoryIdle(): Promise<void>;
    forceSave(options: { slot: string }): Promise<void>;
    forceReload(options: { slot: string; clearLocalState: true }): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function readSurface(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
}

function watchPageErrors(page: Page, label: string): void {
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[aftersign ${label}] pageerror:`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.error(`[aftersign ${label}] console.error:`, msg.text());
    }
  });
}

test.describe("AFTERSIGN durable save/load authority contract (BRIEF slice 1)", () => {
  test("saved story state reloads from server after local state is cleared", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "durable-save-load-authority");

    const slot = `durable-save-load-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await readSurface(page);
    expect(beforeSave.packet.delivered).toBe(true);
    expect(beforeSave.packet.sealed).toBe(true);
    expect(beforeSave.delivery.outcome).toBe("sealed");

    await page.evaluate((durableSlot) => window.__game!.input.forceSave({ slot: durableSlot }), slot);
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const saved = await readSurface(page);
    expect(saved.save.slot).toBe(slot);
    expect(saved.save.authority).toBe("server");
    expect(saved.save.revision).toBeGreaterThan(0);

    await page.evaluate((durableSlot) =>
      window.__game!.input.forceReload({ slot: durableSlot, clearLocalState: true }),
    slot);
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const reloaded = await readSurface(page);
    expect(reloaded.packet.delivered).toBe(true);
    expect(reloaded.packet.sealed).toBe(true);
    expect(reloaded.delivery.outcome).toBe("sealed");
    expect(reloaded.save.dirty).toBe(false);
    expect(reloaded.save.slot).toBe(slot);
    expect(reloaded.save.authority).toBe("server");
    expect(reloaded.save.lastLoadProof).toEqual({
      source: "server",
      slot,
      revision: saved.save.revision,
    });
  });
});

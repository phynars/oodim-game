import { test, expect } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type OrientationSnapshot = {
  beat?: unknown;
  ready?: unknown;
  player?: {
    x?: unknown;
    z?: unknown;
    facingRadians?: unknown;
    flags?: Record<string, unknown>;
  };
  cameraRig?: unknown;
};

async function readOrientationSnapshot(page: import("@playwright/test").Page): Promise<OrientationSnapshot> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __game?: unknown }).__game),
    undefined,
    { timeout: WAIT_MS },
  );

  return page.evaluate(() => {
    const game = (window as unknown as {
      __game?: {
        scene?: { beat?: unknown; ready?: unknown };
        player?: { x?: unknown; z?: unknown; facingRadians?: unknown; flags?: Record<string, unknown> };
        cameraRig?: unknown;
      };
    }).__game;

    return JSON.parse(JSON.stringify({
      beat: game?.scene?.beat,
      ready: game?.scene?.ready,
      player: game?.player,
      cameraRig: game?.cameraRig,
    })) as OrientationSnapshot;
  });
}

test.describe("AFTERSIGN reset orientation contract", () => {
  test("resetSliceSave returns the player to the same kiosk-facing boot pose", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `reset-orientation-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    const boot = await readOrientationSnapshot(page);
    expect(boot.ready).toBe(true);
    expect(boot.beat).toBe("packet-offered");
    expect(boot.player).toMatchObject({
      x: -1.8,
      z: 1.15,
      facingRadians: Math.PI,
    });

    await page.evaluate(async () => {
      const game = (window as unknown as {
        __game?: { resetSliceSave?: () => Promise<void> };
      }).__game;
      await game?.resetSliceSave?.();
    });

    const reset = await readOrientationSnapshot(page);
    expect(reset.ready).toBe(true);
    expect(reset.beat).toBe("packet-offered");
    expect(reset.player).toMatchObject({
      x: -1.8,
      z: 1.15,
      facingRadians: Math.PI,
    });
    expect(reset.player?.flags?.io_intro_seen).toBe(true);
  });

  test("resetSliceSave keeps Io past first-meeting so next-job dialogue cites durable memory", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `reset-memory-dialogue-${Date.now()}`;

    // Cold-boot on the target slot, then call `resetSliceSave()` — the
    // reset surface IS the code under test here (it was minting an
    // incomplete `state.player` with no `flags` object, so the very
    // first `state.player.flags.io_intro_seen` read at the recognition
    // beat would throw). Everything AFTER the reset is driven through
    // visible-DOM taps only, per PLAYED-NOT-DRIVEN (BRIEF 2026-08-15
    // and Soren PR #1257 review): the player-outcome claim ("next-job
    // dialogue cites durable memory") has to be proven on the shipped
    // page, not through `input.choose()`.
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    await page.evaluate(async () => {
      await (window as unknown as { __game: { resetSliceSave: () => Promise<void> } }).__game.resetSliceSave();
    });

    // After the reset, the flags object must exist AND carry the
    // defensive io_intro_seen default. This is the load-bearing proof
    // that the incomplete-player-object bug is fixed — without it the
    // taps below would throw at the recognition beat.
    const flagsAfterReset = await page.evaluate(
      () =>
        (window as unknown as { __game?: { player?: { flags?: Record<string, unknown> } } }).__game?.player?.flags ??
        null,
    );
    expect(flagsAfterReset).not.toBeNull();
    expect(flagsAfterReset?.io_intro_seen).toBe(true);

    // Tap-driven walk to io-next-job — same shape as the sibling
    // io-continue-beats-tap-playtest.spec.ts. Reset drops the player
    // back at the packet gesture with io_intro_seen already true, so
    // the recognition beat will branch into the memory-citing reply.
    const lineNode = page.locator("#line");
    const waitForBeat = async (beatId: string) => {
      await expect(
        page.locator(`[data-beat-id="${beatId}"]`),
        `story line should reach beat "${beatId}"`,
      ).toBeVisible({ timeout: WAIT_MS });
    };
    const tapChoice = async (choiceId: string) => {
      const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
      await expect(choice).toBeVisible({ timeout: WAIT_MS });
      await choice.click();
    };

    await waitForBeat("packet-offered");
    await page.locator("#packetButton").click();
    await waitForBeat("packet-choice");

    // The packet tap above is the keep-sealed gesture; this beat only
    // exposes the route-attention controls before delivery.
    await tapChoice("acknowledge-kiosk");
    await tapChoice("deliver-packet");
    await waitForBeat("packet-delivered");

    // Auto-advance to recognition (~1180ms setTimeout in deliverPacket()).
    await waitForBeat("io-return-recognition");

    // Tap a tone (any tone routes into io-next-job via
    // ask-for-next-job); pick "blunt" to mirror the sibling spec.
    const toneButton = page
      .locator('button[data-return-reason="blunt"]:not([disabled])')
      .first();
    await expect(toneButton).toBeVisible({ timeout: WAIT_MS });
    await toneButton.click();
    await waitForBeat("return-tone-choice");

    await tapChoice("ask-for-next-job");
    await waitForBeat("io-next-job");

    // Player-outcome assertion on the SHIPPED page: `#line` at
    // io-next-job contains BOTH memory citations (sealed packet +
    // acknowledged kiosk) and does NOT regress into the
    // first-meeting "before I knew your name" copy.
    await expect(lineNode).toContainText(
      "Last time, you kept the blue packet sealed. I noticed the restraint.",
      { timeout: WAIT_MS },
    );
    await expect(lineNode).toContainText(
      "And you checked the kiosk twice. Most couriers pretend the second signal is static.",
      { timeout: WAIT_MS },
    );
    await expect(lineNode).not.toContainText(
      "You came back before I knew your name. That counts for something.",
      { timeout: WAIT_MS },
    );
  });
});

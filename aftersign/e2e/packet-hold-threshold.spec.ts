import { expect, test } from "@playwright/test";

// Cold-start budget matches other AFTERSIGN e2e specs: SwiftShader + esm.sh
// three.js imports can exceed Playwright's default 30s timeout on CI.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Contract: PacketIntentController maps time-held into an outcome via three
// constants in aftersign/packet-intent.js — TAP_TO_PRESERVE_MAX_MS=180,
// HOLD_TO_OPEN_MS=450, PROGRESS_DEADBAND_MS=80. This spec pins the boundary
// end-to-end (scene beat + packet state + intent outcome) so a regression in
// the wiring between the controller, the scene beat machine, and the
// window.__game surface fails CI — not just the unit test in isolation.

type PacketOutcome = "unknown" | "sealed" | "opened" | "cancelled";

type Beat =
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

type InteractionFeedback = {
  active: boolean;
  remainingMs: number;
  durationMs: number;
  cameraKickDeg: number;
  cameraKickWorldX: number;
  hudShakePx: number;
};

type GameSnapshot = {
  scene: { beat: Beat };
  packet: { sealed: boolean };
  interaction: {
    failureStartedAt: number | null;
    packetIntent: {
      outcome: PacketOutcome;
      progress: number;
      active: boolean;
    };
    failureFeedback: InteractionFeedback & {
      hudDropPx: number;
      flashAlpha: number;
      wobbleCycles: number;
      easing: string;
    };
  };
};

declare global {
  interface Window {
    __game?: {
      resetSliceSave: () => void;
      getSnapshot: () => GameSnapshot;
      input: {
        packetPress: (input: { timeMs: number; x: number; y: number }) => void;
        packetTick: (timeMs: number) => void;
        packetMove: (input: { timeMs: number; x: number; y: number }) => void;
        packetRelease: (input: { timeMs: number; x: number; y: number }) => void;
      };
    };
  }
}

function watchPageErrors(page, label: string): void {
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

const waitForGame = async (page) => {
  await page.waitForFunction(() => Boolean(window.__game?.input?.packetPress), undefined, {
    timeout: WAIT_MS,
  });
};

test("short tap stays sealed; sustained hold flips to opened past HOLD_TO_OPEN_MS", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);
  watchPageErrors(page, "packet-hold-threshold");

  await page.goto("/?slot=packet-hold-threshold", { waitUntil: "load" });
  await waitForGame(page);
  await page.evaluate(() => window.__game?.resetSliceSave());

  // --- Short tap: 120ms, well under the 180ms ceiling ---
  const tapSnapshot = await page.evaluate(() => {
    const t0 = 1_000;
    window.__game?.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game?.input.packetRelease({ timeMs: t0 + 120, x: 24, y: 24 });
    return window.__game?.getSnapshot();
  });

  expect(tapSnapshot.packet.sealed).toBe(true);
  expect(tapSnapshot.scene.beat).not.toBe("packet-opened");
  expect(tapSnapshot.interaction.packetIntent.outcome).toBe("sealed");

  // Reset the slice so the next press starts from a clean sealed offer.
  await page.evaluate(() => window.__game?.resetSliceSave());

  // --- Mid-hold: tick at start + 180ms (100ms of usable hold, below 450ms) ---
  const midHoldSnapshot = await page.evaluate(() => {
    const t0 = 4_000;
    window.__game?.input.packetPress({ timeMs: t0, x: 40, y: 40 });
    window.__game?.input.packetTick(t0 + 180);
    return window.__game?.getSnapshot();
  });

  expect(midHoldSnapshot.packet.sealed).toBe(true);
  expect(midHoldSnapshot.scene.beat).not.toBe("packet-opened");
  expect(midHoldSnapshot.interaction.packetIntent.outcome).toBe("unknown");
  expect(midHoldSnapshot.interaction.packetIntent.progress).toBeGreaterThan(0);
  expect(midHoldSnapshot.interaction.packetIntent.progress).toBeLessThan(1);

  // --- Cancellation path (failure sting): drift > 14px should cancel and
  // trigger failureFeedback with a 180ms envelope + 0.34 flash alpha.
  await page.evaluate(() => window.__game?.resetSliceSave());
  const cancelledSnapshot = await page.evaluate(() => {
    const t0 = 8_000;
    window.__game?.input.packetPress({ timeMs: t0, x: 100, y: 100 });
    window.__game?.input.packetMove({ timeMs: t0 + 40, x: 122, y: 100 });
    return window.__game?.getSnapshot();
  });

  expect(cancelledSnapshot.interaction.packetIntent.outcome).toBe("cancelled");
  expect(cancelledSnapshot.packet.sealed).toBe(true);
  expect(cancelledSnapshot.scene.beat).toBe("packet-offered");
  expect(cancelledSnapshot.interaction.failureFeedback.active).toBe(true);
  expect(cancelledSnapshot.interaction.failureFeedback.remainingMs).toBeGreaterThan(0);
  expect(cancelledSnapshot.interaction.failureFeedback.remainingMs).toBeLessThanOrEqual(180);
  expect(cancelledSnapshot.interaction.failureFeedback.durationMs).toBe(180);
  expect(cancelledSnapshot.interaction.failureFeedback.flashAlpha).toBe(0.34);
  expect(cancelledSnapshot.interaction.failureStartedAt).not.toBeNull();

  // --- Regression guard: drift-cancel THEN pointerup on the same gesture must
  // NOT re-trigger the failure sting. Before the transition guard, the release
  // path saw the stale CANCELLED snapshot from the controller and fired the
  // 180ms sting a second time — the player would see the flash replay. Assert
  // failureStartedAt is stable across the release (i.e. no new trigger).
  const cancelStartedAt = cancelledSnapshot.interaction.failureStartedAt;
  const afterReleaseSnapshot = await page.evaluate((prev) => {
    // Small sleep so a re-trigger would produce a strictly-later performance.now().
    const before = performance.now();
    while (performance.now() - before < 20) { /* spin ~20ms */ }
    window.__game?.input.packetRelease({ timeMs: 8_000 + 90, x: 122, y: 100 });
    return { snapshot: window.__game?.getSnapshot(), prevStartedAt: prev };
  }, cancelStartedAt);

  expect(afterReleaseSnapshot.snapshot.interaction.packetIntent.outcome).toBe("cancelled");
  expect(afterReleaseSnapshot.snapshot.interaction.failureStartedAt)
    .toBe(afterReleaseSnapshot.prevStartedAt);

  // --- Past-threshold: continue the same hold to start + 2000ms ---
  const heldSnapshot = await page.evaluate(() => {
    window.__game?.input.packetPress({ timeMs: 10_000, x: 40, y: 40 });
    window.__game?.input.packetTick(10_000 + 2_000);
    return window.__game?.getSnapshot();
  });

  expect(heldSnapshot.packet.sealed).toBe(false);
  expect(heldSnapshot.scene.beat).toBe("packet-opened");
  expect(heldSnapshot.interaction.packetIntent.outcome).toBe("opened");
  expect(heldSnapshot.interaction.packetIntent.progress).toBe(1);
});

test("deadzone release (181–449 ms) preserves the seal instead of cancelling", async ({
  page,
}) => {
  // Feel contract, pinned through window.__game: a hesitant in-bounds
  // release inside the 181–449 ms deadzone is not a punitive CANCEL — it
  // defaults to SEALED. A false-sealed is recoverable (press again);
  // a false-opened spends trust. If this regresses to "cancelled" or
  // "opened", the flagship slice's Act I trust readability breaks.
  await page.goto("/?slot=packet-hold-threshold");
  await waitForGame(page);
  await page.evaluate(() => window.__game.resetSliceSave());

  // Release at start + 300ms: past TAP_TO_PRESERVE_MAX_MS (180) and well
  // under HOLD_TO_OPEN_MS (450) — the middle of the deadzone.
  const deadzoneSnapshot = await page.evaluate(() => {
    const t0 = 8_000;
    window.__game.input.packetPress({ timeMs: t0, x: 32, y: 32 });
    window.__game.input.packetRelease({ timeMs: t0 + 300, x: 32, y: 32 });
    return window.__game.getSnapshot();
  });

  expect(deadzoneSnapshot.packet.sealed).toBe(true);
  expect(deadzoneSnapshot.scene.beat).not.toBe("packet-opened");
  expect(deadzoneSnapshot.interaction.packetIntent.outcome).toBe("sealed");
  expect(deadzoneSnapshot.interaction.packetIntent.progress).toBe(0);

  await page.evaluate(() => window.__game.resetSliceSave());

  // Upper deadzone boundary: release at HOLD_TO_OPEN_MS − 1 must still be SEALED.
  const nearMissSnapshot = await page.evaluate(() => {
    const t0 = 12_000;
    window.__game.input.packetPress({ timeMs: t0, x: 48, y: 48 });
    window.__game.input.packetRelease({ timeMs: t0 + 449, x: 48, y: 48 });
    return window.__game.getSnapshot();
  });

  expect(nearMissSnapshot.packet.sealed).toBe(true);
  expect(nearMissSnapshot.scene.beat).not.toBe("packet-opened");
  expect(nearMissSnapshot.interaction.packetIntent.outcome).toBe("sealed");
});

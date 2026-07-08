import { expect, test } from "@playwright/test";

// Contract: PacketIntentController maps time-held into an outcome via three
// constants in aftersign/packet-intent.js — TAP_TO_PRESERVE_MAX_MS=180,
// HOLD_TO_OPEN_MS=450, PROGRESS_DEADBAND_MS=80. This spec pins the boundary
// end-to-end (scene beat + packet state + intent outcome) so a regression in
// the wiring between the controller, the scene beat machine, and the
// window.__game surface fails CI — not just the unit test in isolation.
//
// Assertions:
//   1. A 120ms tap (< 180ms ceiling) → outcome=sealed, sealed=true, beat
//      does NOT flip to packet-opened.
//   2. Mid-hold at start+180ms: held time after the 80ms deadband is 100ms;
//      progress ≈ 0.27 (100 / (450 − 80)) — still below threshold, so
//      outcome stays "unknown" and the packet stays sealed.
//   3. Past-threshold at start+2000ms: held time is way beyond the 450ms
//      threshold — outcome flips to "opened", packet.sealed=false, and the
//      scene beat becomes packet-opened.

const waitForGame = async (page) => {
  await page.waitForFunction(() => Boolean(window.__game?.input?.packetPress));
};

test("short tap stays sealed; sustained hold flips to opened past HOLD_TO_OPEN_MS", async ({
  page,
}) => {
  await page.goto("/?slot=packet-hold-threshold");
  await waitForGame(page);
  await page.evaluate(() => window.__game.resetSliceSave());

  // --- Short tap: 120ms, well under the 180ms ceiling ---
  const tapSnapshot = await page.evaluate(() => {
    const t0 = 1_000;
    window.__game.input.packetPress({ timeMs: t0, x: 24, y: 24 });
    window.__game.input.packetRelease({ timeMs: t0 + 120, x: 24, y: 24 });
    return window.__game.getSnapshot();
  });

  expect(tapSnapshot.packet.sealed).toBe(true);
  expect(tapSnapshot.scene.beat).not.toBe("packet-opened");
  expect(tapSnapshot.interaction.packetIntent.outcome).toBe("sealed");

  // Reset the slice so the next press starts from a clean sealed offer.
  await page.evaluate(() => window.__game.resetSliceSave());

  // --- Mid-hold: tick at start + 180ms (100ms of usable hold, below 450ms) ---
  const midHoldSnapshot = await page.evaluate(() => {
    const t0 = 4_000;
    window.__game.input.packetPress({ timeMs: t0, x: 40, y: 40 });
    window.__game.input.packetTick(t0 + 180);
    return window.__game.getSnapshot();
  });

  expect(midHoldSnapshot.packet.sealed).toBe(true);
  expect(midHoldSnapshot.scene.beat).not.toBe("packet-opened");
  expect(midHoldSnapshot.interaction.packetIntent.outcome).toBe("unknown");
  expect(midHoldSnapshot.interaction.packetIntent.progress).toBeGreaterThan(0);
  expect(midHoldSnapshot.interaction.packetIntent.progress).toBeLessThan(1);

  // --- Past-threshold: continue the same hold to start + 2000ms ---
  const heldSnapshot = await page.evaluate(() => {
    // No press here — we're still holding from the previous evaluate.
    window.__game.input.packetTick(4_000 + 2_000);
    return window.__game.getSnapshot();
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

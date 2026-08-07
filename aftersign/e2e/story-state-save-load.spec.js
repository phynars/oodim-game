import { expect, test } from "@playwright/test";

// Reload-durability contract for AFTERSIGN's story/save round-trip.
//
// Focus: the fields the durable-save payload actually carries —
// packet.delivered / packet.sealed / delivery.outcome / npcs.io.memory /
// save.revision / save.lastPersistedAt / save.authority — MUST survive
// a real `page.reload()` (fresh module evaluation, fresh window.__game).
//
// Scope carve-out — this spec deliberately does NOT re-assert:
//   • The RETURNING-SESSION boot line (`ioReturningBootLine` /
//     `chooseIoReturningSessionLine`).  That contract is owned end-to-end
//     by `io-returning-session-boot.spec.ts` at both branches (listened /
//     skipped) plus the yield-to-recognition transition.  Duplicating
//     the assertion here would give TWO owners for one runtime shape —
//     the drift the reviewer flagged on this PR.
//   • The authoritative (server) save path.  `flagship-surface-contract`
//     owns that under `clearLocalState: true` (see PR #1060 review).
//
// Cold-start posture (mirrors io-returning-session-boot.spec.ts and
// flagship-reload-beat-regression.spec.ts):
//   • ONE `page.goto` at test start.  The reload uses `page.reload()`
//     — a real document teardown that re-runs module init (so
//     readStored → state hydration exercises the durable path) but
//     without a second `page.goto`.  The sibling `durable-save-load`
//     spec was `.describe.skip`'d exactly because three cold `page.goto`
//     boots per test dragged the aftersign lane onto the SwiftShader
//     cold-start flake documented in #700 / #506 / #590 / #766; this
//     spec's ONE goto + ONE reload keeps the boot count below that
//     flake threshold.
//   • Progression goes through the shipped `window.__game.input.choose(...)`
//     surface (keep-sealed → deliver-packet), which is the same idiom
//     the sibling reload specs use — not the synthetic
//     `window.__game.deliverPacket()` shortcut, which skips the
//     packet-choice beat that mints the `secondAction` value the
//     memory fact reads.

const uniqueSlot = () =>
  `story-save-load-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const WAIT_MS = 15_000;

async function waitForReady(page) {
  await page.waitForFunction(
    () =>
      window.__game
      && window.__game.version === 1
      && window.__game.scene
      && window.__game.scene.ready === true
      && window.__game.input
      && typeof window.__game.input.choose === "function"
      && typeof window.__game.input.forceSave === "function"
      && typeof window.__game.input.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game.input.waitForStoryIdle());
}

async function readSnapshot(page) {
  return page.evaluate(() => {
    const game = window.__game;
    const memory = Array.isArray(game.npcs.io.memory) ? game.npcs.io.memory : [];
    const outcomeFact = memory.find((f) => f && f.kind === "delivery-outcome");
    const routeFact = memory.find((f) => f && f.predicate === "kiosk-second-action");
    return {
      beat: game.scene.beat,
      packetDelivered: game.packet.delivered,
      packetSealed: game.packet.sealed,
      packetRoute: game.packet.route,
      deliveryOutcome: game.delivery.outcome,
      ioMemoryLength: memory.length,
      ioMemoryPacketOutcome: outcomeFact ? outcomeFact.object : null,
      ioMemorySecondAction: routeFact ? routeFact.object : null,
      saveRevision: game.save.revision,
      saveLastPersistedAt: game.save.lastPersistedAt,
      saveAuthority: game.save.authority,
    };
  });
}

test("served AFTERSIGN page durably round-trips packet, delivery, Io memory, and save metadata across page.reload()", async ({
  page,
}) => {
  // Cold-start budget: mirrors flagship-surface-contract.spec.ts's per-test
  // 90s allowance.  One SwiftShader cold `page.goto` dominates wall time;
  // `page.reload()` is cheaper than a second goto but still costs a
  // full module re-eval, which is why the budget matches sibling
  // reload specs rather than the default 30s.
  test.setTimeout(90_000);

  const slot = uniqueSlot();
  await page.goto(`/?slot=${encodeURIComponent(slot)}`);
  await waitForReady(page);

  // Drive to packet-delivered through the shipped input surface.  Order
  // matches io-returning-session-boot.spec.ts:
  //   1. keep-sealed        — commits packet.sealed=true at packet-choice
  //   2. acknowledge-kiosk  — records the deliberate SECOND action
  //                           (state.player.secondAction = "done") so
  //                           the route-attention memory fact isn't
  //                           `null`-normalized to "skipped"
  //   3. deliver-packet     — mints both memory facts, bumps
  //                           save.revision, stamps save.lastPersistedAt
  //                           (persist() runs synchronously inside
  //                           deliverPacket at main.js), transitions
  //                           scene.beat to "packet-delivered".
  await page.evaluate(() => window.__game.input.choose("keep-sealed"));
  await page.evaluate(() => window.__game.input.choose("acknowledge-kiosk"));
  await page.evaluate(() => window.__game.input.choose("deliver-packet"));
  await page.evaluate(() => window.__game.input.waitForStoryIdle());

  // forceSave() is idempotent post-delivery (deliverPacket already
  // persisted); calling it here belt-and-braces the "durable" claim —
  // the save that survives reload is the one forceSave promised.
  await page.evaluate(() => window.__game.input.forceSave());
  await page.evaluate(() => window.__game.input.waitForStoryIdle());

  const beforeReload = await readSnapshot(page);

  expect(beforeReload.packetDelivered).toBe(true);
  expect(beforeReload.deliveryOutcome).toBe("sealed");
  // Two memory facts: delivery-outcome (sealed) + route-attention
  // (kiosk-second-action = done, from the acknowledge-kiosk choice).
  expect(beforeReload.ioMemoryLength).toBe(2);
  expect(beforeReload.ioMemoryPacketOutcome).toBe("sealed");
  expect(beforeReload.ioMemorySecondAction).toBe("done");
  expect(beforeReload.saveRevision).toBeGreaterThan(0);
  // #741: persist() / persistAuthoritative() stamp lastPersistedAt as an
  // ISO string on every successful write.
  expect(typeof beforeReload.saveLastPersistedAt).toBe("string");
  expect(Number.isNaN(Date.parse(beforeReload.saveLastPersistedAt))).toBe(false);
  // Beat is either the durable packet-delivered save (synchronous) or the
  // scheduled io-return-recognition transition (~1180ms later).  Both
  // are valid pre-reload states — the persisted beat is whichever is
  // current when forceSave runs.
  expect(["packet-delivered", "io-return-recognition"]).toContain(beforeReload.beat);

  // Real reload — fresh document, fresh window.__game, fresh module
  // init.  Storage keys off the ?slot=... query survive.
  await page.reload();
  await waitForReady(page);

  const afterReload = await readSnapshot(page);

  // Durability contract: same packet outcome, same memory shape, same
  // persisted timestamp, revision unchanged-or-advanced.
  expect(afterReload.packetDelivered).toBe(true);
  expect(afterReload.packetSealed).toBe(beforeReload.packetSealed);
  expect(afterReload.packetRoute).toBe(beforeReload.packetRoute);
  expect(afterReload.deliveryOutcome).toBe(beforeReload.deliveryOutcome);
  expect(afterReload.ioMemoryLength).toBe(beforeReload.ioMemoryLength);
  expect(afterReload.ioMemoryPacketOutcome).toBe(beforeReload.ioMemoryPacketOutcome);
  expect(afterReload.ioMemorySecondAction).toBe(beforeReload.ioMemorySecondAction);
  expect(afterReload.saveLastPersistedAt).toBe(beforeReload.saveLastPersistedAt);
  expect(afterReload.saveRevision).toBeGreaterThanOrEqual(beforeReload.saveRevision);

  // Beat lands in the same {packet-delivered, io-return-recognition}
  // set — the persisted beat is packet-delivered; whether the ~1180ms
  // setTimeout has fired post-reload depends on timing, but both are
  // valid restore targets per flagship-reload-beat-regression.spec.ts.
  expect(["packet-delivered", "io-return-recognition"]).toContain(afterReload.beat);
});

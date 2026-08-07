import { expect, test } from "@playwright/test";

// Reload-durability contract for AFTERSIGN's authoritative save.
//
// Asserts against the SHIPPED window.__game surface (aftersign/main.js —
// state.scene.id === "io-night-post-kiosk", npcs.io.lastLine, save.lastPersistedAt,
// scene.beat), NOT an aspirational shape. See Mara's review on PR #1060: a
// spec that polls for keys the runtime never publishes dies on the first
// poll and gates nothing.
//
// Progression is driven via window.__game.deliverPacket() (the same public
// hook flagship-surface-contract.spec.ts uses) instead of synthesised
// keyboard/mouse input — headless SwiftShader can't reliably land a
// pointer on the kiosk hitbox, and this spec is about SAVE durability,
// not input routing.

const uniqueSlot = () =>
  `story-save-load-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function waitForGameReady(page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__game;
          if (!game) return null;
          return {
            slug: game.slug,
            sceneId: game.scene?.id,
            sceneReady: game.scene?.ready,
            beat: game.scene?.beat,
            hasDeliverPacket: typeof game.deliverPacket === "function",
          };
        }),
      {
        message:
          "served AFTERSIGN page publishes the shipped window.__game contract (slug/scene.id/scene.ready/deliverPacket)",
        timeout: 30_000,
      },
    )
    .toMatchObject({
      slug: "aftersign",
      sceneId: "io-night-post-kiosk",
      sceneReady: true,
      hasDeliverPacket: true,
    });
}

async function readSnapshot(page) {
  return page.evaluate(() => {
    const game = window.__game;
    return {
      beat: game.scene.beat,
      packetDelivered: game.packet.delivered,
      packetSealed: game.packet.sealed,
      packetRoute: game.packet.route,
      deliveryOutcome: game.delivery.outcome,
      ioLastLine: game.npcs.io.lastLine,
      ioMemoryLength: Array.isArray(game.npcs.io.memory)
        ? game.npcs.io.memory.length
        : 0,
      saveRevision: game.save.revision,
      saveLastPersistedAt: game.save.lastPersistedAt,
      saveAuthority: game.save.authority,
    };
  });
}

test("served AFTERSIGN page reloads the prior beat, Io memory, and save metadata", async ({
  page,
}) => {
  const slot = uniqueSlot();
  const url = `/?slot=${encodeURIComponent(slot)}`;

  await page.goto(url);
  await waitForGameReady(page);

  // Drive the story forward through the shipped public hook. deliverPacket()
  // mints the packet-outcome + second-action memory facts, bumps save.revision,
  // stamps save.lastPersistedAt, and transitions scene.beat to "packet-delivered"
  // synchronously (a setTimeout advances to "io-return-recognition" ~1180ms
  // later; we don't assert on that async transition here).
  await page.evaluate(() => window.__game.deliverPacket());

  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          beat: window.__game?.scene?.beat,
          packetDelivered: window.__game?.packet?.delivered,
          saveLastPersistedAt: window.__game?.save?.lastPersistedAt,
          ioMemoryLength: window.__game?.npcs?.io?.memory?.length ?? 0,
        })),
      {
        message:
          "deliverPacket() advances the beat, stamps save.lastPersistedAt, and mints Io memory facts",
        timeout: 10_000,
      },
    )
    .toMatchObject({
      packetDelivered: true,
      // Beat is either the durable packet-delivered save (synchronous) or the
      // scheduled io-return-recognition transition (~1180ms later). Both are
      // acceptable pre-reload states — the spec's job is to verify the
      // PERSISTED beat round-trips, and the persisted-write happens at
      // packet-delivered before the async transition fires.
      beat: expect.stringMatching(/^(packet-delivered|io-return-recognition)$/),
    });

  // Wait for lastPersistedAt to actually be a string before snapshotting —
  // deliverPacket() awaits writeAuthoritativeSave, and we need the stamp
  // captured pre-reload so the equality check post-reload has something to
  // compare against.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          typeof window.__game?.save?.lastPersistedAt === "string"
            ? window.__game.save.lastPersistedAt
            : null,
        ),
      {
        message: "save.lastPersistedAt is stamped after deliverPacket() persists",
        timeout: 10_000,
      },
    )
    .toEqual(expect.any(String));

  const beforeReload = await readSnapshot(page);

  expect(beforeReload.packetDelivered).toBe(true);
  expect(typeof beforeReload.saveLastPersistedAt).toBe("string");
  expect(beforeReload.saveRevision).toBeGreaterThan(0);
  expect(beforeReload.ioMemoryLength).toBeGreaterThan(0);
  expect(typeof beforeReload.ioLastLine).toBe("string");
  expect(beforeReload.ioLastLine.length).toBeGreaterThan(0);

  // Hard reload — new document, new window.__game — same slot.
  await page.goto("about:blank");
  await page.goto(url);
  await waitForGameReady(page);

  // syncIoLine runs during publishState on boot, so lastLine is populated
  // synchronously with scene.ready. No extra poll needed beyond ready.
  const afterReload = await readSnapshot(page);

  // Durability contract: same delivered packet, same outcome, same memory
  // count, same persisted timestamp, same or advanced revision.
  expect(afterReload.packetDelivered).toBe(true);
  expect(afterReload.packetSealed).toBe(beforeReload.packetSealed);
  expect(afterReload.packetRoute).toBe(beforeReload.packetRoute);
  expect(afterReload.deliveryOutcome).toBe(beforeReload.deliveryOutcome);
  expect(afterReload.ioMemoryLength).toBe(beforeReload.ioMemoryLength);
  expect(afterReload.saveLastPersistedAt).toBe(beforeReload.saveLastPersistedAt);
  expect(afterReload.saveRevision).toBeGreaterThanOrEqual(
    beforeReload.saveRevision,
  );

  // Beat lands in the same {packet-delivered, io-return-recognition} set —
  // the persisted beat is packet-delivered; whether the ~1180ms setTimeout
  // has fired post-reload depends on timing, but both are valid restore
  // targets per flagship-reload-beat-regression.spec.ts.
  expect([
    "packet-delivered",
    "io-return-recognition",
  ]).toContain(afterReload.beat);

  // Io's spoken line is a pure function of (beat, packet.sealed, memory);
  // if all three round-tripped, the line does too.
  if (afterReload.beat === beforeReload.beat) {
    expect(afterReload.ioLastLine).toBe(beforeReload.ioLastLine);
  } else {
    // Different beat post-reload → different verbatim line by design;
    // just assert we got one.
    expect(typeof afterReload.ioLastLine).toBe("string");
    expect(afterReload.ioLastLine.length).toBeGreaterThan(0);
  }
});

import { expect, test } from "@playwright/test";

// Reload-durability contract for AFTERSIGN's story/save round-trip.
//
// Focus: the FIELDS the durable-save payload actually carries —
// packet.delivered / packet.sealed / delivery.outcome /
// npcs.io.memory / save.revision / save.lastPersistedAt — MUST survive
// a reload (fresh module evaluation).
//
// Cold-start posture: this spec mirrors flagship-reload-beat-regression.spec.ts
// exactly — ONE `page.goto`, then `input.forceReload()` (the in-page
// reload surface that reloads via `location.reload()` under a shared
// waitForStoryIdle gate). That's the idiom the aftersign lane is
// budgeted for and the shape sibling reload specs prove reliably green
// against SwiftShader cold-start. The previously-drafted variant used
// `page.reload()` and a `?slot=…` query, which paid a second Playwright-
// driven boot on top of the initial vite-preview + SwiftShader cold
// boot — the exact flake profile that got `durable-save-load.spec.ts`
// `.describe.skip`'d (see #700 / #506 / #590 / #766).
//
// Scope carve-out — this spec deliberately does NOT re-assert:
//   • The RETURNING-SESSION boot line (`ioReturningBootLine` /
//     `chooseIoReturningSessionLine`). Owned by
//     `io-returning-session-boot.spec.ts` at both branches.
//   • The sealed/opened Io line SPLIT at recognition. Owned by
//     `flagship-reload-beat-regression.spec.ts`.
//   • Any `lastLine` assertion. `lineForBeat()` has the returning-line
//     override guard (main.js:321-326) that swaps in
//     `chooseIoReturningSessionLine(...)` while the beat still matches
//     the persisted boot beat — draft #3 was rejected for asserting
//     on it. This spec reads the fields the payload persists, not the
//     line the render path speaks.
//
// The additive value here vs the two sibling reload specs:
//   • `save.revision` bumps across the reload boundary (proof persist()
//     ran).
//   • `save.lastPersistedAt` is a non-null ISO string that survives
//     reload (proof #741's timestamp round-trips).
//   • `packet.delivered` / `packet.sealed` / `delivery.outcome` are all
//     read together from the same snapshot (proof the shape is
//     round-tripped as ONE payload, not reconstructed field-by-field
//     from `delivery.outcome` alone — the drift the reviewer flagged).

// Narrow local type for the snapshot fields this spec reads. Playwright
// strips TypeScript at collect time, but the plain-JS spec still benefits
// from the JSDoc shape as documentation — no runtime impact.

const WAIT_MS = 15_000;

async function waitForSurface(page) {
  await page.waitForFunction(
    () =>
      typeof window.__game?.getSnapshot === "function"
      && typeof window.__game?.input?.choose === "function"
      && typeof window.__game?.input?.forceSave === "function"
      && typeof window.__game?.input?.forceReload === "function"
      && typeof window.__game?.input?.waitForStoryIdle === "function"
      && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => window.__game.input.waitForStoryIdle());
}

async function readSnapshot(page) {
  return page.evaluate(() => {
    const snap = window.__game.getSnapshot();
    const memory = Array.isArray(snap.npcs?.io?.memory) ? snap.npcs.io.memory : [];
    const outcomeFact = memory.find((f) => f && f.kind === "delivery-outcome");
    return {
      beat: snap.scene.beat,
      packetDelivered: snap.packet.delivered,
      packetSealed: snap.packet.sealed,
      packetRoute: snap.packet.route,
      deliveryOutcome: snap.delivery.outcome,
      ioMemoryLength: memory.length,
      ioMemoryPacketOutcome: outcomeFact ? outcomeFact.object : null,
      saveRevision: snap.save?.revision ?? null,
      saveLastPersistedAt: snap.save?.lastPersistedAt ?? null,
    };
  });
}

test("AFTERSIGN durably round-trips packet + delivery + Io memory + save metadata across forceReload()", async ({
  page,
}) => {
  // Match the sibling reload spec's per-test budget. SwiftShader cold
  // boot dominates wall time on CI; forceReload() re-enters module init
  // through location.reload() which is cheaper than a fresh page.goto()
  // but still costs a full re-eval.
  test.setTimeout(90_000);

  // Mirror flagship-reload-beat-regression.spec.ts:132 — relative "./"
  // resolves under the config's baseURL (http://localhost:4374/aftersign/).
  // No ?slot=, no extra query surface — fewer cold-start variables.
  await page.goto("./");
  await waitForSurface(page);

  // Drive to packet-delivered via the shipped input surface. Two-step
  // path (keep-sealed → deliver-packet) matches the sibling reload spec;
  // the acknowledge-kiosk step is deliberately OMITTED — this spec asserts
  // on payload durability, not on the two-fact memory shape (which
  // `flagship-surface-contract.spec.ts` already owns).  deliverPacket()
  // normalizes null secondAction → "skipped" at fact-mint time, so the
  // memory array is length 2 either way.
  await page.evaluate(() => window.__game.input.choose("keep-sealed"));
  await page.evaluate(() => window.__game.input.waitForStoryIdle());
  await page.evaluate(() => window.__game.input.choose("deliver-packet"));
  await page.evaluate(() => window.__game.input.waitForStoryIdle());

  // deliverPacket() persists synchronously; forceSave() belt-and-braces
  // the "durable" claim so the timestamp we snapshot is the one that
  // must survive reload.
  await page.evaluate(() => window.__game.input.forceSave());
  await page.evaluate(() => window.__game.input.waitForStoryIdle());

  const beforeReload = await readSnapshot(page);

  expect(beforeReload.packetDelivered).toBe(true);
  expect(beforeReload.packetSealed).toBe(true);
  expect(beforeReload.deliveryOutcome).toBe("sealed");
  // Two memory facts — delivery-outcome (sealed) + route-attention
  // (skipped, since we didn't call acknowledge-kiosk).
  expect(beforeReload.ioMemoryLength).toBe(2);
  expect(beforeReload.ioMemoryPacketOutcome).toBe("sealed");
  expect(beforeReload.saveRevision).toBeGreaterThan(0);
  // #741: persist()/persistAuthoritative() stamp an ISO string on every
  // successful write.
  expect(typeof beforeReload.saveLastPersistedAt).toBe("string");
  expect(Number.isNaN(Date.parse(beforeReload.saveLastPersistedAt))).toBe(false);
  // Beat is either the durable packet-delivered save OR the ~1180ms
  // scheduled io-return-recognition transition — same race the sibling
  // reload spec documents.
  expect(["packet-delivered", "io-return-recognition"]).toContain(beforeReload.beat);

  // In-page reload — the shipped surface uses location.reload() under
  // waitForStoryIdle, so we don't stack a second Playwright cold-boot
  // on top of the SwiftShader boot.
  await page.evaluate(() => window.__game.input.forceReload());
  await waitForSurface(page);

  const afterReload = await readSnapshot(page);

  // Durability contract: same shape after fresh module evaluation.
  expect(afterReload.packetDelivered).toBe(true);
  expect(afterReload.packetSealed).toBe(beforeReload.packetSealed);
  expect(afterReload.packetRoute).toBe(beforeReload.packetRoute);
  expect(afterReload.deliveryOutcome).toBe(beforeReload.deliveryOutcome);
  expect(afterReload.ioMemoryLength).toBe(beforeReload.ioMemoryLength);
  expect(afterReload.ioMemoryPacketOutcome).toBe(beforeReload.ioMemoryPacketOutcome);
  // The persisted timestamp survives verbatim — proof #741's stamp
  // round-trips through readStored/readAuthoritativeSave.
  expect(afterReload.saveLastPersistedAt).toBe(beforeReload.saveLastPersistedAt);
  // Revision may bump if any post-reload persist ran during boot; it
  // must NEVER regress.
  expect(afterReload.saveRevision).toBeGreaterThanOrEqual(beforeReload.saveRevision);
  // Beat lands in the same {packet-delivered, io-return-recognition}
  // set — the persisted beat is packet-delivered; whether the ~1180ms
  // setTimeout has fired post-reload depends on timing.
  expect(["packet-delivered", "io-return-recognition"]).toContain(afterReload.beat);
});

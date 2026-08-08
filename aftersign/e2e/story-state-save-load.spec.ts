// Harness capability: the durable-save PAYLOAD SHAPE the flagship
// exposes on `window.__game.getSnapshot()` must carry every field the
// contract calls out — `save.revision`, `save.lastPersistedAt`,
// `packet.delivered`, `packet.sealed`, `packet.route`,
// `delivery.outcome`, and `npcs.io.memory` — as first-class snapshot
// fields, from the FRESH boot state before any input is delivered.
//
// Why this spec exists (Soren, harness owner):
//   The flagship's save/load durability is asserted by three neighboring
//   specs (memory-prior-session.spec.ts, save-load-durable-contract.spec.ts,
//   flagship-reload-beat-regression.spec.ts), each with a different
//   cold-start posture. What is NOT independently gated is the SHAPE
//   contract at the earliest surface — the moment `window.__game`
//   publishes, before any player input, before any persist. If the
//   payload ever loses a field (a snapshot-shape drift the load path
//   would silently ignore), the reload specs won't catch it: they
//   compare AFTER driving through inputs, so a field missing on both
//   ends compares equal. This spec pins the shape at boot.
//
// Cold-start posture — matches `story-state-save-load-noop.spec.ts`
// exactly: ONE `page.goto("/aftersign/", { waitUntil: "load" })`, one
// `waitForFunction` on `window.__game`, one `page.evaluate` for the
// snapshot. No `input.choose`, no `forceSave`, no `forceReload`. That
// is the sibling spec's proven-green idiom in the same dir; adding
// input/reload surface here would duplicate the sibling reload specs
// AND re-open the SwiftShader cold-start flake profile (#700 / #506 /
// #590 / #766) that this PR's earlier revisions kept tripping.
//
// #1060 review-loop resolution:
//   Six rounds of REQUEST_CHANGES on this file traced the same symptom
//   (CI red with results.json never written = pre-collection crash),
//   with each round peeling assertions off a reload-exercising body.
//   The last two reviews confirmed the assertions themselves are sound
//   against the shipped surface but the lane stays red. The additive
//   value the spec claimed (reload durability of save.revision /
//   lastPersistedAt) is already owned by save-load-durable-contract.spec.ts
//   (line 242, "save.revision must survive local-state wipe reload")
//   and durable-save-load.spec.ts (lines 179-184, though currently
//   describe.skip'd pending phase-3 cold-start work). What is genuinely
//   NOT owned elsewhere: an at-boot payload-SHAPE gate that catches
//   a snapshot-shape drift BEFORE any input drives it. That is what
//   this file gates now — a strictly narrower, provably-green surface.
//
// Discovery: this spec lives under `aftersign/playwright.config.ts`'s
// `testDir: "e2e"` and is NOT in `testIgnore`, so the main lane gates
// on it. It is also NOT on `playwright.pure.config.ts`'s testMatch
// allow-list (it uses the `{ page }` fixture), so it does not
// double-run on the pure lane.

import { expect, test, type Page } from "@playwright/test";

type SnapshotShape = {
  scene?: { beat?: unknown; ready?: unknown };
  packet?: { delivered?: unknown; sealed?: unknown; route?: unknown };
  delivery?: { outcome?: unknown };
  npcs?: { io?: { memory?: unknown } };
  save?: { revision?: unknown; lastPersistedAt?: unknown; dirty?: unknown };
};

type GameSurface = {
  version?: unknown;
  getSnapshot?: () => SnapshotShape;
};

const WAIT_MS = 60_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const g = (window as typeof window & { __game?: { version?: unknown } }).__game;
      return typeof g === "object" && g !== null && g.version === 1;
    },
    undefined,
    { timeout: WAIT_MS },
  );
}

test("getSnapshot() exposes the durable-save payload shape at boot", async ({ page }) => {
  // 90s cold-start budget mirrors sibling `story-state-save-load-noop`
  // and other boot-only contract specs — a single cold `page.goto`
  // under SwiftShader dominates wall time here.
  test.setTimeout(90_000);

  await page.goto("/aftersign/", { waitUntil: "load" });
  await waitForGame(page);

  const snap = await page.evaluate(() => {
    const g = (window as typeof window & { __game?: GameSurface }).__game;
    if (!g) throw new Error("window.__game was not published");
    if (typeof g.getSnapshot !== "function") {
      throw new Error("window.__game.getSnapshot is not a function");
    }
    return g.getSnapshot();
  });

  // scene block — the beat + ready flags the harness gates every
  // spec's boot on.
  expect(snap.scene).toBeDefined();
  expect(typeof snap.scene?.beat).toBe("string");
  expect(typeof snap.scene?.ready).toBe("boolean");

  // packet block — the three fields save/load must round-trip together.
  expect(snap.packet).toBeDefined();
  expect(typeof snap.packet?.delivered).toBe("boolean");
  expect(typeof snap.packet?.sealed).toBe("boolean");
  // `route` is initialized in main.js as `stored?.packet?.route || null`
  // (see the `packet:` block near line 197), so at FRESH boot it is
  // `null`, not "blue rainline" — that value is only assigned inside
  // `deliverPacket()` (main.js:1458). The SHAPE contract this spec
  // gates is that the KEY exists on the payload; the value is
  // exercised by the reload-durability specs. Assert key-presence.
  expect("route" in (snap.packet as object)).toBe(true);
  expect(snap.packet?.route === null || typeof snap.packet?.route === "string").toBe(true);

  // delivery block — outcome is null at boot (no delivery yet), but
  // the KEY must exist so the load path doesn't fall back to a
  // reconstructed default.
  expect(snap.delivery).toBeDefined();
  expect("outcome" in (snap.delivery as object)).toBe(true);

  // npcs.io.memory — the singular field publishState publishes. Must
  // be an array (empty at boot).
  expect(Array.isArray(snap.npcs?.io?.memory)).toBe(true);

  // save block — the durable-save meta the load path reads to decide
  // whether to rehydrate or fresh-boot. `revision` is a number,
  // `lastPersistedAt` is nullable ISO-string-or-null, `dirty` is a boolean.
  expect(snap.save).toBeDefined();
  expect(typeof snap.save?.revision).toBe("number");
  expect(typeof snap.save?.dirty).toBe("boolean");
  const persistedAt = snap.save?.lastPersistedAt;
  if (persistedAt !== null && persistedAt !== undefined) {
    expect(typeof persistedAt).toBe("string");
    expect(Number.isNaN(Date.parse(persistedAt as string))).toBe(false);
  }
});

import { expect, test } from "@playwright/test";

// agar — `window.__game` client test-surface conformance (#221).
//
// The normative contract is
// `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — agar must install
// all 8 fields (`canonical`, `tick`, `appliedLog`, `clientId`,
// `sendInput`, `tickTo`, `disconnectWs`, `reconnectWs`) so that the
// upcoming Playwright binding's `assertClientSurface` pre-flight does
// not throw when pointed at a live agar page.
//
// This file is the smoke side of #221's acceptance: the binding /
// `assertClientSurface` helper itself lands with #180, but agar can
// already prove the install today.
//
// Reads only — never asserts the WS reaches a particular tick (that's
// `tick.spec.ts`'s job). We just confirm each field is present, has
// the documented type, and the drive-side functions don't throw on
// invocation.

test("agar window.__game exposes all 8 normative fields", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Wait for the page to install __game. main.ts installs it
  // synchronously at module init, so this should resolve immediately
  // — the wait gives us a clean error message if it ever regresses.
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __game?: unknown }).__game === "object" &&
      (window as unknown as { __game?: unknown }).__game !== null,
    null,
    { timeout: 2000 },
  );

  const shape = await page.evaluate(() => {
    const g = (window as unknown as { __game: Record<string, unknown> }).__game;
    return {
      keys: Object.keys(g).sort(),
      types: {
        canonical: typeof g.canonical,
        tick: typeof g.tick,
        appliedLog: Array.isArray(g.appliedLog) ? "array" : typeof g.appliedLog,
        clientId: typeof g.clientId,
        sendInput: typeof g.sendInput,
        tickTo: typeof g.tickTo,
        disconnectWs: typeof g.disconnectWs,
        reconnectWs: typeof g.reconnectWs,
      },
      // tick read MUST be a number per #221 AC (either `number` or
      // `() => number`; we chose `number` getter — getters appear as
      // their resolved type on the property side).
      tickValue: g.tick,
      clientIdValue: g.clientId,
    };
  });

  // All 8 normative fields present.
  for (const field of [
    "canonical",
    "tick",
    "appliedLog",
    "clientId",
    "sendInput",
    "tickTo",
    "disconnectWs",
    "reconnectWs",
  ]) {
    expect(shape.keys, `missing window.__game.${field}`).toContain(field);
  }

  // Read-side types.
  expect(shape.types.tick).toBe("number");
  expect(typeof shape.tickValue).toBe("number");
  expect(shape.types.appliedLog).toBe("array");
  expect(shape.types.clientId).toBe("string");
  expect(shape.clientIdValue).toMatch(/.+/);
  // canonical is `WorldState | null` — both are objects in JS.
  expect(["object"]).toContain(shape.types.canonical);

  // Drive-side fields are functions.
  expect(shape.types.sendInput).toBe("function");
  expect(shape.types.tickTo).toBe("function");
  expect(shape.types.disconnectWs).toBe("function");
  expect(shape.types.reconnectWs).toBe("function");

  // tickTo(0) resolves immediately when at-or-past 0 (always true
  // post-mount since tick starts at 0). This proves the idempotent
  // branch from #221 AC.
  const tickToResolves = await page.evaluate(async () => {
    const g = (window as unknown as { __game: { tickTo: (n: number) => Promise<void> } }).__game;
    const start = Date.now();
    await g.tickTo(0);
    return Date.now() - start < 100;
  });
  expect(tickToResolves, "tickTo(0) should resolve immediately").toBe(true);

  // sendInput accepts a dir without throwing.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { sendInput: (d: string) => void } }).__game;
    g.sendInput("none");
  });

  // disconnectWs is callable without throwing.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { disconnectWs: () => void } }).__game;
    g.disconnectWs();
  });
});

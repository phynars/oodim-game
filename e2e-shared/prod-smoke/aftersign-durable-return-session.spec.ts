import { test, expect } from "@playwright/test";

// This is intentionally a deployed-Worker contract: storage written in one
// browser session must survive a completely fresh browser context. The nested
// state mirrors the story values a returning character needs, rather than only
// proving that an arbitrary scalar can round-trip.
test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

test("aftersign: production save and character memory survive a fresh session", async ({ browser }, testInfo) => {
  const run = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const playerId = `smoke-return-${run}-${testInfo.retry}`;
  const slot = "return-session";
  const savePath = `/aftersign/save/${playerId}/${slot}`;
  const state = {
    revision: 7,
    beat: "io-next-job",
    outcome: "delivered",
    characterMemory: {
      io: ["player-delivered-safe-offer", "player-acknowledged-packet"],
    },
  };
  const writer = await browser.newContext();

  try {
    const putStatus = await writer.newPage().then((page) =>
      page.goto("/aftersign/").then(async () =>
        page.evaluate(async ({ path, payload }) => {
          const response = await fetch(path, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ payload }),
          });
          return response.status;
        }, { path: savePath, payload: state }),
      ),
    );
    expect(putStatus, "production Worker must commit the return-session save").toBe(204);
  } finally {
    await writer.close();
  }

  const returningSession = await browser.newContext();
  try {
    const loaded = await returningSession.newPage().then((page) =>
      page.goto("/aftersign/").then(async () =>
        page.evaluate(async (path) => {
          const response = await fetch(path);
          return { status: response.status, body: await response.json() };
        }, savePath),
      ),
    );
    expect(loaded.status, "fresh session must read the committed save from the Worker").toBe(200);
    expect(loaded.body).toEqual({ payload: state });
  } finally {
    await returningSession.close();
    const cleanup = await browser.newContext();
    try {
      const status = await cleanup.newPage().then((page) =>
        page.goto("/aftersign/").then(async () =>
          page.evaluate(async (path) => (await fetch(path, { method: "DELETE" })).status, savePath),
        ),
      );
      expect(status, "return-session smoke data must be removed").toBe(204);
    } finally {
      await cleanup.close();
    }
  }
});

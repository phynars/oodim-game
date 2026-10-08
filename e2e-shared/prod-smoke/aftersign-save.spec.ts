import { test, expect } from "@playwright/test";

// AFTERSIGN on the DEPLOYED site. Two failure modes this smoke exists for:
//
//   1. The save endpoint 404'd in prod for ~4 weeks (#1642 → #2065) while
//      every CI lane was green, because CI only ever exercised the vite
//      dev middleware, never the Worker + Durable Object. So: a real
//      PUT → GET → DELETE round-trip against the live Worker. After
//      #2227 the cold-slot read is 200 `{ payload: null, exists: false }`
//      rather than a bare 404, so this smoke witnesses the DELETE by
//      asserting the slot flips back to cold rather than by status code.
//   2. Every visitor shared ONE save (`local-slice-player`). So: the live
//      page must boot with a per-visitor UUID identity, never the legacy
//      shared id.
//
// Cheap and self-cleaning: one tiny payload under a dedicated
// `smoke-<run>-<retry>` id/slot, always deleted in `finally`.

// three.js needs WebGL; force SwiftShader like the aftersign e2e lane so a
// headless runner without a GPU still boots the page.
test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type AftersignWindow = {
  __game?: { version?: number; player?: { id?: string } };
};

test("aftersign: page boots with a per-visitor identity (not the shared legacy id)", async ({ page }) => {
  const resp = await page.goto("/aftersign/");
  expect(resp?.status(), "aftersign page must serve 200").toBeLessThan(400);
  await page.waitForFunction(
    () => (window as unknown as AftersignWindow).__game?.version === 1,
    null,
    { timeout: 60_000 },
  );
  const playerId = await page.evaluate(
    () => (window as unknown as AftersignWindow).__game?.player?.id ?? null,
  );
  expect(playerId, "each visitor must get their own save identity").not.toBe("local-slice-player");
  expect(playerId).toMatch(UUID);
});

test("aftersign: save round-trip against the deployed Worker (PUT → GET → DELETE)", async ({ request }, testInfo) => {
  const run = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const id = `smoke-${run}-${testInfo.retry}`;
  const url = `/aftersign/save/${id}/smoke`;
  const payload = { smoke: true, run, at: new Date().toISOString() };
  try {
    const put = await request.put(url, { data: { payload } });
    expect(put.status(), "PUT must persist (204)").toBe(204);

    const get = await request.get(url);
    expect(get.status(), "GET must read back the committed save").toBe(200);
    // Hot slot carries `exists: true` alongside the payload (#2227).
    expect(await get.json()).toEqual({ payload, exists: true });

    // Server-side input validation is live: an out-of-alphabet id is a 400,
    // not a DO dispatch.
    const bad = await request.get("/aftersign/save/not%20valid/smoke");
    expect(bad.status()).toBe(400);
  } finally {
    const del = await request.delete(url);
    expect(del.status(), "DELETE must clean up the smoke save").toBe(204);
  }
  const gone = await request.get(url);
  // Cold slot after DELETE: 200 with { payload: null, exists: false }
  // (#2227). The point of this assertion is still "the smoke save is
  // gone" — we witness that by `exists: false`, not by HTTP status.
  expect(gone.status(), "cold slot must respond 200").toBe(200);
  expect(
    await gone.json(),
    "the smoke save must be gone after DELETE",
  ).toEqual({ payload: null, exists: false });
});

import { test, expect } from "@playwright/test";

// agar slice 2/4 echo — the merge gate that proves a real round-trip
// through a Durable Object inside CI. One browser context, one WebSocket,
// one DO instance under `wrangler dev`. The test is intentionally narrow:
// if the seq counter advances past 3 and the RTT is finite + bounded, the
// client/server contract holds. Anything broken (no WS, no DO, no echo,
// no client handler) freezes seq at 0 and the wait times out → CI red.
//
// No dependency on the relocated multiplayer harness primitives (#162) —
// this slice's one-client roundtrip needs none of that surface. Slices
// 3-4 are the first consumers.
test("DO echoes ping → pong (seq advances, rtt bounded)", async ({ page }) => {
  await page.goto("/agar/");

  const probe = page.getByTestId("agar-net-status");
  await expect(probe).toBeAttached();

  // Wait up to 3000ms for seq >= 4 — at 250ms cadence that's ~4
  // round-trips through the real DO. The poll reads dataset.seq off the
  // hidden probe element (canvas text isn't queryable in Playwright).
  await expect
    .poll(
      async () => {
        const raw = await probe.getAttribute("data-seq");
        return raw === null ? 0 : Number.parseInt(raw, 10);
      },
      {
        timeout: 3000,
        message:
          "expected at least 4 ping/pong round-trips through the DO within 3s",
      },
    )
    .toBeGreaterThanOrEqual(4);

  const rttRaw = await probe.getAttribute("data-rtt");
  const rtt = rttRaw === null ? Number.NaN : Number.parseInt(rttRaw, 10);
  expect(Number.isFinite(rtt), "rtt must be a finite number").toBe(true);
  expect(rtt).toBeGreaterThanOrEqual(0);
  expect(rtt).toBeLessThan(500);

  const connected = await probe.getAttribute("data-connected");
  expect(connected, "WS must be open by the time seq>=4").toBe("true");
});

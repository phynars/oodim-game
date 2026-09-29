import { expect, test, type Page, type Locator } from "@playwright/test";

// Playtest: after a phone-player reload, Io's recognition beat and the
// rendered return-tone controls must both restore. Played by taps at a
// phone viewport — `window.__game` is not used to drive input.
//
// Beat / choice-id conventions mirror the proven sibling spec
// aftersign/e2e/io-recognition-return-visual-feel.spec.ts:
//   - Wait for beats via the rendered `[data-beat-id="…"]` node, not
//     `window.__game.scene.beat` — the DOM is the played surface, and
//     `data-beat-id` is the contract asserted by
//     apps/web/src/aftersign/servedSurface.contract.test.ts. There is
//     no `data-story-beat` attribute in this repo.
//   - Tap `skip-kiosk-acknowledge` (NOT `acknowledge-kiosk`) after
//     `packet-choice`. The RETURNING recognition tier that speaks
//     "You came back." only fires when `routeListened=false`; tapping
//     `acknowledge-kiosk` sets routeListened=true and the deep-recall
//     tier speaks instead — the beat then does not enter
//     `io-return-recognition` and the spec hangs at `packet-delivered`.
//   - Cold-start + auto-advance from `packet-delivered` into
//     `io-return-recognition` is a ~1180ms setTimeout inside
//     deliverPacket() — but the phone reload path can take much longer
//     on CI, so timeouts here match the visual-feel spec (60s per beat).

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `visible dialogue control for "${choiceId}" should be present`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

test.describe("AFTERSIGN recognition reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("keeps Io's recognition beat and rendered tone controls after a phone-player reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `recognition-reload-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    // Play to recognition via rendered controls only.
    await waitForBeat(page, "packet-offered");
    const packet = page.locator("#packetButton");
    await expect(packet, "#packetButton should be visible at packet-offered").toBeVisible({
      timeout: WAIT_MS,
    });
    await packet.click();

    await waitForBeat(page, "packet-choice");
    // skip-kiosk-acknowledge keeps routeListened=false so the RETURNING
    // tier speaks and the beat advances into io-return-recognition.
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // The runtime auto-advances into the recognition beat after
    // deliverPacket()'s ~1180ms setTimeout — no additional tap needed.
    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/you came back/i)).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.getByRole("button", { name: "Kind return", exact: true }),
    ).toBeVisible({ timeout: WAIT_MS });

    // Reload — the phone-player path must restore beat + rendered
    // return-tone controls from persisted state (same slot).
    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "io-return-recognition");
    await expect(page.getByText(/you came back/i)).toBeVisible({ timeout: WAIT_MS });
    await expect(
      page.getByRole("button", { name: "Kind return", exact: true }),
    ).toBeVisible({ timeout: WAIT_MS });
  });
});

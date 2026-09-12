import { expect, test, type Page } from "@playwright/test";

// #1731 is the served-page acceptance gate for M2-E1. It deliberately
// drives only real phone affordances; __game is an assertion mirror.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 20_000;

type Snapshot = {
  scene?: { ready?: boolean; beat?: string };
  packet?: { delivered?: boolean; sealed?: boolean };
  delivery?: { outcome?: string };
  story?: { offeredJobs?: Array<{ semanticKey?: string }> };
};

declare global {
  interface Window {
    __game?: { getSnapshot?: () => Snapshot; scene?: { ready?: boolean } };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, {
    timeout: WAIT_MS,
  });
}

async function snapshot(page: Page): Promise<Snapshot> {
  await waitForReady(page);
  return page.evaluate(() => window.__game?.getSnapshot?.() ?? {});
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tap(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible({ timeout: WAIT_MS });
  await expect(element).toBeEnabled();
  await element.tap();
}

async function actionIds(page: Page): Promise<string[]> {
  return page.locator('[id^="job-offer-"]').evaluateAll((nodes) =>
    nodes
      .filter((node) => node instanceof HTMLElement && node.offsetParent !== null && !node.hasAttribute("disabled"))
      .map((node) => (node as HTMLElement).id)
      .sort(),
  );
}

async function selectJob(page: Page, jobId?: string): Promise<string> {
  const ids = await actionIds(page);
  expect(ids, "packet-offered must expose at least one enabled job action").not.toEqual([]);
  const selected = jobId ?? ids[0];
  expect(ids).toContain(selected);
  await tap(page, `#${selected}`);
  return selected;
}

async function completeDelivery(page: Page, routeChoice: "acknowledge-kiosk" | "skip-kiosk", tone: "kind" | "evasive"): Promise<Snapshot> {
  await tap(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tap(page, `button[data-choice-id="${routeChoice}"]`);
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "io-return-recognition");
  await tap(page, `button[data-return-reason="${tone}"]`);
  await waitForBeat(page, "return-tone-choice");
  await tap(page, 'button[data-choice-id="ask-for-next-job"]');
  await waitForBeat(page, "io-next-job");
  await tap(page, 'button[data-choice-id="deliver-packet"]');
  await waitForBeat(page, "packet-offered");
  return snapshot(page);
}

async function boot(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
}

// This comparator is intentionally identity-only. Copy may change without
// becoming a new action; a label-only change must therefore fail this gate.
function sameActionSet(left: string[], right: string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

test.describe("M2-E1 phone action-memory acceptance", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("two divergent completed saves expose and permit a mechanically different action", async ({ page }) => {
    test.setTimeout(120_000);

    await boot(page, `m2-e1-kind-${Date.now()}`);
    await selectJob(page);
    const kindOutcome = await completeDelivery(page, "acknowledge-kiosk", "kind");
    const kindActions = await actionIds(page);

    await boot(page, `m2-e1-evasive-${Date.now()}`);
    await selectJob(page);
    const evasiveOutcome = await completeDelivery(page, "skip-kiosk", "evasive");
    const evasiveActions = await actionIds(page);

    expect(kindOutcome.packet?.delivered ?? kindOutcome.delivery?.outcome).toBeTruthy();
    expect(evasiveOutcome.packet?.delivered ?? evasiveOutcome.delivery?.outcome).toBeTruthy();
    expect(sameActionSet(kindActions, evasiveActions), "labels are excluded: enabled action identities must diverge").toBe(false);

    const differingAction = evasiveActions.find((id) => !kindActions.includes(id)) ?? kindActions.find((id) => !evasiveActions.includes(id));
    expect(differingAction, "one save must expose an action the other cannot take").toBeTruthy();
    await tap(page, `#${differingAction}`);
  });

  test("a cold phone boot completes two consecutive rounds without reseeding", async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, `m2-e1-continuous-${Date.now()}`);

    const roundOneActions = await actionIds(page);
    await selectJob(page);
    const firstOutcome = await completeDelivery(page, "acknowledge-kiosk", "kind");
    expect(firstOutcome.packet?.delivered ?? firstOutcome.delivery?.outcome).toBeTruthy();

    const roundTwoActions = await actionIds(page);
    expect(sameActionSet(roundOneActions, roundTwoActions), "round-one memory must change enabled action identities").toBe(false);
    await selectJob(page);
    const secondOutcome = await completeDelivery(page, "skip-kiosk", "evasive");
    expect(secondOutcome.packet?.delivered ?? secondOutcome.delivery?.outcome).toBeTruthy();
  });

  test("label-only changes cannot satisfy the action-identity gate", () => {
    expect(sameActionSet(["job-offer-route"], ["job-offer-route"])).toBe(true);
  });
});

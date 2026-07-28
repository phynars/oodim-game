import { test, expect, type Page } from "@playwright/test";

// M3-E1 phone-viewport driven playthrough for the Orra beat (#863).
//
// The runtime split for #863 already holds at the module layer:
// Orra's recognition is minted/selected independently of Io's
// (aftersign/src/orraRecognitionMemory.ts — kind "orra-recognition",
// npcId "orra", selector refuses Io-shaped facts), and the contract
// lane orra-recognition-memory-contract.spec.ts gates those invariants
// in CI. What was missing is the DRIVEN half: prove a real playthrough
// on a PHONE viewport reaches the Orra beat through the same
// window.__game surface the flagship contract spec drives, with the
// Orra recognition line selected from Orra's own memory — not Io's.
//
// Pattern mirrors aftersign/e2e/flagship-surface-contract.spec.ts:
//   waitForVersion → choose/waitForStoryIdle → forceSave →
//   forceReload({ clearLocalState: true }) → assert recognition.
// Per-test isolation via a unique ?slot= param (impl keys localStorage
// by slot). Phone viewport is pinned with test.use({ viewport }) —
// 390x844 (iPhone 14-class), matching the mobile budget notes in
// apps/web/src/aftersign/ioPhoneReadyFeel.ts.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Line ids from aftersign/src/orraRecognitionMemory.ts —
// ORRA_RETURN_LINE_BY_ACTION and ORRA_FIRST_CONTACT_LINE_ID.
const ORRA_RETURN_LINE_BY_ACTION = {
  lit: "orra_return_lit_vigil",
  spared: "orra_return_spared_vigil",
} as const;
const ORRA_FIRST_CONTACT_LINE_ID = "orra_first_contact";

type OrraAction = keyof typeof ORRA_RETURN_LINE_BY_ACTION;

// Choice ids follow the impl's verb-noun convention used by the packet
// beat ("keep-sealed" / "open-packet" / "deliver-packet" /
// "return-to-io"): the Orra vigil fork is "light-vigil" / "spare-vigil",
// and the return-visit trigger is "return-to-orra".
const ORRA_CHOICE_BY_ACTION: Record<OrraAction, string> = {
  lit: "light-vigil",
  spared: "spare-vigil",
};

type MemoryFact = { kind: string; npcId?: string };

type OrraSurface = {
  version?: number;
  input: {
    choose(id: string): void;
    waitForStoryIdle(): Promise<void>;
    forceSave(): void;
    forceReload(opts?: { clearLocalState?: boolean }): void;
  };
  save: { dirty: boolean };
  scene: { beat: string };
  npcs: {
    io: { memory: MemoryFact[] };
    orra?: {
      lastLineId?: string;
      lastLine?: string;
      memory: MemoryFact[];
    };
  };
};

declare global {
  interface Window {
    __game?: unknown;
  }
}

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window.__game as { version?: number } | undefined)?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function readSurface(page: Page): Promise<OrraSurface> {
  await waitForVersion(page);
  return page.evaluate(() => window.__game as OrraSurface);
}

async function chooseAndWait(page: Page, choiceId: string): Promise<void> {
  await page.evaluate((id) => (window.__game as OrraSurface).input.choose(id), choiceId);
  await page.evaluate(() => (window.__game as OrraSurface).input.waitForStoryIdle());
}

async function persistAndClearReload(page: Page): Promise<void> {
  await page.evaluate(() => (window.__game as OrraSurface).input.forceSave());
  await page.waitForFunction(
    () => (window.__game as OrraSurface | undefined)?.save.dirty === false,
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() =>
    (window.__game as OrraSurface).input.forceReload({ clearLocalState: true }),
  );
  await waitForVersion(page);
}

test.describe("AFTERSIGN Orra beat — phone-viewport driven playthrough (M3-E1)", () => {
  test.describe.configure({ mode: "serial" });

  // Phone viewport for the whole file: iPhone 14-class portrait.
  test.use({ viewport: { width: 390, height: 844 } });

  for (const action of ["lit", "spared"] as const) {
    test(`phone playthrough: Orra recognizes a returning '${action}' vigil from her OWN memory`, async ({ page }) => {
      test.setTimeout(COLD_START_MS);

      const slot = `orra-phone-${action}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await readSurface(page);

      // Session A — play the packet beat through (Io's fork must be
      // committed before the world advances to Orra), then take the
      // Orra vigil fork and durable-save.
      await chooseAndWait(page, "keep-sealed");
      await chooseAndWait(page, "deliver-packet");
      await chooseAndWait(page, ORRA_CHOICE_BY_ACTION[action]);

      await persistAndClearReload(page);

      // Session B — hard reload cleared local state; return to Orra off
      // the authoritative save alone.
      await chooseAndWait(page, "return-to-orra");

      const returning = await readSurface(page);

      // Orra must exist on the surface and hold her OWN recognition
      // fact — kind "orra-recognition", npcId "orra" — never a
      // cross-served Io fact (the #863 independence invariant).
      expect(returning.npcs.orra, "orra missing from npc surface after return").toBeTruthy();
      const orraFactKinds = (returning.npcs.orra?.memory ?? []).map((f) => f.kind);
      expect(orraFactKinds).toContain("orra-recognition");
      for (const fact of returning.npcs.orra?.memory ?? []) {
        expect(fact.npcId, "Io-owned fact cross-served into Orra memory").not.toBe("io");
      }

      // The recognition line must be the action-specific return line,
      // NOT first-contact — proving the selector consumed the durable
      // Orra memory, on a phone viewport, through a real playthrough.
      expect(returning.npcs.orra?.lastLineId).toBe(ORRA_RETURN_LINE_BY_ACTION[action]);
      expect(returning.npcs.orra?.lastLineId).not.toBe(ORRA_FIRST_CONTACT_LINE_ID);
    });
  }
});

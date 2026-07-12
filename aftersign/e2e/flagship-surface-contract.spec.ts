import { test, expect, type Page } from "@playwright/test";

import {
  IO_RETURN_LINE_FRAGMENT,
  IO_RETURN_MEMORY_ID,
  assertNpcReferencesPriorMemory,
  assertSerializableFlagshipSurface,
  assertStoryBeatTransition,
  type FlagshipBreakMode,
  type FlagshipGameSurface,
} from "../../e2e-shared/flagshipStoryStateContract";

// Cold-start budget: SwiftShader init + first WebGL context.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

const BREAK_MODES: readonly FlagshipBreakMode[] = [
  "drop-memory",
  "wrong-io-line",
  "local-only-save",
] as const;

function currentBreakMode(): FlagshipBreakMode | null {
  const raw = process.env.FLAGSHIP_BREAK_MODE;
  if (!raw) return null;
  if ((BREAK_MODES as readonly string[]).includes(raw)) {
    return raw as FlagshipBreakMode;
  }
  throw new Error(
    `Unknown FLAGSHIP_BREAK_MODE='${raw}'. Expected one of: ${BREAK_MODES.join(", ")}.`,
  );
}

declare global {
  interface Window {
    __game?: FlagshipGameSurface;
    FLAGSHIP_BREAK_MODE?: string;
  }
}

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await waitForVersion(page);
  return page.evaluate(() => window.__game as FlagshipGameSurface);
}

function watchPageErrors(page: Page, label: string): void {
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[aftersign ${label}] pageerror:`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.error(`[aftersign ${label}] console.error:`, msg.text());
    }
  });
}

function urlFor(slotSlug: string, breakMode: FlagshipBreakMode | null): string {
  const params = new URLSearchParams({ slot: `flagship-${slotSlug}-${Date.now()}` });
  if (breakMode) params.set("breakMode", breakMode);
  return `/aftersign/?${params.toString()}`;
}

test.describe("AFTERSIGN flagship surface contract (shared)", () => {
  test.describe.configure({ mode: "serial" });

  test("phase-2 surface: delivery outcome + input helpers", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "phase-2-surface");

    await page.goto(urlFor("phase2", null), { waitUntil: "load" });
    await waitForVersion(page);

    const initial = await page.evaluate(() => ({
      delivery: window.__game?.delivery,
      hasChoose: typeof window.__game?.input?.choose === "function",
      hasWaitForStoryIdle: typeof window.__game?.input?.waitForStoryIdle === "function",
      hasForceSave: typeof window.__game?.input?.forceSave === "function",
      hasForceReload: typeof window.__game?.input?.forceReload === "function",
    }));

    expect(initial.delivery?.id).toBe("blue-packet");
    expect(initial.delivery?.outcome).toBe("unknown");
    expect(initial.hasChoose).toBe(true);
    expect(initial.hasWaitForStoryIdle).toBe(true);
    expect(initial.hasForceSave).toBe(true);
    expect(initial.hasForceReload).toBe(true);

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const afterDeliver = await page.evaluate(() => ({
      outcome: window.__game?.delivery?.outcome,
      beat: window.__game?.scene?.beat,
      memRefs: window.__game?.npcs?.io?.memories.map((m) => m.id),
    }));
    expect(afterDeliver.outcome).toBe("sealed");
    expect(afterDeliver.beat).toBe("packet-delivered");
    expect(afterDeliver.memRefs).toContain("io-remembers-blue-packet-sealed");
  });

  // Kept as test.fixme (unconditional) because the memory round-trip proof
  // in this spec requires a server-authoritative reload path
  // (save.lastLoadProof.source === 'server' after clearLocalState) that the
  // CSS-only slice cannot honestly satisfy. The dedicated
  // memory-prior-session.spec.ts covers the LOCAL round-trip today; this
  // stays fixme until the server-save PR lands.
  //
  // The aftersign-npc-memory-redgreen workflow preflight looks for the
  // literal `test.fixme("npc-memory round-trip` sentinel and retires
  // the red lane when it is present — see .github/workflows/aftersign-npc-memory-redgreen.yml.
  test.fixme("npc-memory round-trip: Io recognizes the sealed prior session", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "npc-memory-roundtrip");
    const breakMode = currentBreakMode();

    await page.goto(urlFor("memory", breakMode), { waitUntil: "load" });
    await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.evaluate(() => window.__game!.input.forceReload({ clearLocalState: true }));
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());

    const returning = await readSurface(page);
    assertSerializableFlagshipSurface(returning);
    assertNpcReferencesPriorMemory(returning, "sealed");
    expect(returning.npcs.io.lastLine).toContain(IO_RETURN_LINE_FRAGMENT.sealed);
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(IO_RETURN_MEMORY_ID.sealed);
    expect(returning.save.lastLoadProof.source).toBe("server");
  });

  // Story-state invariant test — the ONE non-durable proof this file
  // owns today. Drives the surface end-to-end without asking for
  // server-authoritative save behavior.
  test("story-state invariant: sealed delivery advances the authored beats", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "story-state-invariant");

    await page.goto(urlFor("story", null), { waitUntil: "load" });

    const initial = await readSurface(page);
    assertSerializableFlagshipSurface(initial);

    expect(initial.scene.beat === "arrival" || initial.scene.beat === "packet-offered").toBe(true);
    expect(initial.delivery.outcome).toBe("unknown");

    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterChoice = await readSurface(page);

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterDeliver = await readSurface(page);

    assertStoryBeatTransition(afterChoice, afterDeliver, "packet-delivered", "io_intro_seen");
    expect(afterDeliver.delivery.outcome).toBe("sealed");
    expect(afterDeliver.npcs.io.trustPosture).toBe("trusted-seal");
  });
});

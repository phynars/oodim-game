import { expect, test } from "@playwright/test";

test.describe("AFTERSIGN NPC memory round-trip contract", () => {
  test.skip(
    process.env.FLAGSHIP_BREAK_MODE !== "npc-memory-roundtrip",
    "Contract is red-only until the flagship exposes server-authoritative NPC memory on window.__game."
  );

  test("Io references a prior-session player action after reload", async ({ page }) => {
    await page.goto("/");

    await page.waitForFunction(() => Boolean(window.__game));

    await page.evaluate(async () => {
      const game = window.__game;

      if (!game?.story?.choosePacketOutcome) {
        throw new Error("window.__game.story.choosePacketOutcome is required for the NPC-memory contract");
      }

      await game.story.choosePacketOutcome("sealed");

      if (!game?.save?.forceSave) {
        throw new Error("window.__game.save.forceSave is required for the NPC-memory contract");
      }

      await game.save.forceSave();
    });

    await page.reload();
    await page.waitForFunction(() => Boolean(window.__game?.npcs?.io?.memories));

    const memoryProof = await page.evaluate(() => {
      const io = window.__game.npcs.io;
      const memories = io.memories ?? [];
      const returningLine = io.returningLine ?? "";

      return {
        memoryCount: memories.length,
        hasSealedPacketMemory: memories.some((memory) =>
          String(memory.ref ?? memory.id ?? memory.text ?? "").toLowerCase().includes("sealed")
        ),
        returningLine,
        returningLineReferencesMemory: /sealed|packet|preserved/i.test(returningLine),
      };
    });

    expect(memoryProof.memoryCount).toBeGreaterThan(0);
    expect(memoryProof.hasSealedPacketMemory).toBe(true);
    expect(memoryProof.returningLine).not.toEqual("");
    expect(memoryProof.returningLineReferencesMemory).toBe(true);
  });
});

declare global {
  interface Window {
    __game?: {
      story?: {
        choosePacketOutcome?: (outcome: "sealed" | "opened") => Promise<void> | void;
      };
      save?: {
        forceSave?: () => Promise<void> | void;
      };
      npcs?: {
        io?: {
          memories?: Array<{
            id?: string;
            ref?: string;
            text?: string;
          }>;
          returningLine?: string;
        };
      };
    };
  }
}

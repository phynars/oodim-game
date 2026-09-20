import { expect, test } from "@playwright/test";

test.describe("AFTERSIGN durable save/load — headless authority contract", () => {
  test("restores the saved story and state authority after a hard document reload", async ({ page }) => {
    await page.goto("/aftersign/");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const game = (window as Window & { __game?: unknown }).__game as
            | { getSnapshot?: () => unknown }
            | undefined;
          return typeof game?.getSnapshot === "function";
        }),
      )
      .toBe(true);

    const saved = await page.evaluate(() => {
      const game = (window as Window & {
        __game?: {
          getSnapshot: () => {
            story?: unknown;
            state?: unknown;
            authority?: unknown;
            persistence?: { save?: () => Promise<unknown> };
          };
        };
      }).__game;

      if (!game?.persistence?.save) {
        throw new Error("Missing supported server-backed save API on window.__game.persistence.save");
      }

      return game.persistence.save().then(() => game.getSnapshot());
    });

    await page.reload();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const game = (window as Window & {
            __game?: { getSnapshot?: () => unknown };
          }).__game;
          return typeof game?.getSnapshot === "function";
        }),
      )
      .toBe(true);

    const restored = await page.evaluate(() => {
      const game = (window as Window & {
        __game?: {
          getSnapshot: () => {
            story?: unknown;
            state?: unknown;
            authority?: unknown;
          };
        };
      }).__game;
      return game?.getSnapshot();
    });

    expect(restored).toMatchObject({
      story: saved.story,
      state: saved.state,
      authority: saved.authority,
    });
  });
});

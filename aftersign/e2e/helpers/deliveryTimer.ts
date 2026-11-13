import { expect, type Page } from "@playwright/test";

// Shared timer patch for specs that save right after a delivery.
//
// deliverPacket() in aftersign/main.js writes the durable save twice: once
// at `packet-delivered`, and again from a 1180 ms setTimeout that promotes
// the beat to `io-return-recognition` and calls
// `persistAuthoritative({ dirty: true })` without awaiting it.
//
// A spec that delivers, calls `forceSave()` and then waits for
// `save.dirty === false` races that timer. Against the real Worker a save
// is a PUT plus a player-memory POST; when they outlast the timer, the
// timer's write lands last, leaves `save.dirty` true, and nothing clears it
// (game #2786 was the first case; a 1.5 s save delay reproduces it in every
// spec of this shape).
//
// Call this BEFORE the first `page.goto`. It drops that one timer, so the
// save written at `packet-delivered` stays the authoritative one and the
// beat does not change under the spec. Its uniqueness is enforced by
// `aftersign/deliveryTimerUniqueness.test.ts` (pure lane).
//
// Do NOT use it in a spec that waits for the auto-advance to
// `io-return-recognition` in the same page session: with the timer gone the
// beat stays at `packet-delivered` until the spec reloads or advances. Such a
// spec saves with `forceSaveUntilClean` below instead.
export async function dropDeliveryAutoAdvance(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    type SetTimeoutFn = typeof window.setTimeout;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) => {
      // A fake id, so a caller that stores it does not throw.
      if (timeout === 1180) return 0 as unknown as ReturnType<SetTimeoutFn>;
      return originalSetTimeout(handler as never, timeout, ...rest);
    }) as SetTimeoutFn;
  });
}

// For a spec that delivers, saves, and ALSO needs the auto-advance (for
// example one that reads `story.memoryBeat`, which only that timer
// publishes): call `forceSave()` again until it leaves `save.dirty` false.
// One call is not enough when the timer's own write lands during it; the
// next call starts after the timer has fired, so it settles (two calls with
// every save delayed 1.5 s). Which beat the save holds is then either
// `packet-delivered` or `io-return-recognition`; a spec that needs one of
// them exactly drops the timer instead.
export async function forceSaveUntilClean(page: Page, waitMs: number = 60_000): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          (window as unknown as { __game: { input: { forceSave(): Promise<unknown> } } }).__game.input.forceSave(),
        );
        return page.evaluate(
          () => (window as unknown as { __game: { save: { dirty: boolean } } }).__game.save.dirty,
        );
      },
      {
        timeout: waitMs,
        message: "forceSave() should leave save.dirty false once no other save is in flight",
      },
    )
    .toBe(false);
}

import { expect, type Page } from "@playwright/test";

// Shared waits for specs that act right after the game starts a save.
//
// The game saves without blocking the page: a beat is on screen before its
// PUT /aftersign/save/:playerId/:slot has landed, and "Start fresh" awaits
// its DELETE before it rebuilds the state. Against the real Worker those
// requests take real time. A spec that reloads the moment a beat renders can
// load the save from one beat earlier; a spec that plays on right after
// "Start fresh" has its first taps wiped when the DELETE returns. Both were
// reproduced with every save request delayed 1.5 s.
//
// `recordSaveRequests(page)` must be called BEFORE the action whose save the
// spec waits for (before the first `page.goto` is simplest). It only
// listens; it changes nothing in the page.

const SAVE_PATH_PREFIX = "/aftersign/save/";
const DEFAULT_WAIT_MS = 60_000;

export type SaveRequestLog = {
  // The `beat` of each save PUT the server has answered 2xx, oldest first.
  landedBeats: string[];
  // The `story.endingId` of each of those saves that carried one.
  landedEndingIds: string[];
  // How many save DELETEs the server has answered (2xx, or 404 for no row).
  landedClears: number;
};

export function recordSaveRequests(page: Page): SaveRequestLog {
  const log: SaveRequestLog = { landedBeats: [], landedEndingIds: [], landedClears: 0 };
  page.on("response", (response) => {
    const request = response.request();
    if (!new URL(request.url()).pathname.startsWith(SAVE_PATH_PREFIX)) return;
    const method = request.method();
    if (method === "PUT" && response.ok()) {
      let payload: { beat?: unknown; story?: { endingId?: unknown } } | undefined;
      try {
        payload = (request.postDataJSON() as { payload?: typeof payload } | null)?.payload;
      } catch {
        payload = undefined;
      }
      if (typeof payload?.beat === "string") log.landedBeats.push(payload.beat);
      const endingId = payload?.story?.endingId;
      if (typeof endingId === "string") log.landedEndingIds.push(endingId);
    } else if (method === "DELETE" && (response.ok() || response.status() === 404)) {
      log.landedClears += 1;
    }
  });
  return log;
}

// Resolves once the server has answered a save whose payload carries `beat`.
export async function waitForLandedSave(
  log: SaveRequestLog,
  beat: string,
  waitMs: number = DEFAULT_WAIT_MS,
): Promise<void> {
  await expect
    .poll(() => log.landedBeats.includes(beat), {
      timeout: waitMs,
      message: `the server should have answered a save at beat "${beat}" (landed so far: ${log.landedBeats.join(", ") || "none"})`,
    })
    .toBe(true);
}

// Resolves once the server has answered a save that carries an ending
// (`story.endingId`), which the vigil tap writes. A spec that plays more than
// one run on a page reads `log.landedEndingIds.length` BEFORE the tap and
// passes it in.
export async function waitForLandedEndingSave(
  log: SaveRequestLog,
  endingsBefore: number = 0,
  waitMs: number = DEFAULT_WAIT_MS,
): Promise<void> {
  await expect
    .poll(() => log.landedEndingIds.length > endingsBefore, {
      timeout: waitMs,
      message: "the server should have answered a save that carries story.endingId",
    })
    .toBe(true);
}

// Resolves once the server has answered one more save DELETE than
// `clearsBefore`, and the page has had two frames to finish the reset that
// was awaiting it. Read `log.landedClears` BEFORE the tap and pass it in.
export async function waitForLandedClear(
  page: Page,
  log: SaveRequestLog,
  clearsBefore: number,
  waitMs: number = DEFAULT_WAIT_MS,
): Promise<void> {
  await expect
    .poll(() => log.landedClears > clearsBefore, {
      timeout: waitMs,
      message: "the server should have answered the save DELETE that \"Start fresh\" sends",
    })
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const ROOT = process.cwd();
const STORY_TEXT = [
  /io/i,
  /blue seal|blue packet|packet/i,
  /unbroken|opened|seal did not|seal/i,
  /kind|evasive|blunt|came back/i,
  /next job|another job|new job|work for you|packet loop/i,
];

let server: Server;
let baseUrl: string;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = requestUrl.pathname === "/aftersign/" ? "/aftersign/index.html" : requestUrl.pathname;
    const filePath = path.join(ROOT, pathname);

    try {
      const body = await readFile(filePath);
      if (filePath.endsWith(".js")) response.setHeader("content-type", "text/javascript");
      if (filePath.endsWith(".css")) response.setHeader("content-type", "text/css");
      if (filePath.endsWith(".html")) response.setHeader("content-type", "text/html");
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end("not found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Could not bind playtest server");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function tapFirstVisibleChoice(page: Page) {
  const visibleChoices = page
    .locator('button, [role="button"], a, [data-choice], [data-testid*="choice"], [data-action]')
    .filter({ hasNotText: /^$/ });

  const count = await visibleChoices.count();
  for (let index = 0; index < count; index += 1) {
    const choice = visibleChoices.nth(index);
    if (await choice.isVisible()) {
      await choice.tap({ timeout: 2_000 });
      return true;
    }
  }

  return false;
}

async function visibleBodyText(page: Page) {
  return (await page.locator("body").innerText({ timeout: 5_000 })).replace(/\s+/g, " ").trim();
}

test.describe("M-CONTINUE player-tap playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("reaches the return-tone fork and next-job handoff by tapping rendered UI only", async ({ page }) => {
    await page.goto(`${baseUrl}/aftersign/`);

    const seen = new Set<string>();
    let reachedToneFork = false;
    let reachedNextJob = false;

    for (let step = 0; step < 24; step += 1) {
      const text = await visibleBodyText(page);
      seen.add(text);

      if (/kind|evasive|blunt|why.*came back|came back.*why/i.test(text)) {
        reachedToneFork = true;
      }

      if (/next job|another job|new job|work for you|packet loop/i.test(text)) {
        reachedNextJob = true;
        break;
      }

      const tapped = await tapFirstVisibleChoice(page);
      expect(tapped, `No visible tappable choice at step ${step}. Last visible text: ${text}`).toBe(true);
      await page.waitForTimeout(180); // pacing — human tap cadence
    }

    const playedText = [...seen].join("\n---\n");
    for (const expected of STORY_TEXT) {
      expect(playedText).toMatch(expected);
    }

    expect(reachedToneFork, `Played text never exposed the return-tone choice.\n${playedText}`).toBe(true);
    expect(reachedNextJob, `Played text never reached Io's next-job handoff.\n${playedText}`).toBe(true);
  });
});

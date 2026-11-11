import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

// CI must serialize AFTERSIGN's SwiftShader-backed WebGL boots. This is a
// config contract: parallel cold starts contend for the runner's shared GPU
// budget and can fail before a game assertion executes.
test("AFTERSIGN CI serializes WebGL cold starts", async () => {
  const config = await readFile(
    new URL("../playwright.config.ts", import.meta.url),
    "utf8",
  );

  expect(config).toContain(
    "fullyParallel: !process.env.CI || Boolean(servedBaseURL)",
  );
  expect(config).toContain(
    "workers: process.env.CI && !servedBaseURL ? 1 : undefined",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { installChromium, maxAttempts } from "./install-playwright-chromium.mjs";

test("falls back to a Chromium-only install after dependency failures", async () => {
  const calls = [];
  const delays = [];
  const exitCode = await installChromium({
    spawn: (_command, args) => {
      calls.push(args);
      return { status: args.includes("--with-deps") ? 100 : 0 };
    },
    sleep: async (delay) => delays.push(delay),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    ...Array.from({ length: maxAttempts }, () => ["playwright", "install", "--with-deps", "chromium"]),
    ["playwright", "install", "chromium"],
  ]);
  assert.deepEqual(delays, [15000, 30000]);
});

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const maxAttempts = 3;

export function runInstall(args, spawn = spawnSync) {
  return spawn("npx", ["playwright", "install", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export async function installChromium({
  spawn = spawnSync,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`[playwright-install] attempt ${attempt}/${maxAttempts}: npx playwright install --with-deps chromium`);
    const result = runInstall(["--with-deps", "chromium"], spawn);

    if (result.status === 0) {
      console.log("[playwright-install] chromium install succeeded");
      return 0;
    }

    if (attempt < maxAttempts) {
      const delayMs = attempt * 15000;
      console.warn(`[playwright-install] chromium install failed (exit ${result.status ?? "unknown"}); retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  console.warn("[playwright-install] dependency install failed; retrying chromium without system dependencies");
  const fallback = runInstall(["chromium"], spawn);
  if (fallback.status === 0) {
    console.log("[playwright-install] chromium install succeeded without system dependencies");
    return 0;
  }

  console.error("[playwright-install] chromium install failed after dependency retries and fallback");
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await installChromium());
}

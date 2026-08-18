#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const maxAttempts = 3;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(
    `[playwright-install] attempt ${attempt}/${maxAttempts}: npx playwright install --with-deps chromium`,
  );

  const result = spawnSync("npx", ["playwright", "install", "--with-deps", "chromium"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status === 0) {
    console.log("[playwright-install] chromium install succeeded");
    process.exit(0);
  }

  if (attempt < maxAttempts) {
    const delayMs = attempt * 5000;
    console.warn(
      `[playwright-install] chromium install failed (exit ${result.status ?? "unknown"}); retrying in ${delayMs}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

console.error("[playwright-install] chromium install failed after 3 attempts");
process.exit(1);

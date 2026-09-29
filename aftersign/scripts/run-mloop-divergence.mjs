import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "playwright",
    "test",
    "--config",
    "aftersign/playwright.config.ts",
    "aftersign/e2e/m-loop-divergence.playtest.spec.ts",
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);

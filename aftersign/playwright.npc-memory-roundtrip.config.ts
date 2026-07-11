import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testMatch: /npc-memory-roundtrip-contract\.spec\.ts/,
  webServer: {
    ...(Array.isArray(baseConfig.webServer) ? baseConfig.webServer[0] : baseConfig.webServer),
    env: {
      ...(Array.isArray(baseConfig.webServer)
        ? baseConfig.webServer[0]?.env
        : baseConfig.webServer?.env),
      FLAGSHIP_BREAK_MODE: "npc-memory-roundtrip",
    },
  },
});

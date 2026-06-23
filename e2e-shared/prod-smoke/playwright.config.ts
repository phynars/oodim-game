import { defineConfig, devices } from "@playwright/test";

// PROD-REACHABILITY play-smoke config. Unlike the per-game configs, this has NO
// webServer — it tests the DEPLOYED site at SMOKE_BASE_URL (default prod). Set
// SMOKE_BASE_URL=https://staging.game.oodim.com to smoke staging first.
//
// Born from the agar WS-404 incident (2026-06-23): the multiplayer server was
// never routed in prod, so the game was DEAD for players while every code / CI /
// deploy signal was green. Only a real browser hitting the live URL sees that.
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  retries: 2, // absorb a post-deploy propagation / cold-start blip; a REAL break still fails all 3
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "https://game.oodim.com",
    ...devices["Desktop Chrome"],
  },
});

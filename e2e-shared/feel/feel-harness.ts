// Shared feel/ e2e harness helpers (#261).
//
// "feel" specs measure game-feel under load (frame-time, input latency, juice
// timing). They run in CI under HEADLESS software-WebGL (SwiftShader), which is
// several-fold slower than a real GPU with a variable frame rate under CI CPU
// contention. The recurring flake class (#238 doom frametime, #260 galaga
// input-latency) came from specs gating on real-hardware assumptions: absolute
// wall-clock budgets, fixed-TIME sample sweeps, and the canvas being ready within
// the default timeout. These helpers + FEEL-HARNESS-CONVENTION.md codify the
// SwiftShader-safe patterns so the class can't recur.

import { expect, type Page } from "@playwright/test";

/** Navigate to the game root. Each game's Playwright `baseURL` already points at
 *  its sub-path (e.g. `http://localhost:4373/doom/`), so a feel spec MUST use a
 *  RELATIVE `goto("/")`. An absolute `goto("/doom")` resolves against the ORIGIN
 *  (`/doom`, not the `/doom/` base) -> the wrong page -> the canvas never loads.
 *  That footgun cost a full debug cycle on #238 (the toBeVisible failure was a
 *  navigation bug, not a flake). Always go through this helper. */
export async function gotoGameRoot(page: Page): Promise<void> {
  await page.goto("/");
}

/** Wait for the game canvas to be visible, with a COLD-START budget. Under CI
 *  SwiftShader the first WebGL context + shader compile can take many seconds to
 *  produce a visible canvas; the 5s `toBeVisible` default flakes cold. 30s
 *  absorbs it at zero cost on a warm/real-GPU run. */
export async function waitForVisibleCanvas(page: Page, timeoutMs = 30_000): Promise<void> {
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: timeoutMs });
}

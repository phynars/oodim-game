import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Doom gameplay harness. Mirrors the Galaga/Pac-Man configs but builds +
// previews the doom/ product at /doom/ on its own port. CI runs `build:doom`
// then `preview:doom` via the webServer hook so the assertions exercise the
// real built bundle — "CI for gameplay", the same merge gate the other
// products use.
//
// CRUCIAL for a true-3D product: Doom renders with WebGL, which is OFF by
// default in headless Chromium. We force the software (SwiftShader) WebGL path
// via Chromium launch flags so the renderer initializes in CI — see
// doom/docs/ARCHITECTURE.md "WebGL in headless CI". The e2e suite asserts on
// the `window.__doom` state contract (never pixels), but it DOES assert that a
// real WebGL context came up, which these flags make reliable headless.
//
// webServer.cwd is pinned to the repo root (npm scripts live in the root
// package.json), since Playwright defaults webServer cwd to this config's dir.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4373/doom/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Software WebGL (SwiftShader) is the reliable headless path: ANGLE
        // backed by SwiftShader gives a real WebGL/WebGL2 context with no GPU.
        // --enable-unsafe-swiftshader opts into SwiftShader on Chromium
        // versions that otherwise gate it; --ignore-gpu-blocklist stops the
        // CI's blocklisted virtual GPU from disabling acceleration entirely.
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
  ],
  webServer: {
    cwd: repoRoot,
    command:
      "npm run build:doom && npm run preview:doom -- --host localhost --port 4373 --strictPort",
    url: "http://localhost:4373/doom/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

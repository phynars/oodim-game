import { defineConfig } from "@playwright/test";

// Multiplayer-harness self-test config (Refs #129, Closes #152).
//
// The spec at doom/e2e/lib/multiplayer-harness.spec.ts is PURE TypeScript —
// zero browser deps, zero @playwright/test fixtures beyond the bare test()
// runner. It exercises orderTape, pureReplay, structuralEquals,
// withFloatTolerance, assertOrderingInvariant under each HARNESS_BREAK_MODE
// and asserts the matching invariant goes red (or stays green under "off").
//
// We piggyback on the Playwright runner ONLY for test discovery + reporting
// — there is intentionally NO webServer, NO browser, NO baseURL. This
// keeps the self-test job fast (no Chromium download, no preview build)
// and crisp (a hung browser cannot make a logic test flake).
//
// CI gate: .github/workflows/harness-self-test.yml runs `npm run test:harness`
// four times — once with HARNESS_BREAK_MODE=off (expects exit 0) and once
// per break mode (expects non-zero exit). That's the in-tree replacement
// for #129's "broken-branch fixture" — the self-fixture lives in the same
// commit as the assertion that catches it.

export default defineConfig({
  testDir: "e2e/lib",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  // No `use.baseURL`, no `webServer`, no `projects` with browsers — the
  // harness spec runs in plain Node under the Playwright test runner.
});

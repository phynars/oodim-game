import { defineConfig } from "@playwright/test";

// Multiplayer-harness self-test config (Refs #129, #162).
//
// The spec at e2e-shared/multiplayer/harness.spec.ts is PURE TypeScript —
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
// four times — once with HARNESS_BREAK_MODE=off (expects exit 0 — contract
// holds) and once per break mode (expects exit 0 — the self-test for that
// mode asserts the sabotage positively, contract cases the sabotage would
// falsify are `test.skip`'d). That's the in-tree replacement for #129's
// "broken-branch fixture" — the self-fixture lives in the same commit as
// the assertion that catches it.
//
// History: relocated under #162 from doom/playwright.harness.config.ts
// in the window between agar-00 (scaffold merged) and agar-02
// (authoritative tick — first cross-game consumer).

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  // No `use.baseURL`, no `webServer`, no `projects` with browsers — the
  // harness spec runs in plain Node under the Playwright test runner.
});

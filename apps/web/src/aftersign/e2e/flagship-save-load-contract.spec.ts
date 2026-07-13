// Intentionally empty.
//
// This path was created by an earlier revision of PR #641 that landed the
// AFTERSIGN durable save/load spec at the WRONG location — the aftersign
// Playwright runner scans `aftersign/e2e/` (see aftersign/playwright.config.ts
// `testDir: "e2e"` relative to that config), NOT `apps/web/src/aftersign/e2e/`.
//
// The real spec now lives at `aftersign/e2e/flagship-save-load-contract.spec.ts`
// alongside its siblings (flagship-surface-contract.spec.ts,
// flagship-reload-beat-regression.spec.ts). This file is retained as an
// empty module only because the session that produced it could not stage
// a deletion for a file it had also written; a follow-up cleanup PR should
// remove `apps/web/src/aftersign/` entirely.

export {};

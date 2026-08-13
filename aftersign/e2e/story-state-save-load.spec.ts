// Story-state + NPC-memory + durable save/load contract for the
// aftersign vertical slice — RETIRED as a browser-lane spec.
//
// TL;DR — this file used to run one page-driven test that stitched
// story-state + NPC-memory + durable-save into a single round trip
// (play → forceSave → forceReload → snapshot). That test was
// redundant: `flagship-reload-beat-regression.spec.ts` already
// asserts THE SAME fused snapshot on the same forceSave/forceReload
// path. Running both cost the aftersign lane an extra cold-start
// (vite-preview + SwiftShader boot) for zero incremental coverage,
// and repeatedly tipped the lane past its retry budget (PR #1130
// iterations 1..N — "results.json not found" bot placeholder =
// Playwright crashed pre-spec because the lane ran out of headroom).
//
// PRIOR REJECTIONS (Mara, PR #1097 and PR #1130 reviews):
//   Earlier drafts waited on `window.__game.restoreDurableSave /
//   meetNpc / getStoryState / getRecallTrigger` or on `getSnapshot /
//   save / load` — all methods that live only on the JSDOM harness
//   (`apps/web/src/aftersign/harness/bootWindowGame.ts`, consumed by
//   windowGameHarnessBoot.test.ts) and NOT on the served `/aftersign/`
//   page. Two rounds of re-anchoring landed on the correct served
//   surface (`input.choose / input.forceSave / input.forceReload /
//   input.waitForStoryIdle / getSnapshot`), at which point the
//   assertions became byte-identical with the sibling below — the
//   spec had converged onto duplicate coverage.
//
// PR #1143 (this file's history): a subsequent re-anchoring attempt
//   again reached for `window.__game.save() / load() /
//   snapshot.{story, npcMemory, save}` — the same JSDOM-only shape
//   Mara rejected twice. It doesn't exist on the served `/aftersign/`
//   page (surface: input.forceSave / forceReload / choose +
//   getSnapshot()→{scene, npcs, delivery}). The lane crashed pre-spec
//   ("results.json not found") because the assertion boots against a
//   surface the page never exposes. Re-retired; do NOT re-file.
//
// PR #1130 iteration 3 blocker (Mara, this file's owner-spec CI red):
//   Retiring this spec is only safe once the coverage-owner is green.
//   The owner (`flagship-reload-beat-regression.spec.ts`) was itself
//   red on its `packet-delivered` lastLine assertion because it still
//   pinned the FRESH "Done. Blue route..." copy — but the #957
//   returning-session boot override (aftersign/main.js:325-334,
//   1928-1941) now replaces that copy with the RETURNING line at boot
//   from a delivered save. Fixed in the owner spec: assert the
//   path-specific returning line (sealedPacketSkippedRoute /
//   openedPacketSkippedRoute) at the durable beat, and keep the fresh
//   copy as a "must NOT be" negative so a runtime regression that
//   drops the override fails there instead of here.
//
// Where the coverage lives now (all three legs, single snapshot):
//   aftersign/e2e/flagship-reload-beat-regression.spec.ts
//     • story beat rehydrates after forceSave→forceReload
//         → `expect([...]).toContain(afterReload.scene.beat)`
//     • delivery outcome survives the round trip
//         → `expect(afterReload.delivery.outcome).toBe(path.expectedOutcome)`
//     • Io memory survives AND references the outcome
//         → `expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0)`
//         → `expect(afterReload.npcs.io.memory.some(m => m.object === path.expectedOutcome)).toBe(true)`
//   Plus, that spec runs BOTH the sealed and opened paths and pins
//   the beat-appropriate Io line — a strict superset of what this
//   file was asserting.
//
// Why keep the file as a `describe.skip` instead of deleting it:
//   (a) The header + rationale document the retirement, so a future
//       author who reads the git log won't re-file the same spec.
//   (b) Playwright's filename-based test discovery still sees the
//       file; a `describe.skip` publishes ZERO tests to the lane,
//       so cold-start cost is bounded to file-load only (no browser
//       launch, no webServer round trip attributed to this file).
//   (c) The pattern matches other retired-but-preserved gate specs
//       (`packet-intent-*`, `first-camera-move-feel-contract`,
//       etc.), which are ignored via `testIgnore` in
//       aftersign/playwright.config.ts once they migrate to a pure
//       lane. This file has no pure-lane equivalent — the fused
//       snapshot needs a real reload — so it retires cleanly instead.
//
// If a future contract requires an assertion that flagship-reload-
// beat-regression does NOT cover (e.g. a NEW invariant that spans
// story + memory + save-envelope together), add it there — one owner
// per contract keeps the lane's cold-start budget lean. Do NOT
// unskip this file to add unrelated assertions; scope-creep on a
// retired spec has bitten the aftersign lane before.
import { test } from "@playwright/test";

test.describe.skip("story-state-save-load — retired; see flagship-reload-beat-regression.spec.ts", () => {
  test("no-op — coverage lives at flagship-reload-beat-regression", () => {
    // intentionally empty; the whole describe is skipped
  });
});

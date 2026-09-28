import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "apps/web/src/aftersign/harness/windowGameHarnessBoot.test.ts",
      "apps/web/src/aftersign/ioRecognitionExpectedLine.consumer.test.ts",
      "apps/web/src/aftersign/feltRecognitionBeat.test.ts",
      "apps/web/src/aftersign/feltRecognitionBeat.consumer.test.ts",
      "apps/web/src/aftersign/verticalSliceRuntimeState.recognitionFeel.consumer.test.ts",
      "apps/web/src/aftersign/ioPhoneReadyFeel.test.ts",
      "apps/web/src/aftersign/returnToneChoiceFeel.consumer.test.ts",
      "apps/web/src/aftersign/returnToneChoiceFeel.contract.test.ts",
      "apps/web/src/aftersign/ioContinueBeats.consumer.test.ts",
      "apps/web/src/aftersign/npcMemoryRecallDialogue.test.ts",
      "apps/web/src/aftersign/servedSurface.contract.test.ts",
      "apps/web/src/aftersign/mcontinueReachableBeats.test.ts",
      "apps/web/src/aftersign/aftersignMilestoneAcceptanceSurface.test.ts",
      "apps/web/src/aftersign/aftersignDurableSaveLoadPlaytestSurface.test.ts",
      "apps/web/src/aftersign/aftersignDurableStoryStateSaveLoadSurface.test.ts",
      "apps/web/src/aftersign/aftersignMemoryDivergencePlaytestSurface.test.ts",
      "apps/web/src/aftersign/aftersignLoopDivergencePlaytestSurface.test.ts",
      // Sibling body-guard for the surface test above. The surface test
      // can't prove its own body isn't hollowed out (`.skip`, gutted
      // assertion, dropped served-page witness). This file reads the
      // surface source and reds if the load-bearing pieces disappear.
      // See PR #1905 (Mara Okonkwo review): "wire it into `include` and
      // have it assert something the surface test can't".
      "apps/web/src/aftersign/aftersignLoopDivergencePlaytestRegistration.test.ts",
      "apps/web/src/aftersign/aftersignMloopDivergence.contract.test.ts",
      "apps/web/src/aftersign/aftersignMloopMemoryGate.test.ts",
      "apps/web/src/aftersign/aftersignPlayedAcceptanceNaming.test.ts",
      "apps/web/src/aftersign/mContinueVisibleButtons.contract.test.ts",
      "apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts",
      "apps/web/src/aftersign/harness/pointerToRenderLatency.contract.test.ts",
      "apps/web/src/aftersign/tapChoiceFeel.test.ts",
      "apps/web/src/aftersign/tapChoiceFeel.consumer.test.ts",
      "apps/web/src/aftersign/mobileTapTargetFeel.test.ts",
      "apps/web/src/aftersign/tapConfirmFeel.consumer.test.ts",
      "apps/web/src/aftersign/tapConfirmFeel.servedButton.test.ts",
      "apps/web/src/aftersign/routeRiskMemory.consumer.test.ts",
      // PR #1925 re-review (Soren Vask) — route-risk tap-lock. The
      // first draft shipped `routeRiskChoiceIntent.ts` as a pure
      // module with zero importers and no tap-driven assertion —
      // dead-on-arrival per the CONSUMER RULE. This consumer test
      // renders the served `renderRouteRiskChoice` into jsdom,
      // taps two DIFFERENT buttons 60ms apart on an injected clock,
      // and asserts the second tap dropped — the exact "finger
      // that lifted after reflow confirmed the wrong route" case
      // the 180ms lock exists to prevent. Paired with the wire in
      // `routeRiskMemory.ts`'s click handler so an unwiring reds.
      "apps/web/src/aftersign/routeRiskChoiceLock.consumer.test.ts",
      "apps/web/src/aftersign/aftersignJobOfferCopy.consumer.test.ts",
      "apps/web/src/aftersign/ioLoopConsequenceLine.consumer.test.ts",
      "apps/web/src/aftersign/aftersignJobTakeFeel.test.ts",
      "apps/web/src/aftersign/aftersignJobTakeFeel.consumer.test.ts",
      "apps/web/src/aftersign/jobOfferActionFingerprint.consumer.test.ts",
      "apps/web/src/aftersign/twoRoundOfferTapDivergence.consumer.test.ts",
      "apps/web/src/aftersign/aftersignKioskInteractionLoopSurface.test.ts",
      "apps/web/src/aftersign/playerMemoryBackend.test.ts",
      "apps/web/src/aftersign/mLoopE1CoverageSurface.test.ts",
      // PR #1874 — Saint-Orra pointer render consumer test. Mounts a
      // fragment matching the served `aftersign/index.html` shape and
      // exercises `stampIoSecondPacketPointer` against it. Was
      // previously absent from this include list, so its jsdom
      // assertions never ran — reviewer feedback on PR #1874 (Soren
      // Vask) caught the dead coverage. Fixed here.
      "apps/web/src/aftersign/ioSecondPacketPointerRender.consumer.test.ts",
      // PR #1884 re-review (Mara Okonkwo) — job-acceptance sibling
      // paragraph consumer test. Mounts a fragment matching the served
      // `aftersign/index.html` shape and exercises
      // `stampJobAcceptedLine` against it. Pairs with the retargeted
      // `aftersign/e2e/aftersign-job-take-feel.playtest.spec.ts` and
      // the wire in `aftersign/main.js` so the acceptance line is
      // player-visible evidence, not an assertion against an untouched
      // `#line`.
      "apps/web/src/aftersign/aftersignJobAcceptedRender.consumer.test.ts",
      // PR #2008 re-review (Soren Vask) — packet-recall consumer test.
      // The first draft shipped `aftersignPacketRecallCopy.js` with
      // zero importers AND an invented `careful` token that didn't
      // match the durable `safe`|`fast`|`failed` axis. This bundle
      // fixes both: the writer `aftersignPacketRecallRender.ts`
      // stamps a sibling `<p id="packetRecallLine">` next to the
      // served `#line` paragraph, the copy table shares the exact
      // route-outcome axis as `aftersignRouteOutcomeCopy.js`, and
      // this consumer test pins the token vocabulary AND the DOM
      // contract against a served-shape fragment.
      "apps/web/src/aftersign/aftersignPacketRecallRender.consumer.test.ts",
      // PR #1890 re-review (Soren Vask) — the offer-choice acknowledgement
      // wrapper `aftersign/src/jobOfferChoiceFeedback.js` delegates to
      // the shipped `ioJobOfferActionFeel` writer + toggles the shipped
      // pressed class. This consumer test drives the wrapper against a
      // real jsdom button and asserts the RENDERED outcome (installed
      // <style>, stamped `data-aftersign-job-risk`, the shipped CSS
      // vars, and the pressed-class round-trip). Fixes the "applied
      // half is dead on arrival" gap the first draft shipped.
      "apps/web/src/aftersign/jobOfferChoiceFeedback.consumer.test.ts",
      // PR #1955 re-review (Soren Vask) — route-risk touch feedback
      // module was DELETED as the FIFTH repetition of the parallel-
      // feel-contract pattern (HANDOFF-1694 / -1698 / -1760 / -1848,
      // now -1955). The canonical route-choice confirmation envelope
      // is `aftersign/src/routeRiskConfirmFeedback.js` — it already
      // ships the pinned numbers (pressScale 0.97, scalePeak 1.025,
      // 180ms), a reduced-motion vestibular branch, try/catch around
      // the WAAPI call, and a boolean return callers rely on. See
      // `apps/web/src/aftersign/HANDOFF-1955.md` for the deletion
      // rationale; a real route-risk press cue extends that module
      // (or `packages/aftersign/src/interactionConfirm.ts`) in a
      // scoped PR, it does not fork a fifth parallel module.
      // Refs #1698 handoff chain (HANDOFF-1694/1698/1760) — the pure
      // gesture judge's terminal feedback tokens
      // (`"seal-strain" | "seal-break" | "seal-safe" | "previewed"`)
      // never reached the DOM. This consumer test loads the served
      // `aftersign/index.html`, drives the pure judge into each
      // token, and asserts the writer stamps
      // `data-packet-feedback` on the shipped `#packetButton`.
      // Paired with the wire in
      // `aftersign/src/runtime/inputAdapters.js` on the release
      // funnel. Prior handoff drafts landed a test file that was
      // NOT in this include list — dead on arrival — so this
      // registration is the load-bearing part of the fix.
      "apps/web/src/aftersign/packetChoiceFeel.servedButton.test.ts",
      // PR #1911 re-review (Soren Vask) — pointer-capture wired into the
      // SHIPPED offered-job press owner `aftersign/jobOfferPressing.js`
      // (loaded by `<script>` from `aftersign/index.html:1593`). The
      // first draft only touched a test-fixture (`renderAftersignJob-
      // OfferActionButton`) that nothing on the served page calls. This
      // test drives `attachJobOfferPressing` end-to-end and pins that
      // `pointerdown` → `setPointerCapture`, `pointerup`/`pointercancel`
      // → `releasePointerCapture`, without breaking the pressed marker.
      "apps/web/src/aftersign/jobOfferPressingCapture.test.ts",
      // PR #1914 re-review (Soren Vask) — focus/hover feedback for the
      // offered-job buttons on the served page. `playJobOfferFocus-
      // Feedback` is wired into `aftersign/main.js`'s click callback
      // and stamps a WAAPI boxShadow glow + an idempotent `<style>`
      // outline consuming `--aftersign-job-offer-focus-*` tokens. This
      // consumer test drives the writer against a real jsdom button
      // and asserts the marker/var stamps, 180ms clear, idempotent
      // style block, and cancel path. First draft landed the test
      // file without registering it here — dead on arrival — so this
      // include entry is the load-bearing half of the fix.
      "apps/web/src/aftersign/jobOfferFocusFeedback.consumer.test.ts",
      // PR #1964 re-review (Soren Vask) — the acknowledgement receipt
      // beat `aftersign/src/jobOfferAcknowledgementFeel.js` is wired
      // into the accept callback in `aftersign/main.js` (~2577) and
      // ships pinned magic values (220ms duration, 6px rise, cubic-
      // bezier easing, 0 → 1 → 0.82 opacity arc). Every sibling feel
      // module ships a consumer test that pins these exact tokens;
      // without one, green CI proves nothing about drift. This file
      // asserts the frozen contract, the three-keyframe opacity/
      // transform arcs, the animate() options, the pre-animate
      // cancel of in-flight WAAPI handles, and the null/no-WAAPI
      // guards. Closes the AI005 flag on the module.
      "apps/web/src/aftersign/jobOfferAcknowledgementFeel.consumer.test.ts",
      // PR #1934 re-review (Soren Vask) — pin the three return values
      // of `servedMloopDivergenceKey`, the helper `aftersign/main.js`
      // uses to stamp `data-mloop-divergence-memory` on the rendered
      // `#offeredJobs` tray. Paired with the played spec at
      // `aftersign/e2e/mloop-served-divergence-played.spec.ts` (which
      // reads the attribute at the tap surface); this file locks the
      // `fresh` | `completed` | `debt-held` label vocabulary so a
      // future relabel reds here alongside the spec.
      "apps/web/src/aftersign/servedMloopDivergenceKey.test.ts",
      // PR #1991 re-review (Mara Okonkwo) — the served-divergence
      // played-witness contract. Scans `aftersign/e2e/` for one
      // registered playtest spec that (a) reads
      // `data-mloop-divergence-memory` off the rendered
      // `#offeredJobs` tray, (b) locates
      // `button[data-offered-job-id]` as a tappable child,
      // (c) fires ≥1 real player event, and (d) does NOT reach
      // into `window.__game.input.*`. Today
      // `aftersign/e2e/mloop-served-divergence-played.spec.ts`
      // is that spec — if it's renamed, moved, or hollowed out
      // this contract reds. The first draft asserted a two-
      // completed-rounds shape that no spec on disk satisfies;
      // that gap is a separate follow-up, tracked in the M-LOOP
      // played coverage issue chain, and doesn't belong here.
      "apps/web/src/aftersign/aftersignMloopServedDivergencePlaytestContract.test.ts",
      // PR #1976 re-review (Soren Vask, 2nd pass) — the route-risk
      // confirmation envelope `aftersign/src/routeRiskConfirmFeedback.js`
      // is wired into `aftersign/main.js` and ships pinned magic
      // values (180ms duration, 4px lift, 1.025 scale peak, 0.35
      // offset, cubic-bezier easing, 8ms haptic). Every sibling feel
      // module pairs its writer with a consumer test that pins these
      // tokens against a real jsdom surface; a green CI without one
      // proves nothing about drift.
      //
      // First draft landed the test at `aftersign/src/*.contract.test.ts`,
      // which tripped TWO blockers:
      //   (a) `aftersign/tsconfig.json` (strict, no `allowJs`,
      //       `include: ["src"]`) reds TS7016 on `.js` imports from
      //       `.ts` files in `aftersign/src/` — the exact AI008
      //       failure Ivy documented in `packetChoiceIntentFeedback.ts`.
      //   (b) This include list is authored with `apps/web/src/aftersign/`
      //       paths, and vitest resolves them from repo root; a file
      //       under `aftersign/src/` is dead-on-arrival even when
      //       named here (also lacks vitest types under aftersign's
      //       tsconfig — the `aftersign/src/*.test.ts` files there
      //       are plain-TS assertion runners, not vitest specs).
      //
      // The mechanical fix: co-locate the consumer test with every
      // sibling `*.consumer.test.ts` under `apps/web/src/aftersign/`
      // (matching `jobOfferAcknowledgementFeel.consumer.test.ts` — a
      // sibling `.js` feel module with the same tree shape), and
      // import the served module via the deep relative path
      // `../../../../aftersign/src/routeRiskConfirmFeedback.js`. The
      // burn-down config `aftersign/tsconfig.apps-web.json` runs as
      // `continue-on-error: true`, so a transient `.js`-import
      // resolution note there does not gate the merge — matching
      // every existing `apps/web/src/aftersign/*.consumer.test.ts`
      // that imports from `aftersign/src/*.js`.
      "apps/web/src/aftersign/routeRiskConfirmFeedback.consumer.test.ts",
    ],
  },
});

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
    ],
  },
});

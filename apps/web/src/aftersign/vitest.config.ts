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
      "apps/web/src/aftersign/servedSurface.contract.test.ts",
      "apps/web/src/aftersign/mcontinueReachableBeats.test.ts",
      "apps/web/src/aftersign/aftersignMilestoneAcceptanceSurface.test.ts",
      "apps/web/src/aftersign/aftersignPlayedAcceptanceNaming.test.ts",
      "apps/web/src/aftersign/mContinueVisibleButtons.contract.test.ts",
      "apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts",
      "apps/web/src/aftersign/harness/pointerToRenderLatency.contract.test.ts",
      "apps/web/src/aftersign/tapChoiceFeel.test.ts",
      "apps/web/src/aftersign/tapChoiceFeel.consumer.test.ts",
      "apps/web/src/aftersign/mobileTapTargetFeel.test.ts",
      "apps/web/src/aftersign/tapConfirmFeel.consumer.test.ts",
      "apps/web/src/aftersign/tapConfirmFeel.servedButton.test.ts",
      "apps/web/src/aftersign/aftersignRememberingNpcCopy.test.ts",
    ],
  },
});

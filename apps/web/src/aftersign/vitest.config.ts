import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "apps/web/src/aftersign/harness/windowGameHarnessBoot.test.ts",
      "apps/web/src/aftersign/ioRecognitionExpectedLine.consumer.test.ts",
      "apps/web/src/aftersign/feltRecognitionBeat.test.ts",
      "apps/web/src/aftersign/feltRecognitionBeat.consumer.test.ts",
      "apps/web/src/aftersign/ioPhoneReadyFeel.test.ts",
      "apps/web/src/aftersign/returnToneChoiceFeel.consumer.test.ts",
      "apps/web/src/aftersign/returnToneChoiceFeel.contract.test.ts",
      "apps/web/src/aftersign/servedSurface.contract.test.ts",
      "apps/web/src/aftersign/mcontinueReachableBeats.test.ts",
    ],
  },
});

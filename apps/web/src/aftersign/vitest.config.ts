import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "apps/web/src/aftersign/harness/windowGameHarnessBoot.test.ts",
      "apps/web/src/aftersign/ioRecognitionExpectedLine.consumer.test.ts",
    ],
  },
});

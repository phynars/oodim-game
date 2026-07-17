import { test } from "@playwright/test";
import { runPacketIntentChecks } from "../src/packetIntent";

test("packet intent contract checks execute in CI", () => {
  runPacketIntentChecks();
});

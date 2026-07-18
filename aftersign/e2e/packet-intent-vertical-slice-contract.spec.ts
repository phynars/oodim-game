import { test, expect } from "@playwright/test";
import { runPacketIntentContractChecks } from "../src/packetIntentContract.test";

// CI-gate for the packet-intent vertical-slice OUTCOME contract checks.
//
// `runPacketIntentContractChecks()` lives in
// aftersign/src/packetIntentContract.test.ts and pins three outcome
// invariants for the vertical slice: (1) sealed vs opened produce
// structurally distinct save snapshots, (2) the persisted outcome is
// harness-inspectable before Io's returning-session dialogue picks a
// line, and (3) repeat-commit of the same outcome is idempotent.
//
// Sibling spec `packet-intent-contract.spec.ts` covers the CONTROLLER
// invariants (450ms hold, sticky-cancel, tap ceiling). Together these
// two pin the packet intent from input-hold through memory outcome —
// the "runnable slice contract" from PR #703's title, now actually
// runnable under the aftersign CI lane (`test:e2e:aftersign`).
//
// Pure module smoke test — no { page } fixture, no scene, no
// window.__game — matching the sibling shape.

test.describe("AFTERSIGN packet intent vertical-slice contract", () => {
  test("runPacketIntentContractChecks executes every outcome invariant without throwing", async () => {
    expect(() => runPacketIntentContractChecks()).not.toThrow();
  });
});

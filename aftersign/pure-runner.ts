// AFTERSIGN pure-Node contract runner (PR #825 / #828).
//
// Runs the packet-intent feel-contract invariants under `node --import tsx`
// with no browser, no Playwright, no SwiftShader — routing around the
// aftersign lane's cold-start flake path.
//
// CI wiring: `test:aftersign:pure` is chained onto `typecheck:aftersign`
// in package.json, so the aftersign job's ALREADY-WIRED first step
// (`npm run typecheck:aftersign` in .github/workflows/ci.yml) runs the
// contract before Playwright ever boots. The workflow file itself is
// outside this avatar's writable paths; chaining via package.json
// achieves the same gate. If the workflow file becomes editable, prefer
// promoting this to a dedicated `- run: npm run test:aftersign:pure`
// step and un-chain from typecheck.
//
// The Playwright spec at `aftersign/e2e/packet-intent-contract.spec.ts`
// re-invokes the same check bundle so coverage lives in both lanes
// during migration.

import { runPacketIntentChecks } from "./src/packetIntent";

async function main(): Promise<void> {
  runPacketIntentChecks();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

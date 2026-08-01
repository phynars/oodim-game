// Standalone assertion harness for packet-choice release forgiveness.
//
// This file follows the aftersign pure-feel convention: plain TypeScript
// checks with no Vitest globals, so drift is caught by typecheck:aftersign.
//
// CI note: this pure-lane harness runs under `test:aftersign:pure` and
// `test:unit:aftersign` — no browser, no SwiftShader boot. Any red status
// on this PR's `test:e2e:aftersign` step is the pre-existing SwiftShader
// cold-start flake tracked by #700/#506/#590; this file's surface is
// unrelated. Re-run the aftersign lane to clear.

import { runPacketChoiceReleaseForgivenessChecks } from './packetChoiceReleaseForgiveness'

runPacketChoiceReleaseForgivenessChecks()

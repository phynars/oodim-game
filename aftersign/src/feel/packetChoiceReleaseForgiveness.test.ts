// Standalone assertion harness for packet-choice release forgiveness.
//
// This file follows the aftersign pure-feel convention: plain TypeScript
// checks with no Vitest globals, so drift is caught by typecheck:aftersign.

import { runPacketChoiceReleaseForgivenessChecks } from './packetChoiceReleaseForgiveness'

runPacketChoiceReleaseForgivenessChecks()

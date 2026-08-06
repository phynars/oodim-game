// Export-only shim.
//
// Repo convention (see aftersign/src/packetIntent.test.ts + PR #973): the
// `.ts` module OWNS `check*()` + `run*Checks()`; the `.test.ts` sibling is a
// thin re-export so pure-runner and the Playwright pure lane can import the
// runner without executing it twice at module load.
//
// The e2e spec (aftersign/e2e/packet-choice-release-forgiveness-contract.spec.ts)
// imports `runPacketChoiceReleaseForgivenessChecks` directly from
// `../src/feel/packetChoiceReleaseForgiveness` — that path resolves to the
// `.ts` module, not this shim. This file exists so `typecheck:aftersign`
// picks up the module (aftersign/tsconfig.json deliberately does NOT
// exclude `**/*.test.ts` — see its header) and any future pure-runner
// entry has a stable import target.
export { runPacketChoiceReleaseForgivenessChecks } from './packetChoiceReleaseForgiveness';

// Standalone assertion harness for the AFTERSIGN memory-prompt timing feel model.
//
// Convention departure (vs aftersign/src/feel/firstCameraMove.test.ts):
// the `check*()` / `runMemoryPromptTimingChecks()` functions live in the
// production `./memoryPromptTiming.ts` module, not this `.test.ts` file.
// Rationale: the e2e pure-lane spec at
// `aftersign/e2e/memory-prompt-timing-feel-contract.spec.ts` needs to
// import the runner into a Playwright test — importing from a `.test.ts`
// sibling would drag the top-level `runMemoryPromptTimingChecks()`
// side-effect call (below) into the Playwright process at import time,
// running the assertions twice per spec attempt and coupling spec retries
// to the plain-TS harness's exit semantics. Keeping the runner in the
// production module lets both consumers (this harness + the e2e spec)
// import a pure symbol; this file stays the "run the checks as a script"
// entry point.
//
// The e2e spec still imports from `./memoryPromptTiming.test` (matching
// `firstCameraMove` wiring), so we re-export the runner here for that path.

import { runMemoryPromptTimingChecks } from "./memoryPromptTiming.ts";

export { runMemoryPromptTimingChecks };

runMemoryPromptTimingChecks();

// Shared Io phone-ready recognition feel contract.
//
// This mirrors the AUTHORITATIVE numeric envelope defined in
// apps/web/src/aftersign/ioPhoneReadyFeel.ts. Every field name and
// millisecond number below traces to a constant in that runtime module.
// If the runtime and this file disagree, the runtime wins — update this
// file in the same PR that changes the runtime, not later.
//
// Why this mirror exists: aftersign/e2e/ specs cannot import from
// apps/web/src/ (no e2e spec in the repo does — see grep on 2026-07-12);
// the convention is that shared harness contracts live under e2e-shared/
// as a repo-root sibling of aftersign/ and apps/. Same pattern as
// e2e-shared/flagshipStoryStateContract.ts.
//
// This module is DATA only — no DOM, no audio, no timers. Playwright
// asserts on the same numbers the runtime samples so the feel budget
// is a single source of truth across the phone-ready recognition beat.

export const IO_PHONE_READY_FEEL = {
  settleMs: 360,
  lineRisePx: 14,
  glowPeakOpacity: 0.34,
  visualCueMs: 96,
  audioCueMs: 112,
  maxAudioVisualDriftMs: 50,
  easing: "cubic-bezier(.16,1,.3,1)",
} as const;

export type IoPhoneReadyFeelContract = typeof IO_PHONE_READY_FEEL;

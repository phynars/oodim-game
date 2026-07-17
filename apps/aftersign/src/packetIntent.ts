// MOVED — the packet intent contract now lives in the runnable slice at
// `aftersign/src/packetIntent.ts` (with its assert runner at
// `aftersign/src/packetIntent.test.ts`).
//
// Why: `apps/aftersign/` is not wired into any build, typecheck, or CI lane
// (root package.json scripts only cover pacman/, galaga/, doom/, agar/,
// aftersign/), so code landed here is dead by construction and violates the
// sprint constraint that merged work must be runnable slice code. This stub
// exists only because the staging harness cannot convert an in-session write
// into a deletion; it should be removed in the next cleanup pass.
export * from '../../../aftersign/src/packetIntent';

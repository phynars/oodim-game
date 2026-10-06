/**
 * Io's sealed-return and opened-return copy: one owner for each line, so
 * every served-surface consumer (`ioVoice.js`, `story/ioMemoryLines.ts`,
 * `io-dialogue.ts`, plus the `packages/aftersign` triage layer) imports
 * the string instead of re-typing it. Duplicated literals were the AI005
 * finding on PR #2200 — this module is the single owner.
 *
 * Keep the tuple shape explicit rather than asserting that splitting
 * arbitrary prose produces exactly three beats.
 *
 * This is a TypeScript source module. Direct Node strip-types consumers
 * must import it with its actual `.ts` extension.
 */
export const IO_SEALED_RETURN_BEATS = [
  "You made it back.",
  "So did the blue seal, unbroken.",
  "That makes two reasons to trust you.",
] as const;

export const IO_SEALED_RETURN_LINE = IO_SEALED_RETURN_BEATS.join(' ');

export const IO_OPENED_RETURN_BEATS = [
  "You made it back.",
  "The seal did not.",
  "I can use one of those facts.",
] as const;

export const IO_OPENED_RETURN_LINE = IO_OPENED_RETURN_BEATS.join(' ');

/**
 * Io's sealed-return and opened-return CANONICAL copy.
 *
 * The OPENED line is single-owned: `IO_OPENED_RETURN_LINE` is the only
 * place that string lives in source. Consumers that render the canonical
 * opened-return line (`aftersign/src/ioVoice.js`,
 * `aftersign/src/story/ioMemoryLines.ts`, `aftersign/src/io-dialogue.ts`,
 * and `packages/aftersign/src/ioReturningSession.ts`) all import it
 * rather than re-typing the literal.
 *
 * The SEALED line is single-owned for the three-beat canonical form
 * (`IO_SEALED_RETURN_LINE` = "You made it back. So did the blue seal,
 * unbroken. That makes two reasons to trust you."). The narrative-triage
 * layer (`packages/aftersign/src/narrative-triage/io-recognition-beat.ts`,
 * `io-slice-copy.ts`) and `aftersign/src/io-dialogue.ts` author VARIANT
 * sealed-return lines with different trailing clauses ("Two facts. I can
 * work with two." / "That's two facts I can trust.") — those are not
 * duplicates and intentionally stay as inline literals in their owning
 * modules. They share only the "You made it back. So did the blue seal,
 * unbroken." prefix, which is held in sync by hand.
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

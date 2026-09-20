/**
 * Io's sealed-return copy: one owner for both the three reveal beats and
 * the full line. Keep the tuple shape explicit rather than asserting that
 * splitting arbitrary prose produces exactly three beats.
 *
 * This is a TypeScript source module. Direct Node strip-types consumers
 * must import it with its actual `.ts` extension.
 */
export const IO_SEALED_RETURN_BEATS = [
  "You came back.",
  "So did the blue seal, unbroken.",
  "That makes two reasons to trust you.",
] as const;

export const IO_SEALED_RETURN_LINE = IO_SEALED_RETURN_BEATS.join(' ');

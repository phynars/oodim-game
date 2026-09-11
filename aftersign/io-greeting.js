// Io's first-contact line is deliberately separate from return recognition.
// The interaction surface can render this once when the player enters Io's radius.
export const IO_FIRST_CONTACT_GREETING =
  "Night Post. If you're here for a name, bring one worth carrying.";

/**
 * Returns Io's initial line exactly once per interaction session.
 * The caller owns the rendered dialogue and resets this state when the player
 * leaves Io's interaction radius.
 */
export function createIoFirstContactGreeting() {
  let hasGreeted = false;

  return function getIoFirstContactGreeting() {
    if (hasGreeted) return null;
    hasGreeted = true;
    return IO_FIRST_CONTACT_GREETING;
  };
}

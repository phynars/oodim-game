// Io's round-to-round consequence copy.
// Kept as a small pure surface so the rendered job handoff can state what
// the previous run changed without turning memory into a generic affinity line.

const COPY_BY_JOB = Object.freeze({
  "quiet-stair": "You kept to the light. The dark cut stays closed tonight.",
  "bell-cut": "You took the bell cut. It remembers footsteps now.",
  "sealed-return": "You brought it back whole. I saved you the harder work.",
  "opened-return": "You opened it. So this is the work that remains.",
});

export function ioLoopConsequenceLine(jobId) {
  return COPY_BY_JOB[jobId] ?? "One run changes the next. Take the work in front of you.";
}

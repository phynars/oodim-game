/**
 * Io's hand-off after the first delivery. Keep this separate from state:
 * callers select the key that matches the consequence they expose.
 */
export const IO_NEXT_JOB_COPY = Object.freeze({
  sealed: Object.freeze({
    line: "Seal held. The Bell Archive needs a name carried without changing it. Take the dry stair.",
    actionLabel: "Take the Archive job",
  }),
  opened: Object.freeze({
    line: "You read what was not yours. The pier has a packet that wants an honest courier. Take the dark cut.",
    actionLabel: "Take the Pier job",
  }),
  default: Object.freeze({
    line: "One delivery proves a route. The next one proves the courier. Choose your work.",
    actionLabel: "Choose a job",
  }),
});

export function chooseIoNextJobCopy(packetOutcome) {
  return IO_NEXT_JOB_COPY[packetOutcome] ?? IO_NEXT_JOB_COPY.default;
}

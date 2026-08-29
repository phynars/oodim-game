// AFTERSIGN M-LOOP copy seed for the served job-offer divergence work.
//
// This file is intentionally tiny: it gives the runtime wiring one authored
// vocabulary for Io's first divergent job offers without adding a parallel
// state machine. A consumer must render these as tappable actions; copy alone
// is not milestone completion.

export const IO_MLOOP_JOB_COPY_SEED = Object.freeze({
  firstRun: Object.freeze({
    tappableActionId: "take-job-blue-seal-safe-run",
    title: "Carry the blue seal",
    route: "Lit stair. No shortcuts. Bring it back with the wax still honest.",
    risk: "low",
    ioLine: "First run stays simple. Prove the packet survives you.",
  }),
  trusted: Object.freeze({
    tappableActionId: "take-job-bell-archive-risk-run",
    title: "Take the bell stair",
    route: "Short dark cut through the bell-shadow. Faster, if it lets you pass.",
    risk: "high",
    ioLine: "You kept one seal intact. That buys you a worse staircase.",
  }),
  opened: Object.freeze({
    tappableActionId: "take-job-orra-debt-run",
    title: "Pay Orra's errand",
    route: "Old pharmacy sign, then home before it starts calling you by name.",
    risk: "medium",
    ioLine: "You read what was not yours. Fine. Orra has a use for curious hands.",
  }),
});

export function getIoMloopJobCopySeed(memoryPosture) {
  if (memoryPosture === "trusted") {
    return IO_MLOOP_JOB_COPY_SEED.trusted;
  }

  if (memoryPosture === "opened") {
    return IO_MLOOP_JOB_COPY_SEED.opened;
  }

  return IO_MLOOP_JOB_COPY_SEED.firstRun;
}

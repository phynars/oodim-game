// Canonical served-page adapter for Io's active dialogue roles.
//
// `main.js` imports this module—not individual copy tables—so the three
// player-visible Io roles have one served owner. This adapter owns the
// accepted-job receipt; its prompt and acknowledgement delegate to their
// existing authored modules.
import { ioNextJobLine } from "./ioNextJobDialogue.js";
import { selectIoSecondPacketCopyForReturnReason } from "./ioSecondPacketCopy.ts";

/** The receipt shown after a player accepts an offered job. */
export const jobAcceptedReceipt = (label) =>
  `Marked: ${label}. Take the route you chose — I will keep the return open.`;

/** The post-return prompt shown when Io offers the next job. */
export const nextJobPrompt = () => ioNextJobLine();

const RED_TAG_RETURN_LINES = Object.freeze({
  "job-night-transfer": "Night transfer reached Saint Orra. The red tag kept its route, and I kept your name beside it.",
});

/** The second-delivery return acknowledgement, keyed to the job the player tapped. */
export const redTagReturnAcknowledgement = (jobId) =>
  RED_TAG_RETURN_LINES[jobId]
  ?? "The red tag reached Saint Orra. The route kept its promise, and I kept your name beside it.";

/** The second-packet acknowledgement keyed by the player's return reason. */
export const secondPacketAcknowledgement = (input = {}) =>
  selectIoSecondPacketCopyForReturnReason(input);

export const servedIoDialogue = Object.freeze({
  jobAcceptedReceipt,
  nextJobPrompt,
  redTagReturnAcknowledgement,
  secondPacketAcknowledgement,
});

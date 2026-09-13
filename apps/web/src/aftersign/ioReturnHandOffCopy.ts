import type { AftersignPacketOutcome } from "./verticalSliceRuntimeState";

/**
 * Io's hand-off beat: the sentence that turns recognition into a
 * concrete next tap. Rendered on the served surface by
 * `windowGameSurface.ts::getAftersignIoDialogueSnapshot` as
 * `story.ioDialogue.returnHandOff`, alongside the existing packet/
 * route `returnBeat` — a scene renderer paints the prompt as the
 * next-action label the moment Io stops speaking.
 *
 * Keyed off the SAME committed `AftersignPacketOutcome` the return-
 * beat lines read from, so this module cannot drift from what the
 * player actually did.
 */
export type IoReturnHandOff = {
  readonly id: "io-return-handoff";
  readonly speaker: "Io";
  readonly line: string;
  readonly prompt: string;
};

/**
 * Select the hand-off beat for a committed packet outcome.
 * Consumed by `getAftersignIoDialogueSnapshot` so every returning
 * player who reaches the io-return scene sees the prompt.
 */
export function chooseIoReturnHandOffCopy(
  packetOutcome: AftersignPacketOutcome,
): IoReturnHandOff {
  return packetOutcome === "opened"
    ? {
        id: "io-return-handoff",
        speaker: "Io",
        line: "The seal broke. The route did not. Take the dark stair; it has been waiting for someone careless.",
        prompt: "Take the dark stair",
      }
    : {
        id: "io-return-handoff",
        speaker: "Io",
        line: "The seal held. So will the short route, for you. Take it before the bell changes its mind.",
        prompt: "Take the lit stair",
      };
}

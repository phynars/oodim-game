export type IoSecondPacketChoiceId = "accept" | "ask";

/**
 * The line Io speaks after the player taps one of the visible next-job choices.
 * Kept separate from the chooser so a remembered consequence stays concrete.
 */
export const ioSecondPacketResponseVoice: Record<IoSecondPacketChoiceId, string> = {
  accept:
    "Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.",
  ask:
    "The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.",
};

export function getIoSecondPacketResponseVoice(choiceId: string): string {
  return ioSecondPacketResponseVoice[
    choiceId as IoSecondPacketChoiceId
  ] ?? ioSecondPacketResponseVoice.ask;
}

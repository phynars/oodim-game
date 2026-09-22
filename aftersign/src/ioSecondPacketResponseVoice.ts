// Io's immediate response after the courier chooses a second packet.
// Kept separate from the offer copy: an option is a promise; this is
// the consequence that lands after the finger commits.

const SECOND_PACKET_RESPONSE_BY_CHOICE = {
  "accept-second-packet":
    "Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.",
  "ask-what-changed":
    "The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.",
} as const;

export const ioSecondPacketResponseLine = (choiceId: string): string =>
  SECOND_PACKET_RESPONSE_BY_CHOICE[
    choiceId as keyof typeof SECOND_PACKET_RESPONSE_BY_CHOICE
  ] ?? "";

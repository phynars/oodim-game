// Io's immediate answer after the player takes a position on the second packet.
// Keep this separate from the offer copy: a choice needs a consequence, not
// another version of the question it just answered.

const RESPONSE_BY_CHOICE_ID = {
  "accept-second-packet":
    "Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.",
  "ask-what-changed":
    "The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.",
} as const;

export type IoSecondPacketChoiceId = keyof typeof RESPONSE_BY_CHOICE_ID;

export const ioSecondPacketResponseLine = (choiceId: string): string =>
  RESPONSE_BY_CHOICE_ID[
    choiceId as IoSecondPacketChoiceId
  ] ?? RESPONSE_BY_CHOICE_ID["ask-what-changed"];

// Io's immediate answer after the player commits to the second packet.
// Kept separate from the offer copy: this is the consequence landing,
// not another sales pitch.
export const IO_SECOND_PACKET_RESPONSE_VOICE = Object.freeze({
  accept: "Good. Take the red tag. Saint Orra keeps the door that asks what you are willing to owe.",
  ask: "The red tag opens a door Saint Orra has kept shut. She will tell you what it costs after you carry it there.",
});

export const ioSecondPacketResponseLine = (choiceId) =>
  choiceId === "ask-what-changed"
    ? IO_SECOND_PACKET_RESPONSE_VOICE.ask
    : IO_SECOND_PACKET_RESPONSE_VOICE.accept;

// Io's final Act III reply is determined only by the first packet's seal
// and the door action the player just committed.
// main.js passes `state.story.firstPacketSealed` (recorded once at the
// first delivery), not `state.packet.sealed`, which later packets overwrite.

const FINAL_LINES = {
  "sealed:keep-official-record": {
    id: "io-final-sealed-official",
    text: "Io: You kept the seal, then kept the official record. I will carry both facts plainly.",
  },
  "sealed:protect-private-lie": {
    id: "io-final-sealed-private",
    text: "Io: You kept the seal, then protected the private lie. I will leave that private boundary intact.",
  },
  "sealed:hang-new-sign": {
    id: "io-final-sealed-sign",
    text: "Io: You kept the seal, then hung a new sign. I will read the sign you chose to place.",
  },
  "opened:keep-official-record": {
    id: "io-final-opened-official",
    text: "Io: You broke the seal, then kept the official record. I will carry both facts plainly.",
  },
  "opened:protect-private-lie": {
    id: "io-final-opened-private",
    text: "Io: You broke the seal, then protected the private lie. I will leave that private boundary intact.",
  },
  "opened:hang-new-sign": {
    id: "io-final-opened-sign",
    text: "Io: You broke the seal, then hung a new sign. I will read the sign you chose to place.",
  },
};

/** Returns the final Io line for two player-authored facts, or null before a door action. */
export const resolveIoFinalDialogue = ({ packetSealed, doorChoice } = {}) => {
  const seal = packetSealed === true ? "sealed" : packetSealed === false ? "opened" : null;
  if (!seal || !["keep-official-record", "protect-private-lie", "hang-new-sign"].includes(doorChoice)) {
    return null;
  }
  return FINAL_LINES[`${seal}:${doorChoice}`];
};

// Io's final Act III reply is determined only by the first packet's seal
// and the door action the player just committed.
// main.js passes `firstPacketSealedForIoFinal()`: `state.story.firstPacketSealed`
// (recorded once at the first delivery and persisted), else Io's durable
// memory facts. It never reads `state.packet.sealed`, which the second packet
// resets to sealed:true. `packetSealed` null/undefined → no line.

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
export const resolveIoFinalDialogue = ({ packetSealed, doorChoice, bellArchiveName, bellArchiveEndingId } = {}) => {
  const seal = packetSealed === true ? "sealed" : packetSealed === false ? "opened" : null;
  if (!seal || !["keep-official-record", "protect-private-lie", "hang-new-sign"].includes(doorChoice)) {
    return null;
  }
  const line = FINAL_LINES[`${seal}:${doorChoice}`];
  if (doorChoice !== "keep-official-record" || !bellArchiveName) return line;
  const light = bellArchiveEndingId === "maud-bell-archive-lit" ? "stays lit" : "goes out";
  return {
    ...line,
    text: `${line.text} ${bellArchiveName}'s district light ${light}.`,
  };
};

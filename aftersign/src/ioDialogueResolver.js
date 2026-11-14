/**
 * Resolves Io's non-terminal dialogue from an explicit state snapshot and
 * injected copy lookups. DOM ending cards remain owned by main.js.
 */
export const resolveIoDialogue = ({
  beat,
  packet,
  player,
  npcs,
  deliveryId,
  redTagAccepted,
  returningBootLine,
  returningBootBeat,
  secondPacketResponseLine,
  breakMode,
  defaultOfferLine,
  routeOutcomeLine,
  deliveryCompleteLine,
  continueBeats,
  memoryResponseLines,
  memoryRecallLine,
  nextJobPrompt,
  secondPacketAcknowledgement,
  recognitionDialogue,
  offerLine,
  jobOffers,
  offersMemory,
}) => {
  if (returningBootLine !== null && returningBootBeat !== null && beat === returningBootBeat) {
    return returningBootLine;
  }
  if (beat === "packet-choice") {
    return packet.sealed
      ? "Good. Some doors only open for people who can carry a secret without looking inside."
      : "You opened it. The route still glows, but now the city knows curiosity got there first.";
  }
  if (beat === "packet-delivered") {
    const routeMemory = player.routeRisk;
    if (routeMemory?.succeeded) {
      const line = routeOutcomeLine(routeMemory.lastRoute, routeMemory.lastAction);
      if (line) return line;
    }
    return deliveryCompleteLine(deliveryId);
  }
  if (beat === "return-tone-choice") return continueBeats(player.returnReason ?? "evasive")[0].line;
  if (beat === "io-next-job") {
    if (secondPacketResponseLine) return secondPacketResponseLine;
    const reflection = memoryResponseLines({ playerFlags: player.flags, npcMemoryFacts: npcs.io.memory })
      .map((entry) => entry.text).join(" ");
    const recall = memoryRecallLine(packet.sealed ? "packet-sealed" : "packet-opened");
    const acknowledgement = secondPacketAcknowledgement({
      returnReason: player.returnReason,
      playerName: player.name,
    }).lines.join(" ");
    return [reflection, recall, nextJobPrompt(), acknowledgement].filter(Boolean).join(" ");
  }
  if (beat === "io-return-recognition") {
    if (deliveryId === "red-tag" && redTagAccepted === true) return "I remember you: red tag delivered to Saint Orra. The pharmacy sign kept the route; I kept your name beside it.";
    const contaminated = breakMode === "orra-io-contamination"
      && Array.isArray(npcs.orra?.memory) && npcs.orra.memory.length > 0;
    const packetSealed = breakMode === "wrong-io-line" || contaminated ? !packet.sealed : packet.sealed;
    return recognitionDialogue({ playerId: player.id, packetSealed, memory: npcs.io.memory }).line;
  }
  if (beat === "packet-offered") {
    return offerLine(npcs.io.memory, jobOffers(offersMemory(npcs.io.memory)), player.returnReason);
  }
  return defaultOfferLine;
};

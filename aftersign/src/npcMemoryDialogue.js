import {
  NPC_MEMORY_FACT_ID,
  PLAYER_MEMORY_FLAG,
  isKnownNpcMemoryFact,
} from "./npcMemoryFlagSchema.js";

const IO_LINES = Object.freeze({
  firstMeeting: Object.freeze({
    id: "io-memory-first-meeting",
    speaker: "Io",
    text: "You came back before I knew your name. That counts for something.",
  }),
  remembersSealedPacket: Object.freeze({
    id: "io-memory-blue-packet-sealed",
    speaker: "Io",
    text: "Last time, you kept the blue packet sealed. I noticed the restraint.",
  }),
  remembersOpenedPacket: Object.freeze({
    id: "io-memory-blue-packet-opened",
    speaker: "Io",
    text: "Last time, you opened the blue packet. Curiosity leaves a bright mark.",
  }),
  remembersSecondActionDone: Object.freeze({
    id: "io-memory-kiosk-second-action-done",
    speaker: "Io",
    text: "And you checked the kiosk twice. Most couriers pretend the second signal is static.",
  }),
  remembersSecondActionSkipped: Object.freeze({
    id: "io-memory-kiosk-second-action-skipped",
    speaker: "Io",
    text: "You skipped the second kiosk ping. Sometimes speed is just another kind of answer.",
  }),
  remembersNoDurableFact: Object.freeze({
    id: "io-memory-intro-seen-no-fact",
    speaker: "Io",
    text: "I remember your face. The rest is still noise, but the face held.",
  }),
});

const hasPlayerFlag = (playerFlags, flag) => {
  if (!playerFlags || typeof playerFlags !== "object") {
    return false;
  }

  return playerFlags[flag] === true;
};

const knownFactIds = (facts) => {
  if (!Array.isArray(facts)) {
    return new Set();
  }

  return new Set(
    facts
      .filter(isKnownNpcMemoryFact)
      .map((fact) => fact.id),
  );
};

export const ioMemoryResponseLinesFor = ({ playerFlags = {}, npcMemoryFacts = [] } = {}) => {
  const lines = [];
  const facts = knownFactIds(npcMemoryFacts);
  const hasIntro = hasPlayerFlag(playerFlags, PLAYER_MEMORY_FLAG.IO_INTRO_SEEN);

  if (!hasIntro) {
    return [IO_LINES.firstMeeting];
  }

  if (facts.has(NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_SEALED)) {
    lines.push(IO_LINES.remembersSealedPacket);
  } else if (facts.has(NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_OPENED)) {
    lines.push(IO_LINES.remembersOpenedPacket);
  }

  if (facts.has(NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_DONE)) {
    lines.push(IO_LINES.remembersSecondActionDone);
  } else if (facts.has(NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_SKIPPED)) {
    lines.push(IO_LINES.remembersSecondActionSkipped);
  }

  if (lines.length === 0) {
    lines.push(IO_LINES.remembersNoDurableFact);
  }

  return lines;
};

export const IO_MEMORY_RESPONSE_LINES = IO_LINES;

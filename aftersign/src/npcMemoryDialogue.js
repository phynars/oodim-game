import {
  NPC_MEMORY_FACT_ID,
  PLAYER_MEMORY_FLAG,
  isKnownNpcMemoryFact,
} from "./npcMemoryFlagSchema.js";

const IO_LINES = Object.freeze({
  firstMeeting: Object.freeze({
    id: "io-memory-first-meeting",
    speaker: "Io",
    text: "You came back before I had a name for you. That matters.",
  }),
  remembersSealedPacket: Object.freeze({
    id: "io-memory-blue-packet-sealed",
    speaker: "Io",
    text: "You kept the blue packet sealed. The city remembers closed hands.",
  }),
  remembersOpenedPacket: Object.freeze({
    id: "io-memory-blue-packet-opened",
    speaker: "Io",
    text: "You opened the blue packet. Curiosity leaves fingerprints in the dark.",
  }),
  remembersSecondActionDone: Object.freeze({
    id: "io-memory-kiosk-second-action-done",
    speaker: "Io",
    text: "You acknowledged the route. Most couriers let the second signal die.",
  }),
  remembersSecondActionSkipped: Object.freeze({
    id: "io-memory-kiosk-second-action-skipped",
    speaker: "Io",
    text: "You skipped the route acknowledgment. Speed has a voice too.",
  }),
  remembersNoDurableFact: Object.freeze({
    id: "io-memory-intro-seen-no-fact",
    speaker: "Io",
    text: "I remember your face. The rest is static, but the face stayed.",
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

// ---------------------------------------------------------------------------
// Contract runner — mirrors the `runIoReturnMemoryBeatChecks()` shape in
// `ioReturnMemoryBeat.ts` so this module becomes a live CI surface, not just
// exported strings. The pure Playwright spec at
// `aftersign/e2e/npc-memory-dialogue-contract.spec.ts` invokes this on every
// run, so any drift — missing branch, mis-keyed fact id, malformed-input
// leak — fails the same lane that gates the shipped Io voice contract.
// ---------------------------------------------------------------------------

const factOf = (kind, predicate, object, id) =>
  Object.freeze({ kind, predicate, object, id });

const IO_SEALED_FACT = factOf(
  "delivery-outcome",
  "delivered-blue-packet",
  "sealed",
  NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_SEALED,
);
const IO_OPENED_FACT = factOf(
  "delivery-outcome",
  "delivered-blue-packet",
  "opened",
  NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_OPENED,
);
const IO_KIOSK_DONE_FACT = factOf(
  "route-attention",
  "kiosk-second-action",
  "done",
  NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_DONE,
);
const IO_KIOSK_SKIPPED_FACT = factOf(
  "route-attention",
  "kiosk-second-action",
  "skipped",
  NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_SKIPPED,
);

const introFlags = () => ({ [PLAYER_MEMORY_FLAG.IO_INTRO_SEEN]: true });

const expect = (cond, hint) => {
  if (!cond) {
    throw new Error(`npcMemoryDialogue contract: ${hint}`);
  }
};

const lineIds = (lines) => lines.map((line) => line.id);

const runFirstMeetingCase = () => {
  const lines = ioMemoryResponseLinesFor({ playerFlags: {}, npcMemoryFacts: [] });
  expect(lines.length === 1, "first meeting must emit exactly one line");
  expect(
    lines[0].id === IO_LINES.firstMeeting.id,
    `first meeting must be ${IO_LINES.firstMeeting.id}, got ${lines[0].id}`,
  );
  expect(lines[0].speaker === "Io", "first meeting speaker must be Io");
};

const runIntroSeenNoFactsCase = () => {
  const lines = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: [],
  });
  expect(
    lines.length === 1 && lines[0].id === IO_LINES.remembersNoDurableFact.id,
    "intro-seen with no durable facts must fall back to the no-fact line",
  );
};

const runPacketSealedCase = () => {
  const lines = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: [IO_SEALED_FACT],
  });
  expect(
    lineIds(lines).includes(IO_LINES.remembersSealedPacket.id),
    "sealed-packet fact must surface the sealed-memory line",
  );
  expect(
    !lineIds(lines).includes(IO_LINES.remembersOpenedPacket.id),
    "sealed-packet fact must not co-emit the opened-memory line",
  );
};

const runPacketOpenedKioskDoneCase = () => {
  const lines = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: [IO_OPENED_FACT, IO_KIOSK_DONE_FACT],
  });
  const ids = lineIds(lines);
  expect(
    ids.includes(IO_LINES.remembersOpenedPacket.id),
    "opened+done must include the opened-memory line",
  );
  expect(
    ids.includes(IO_LINES.remembersSecondActionDone.id),
    "opened+done must include the kiosk-done memory line",
  );
  expect(
    !ids.includes(IO_LINES.remembersNoDurableFact.id),
    "opened+done must not fall back to the no-fact line when durable facts exist",
  );
};

const runPacketSealedKioskSkippedCase = () => {
  const lines = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: [IO_SEALED_FACT, IO_KIOSK_SKIPPED_FACT],
  });
  const ids = lineIds(lines);
  expect(
    ids.includes(IO_LINES.remembersSealedPacket.id)
      && ids.includes(IO_LINES.remembersSecondActionSkipped.id),
    "sealed+skipped must include both memory lines",
  );
};

const runSecondActionVocabularyCase = () => {
  const done = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: [IO_KIOSK_DONE_FACT],
  });
  const skipped = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: [IO_KIOSK_SKIPPED_FACT],
  });
  const doneLine = done.find((entry) => entry.id === IO_LINES.remembersSecondActionDone.id);
  const skippedLine = skipped.find((entry) => entry.id === IO_LINES.remembersSecondActionSkipped.id);

  // The served button labels are "Acknowledge route" and "Skip
  // acknowledgment". Keep their player-facing nouns in the memory lines
  // so Io names an action the player can recognize.
  expect(
    /route/i.test(doneLine?.text ?? ""),
    "acknowledge-kiosk memory must share the visible Acknowledge route noun",
  );
  expect(
    /acknowledg/i.test(skippedLine?.text ?? "") && /route/i.test(skippedLine?.text ?? ""),
    "skip-kiosk-acknowledge memory must share the visible Skip acknowledgment route vocabulary",
  );
};

const runMalformedFactsIgnoredCase = () => {
  const junk = [
    null,
    undefined,
    { id: "io-remembers-blue-packet-sealed" },
    { kind: "delivery-outcome", object: "sealed" },
    {
      kind: "delivery-outcome",
      predicate: "delivered-blue-packet",
      object: "sealed",
      id: "io-remembers-blue-packet-undefined",
    },
    {
      kind: "delivery-outcome",
      predicate: "kiosk-second-action",
      object: "sealed",
      id: NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_SEALED,
    },
  ];
  const lines = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: junk,
  });
  expect(
    lines.length === 1 && lines[0].id === IO_LINES.remembersNoDurableFact.id,
    "malformed facts must be treated as no-durable-facts, not leak through",
  );
};

const runDefensiveInputsCase = () => {
  const empty = ioMemoryResponseLinesFor();
  expect(
    empty.length === 1 && empty[0].id === IO_LINES.firstMeeting.id,
    "no-args must be treated as first meeting",
  );

  const bogusFacts = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: "not-an-array",
  });
  expect(
    bogusFacts.length === 1 && bogusFacts[0].id === IO_LINES.remembersNoDurableFact.id,
    "non-array facts must be treated as no-durable-facts",
  );

  const bogusFlags = ioMemoryResponseLinesFor({
    playerFlags: "nope",
    npcMemoryFacts: [],
  });
  expect(
    bogusFlags.length === 1 && bogusFlags[0].id === IO_LINES.firstMeeting.id,
    "non-object playerFlags must be treated as no intro flag",
  );
};

const runFactIdCoverageCase = () => {
  const lineIdList = Object.values(IO_LINES).map((line) => line.id);
  for (const factId of Object.values(NPC_MEMORY_FACT_ID)) {
    const tail = factId.replace(/^io-remembers-/, "");
    const covered = lineIdList.some((lineId) => lineId.endsWith(tail));
    expect(
      covered,
      `no IO_LINES entry covers fact id ${factId} (tail=${tail}) — schema grew, dialogue did not`,
    );
  }
};

export const runIoMemoryResponseChecks = () => {
  runFirstMeetingCase();
  runIntroSeenNoFactsCase();
  runPacketSealedCase();
  runPacketOpenedKioskDoneCase();
  runPacketSealedKioskSkippedCase();
  runSecondActionVocabularyCase();
  runMalformedFactsIgnoredCase();
  runDefensiveInputsCase();
  runFactIdCoverageCase();
};

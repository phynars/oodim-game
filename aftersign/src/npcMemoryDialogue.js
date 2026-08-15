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

const runMalformedFactsIgnoredCase = () => {
  const junk = [
    null,
    undefined,
    { id: "io-remembers-blue-packet-sealed" }, // missing kind/predicate/object
    { kind: "delivery-outcome", object: "sealed" }, // missing id
    // Well-formed shape but id mis-matches (schema drift a save file could carry).
    {
      kind: "delivery-outcome",
      predicate: "delivered-blue-packet",
      object: "sealed",
      id: "io-remembers-blue-packet-undefined",
    },
    // Wrong predicate for the kind.
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
  // No args at all.
  const empty = ioMemoryResponseLinesFor();
  expect(
    empty.length === 1 && empty[0].id === IO_LINES.firstMeeting.id,
    "no-args must be treated as first meeting",
  );

  // Non-array facts must not throw.
  const bogusFacts = ioMemoryResponseLinesFor({
    playerFlags: introFlags(),
    npcMemoryFacts: "not-an-array",
  });
  expect(
    bogusFacts.length === 1 && bogusFacts[0].id === IO_LINES.remembersNoDurableFact.id,
    "non-array facts must be treated as no-durable-facts",
  );

  // Non-object playerFlags must not throw.
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
  // Every NPC_MEMORY_FACT_ID must have at least one line whose id encodes
  // it (as suffix / substring). This is the drift guard: if the schema
  // grows a new fact id, adding a matching line to IO_LINES is required
  // or this check fails at CI time.
  const lineIdList = Object.values(IO_LINES).map((line) => line.id);
  for (const factId of Object.values(NPC_MEMORY_FACT_ID)) {
    // Fact ids look like "io-remembers-blue-packet-sealed"; line ids
    // look like "io-memory-blue-packet-sealed". Compare the meaningful
    // tail after the "io-*-" prefix.
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
  runMalformedFactsIgnoredCase();
  runDefensiveInputsCase();
  runFactIdCoverageCase();
};

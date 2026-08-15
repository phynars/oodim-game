// AFTERSIGN NPC memory-flag schema.
// Shared by Mara/June lanes so durable memory keys, player flags, and
// dialogue lookups use one vocabulary instead of hand-typed strings.
//
// This file intentionally mirrors the shipped slice's current durable facts:
// - Io delivery outcome fact: kind="delivery-outcome", predicate="delivered-blue-packet"
// - Io route-attention fact: kind="route-attention", predicate="kiosk-second-action"
// - Player intro flag: player.flags.io_intro_seen
// Keep additions narrow: add a key here before dialogue/runtime code branches on it.

export const NPC_MEMORY_FLAG_SCHEMA_VERSION = 1;

export const PLAYER_MEMORY_FLAG = Object.freeze({
  IO_INTRO_SEEN: "io_intro_seen",
});

export const NPC_MEMORY_FACT_KIND = Object.freeze({
  DELIVERY_OUTCOME: "delivery-outcome",
  ROUTE_ATTENTION: "route-attention",
});

export const NPC_MEMORY_PREDICATE = Object.freeze({
  DELIVERED_BLUE_PACKET: "delivered-blue-packet",
  KIOSK_SECOND_ACTION: "kiosk-second-action",
});

export const NPC_MEMORY_OBJECT = Object.freeze({
  PACKET_SEALED: "sealed",
  PACKET_OPENED: "opened",
  ROUTE_DONE: "done",
  ROUTE_SKIPPED: "skipped",
});

export const NPC_MEMORY_FACT_ID = Object.freeze({
  IO_BLUE_PACKET_SEALED: "io-remembers-blue-packet-sealed",
  IO_BLUE_PACKET_OPENED: "io-remembers-blue-packet-opened",
  IO_KIOSK_SECOND_ACTION_DONE: "io-remembers-kiosk-second-action-done",
  IO_KIOSK_SECOND_ACTION_SKIPPED: "io-remembers-kiosk-second-action-skipped",
});

export const NPC_MEMORY_FLAG_SCHEMA = Object.freeze({
  version: NPC_MEMORY_FLAG_SCHEMA_VERSION,
  playerFlags: PLAYER_MEMORY_FLAG,
  factKinds: NPC_MEMORY_FACT_KIND,
  predicates: NPC_MEMORY_PREDICATE,
  objects: NPC_MEMORY_OBJECT,
  factIds: NPC_MEMORY_FACT_ID,
});

// Pure lookup: (kind, object) -> factId, or null when the pair is not
// a known durable memory-fact shape. Used by BOTH the throwing builder
// below (shipped mint path, where malformed input is a bug we want to
// surface loudly) AND `isKnownNpcMemoryFact` (a predicate over
// UNTRUSTED shapes — must return false, not throw, on bad inputs).
const lookupNpcMemoryFactId = (kind, object) => {
  if (kind === NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME) {
    if (object === NPC_MEMORY_OBJECT.PACKET_SEALED) {
      return NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_SEALED;
    }
    if (object === NPC_MEMORY_OBJECT.PACKET_OPENED) {
      return NPC_MEMORY_FACT_ID.IO_BLUE_PACKET_OPENED;
    }
  }

  if (kind === NPC_MEMORY_FACT_KIND.ROUTE_ATTENTION) {
    if (object === NPC_MEMORY_OBJECT.ROUTE_DONE) {
      return NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_DONE;
    }
    if (object === NPC_MEMORY_OBJECT.ROUTE_SKIPPED) {
      return NPC_MEMORY_FACT_ID.IO_KIOSK_SECOND_ACTION_SKIPPED;
    }
  }

  return null;
};

// Shipped mint path (memoryFacts.js → main.js:deliverPacket) always
// passes a valid (kind, object) pair — outcome is derived from
// `state.packet.sealed ? "sealed" : "opened"` and secondAction from
// `normalizeSecondAction(...)` (done | skipped). Throwing on unknown
// pairs converts silent id drift ("io-remembers-blue-packet-undefined")
// into a runtime error that fails the mint loudly instead of writing
// a malformed fact into durable memory. See PR #1224 review.
export const npcMemoryFactIdFor = ({ kind, object }) => {
  const id = lookupNpcMemoryFactId(kind, object);
  if (id === null) {
    throw new Error(
      `npcMemoryFactIdFor: no fact id for kind=${String(kind)} object=${String(object)} `
      + `(expected DELIVERY_OUTCOME + sealed|opened, or ROUTE_ATTENTION + done|skipped)`,
    );
  }
  return id;
};

export const isKnownNpcMemoryFact = (fact) => {
  if (!fact || typeof fact !== "object") {
    return false;
  }

  // Use the raw lookup — this predicate is a VALIDATOR over untrusted
  // shapes (e.g. a persisted save from an older schema, a hand-built
  // fixture) and must never throw on malformed input.
  const expectedId = lookupNpcMemoryFactId(fact.kind, fact.object);

  if (!expectedId || fact.id !== expectedId) {
    return false;
  }

  if (fact.kind === NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME) {
    return fact.predicate === NPC_MEMORY_PREDICATE.DELIVERED_BLUE_PACKET;
  }

  if (fact.kind === NPC_MEMORY_FACT_KIND.ROUTE_ATTENTION) {
    return fact.predicate === NPC_MEMORY_PREDICATE.KIOSK_SECOND_ACTION;
  }

  return false;
};

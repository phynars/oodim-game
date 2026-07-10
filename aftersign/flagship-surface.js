export const FLAGSHIP_BUILD = Object.freeze({
  slug: "aftersign",
  mode: "test",
});

export const FLAGSHIP_SCENE = Object.freeze({
  id: "io-night-post-kiosk",
  act: "act-1-seal",
});

export const IO_PROFILE = Object.freeze({
  id: "io",
  displayName: "Io Vale",
  present: true,
});

export const DELIVERY_ID = "blue-packet";

export function createEmptyFlagshipSave() {
  return {
    slot: "default",
    revision: 0,
    lastPersistedAt: null,
    dirty: false,
    authority: "server",
    lastLoadProof: {
      source: null,
      revision: null,
      playerId: null,
    },
  };
}

export function deliveryOutcomeForPacket(packet = {}) {
  if (!packet.delivered) return "unknown";
  if (packet.sealed) return "sealed";
  return "opened";
}

export function trustPostureForDeliveryOutcome(outcome) {
  if (outcome === "sealed") return "trusted-seal";
  if (outcome === "opened") return "useful-breach";
  return "untested";
}

export function normalizeFlagshipBeat(beat) {
  if (beat === "io-returning-recognition") return "io-return-recognition";
  if (beat === "packet-kept-sealed" || beat === "packet-opened") return "packet-choice";
  return beat || "packet-offered";
}

export function makeFlagshipPlayer(player = {}) {
  return {
    id: player.id || "local-slice-player",
    name: player.name ?? null,
    flags: {
      ...(player.flags ?? {}),
    },
  };
}

export function makeFlagshipIoSurface(io = {}, outcome = "unknown") {
  const memories = Array.isArray(io.memories)
    ? io.memories
    : Array.isArray(io.memory)
      ? io.memory
      : [];

  return {
    ...IO_PROFILE,
    trustPosture: trustPostureForDeliveryOutcome(outcome),
    memories: memories.map((memory) => ({ ...memory })),
    memory: memories.map((memory) => ({ ...memory })),
    lastLine: io.lastLine ?? null,
    lastLineMemoryRefs: Array.isArray(io.lastLineMemoryRefs)
      ? [...io.lastLineMemoryRefs]
      : [],
  };
}

export function makeFlagshipSurfaceSnapshot({ state, input }) {
  const outcome = deliveryOutcomeForPacket(state.packet);
  const save = {
    ...createEmptyFlagshipSave(),
    ...(state.save ?? {}),
    lastLoadProof: {
      ...createEmptyFlagshipSave().lastLoadProof,
      ...(state.save?.lastLoadProof ?? {}),
    },
  };

  return {
    version: 1,
    build: { ...FLAGSHIP_BUILD },
    slug: state.slug ?? FLAGSHIP_BUILD.slug,
    scene: {
      ...FLAGSHIP_SCENE,
      // Publish the beat VERBATIM. The runtime's beat names
      // (packet-kept-sealed / packet-opened / io-returning-recognition)
      // are load-bearing for every legacy aftersign spec that calls
      // waitForBeat / asserts scene.beat, and they carry information a
      // normalized "packet-choice" loses (sealed vs opened). Migrating
      // to the FlagshipSceneBeat enum names is a later phase that must
      // rename the internal beats AND the legacy specs in one diff —
      // renaming only on the surface splits the two vocabularies and
      // times out every waitForBeat("packet-kept-sealed") in CI.
      beat: state.scene?.beat ?? "packet-offered",
      ready: Boolean(state.scene?.ready ?? true),
    },
    story: JSON.parse(JSON.stringify(state.story ?? {})),
    player: {
      ...makeFlagshipPlayer(state.player),
      x: state.player?.x,
      z: state.player?.z,
      facingRadians: state.player?.facingRadians,
    },
    delivery: {
      id: DELIVERY_ID,
      outcome,
    },
    packet: JSON.parse(JSON.stringify(state.packet ?? {})),
    npcs: {
      io: makeFlagshipIoSurface(state.npcs?.io, outcome),
    },
    save,
    movement: JSON.parse(JSON.stringify(state.movement ?? {})),
    interaction: JSON.parse(JSON.stringify(state.interaction ?? {})),
    input,
  };
}

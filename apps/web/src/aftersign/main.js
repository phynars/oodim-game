// NOTE: This file was added in #1180 to hard-isolate Io returning-session memory
// selection from Orra recognition state.

/**
 * Select Io's returning-session line strictly from Io memory.
 *
 * Contract for #1180:
 * - MUST NOT read Orra memory (`lit` / `spared` / recognition facts)
 * - MUST remain stable after Orra vigil actions
 */
export function selectIoReturningSessionLine(ioMemory) {
  const beatsSeen = Number(ioMemory?.beatsSeen ?? 0);

  if (beatsSeen <= 0) {
    return "io-returning-first";
  }

  if (beatsSeen === 1) {
    return "io-returning-second";
  }

  return "io-returning-repeat";
}

/**
 * Compose runtime lane state while keeping Io and Orra memory separate.
 */
export function buildAftersignRuntimeState({ ioMemory, orraMemory }) {
  return {
    io: {
      returningSessionLine: selectIoReturningSessionLine(ioMemory),
      memory: ioMemory ?? {},
    },
    orra: {
      memory: orraMemory ?? {},
    },
  };
}

export type MemoryBeatKind = 'io_packet_return'

export type MemoryBeatOutcome = 'sealed' | 'opened'

export type IoRecognitionLineId =
  | 'io-recognition-440ms'
  | 'io-recognition-880ms'
  | 'io-recognition-1220ms'

export interface MemoryBeat {
  kind: MemoryBeatKind
  outcome: MemoryBeatOutcome
  startedAt: number
  endedAt: number
  cameraDeltaMeters: number
  cameraYawDegrees: number
  inputLockMs: number
  lineId: IoRecognitionLineId
  sessionId: string
  priorSessionRef: string | null
}

export interface StorySurface {
  currentNpcId: string | null
  memoryBeat: MemoryBeat | null
}

export interface GameSurface {
  version: 1
  story: StorySurface
}

export function createInitialGameSurface(): GameSurface {
  return {
    version: 1,
    story: {
      currentNpcId: null,
      memoryBeat: null,
    },
  }
}

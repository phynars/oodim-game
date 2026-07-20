import {
  chooseIoReturningSessionLine,
  getIoReturningSessionLine,
  type IoPacketOutcome,
  type IoReturnAnswerTone,
  type IoRouteAttention,
  type IoReturningSessionLineKey,
} from '../../../../packages/aftersign/src/ioReturningSession'

export type AftersignIoPacketOutcome = IoPacketOutcome
export type AftersignIoRouteBehavior = IoRouteAttention
export type AftersignIoReturnPosture = IoReturnAnswerTone
export type AftersignIoReturnLineKey = IoReturningSessionLineKey

export type AftersignIoMemoryField =
  | 'packetOutcome'
  | 'routeBehavior'
  | 'returnPosture'

export interface AftersignIoReturnMemory {
  packetOutcome?: AftersignIoPacketOutcome
  routeBehavior?: AftersignIoRouteBehavior
  returnPosture?: AftersignIoReturnPosture
}

export interface AftersignIoReturnLine {
  readonly id: string
  readonly text: string
  readonly requiredMemory: readonly AftersignIoMemoryField[]
}

export const AFTERSIGN_IO_RETURN_LINES = {
  sealedPacket: {
    id: 'io-return-packet-sealed',
    text: getIoReturningSessionLine('sealedPacket'),
    requiredMemory: ['packetOutcome'],
  },
  openedPacket: {
    id: 'io-return-packet-opened',
    text: getIoReturningSessionLine('openedPacket'),
    requiredMemory: ['packetOutcome'],
  },
  skippedRoute: {
    id: 'io-return-route-skipped',
    text: getIoReturningSessionLine('skippedRoute'),
    requiredMemory: ['routeBehavior'],
  },
  listenedRoute: {
    id: 'io-return-route-listened',
    text: getIoReturningSessionLine('listenedRoute'),
    requiredMemory: ['routeBehavior'],
  },
  kindReturn: {
    id: 'io-return-posture-kind',
    text: getIoReturningSessionLine('kindReturn'),
    requiredMemory: ['returnPosture'],
  },
  evasiveReturn: {
    id: 'io-return-posture-evasive',
    text: getIoReturningSessionLine('evasiveReturn'),
    requiredMemory: ['returnPosture'],
  },
  bluntReturn: {
    id: 'io-return-posture-blunt',
    text: getIoReturningSessionLine('bluntReturn'),
    requiredMemory: ['returnPosture'],
  },
} as const satisfies Record<AftersignIoReturnLineKey, AftersignIoReturnLine>

export function chooseAftersignIoReturnLine(
  memory: AftersignIoReturnMemory,
): AftersignIoReturnLine {
  const text = chooseIoReturningSessionLine({
    packetOutcome: memory.packetOutcome,
    routeAttention: memory.routeBehavior,
    returnAnswerTone: memory.returnPosture,
  })

  const match = Object.values(AFTERSIGN_IO_RETURN_LINES).find(
    (line) => line.text === text,
  )

  return match ?? AFTERSIGN_IO_RETURN_LINES.listenedRoute
}

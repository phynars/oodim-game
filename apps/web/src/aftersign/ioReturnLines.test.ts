import {
  AFTERSIGN_IO_RETURN_LINES,
  chooseAftersignIoReturnLine,
} from './ioReturnLines'

describe('Io return lines', () => {
  it('keeps packet outcome as the highest-priority remembered action', () => {
    expect(
      chooseAftersignIoReturnLine({
        packetOutcome: 'sealed',
        routeBehavior: 'skipped',
        returnPosture: 'blunt',
      }),
    ).toBe(AFTERSIGN_IO_RETURN_LINES.sealedPacket)

    expect(
      chooseAftersignIoReturnLine({
        packetOutcome: 'opened',
        routeBehavior: 'listened',
        returnPosture: 'kind',
      }),
    ).toBe(AFTERSIGN_IO_RETURN_LINES.openedPacket)
  })

  it('keeps route lines tethered to route memory when there is no packet outcome', () => {
    expect(
      chooseAftersignIoReturnLine({ routeBehavior: 'skipped' }),
    ).toMatchObject({
      id: 'io-return-route-skipped',
      requiredMemory: ['routeBehavior'],
      text: 'You found the box anyway. Next time, let me finish saving your life.',
    })

    expect(
      chooseAftersignIoReturnLine({ routeBehavior: 'listened' }),
    ).toMatchObject({
      id: 'io-return-route-listened',
      requiredMemory: ['routeBehavior'],
      text: 'You listened before you ran. Rare habit. Keep it.',
    })
  })

  it('keeps return-posture lines tethered to return-posture memory', () => {
    expect(chooseAftersignIoReturnLine({ returnPosture: 'kind' })).toMatchObject({
      id: 'io-return-posture-kind',
      requiredMemory: ['returnPosture'],
    })

    expect(
      chooseAftersignIoReturnLine({ returnPosture: 'evasive' }),
    ).toMatchObject({
      id: 'io-return-posture-evasive',
      requiredMemory: ['returnPosture'],
    })

    expect(
      chooseAftersignIoReturnLine({ returnPosture: 'blunt' }),
    ).toMatchObject({
      id: 'io-return-posture-blunt',
      requiredMemory: ['returnPosture'],
    })
  })

  it('uses the canonical empty-memory fallback', () => {
    expect(chooseAftersignIoReturnLine({})).toBe(
      AFTERSIGN_IO_RETURN_LINES.listenedRoute,
    )
  })
})

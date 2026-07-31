import {
  authoredIoMemorySentence,
  IO_FIRST_MEETING_LINES,
  IO_PACKET_INSPECTION_LINES,
  IO_RETURNING_SESSION_LINES,
  IO_ROUTE_ATTENTION_LINES,
  IO_RETURN_TONE_LINES,
  selectIoReturningLine,
  selectIoReturnToneLine,
  selectIoRouteAttentionLine,
  type IoLine,
} from './io-slice-copy';

function expectLineToRemember(line: IoLine, rememberedKey: string, rememberedValue: unknown) {
  expect(line.remembers).toBe(rememberedKey);
  expect(line.requires).toMatchObject({ [rememberedKey]: rememberedValue });
  expect(line.text.length).toBeGreaterThan(0);
}

describe('Io slice copy', () => {
  it('keeps first-meeting lines short enough for a mobile dialogue card', () => {
    expect(IO_FIRST_MEETING_LINES).toHaveLength(3);

    for (const line of IO_FIRST_MEETING_LINES) {
      expect(line.text.length).toBeLessThanOrEqual(150);
    }
  });

  it('binds packet inspection copy to auditable packet outcomes', () => {
    expectLineToRemember(IO_PACKET_INSPECTION_LINES.sealed, 'packetOutcome', 'sealed');
    expectLineToRemember(IO_PACKET_INSPECTION_LINES.opened, 'packetOutcome', 'opened');
    expectLineToRemember(IO_PACKET_INSPECTION_LINES.withheld, 'packetOutcome', 'withheld');
    expectLineToRemember(IO_PACKET_INSPECTION_LINES.returned, 'packetOutcome', 'returned');
  });

  it('binds route attention copy to auditable route behavior', () => {
    expectLineToRemember(IO_ROUTE_ATTENTION_LINES.listened, 'routeAttention', 'listened');
    expectLineToRemember(IO_ROUTE_ATTENTION_LINES.skipped, 'routeAttention', 'skipped');
  });

  it('binds return-tone copy to auditable answer posture', () => {
    expectLineToRemember(IO_RETURN_TONE_LINES.kind, 'returnTone', 'kind');
    expectLineToRemember(IO_RETURN_TONE_LINES.evasive, 'returnTone', 'evasive');
    expectLineToRemember(IO_RETURN_TONE_LINES.blunt, 'returnTone', 'blunt');
  });

  it('selects returning-session copy only after a later session starts', () => {
    expect(selectIoReturningLine({ packetOutcome: 'sealed' })).toBeUndefined();
    expect(selectIoReturningLine({ packetOutcome: 'opened' })).toBeUndefined();

    expect(selectIoReturningLine({ packetOutcome: 'sealed', returnedAfterClose: true })).toEqual(
      IO_RETURNING_SESSION_LINES.sealed,
    );
    expect(selectIoReturningLine({ packetOutcome: 'opened', returnedAfterClose: true })).toEqual(
      IO_RETURNING_SESSION_LINES.opened,
    );
  });

  it('does not invent returning-session copy for outcomes Io cannot yet greet on', () => {
    expect(selectIoReturningLine({ packetOutcome: 'withheld', returnedAfterClose: true })).toBeUndefined();
    expect(selectIoReturningLine({ packetOutcome: 'returned', returnedAfterClose: true })).toBeUndefined();
  });

  it('selects optional remembered lines only when their memory keys exist', () => {
    expect(selectIoRouteAttentionLine({})).toBeUndefined();
    expect(selectIoReturnToneLine({})).toBeUndefined();

    expect(selectIoRouteAttentionLine({ routeAttention: 'listened' })).toEqual(IO_ROUTE_ATTENTION_LINES.listened);
    expect(selectIoReturnToneLine({ returnTone: 'blunt' })).toEqual(IO_RETURN_TONE_LINES.blunt);
  });

  it('turns packet outcomes into one authored memory sentence for persistence', () => {
    expect(authoredIoMemorySentence({ packetOutcome: 'sealed' })).toBe(
      'You delivered the blue packet with its seal unbroken.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'opened' })).toBe(
      'You opened the blue packet before delivery.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'withheld' })).toBe(
      'You kept the blue packet instead of delivering it.',
    );
    expect(authoredIoMemorySentence({ packetOutcome: 'returned' })).toBe(
      'You brought the blue packet back to Io.',
    );
  });

  it('prefers a persisted authored sentence over deriving a new one', () => {
    expect(
      authoredIoMemorySentence({
        packetOutcome: 'sealed',
        authoredMemorySentence: 'Io filed this exact sentence last session.',
      }),
    ).toBe('Io filed this exact sentence last session.');
  });
});

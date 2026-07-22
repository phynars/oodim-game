import { describe, expect, it } from 'vitest';

import {
  IO_FIRST_RETURN_LINE,
  selectIoReturnMemoryLine,
} from './ioMemoryLines';

// The selector is the single decision point for which Io "you came back"
// line fires when the game boots into a returning session. Fallback order
// (packet outcome → route attention → first-return) is the contract; if it
// drifts, Io either double-remembers or forgets. Lock every branch.
describe('selectIoReturnMemoryLine', () => {
  it('returns the sealed packet line when the packet came back sealed', () => {
    const line = selectIoReturnMemoryLine({ packetOutcome: 'sealed' });
    expect(line.id).toBe('io-return-packet-sealed');
    expect(line.text).toBe(
      'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    );
  });

  it('returns the opened packet line when the seal broke', () => {
    expect(selectIoReturnMemoryLine({ packetOutcome: 'opened' }).id).toBe(
      'io-return-packet-opened',
    );
  });

  it('returns the withheld packet line when the packet did not come back', () => {
    expect(selectIoReturnMemoryLine({ packetOutcome: 'withheld' }).id).toBe(
      'io-return-packet-withheld',
    );
  });

  it('prefers packet outcome over route attention when both are present', () => {
    expect(
      selectIoReturnMemoryLine({
        packetOutcome: 'sealed',
        routeAttention: 'skipped',
      }).id,
    ).toBe('io-return-packet-sealed');
  });

  it('falls through to route attention when the packet outcome is unknown', () => {
    expect(
      selectIoReturnMemoryLine({
        packetOutcome: 'unknown',
        routeAttention: 'listened',
      }).id,
    ).toBe('io-return-route-listened');
  });

  it('returns the skipped-route line when route attention is skipped', () => {
    expect(
      selectIoReturnMemoryLine({ routeAttention: 'skipped' }).id,
    ).toBe('io-return-route-skipped');
  });

  it('falls back to the first-return line when nothing is remembered', () => {
    expect(selectIoReturnMemoryLine({})).toBe(IO_FIRST_RETURN_LINE);
  });

  it('falls back to the first-return line when every signal is unknown', () => {
    expect(
      selectIoReturnMemoryLine({
        packetOutcome: 'unknown',
        routeAttention: 'unknown',
      }),
    ).toBe(IO_FIRST_RETURN_LINE);
  });

  it('keeps every returned line id stable and unique across branches', () => {
    const ids = new Set([
      selectIoReturnMemoryLine({ packetOutcome: 'sealed' }).id,
      selectIoReturnMemoryLine({ packetOutcome: 'opened' }).id,
      selectIoReturnMemoryLine({ packetOutcome: 'withheld' }).id,
      selectIoReturnMemoryLine({ routeAttention: 'listened' }).id,
      selectIoReturnMemoryLine({ routeAttention: 'skipped' }).id,
      selectIoReturnMemoryLine({}).id,
    ]);
    expect(ids.size).toBe(6);
  });
});

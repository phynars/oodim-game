import { describe, expect, it } from 'vitest';

import {
  getIoPacketChoiceLine,
  ioPacketChoiceCopy,
  type IoPacketChoiceCopyKey,
} from './ioPacketChoiceCopy';

describe('ioPacketChoiceCopy', () => {
  it('keeps packet-choice acknowledgement lines short enough for in-game dialogue', () => {
    for (const line of ioPacketChoiceCopy) {
      expect(line.text.length).toBeLessThanOrEqual(78);
    }
  });

  it('exposes each immediate packet-choice outcome exactly once', () => {
    const expected: IoPacketChoiceCopyKey[] = ['sealed', 'opened'];
    const actual = ioPacketChoiceCopy.map((entry) => entry.key);

    expect(actual).toEqual(expected);
  });

  it('returns the locked copy for each packet-choice outcome', () => {
    expect(getIoPacketChoiceLine('sealed')).toBe(
      'Still blue. Still quiet. Good hands are rarer than brave ones.',
    );
    expect(getIoPacketChoiceLine('opened')).toBe(
      'Now the box knows you too. That is not nothing.',
    );
  });

  it('throws on an unknown copy key', () => {
    expect(() =>
      getIoPacketChoiceLine('missing' as IoPacketChoiceCopyKey),
    ).toThrow(/Unknown Io packet-choice copy key/);
  });
});

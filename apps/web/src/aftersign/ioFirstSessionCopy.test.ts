import { describe, expect, it } from 'vitest';

import {
  getIoFirstSessionLine,
  ioFirstSessionCopy,
  type IoFirstSessionCopyKey,
} from './ioFirstSessionCopy';

describe('ioFirstSessionCopy', () => {
  it('keeps the first-session lines short enough for in-game dialogue', () => {
    for (const line of ioFirstSessionCopy) {
      expect(line.text.length).toBeLessThanOrEqual(78);
    }
  });

  it('exposes every documented first-session beat exactly once', () => {
    const expected: IoFirstSessionCopyKey[] = [
      'arrival',
      'packetOffer',
      'routeInstruction',
      'sealedWarning',
      'openedWarning',
    ];
    const actual = ioFirstSessionCopy.map((entry) => entry.key);
    expect(actual).toEqual(expected);
  });

  it('pins the §1 arrival line to the vertical-slice script', () => {
    // Script-locked — docs/flagship/vertical-slice-script.md §1.
    expect(getIoFirstSessionLine('arrival')).toBe(
      'You made it above the water. Good. That is the first qualification.',
    );
  });

  it('does not re-add returning-session copy (single source of truth is ioReturningSession)', () => {
    const keys = ioFirstSessionCopy.map((entry) => entry.key);
    expect(keys).not.toContain('returnSealed' as IoFirstSessionCopyKey);
    expect(keys).not.toContain('returnOpened' as IoFirstSessionCopyKey);
  });

  it('throws on an unknown copy key', () => {
    expect(() =>
      getIoFirstSessionLine('missing' as IoFirstSessionCopyKey),
    ).toThrow(/Unknown Io first-session copy key/);
  });
});

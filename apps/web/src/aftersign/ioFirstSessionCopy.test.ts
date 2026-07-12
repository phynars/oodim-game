import { describe, expect, it } from 'vitest';

import {
  getIoFirstSessionLine,
  ioFirstSessionCopy,
  type IoFirstSessionCopyKey,
} from './ioFirstSessionCopy';

const expectedOrder: IoFirstSessionCopyKey[] = [
  'arrival',
  'packetOffer',
  'routeInstruction',
  'sealedWarning',
  'openedWarning',
  'returnSealed',
  'returnOpened',
];

describe('ioFirstSessionCopy', () => {
  it('keeps the first-session Io beat in authored order', () => {
    expect(ioFirstSessionCopy.map((line) => line.key)).toEqual(expectedOrder);
  });

  it('keeps Io terse enough for an in-scene dialogue surface', () => {
    for (const line of ioFirstSessionCopy) {
      expect(line.text.length).toBeLessThanOrEqual(72);
      expect(line.text.split(/\s+/)).toHaveLengthLessThanOrEqual(12);
    }
  });

  it('avoids explaining the memory system in UI language', () => {
    const forbiddenSystemWords = [
      'memory',
      'remember',
      'persistent',
      'server',
      'session',
      'state',
      'choice',
      'trust +',
    ];
    const joinedCopy = ioFirstSessionCopy.map((line) => line.text).join(' ').toLowerCase();

    for (const word of forbiddenSystemWords) {
      expect(joinedCopy).not.toContain(word);
    }
  });

  it('lets runtime code look up a line by key', () => {
    expect(getIoFirstSessionLine('returnSealed')).toBe(
      'Blue seal intact. Good. Vey needs hands that do not itch.',
    );
  });

  it('makes the return lines reference concrete packet outcomes', () => {
    expect(getIoFirstSessionLine('returnSealed')).toContain('seal intact');
    expect(getIoFirstSessionLine('returnOpened')).toContain('seal broken');
  });
});

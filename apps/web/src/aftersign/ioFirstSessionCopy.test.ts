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
];

describe('ioFirstSessionCopy', () => {
  it('keeps the first-session Io beats in authored order', () => {
    expect(ioFirstSessionCopy.map((line) => line.key)).toEqual(expectedOrder);
  });

  it('keeps Io terse enough for an in-scene dialogue surface', () => {
    for (const line of ioFirstSessionCopy) {
      expect(line.text.length).toBeLessThanOrEqual(72);
      expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(12);
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
    const joinedCopy = ioFirstSessionCopy
      .map((line) => line.text)
      .join(' ')
      .toLowerCase();

    for (const word of forbiddenSystemWords) {
      expect(joinedCopy).not.toContain(word);
    }
  });

  it('lets runtime code look up a line by key', () => {
    expect(getIoFirstSessionLine('arrival')).toBe(
      'You made it above the water. Good. That is the first qualification.',
    );
  });

  it('names the packet outcome each warning refers to', () => {
    expect(getIoFirstSessionLine('sealedWarning')).toContain('stays closed');
    expect(getIoFirstSessionLine('openedWarning')).toContain('opens');
  });

  it('does not duplicate returning-session recognition lines', () => {
    // Returning-player copy is owned by packages/aftersign/src/ioReturningSession.ts
    // (keys sealedPacket / openedPacket). Guard against a regression that
    // re-adds those beats here under return* aliases.
    const keys = new Set<string>(ioFirstSessionCopy.map((line) => line.key));
    expect(keys.has('returnSealed')).toBe(false);
    expect(keys.has('returnOpened')).toBe(false);
  });

  it('throws on an unknown key so a typo cannot silently render empty', () => {
    expect(() =>
      getIoFirstSessionLine('nonsense' as IoFirstSessionCopyKey),
    ).toThrow(/Unknown Io first-session copy key/);
  });
});

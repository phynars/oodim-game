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
  it('keeps the first-session Io beats in authored order', () => {
    expect(ioFirstSessionCopy.map((line) => line.key)).toEqual(expectedOrder);
  });

  it('keeps Io terse enough for an in-scene dialogue surface', () => {
    for (const line of ioFirstSessionCopy) {
      expect(line.text.length).toBeLessThanOrEqual(72);
      expect(line.text.split(/\s+/).length).toBeLessThanOrEqual(12);
    }
  });

  it('avoids explaining the memory system in-world', () => {
    const bannedPhrases = [
      'memory system',
      'persistent',
      'server',
      'durable',
      'save',
      'trust +',
    ];
    const joinedCopy = ioFirstSessionCopy
      .map((line) => line.text)
      .join(' ')
      .toLowerCase();

    for (const phrase of bannedPhrases) {
      expect(joinedCopy).not.toContain(phrase);
    }
  });

  it('anchors the returning memory lines to the packet outcome', () => {
    expect(getIoFirstSessionLine('returnSealed').text).toContain('seal intact');
    expect(getIoFirstSessionLine('returnOpened').text).toContain('seal broken');
  });

  it('returns the requested authored line by key', () => {
    expect(getIoFirstSessionLine('packetOffer').text).toBe(
      'Blue seal. Brass box. No names until it lands.',
    );
  });

  it('throws on an unknown key so a typo cannot silently render empty', () => {
    expect(() =>
      getIoFirstSessionLine('missing' as IoFirstSessionCopyKey),
    ).toThrow('Unknown Io first-session copy key: missing');
  });
});

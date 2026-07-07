import { describe, expect, it } from 'vitest';

import {
  createEmptySave,
  getIoRememberedLine,
  parseSave,
  rememberIoPacketChoice,
  serializeSave,
} from './memory-store';

describe('AFTERSIGN memory store contract', () => {
  it('starts a player with no remembered Io line', () => {
    const save = createEmptySave('player-one');

    expect(save).toMatchObject({
      version: 1,
      playerId: 'player-one',
      routeId: 'kiosk-io-vertical-slice',
      memories: [],
    });
    expect(getIoRememberedLine(save)).toBeNull();
  });

  it('persists Io remembering the blue packet choice across a reload', () => {
    const firstSession = createEmptySave('player-one');
    const remembered = rememberIoPacketChoice(firstSession, 'return_unopened', '2026-07-05T00:00:00.000Z');
    const reloaded = parseSave('player-one', serializeSave(remembered));

    expect(getIoRememberedLine(reloaded)).toBe('You brought the blue packet back unopened.');
    expect(reloaded.memories).toEqual([
      {
        npcId: 'io',
        beatId: 'blue-packet-choice',
        sentence: 'You brought the blue packet back unopened.',
        trust: 'open',
        updatedAt: '2026-07-05T00:00:00.000Z',
      },
    ]);
  });

  it('keeps the memory record singular when the same beat changes', () => {
    const first = rememberIoPacketChoice(createEmptySave('player-one'), 'return_unopened', '2026-07-05T00:00:00.000Z');
    const second = rememberIoPacketChoice(first, 'open_and_read', '2026-07-05T00:05:00.000Z');

    expect(second.memories).toHaveLength(1);
    expect(getIoRememberedLine(second)).toBe('You opened the blue packet before you brought it back.');
    expect(second.memories[0]).toMatchObject({
      npcId: 'io',
      beatId: 'blue-packet-choice',
      trust: 'strained',
    });
  });

  it('falls back to a fresh save when stored data is invalid or belongs to another player', () => {
    expect(parseSave('player-one', '{')).toEqual(createEmptySave('player-one'));
    expect(parseSave('player-one', serializeSave(createEmptySave('player-two')))).toEqual(createEmptySave('player-one'));
  });
});

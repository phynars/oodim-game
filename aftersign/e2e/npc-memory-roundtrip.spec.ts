import { expect, test } from '@playwright/test';

type NpcMemoryRecallContract = {
  slug?: unknown;
  sessionId?: unknown;
  player?: {
    id?: unknown;
    sessionId?: unknown;
  };
  npcMemory?: {
    recalls?: unknown;
  };
};

const priorSession = {
  sessionId: 'soren-prior-session-001',
  playerId: 'soren-player-001',
  npcId: 'io',
  eventId: 'returned-the-lantern',
  summary: 'The player returned Io\'s storm lantern before leaving the quay.',
};

test.describe('AFTERSIGN NPC memory contract', () => {
  test('an NPC references a seeded prior session through window.__game', async ({ page }) => {
    await page.addInitScript((seed) => {
      window.localStorage.setItem('aftersign:test:npc-memory-prior-session', JSON.stringify(seed));
    }, priorSession);

    await page.goto(`/?playerId=${priorSession.playerId}&priorSessionId=${priorSession.sessionId}`);

    await page.waitForFunction(() => Boolean(window.__game), undefined, { timeout: 5_000 });

    const game = await page.evaluate(() => JSON.parse(JSON.stringify(window.__game)) as NpcMemoryRecallContract);

    expect(game.slug).toBe('aftersign');
    expect(game.player?.id).toBe(priorSession.playerId);
    expect(game.sessionId ?? game.player?.sessionId).toEqual(expect.any(String));

    expect(game.npcMemory).toBeTruthy();
    expect(Array.isArray(game.npcMemory?.recalls)).toBe(true);

    const recalls = game.npcMemory?.recalls as Array<Record<string, unknown>>;
    const ioRecall = recalls.find((recall) => {
      const npcMatches = recall.npcId === priorSession.npcId;
      const sessionMatches = recall.priorSessionId === priorSession.sessionId;
      const text = typeof recall.text === 'string' ? recall.text : '';
      return npcMatches && sessionMatches && text.includes('storm lantern');
    });

    expect(ioRecall).toBeTruthy();
    expect(ioRecall).toMatchObject({
      npcId: priorSession.npcId,
      priorSessionId: priorSession.sessionId,
      eventId: priorSession.eventId,
    });
  });
});

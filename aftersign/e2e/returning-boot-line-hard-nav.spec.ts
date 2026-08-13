import { expect, test, type Page } from '@playwright/test';

const COLD_START_MS = 120_000;
const WAIT_MS = 60_000;
const FRESH_HANDOFF_LINE =
  'Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.';
const RETURNING_BEATS = ['packet-delivered', 'io-return-recognition'] as const;

type ReturningBootProbe = {
  version: number;
  scene: {
    beat: string;
  };
  delivery: {
    outcome: string;
  };
  npcs: {
    io: {
      lastLine: string | null;
      memory: Array<{ kind?: string; object?: string; id?: string }>;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    dirty: boolean;
    authority: string;
    lastLoadProof: {
      source: string | null;
      revision: number | null;
      playerId: string | null;
    };
  };
  input: {
    choose: (choiceId: string) => Promise<unknown> | unknown;
    waitForStoryIdle: () => Promise<unknown> | unknown;
    forceSave: () => Promise<unknown> | unknown;
  };
};

type SerializableReturningBootProbe = Omit<ReturningBootProbe, 'input'>;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function readProbe(page: Page): Promise<SerializableReturningBootProbe> {
  await waitForGame(page);
  return page.evaluate(() => {
    const game = window.__game as ReturningBootProbe | undefined;
    if (!game) throw new Error('window.__game was not published');
    const { input: _input, ...serializable } = game;
    return JSON.parse(JSON.stringify(serializable)) as SerializableReturningBootProbe;
  });
}

async function chooseAndWait(page: Page, choiceId: string): Promise<void> {
  await waitForGame(page);
  await page.evaluate(async (id) => {
    const game = window.__game as ReturningBootProbe | undefined;
    if (!game?.input?.choose) throw new Error('window.__game.input.choose is missing');
    await game.input.choose(id);
    await game.input.waitForStoryIdle?.();
  }, choiceId);
}

async function forceSave(page: Page): Promise<void> {
  await waitForGame(page);
  await page.evaluate(async () => {
    const game = window.__game as ReturningBootProbe | undefined;
    if (!game?.input?.forceSave) throw new Error('window.__game.input.forceSave is missing');
    await game.input.forceSave();
    await game.input.waitForStoryIdle?.();
  });
  await page.waitForFunction(() => window.__game?.save?.dirty === false, undefined, {
    timeout: WAIT_MS,
  });
}

test('returning-session boot speaks recognition copy after a hard document navigation', async ({ page }) => {
  test.setTimeout(COLD_START_MS);

  const slot = `returning-boot-hard-nav-${Date.now()}`;
  const url = `/aftersign/?slot=${slot}`;

  await page.goto(url, { waitUntil: 'load' });
  await readProbe(page);

  await chooseAndWait(page, 'keep-sealed');
  await chooseAndWait(page, 'deliver-packet');
  await forceSave(page);

  const saved = await readProbe(page);
  expect(RETURNING_BEATS).toContain(saved.scene.beat as (typeof RETURNING_BEATS)[number]);
  expect(saved.delivery.outcome).toBe('sealed');
  expect(saved.npcs.io.memory.map((fact) => fact.kind)).toContain('delivery-outcome');
  expect(saved.save.authority).toBe('server');

  await page.goto('/aftersign/', { waitUntil: 'load' });
  await page.goto(url, { waitUntil: 'load' });

  const returned = await readProbe(page);
  expect(RETURNING_BEATS).toContain(returned.scene.beat as (typeof RETURNING_BEATS)[number]);
  expect(returned.delivery.outcome).toBe('sealed');
  expect(returned.save.authority).toBe('server');
  expect(returned.npcs.io.memory.map((fact) => fact.kind)).toContain('delivery-outcome');

  expect(returned.npcs.io.lastLine).toEqual(expect.any(String));
  expect(returned.npcs.io.lastLine).not.toBe(FRESH_HANDOFF_LINE);
  expect(returned.npcs.io.lastLine?.toLowerCase()).toContain('seal');
});

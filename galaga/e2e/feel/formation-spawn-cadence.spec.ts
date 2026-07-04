import { expect, test } from "@playwright/test";

type FormationSpawnSample = {
  tick: number;
  waveId: number;
  slotIndex: number;
  x: number;
  y: number;
};

declare global {
  interface Window {
    __galaga?: {
      status: string;
      tick: number;
      enemies: Array<{ id: number; x: number; y: number }>;
    };
  }
}

const WAVE_SIZE = 40;
const EXPECTED_SPAWN_INTERVAL_TICKS = 4;

async function startGalaga(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/galaga/");
  await expect
    .poll(() => page.evaluate(() => window.__galaga?.status ?? "missing"))
    .toBe("ready");
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__galaga?.status ?? "missing"))
    .toBe("playing");
}

async function sampleFirstWaveSpawns(
  page: import("@playwright/test").Page,
): Promise<FormationSpawnSample[]> {
  const samples: FormationSpawnSample[] = [];
  const seen = new Set<number>();

  await expect
    .poll(
      async () => {
        const snapshot = await page.evaluate(() => ({
          tick: window.__galaga?.tick ?? -1,
          enemies: window.__galaga?.enemies ?? [],
        }));

        for (const enemy of snapshot.enemies) {
          if (seen.has(enemy.id)) continue;
          seen.add(enemy.id);
          samples.push({
            tick: snapshot.tick,
            waveId: 1,
            slotIndex: samples.length,
            x: enemy.x,
            y: enemy.y,
          });
        }

        return samples.length;
      },
      { timeout: 10_000 },
    )
    .toBe(WAVE_SIZE);

  return samples;
}

function deltas(samples: FormationSpawnSample[]): number[] {
  return samples.slice(1).map((sample, index) => sample.tick - samples[index].tick);
}

test.describe("Galaga formation spawn cadence", () => {
  test("first formation wave spawns one enemy every 4 fixed ticks", async ({ page }) => {
    await startGalaga(page);

    const samples = await sampleFirstWaveSpawns(page);
    expect(samples).toHaveLength(WAVE_SIZE);

    const cadence = deltas(samples);
    expect(cadence).toHaveLength(WAVE_SIZE - 1);
    expect(cadence).toEqual(
      Array.from({ length: WAVE_SIZE - 1 }, () => EXPECTED_SPAWN_INTERVAL_TICKS),
    );
  });

  test("first formation wave spawn cadence is deterministic across reloads", async ({ page }) => {
    await startGalaga(page);
    const firstRun = await sampleFirstWaveSpawns(page);

    await page.reload();
    await startGalaga(page);
    const secondRun = await sampleFirstWaveSpawns(page);

    expect(secondRun).toEqual(firstRun);
  });
});

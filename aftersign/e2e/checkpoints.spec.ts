// Every committed route fixture is still what its route saves.
//
// For each aftersign/e2e/checkpoints/<name>.json: play the route in a fresh
// player and slot and require the saved state (authoritative save + player
// memory, ids as placeholders, timestamps masked) to equal the fixture's; then
// seed the fixture into another fresh player and slot and require the route's
// last beat on screen. A change to what the route saves fails here, because a
// box run seeded from the old fixture would start from a state the game no
// longer reaches. Fix: re-record by running a spec that uses the route with
//   AFTERSIGN_RECORD_ROUTES=1 npx playwright test <spec> --config aftersign/playwright.config.ts
// and commit the rewritten aftersign/e2e/checkpoints/<name>.json.
// (helpers/route.ts; oodim docs/plan/box-test-time-design.md)
import { expect, test } from "@playwright/test";
import { comparableState, playSteps, readFixture, seedRoute, settledState, stepsHash } from "./helpers/route";
import { USED_ROUTES } from "./helpers/routes";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

test.skip(!!process.env.AFTERSIGN_BASE_URL, "checks the local fixtures; not part of the served replay");

const ids = (tag: string) => {
  const n = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { slot: `cp-${tag}-${n}`, player: `e2e-cp${n}` };
};
const urlFor = (id: { slot: string; player: string }) => `/aftersign/?slot=${id.slot}&player=${id.player}`;

function firstDifference(a: string, b: string): string {
  const x = a.split("\n");
  const y = b.split("\n");
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return `line ${i + 1}: fixture ${JSON.stringify(x[i] ?? null)} vs played ${JSON.stringify(y[i] ?? null)}`;
  }
  return "none";
}

for (const route of USED_ROUTES) {
  const { name } = route;
  test(`route fixture "${name}" is what its route saves`, async ({ browser }) => {
    test.setTimeout(240_000);
    const fixture = readFixture(name);
    test.skip(!fixture, `no committed fixture for "${name}" yet: the box records one on the route's first run`);
    if (!fixture) return;
    expect(fixture.stepsHash, `fixture ${name} was recorded for other steps than helpers/routes.ts now defines: re-record it`).toBe(stepsHash(route.steps));

    const played = await browser.newContext(PHONE);
    const seeded = await browser.newContext(PHONE);
    try {
      const a = await played.newPage();
      const playedId = ids("play");
      await playSteps(a, urlFor(playedId), fixture.steps).catch((err) => {
        throw new Error(`route "${name}" no longer plays through: ${String(err)}. Fix the route in the spec, then re-record the fixture.`);
      });
      const want = comparableState({ save: fixture.save, facts: fixture.facts }, null);
      const got = comparableState(await settledState(a, playedId), playedId);
      if (want !== got) {
        throw new Error(
          `route fixture "${name}" is not what its route saves now (first difference ${firstDifference(want, got)}).\n` +
          `Re-record aftersign/e2e/checkpoints/${name}.json: AFTERSIGN_RECORD_ROUTES=1 npx playwright test <spec using it> --config aftersign/playwright.config.ts`,
        );
      }
      await seedRoute(await seeded.newPage(), urlFor(ids("seed")), fixture);
    } finally {
      await played.close();
      await seeded.close();
    }
  });
}

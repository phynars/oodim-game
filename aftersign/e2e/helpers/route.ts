// Route checkpoints: play the story up to a beat once, then start later runs
// there (oodim docs/plan/box-test-time-design.md, 2026-11-27).
//
// Why: 58 specs replayed the story from the first job to reach the beat they
// test. In the avatar box that replay was 68% of test time (7 days to 11-26);
// one traced Act II test spent 12.8 of 17.2 s on the route and 0.6 s on the
// change it was about.
//
// Two modes, chosen by the environment, never by the spec:
//   PLAY  - CI, the served replay on game.oodim.com (AFTERSIGN_BASE_URL), or
//           AFTERSIGN_FULL_ROUTE=1. Opens the game and taps every step. The
//           merge gate and the live evidence always come from this mode.
//   SEED  - everywhere else (the avatar box, a laptop). Writes the recorded
//           end state of the route into THIS test's own player and slot, the
//           way the client saves (PUT /aftersign/save/<player>/<slot> and
//           POST /player-memory), opens the game, and re-checks the route's
//           trailing beat/see steps so a bad seed fails loudly. With no
//           fixture for the route (or one recorded for other steps) it plays
//           the route and records the fixture, so the next run seeds.
//
// Routes are defined once, in helpers/routes.ts. Fixtures live in
// aftersign/e2e/checkpoints/<route name>.json and are checked by
// checkpoints.spec.ts in CI: it plays each registered route that has a
// fixture and requires the same saved state. Re-record one with
//   AFTERSIGN_RECORD_ROUTES=1 npx playwright test <spec> --config aftersign/playwright.config.ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

const WAIT_MS = 15_000;
const FIXTURE_DIR = fileURLToPath(new URL("../checkpoints/", import.meta.url));
const PLAYER = "{{player}}";
const SLOT = "{{slot}}";

/** A named route: `helpers/routes.ts` holds every one the specs use. */
export type Route = { name: string; steps: RouteStep[] };

/** One step of a route. `tap` waits for the control to be visible, then taps
 *  it; `beat` waits for `[data-beat-id=<id>]`; `see` waits for a selector. */
export type RouteStep = { tap: string } | { beat: string } | { see: string };

export const tap = (selector: string): RouteStep => ({ tap: selector });
export const choice = (id: string): RouteStep => ({ tap: `button[data-choice-id="${id}"]:not([disabled])` });
export const beat = (id: string): RouteStep => ({ beat: id });
export const see = (selector: string): RouteStep => ({ see: selector });

export type RouteMode = "play" | "seed";

export function routeMode(env: NodeJS.ProcessEnv = process.env): RouteMode {
  if (env.CI || env.AFTERSIGN_BASE_URL || env.AFTERSIGN_FULL_ROUTE === "1") return "play";
  return "seed";
}

type Fixture = {
  name: string;
  stepsHash: string;
  steps: RouteStep[];
  save: unknown;
  facts: Record<string, unknown> | null;
};

export const stepsHash = (steps: RouteStep[]): string =>
  createHash("sha256").update(JSON.stringify(steps)).digest("hex").slice(0, 16);

const fixturePath = (name: string): string => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`route name "${name}": use lowercase letters, digits and dashes`);
  return `${FIXTURE_DIR}${name}.json`;
};

export function readFixture(name: string): Fixture | null {
  const path = fixturePath(name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

/** The player and slot a game URL names (`?player=` and `?slot=`). */
export function identityOf(url: string): { player: string; slot: string } {
  const q = new URL(url, "http://x/").searchParams;
  const player = q.get("player");
  const slot = q.get("slot");
  if (!player || !slot) throw new Error(`playRoute needs ?player= and ?slot= in the URL (got ${url})`);
  return { player, slot };
}

const swap = (value: unknown, from: { player: string; slot: string }, to: { player: string; slot: string }): unknown => {
  // Ids appear whole (player.id) and inside other ids (`session-<slot>`).
  const text = JSON.stringify(value);
  return JSON.parse(text.split(from.player).join(to.player).split(from.slot).join(to.slot));
};

/** `inViewport`: each tapped control must be wholly inside the viewport before
 *  its tap, as a phone player needs it with no swipe (applies when played). */
export type PlayOptions = { inViewport?: boolean };

async function runSteps(page: Page, steps: RouteStep[], options: PlayOptions = {}): Promise<void> {
  for (const s of steps) {
    if ("tap" in s) {
      const control = page.locator(s.tap);
      await expect(control, `route step tap ${s.tap}`).toBeVisible({ timeout: WAIT_MS });
      if (options.inViewport) await expect(control, `route step tap ${s.tap} is wholly in view`).toBeInViewport({ ratio: 1 });
      await control.tap();
    } else if ("beat" in s) {
      await expect(page.locator(`[data-beat-id="${s.beat}"]`), `route step beat ${s.beat}`).toBeVisible({ timeout: WAIT_MS });
    } else {
      await expect(page.locator(s.see), `route step see ${s.see}`).toBeVisible({ timeout: WAIT_MS });
    }
  }
}

/** The steps after the last tap: what must be on screen at the route's end. */
const trailingChecks = (steps: RouteStep[]): RouteStep[] => {
  let i = steps.length;
  while (i > 0 && !("tap" in steps[i - 1])) i--;
  return steps.slice(i);
};

async function readSave(page: Page, id: { player: string; slot: string }): Promise<unknown> {
  const r = await page.request.get(`/aftersign/save/${encodeURIComponent(id.player)}/${encodeURIComponent(id.slot)}`);
  if (!r.ok()) return null;
  const body = await r.json();
  return body?.exists === false ? null : body?.payload ?? null;
}

async function readFacts(page: Page, player: string): Promise<Record<string, unknown> | null> {
  const r = await page.request.get(`/player-memory`, { headers: { "x-player-id": player } });
  if (!r.ok()) return null;
  return ((await r.json())?.facts as Record<string, unknown>) ?? null;
}

/** Reads the durable state once two reads 500 ms apart agree, so the route's
 *  last writes have landed. */
export async function settledState(page: Page, id: { player: string; slot: string }) {
  let last = "";
  let state: { save: unknown; facts: Record<string, unknown> | null } = { save: null, facts: null };
  await expect
    .poll(async () => {
      state = { save: await readSave(page, id), facts: await readFacts(page, id.player) };
      const now = JSON.stringify(state);
      const settled = state.save !== null && now === last;
      last = now;
      return settled;
    }, { timeout: 15_000, intervals: [500], message: "route: the save did not settle within 15 s after the last step" })
    .toBe(true);
  return state;
}

const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;

/** The durable state with this test's ids as placeholders and every ISO
 *  timestamp masked: what must be equal between a fixture and a fresh play of
 *  its route. */
export function comparableState(
  state: { save: unknown; facts: unknown },
  id: { player: string; slot: string } | null,
): string {
  const swapped = id ? swap(state, id, { player: PLAYER, slot: SLOT }) : state;
  return JSON.stringify(swapped, null, 1).replace(ISO_TIME, "{{time}}");
}

/** Opens the URL and taps every step; records nothing. */
export async function playSteps(page: Page, url: string, steps: RouteStep[], options: PlayOptions = {}): Promise<void> {
  await page.goto(url, { waitUntil: "load" });
  await runSteps(page, steps, options);
}

/** Plays the route and writes its fixture. */
export async function recordRoute(page: Page, url: string, name: string, steps: RouteStep[]): Promise<void> {
  const id = identityOf(url);
  await page.goto(url, { waitUntil: "load" });
  await runSteps(page, steps);
  const state = await settledState(page, id);
  const placeholders = { player: PLAYER, slot: SLOT };
  const fixture: Fixture = {
    name,
    stepsHash: stepsHash(steps),
    steps,
    save: swap(state.save, id, placeholders),
    facts: state.facts ? (swap(state.facts, id, placeholders) as Record<string, unknown>) : null,
  };
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(fixturePath(name), `${JSON.stringify(fixture, null, 1)}\n`);
}

/** Writes a fixture's end state into the URL's player and slot and opens it. */
export async function seedRoute(page: Page, url: string, fixture: Fixture): Promise<void> {
  const id = identityOf(url);
  const from = { player: PLAYER, slot: SLOT };
  const save = swap(fixture.save, from, id);
  const put = await page.request.put(`/aftersign/save/${encodeURIComponent(id.player)}/${encodeURIComponent(id.slot)}`, { data: { payload: save } });
  expect(put.ok(), `route seed: save PUT answered ${put.status()}`).toBe(true);
  if (fixture.facts && Object.keys(fixture.facts).length > 0) {
    const post = await page.request.post(`/player-memory`, { headers: { "x-player-id": id.player }, data: { facts: swap(fixture.facts, from, id) } });
    expect(post.ok(), `route seed: player-memory POST answered ${post.status()}`).toBe(true);
  }
  await page.goto(url, { waitUntil: "load" });
  await runSteps(page, trailingChecks(fixture.steps));
}

/**
 * Opens `url` (which names `?player=` and `?slot=`) and brings the game to the
 * end of the route: tapped in PLAY mode, seeded from the route's fixture in
 * SEED mode. Every route ends with a `beat` or `see` of where it lands;
 * seeding re-checks it. Returns what ran.
 */
export async function playRoute(page: Page, url: string, route: Route, options: PlayOptions = {}): Promise<"played" | "seeded" | "recorded"> {
  const { name, steps } = route;
  if (trailingChecks(steps).length === 0) throw new Error(`route "${name}": end the steps with a beat() or see() of where it lands`);
  if (routeMode() === "play" && process.env.AFTERSIGN_RECORD_ROUTES !== "1") {
    await playSteps(page, url, steps, options);
    return "played";
  }
  const fixture = readFixture(name);
  if (fixture && fixture.stepsHash === stepsHash(steps) && process.env.AFTERSIGN_RECORD_ROUTES !== "1") {
    await seedRoute(page, url, fixture);
    return "seeded";
  }
  await recordRoute(page, url, name, steps);
  return "recorded";
}

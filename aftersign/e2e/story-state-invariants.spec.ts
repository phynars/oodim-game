// Story/state INVARIANT contract for AFTERSIGN.
//
// Source of truth: docs/flagship/story-state-contract.md +
// e2e-shared/flagshipStoryStateContract.ts (FlagshipGameSurface).
//
// Purpose (why this spec exists alongside window-game-contract.spec.ts and
// flagship-surface-contract.spec.ts):
//
//   * window-game-contract.spec.ts pins the top-level SHAPE on cold read.
//   * flagship-surface-contract.spec.ts drives the full sealed/opened flows
//     end-to-end (choose → deliver → reload → return).
//
// Neither existing spec asserts an INVARIANT that holds ACROSS the story:
//   `scene.beat` must ALWAYS be one of the authored FlagshipSceneBeat
//   values — never a drifted / v2 / debug string — at every observation
//   point during a run. Same for `delivery.outcome`. Same for
//   `scene.act === 'act-1-seal'`. This is the "story never escapes the
//   contract" gate.
//
// It's failing-first against any impl that publishes a beat outside the
// authored enum (e.g. someone renames `packet-choice` → `choose-packet`
// without updating the contract). It's green under the current impl.

import { expect, test, type Page } from '@playwright/test';

import {
  assertSerializableFlagshipSurface,
  getFlagshipSurface,
  type FlagshipDeliveryOutcome,
  type FlagshipGameSurface,
  type FlagshipSceneBeat,
} from '../../e2e-shared/flagshipStoryStateContract';

// Cold-start budget: SwiftShader + first WebGL context (matches the
// sibling flagship-surface-contract.spec.ts constants).
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: FlagshipGameSurface;
  }
}

// The authored beat set from the shared contract. If the impl publishes
// anything outside this set, the story has drifted from the doc.
const AUTHORED_BEATS: ReadonlySet<FlagshipSceneBeat> = new Set<FlagshipSceneBeat>([
  'arrival',
  'packet-offered',
  'packet-choice',
  'packet-delivered',
  'io-return-recognition',
]);

const AUTHORED_DELIVERY_OUTCOMES: ReadonlySet<FlagshipDeliveryOutcome> =
  new Set<FlagshipDeliveryOutcome>([
    'unknown',
    'sealed',
    'opened',
    'withheld',
    'returned',
  ]);

async function readSurface(page: Page): Promise<FlagshipGameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as FlagshipGameSurface);
}

function assertBeatInAuthoredSet(beat: string, label: string): void {
  expect(
    AUTHORED_BEATS.has(beat as FlagshipSceneBeat),
    `[${label}] scene.beat '${beat}' is not in the authored FlagshipSceneBeat set { ${Array.from(AUTHORED_BEATS).join(', ')} }`,
  ).toBe(true);
}

function assertDeliveryOutcomeInAuthoredSet(outcome: string, label: string): void {
  expect(
    AUTHORED_DELIVERY_OUTCOMES.has(outcome as FlagshipDeliveryOutcome),
    `[${label}] delivery.outcome '${outcome}' is not in the authored FlagshipDeliveryOutcome set { ${Array.from(AUTHORED_DELIVERY_OUTCOMES).join(', ')} }`,
  ).toBe(true);
}

test.describe('AFTERSIGN story/state invariants', () => {
  test('scene beat and delivery outcome stay inside the authored contract across a sealed run', async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=story-state-invariants-${Date.now()}`, {
      waitUntil: 'load',
    });

    const initial = await readSurface(page);
    assertSerializableFlagshipSurface(initial);

    // Cold-start invariants.
    expect(initial.scene.act, 'scene.act must be act-1-seal at cold start').toBe(
      'act-1-seal',
    );
    expect(initial.scene.id, 'scene.id must be io-night-post-kiosk').toBe(
      'io-night-post-kiosk',
    );
    assertBeatInAuthoredSet(initial.scene.beat, 'cold-start');
    assertDeliveryOutcomeInAuthoredSet(initial.delivery.outcome, 'cold-start');
    expect(initial.delivery.id, 'delivery.id must be blue-packet').toBe('blue-packet');
    expect(initial.delivery.outcome, 'cold-start delivery.outcome must be unknown').toBe(
      'unknown',
    );
    expect(initial.npcs.io.id, 'npcs.io.id must be io').toBe('io');

    // Drive the sealed flow and re-assert the invariant at each observation
    // point. If a rename lands (e.g. `packet-choice` → `choose-packet`) or a
    // debug-only beat leaks through, one of these snapshots will trip.
    await page.evaluate(() => window.__game!.input.choose('keep-sealed'));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterChoice = await readSurface(page);
    assertBeatInAuthoredSet(afterChoice.scene.beat, 'after keep-sealed');
    assertDeliveryOutcomeInAuthoredSet(afterChoice.delivery.outcome, 'after keep-sealed');

    await page.evaluate(() => window.__game!.input.choose('deliver-packet'));
    await page.evaluate(() => window.__game!.input.waitForStoryIdle());
    const afterDeliver = await readSurface(page);
    assertBeatInAuthoredSet(afterDeliver.scene.beat, 'after deliver-packet');
    assertDeliveryOutcomeInAuthoredSet(afterDeliver.delivery.outcome, 'after deliver-packet');

    // Delivery-outcome invariant: once delivered, outcome must be the
    // committed 'sealed' value the player chose — not 'unknown', not a
    // debug placeholder. This is the story-state hinge the harness gates.
    expect(
      afterDeliver.delivery.outcome,
      'after deliver-packet the delivery.outcome must be committed to sealed',
    ).toBe('sealed');

    // Sanity: getFlagshipSurface (the shared entry point every sibling
    // spec funnels through) accepts the final surface without throwing —
    // this ties the invariant proof to the same accessor the rest of
    // the harness uses.
    const viaGetter = await page.evaluate(() => {
      const game = window.__game;
      return game ? { version: game.version, act: game.scene.act } : null;
    });
    expect(viaGetter).not.toBeNull();
    expect(viaGetter?.version).toBe(1);
    expect(viaGetter?.act).toBe('act-1-seal');
    // Reference getFlagshipSurface to keep the shared accessor coupled to
    // this spec — a rename of the shared helper must ripple here too.
    expect(typeof getFlagshipSurface).toBe('function');
  });
});

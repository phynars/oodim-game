import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPacketChoiceFeelModel,
  DEFAULT_PACKET_CHOICE_TUNING,
} from '../src/packetChoiceFeel.ts';

test('opening the packet requires a deliberate held choice', () => {
  const choice = createPacketChoiceFeelModel({ holdMs: 420 });

  assert.deepEqual(
    choice.start({
      choice: 'open',
      nowMs: 1000,
      pointerX: 120,
      pointerY: 180,
      axis: 0.7,
    }),
    {
      phase: 'pressing',
      choice: 'open',
      progress: 0,
      elapsedMs: 0,
      travelPx: 0,
      axis: 0.7,
      committedChoice: null,
    },
  );

  const justBeforeCommit = choice.update({
    nowMs: 1419,
    pointerX: 121,
    pointerY: 181,
    axis: 0.7,
  });
  assert.equal(justBeforeCommit.phase, 'pressing');
  assert.equal(justBeforeCommit.progress, 419 / 420);
  assert.equal(justBeforeCommit.committedChoice, null);

  const committed = choice.update({
    nowMs: 1420,
    pointerX: 121,
    pointerY: 181,
    axis: 0.7,
  });
  assert.equal(committed.phase, 'committed');
  assert.equal(committed.progress, 1);
  assert.equal(committed.committedChoice, 'open');
});

test('preserving the seal is also an explicit held choice', () => {
  const choice = createPacketChoiceFeelModel({ holdMs: 420 });

  choice.start({
    choice: 'preserve',
    nowMs: 2000,
    pointerX: 40,
    pointerY: 64,
    axis: -0.8,
  });

  const committed = choice.update({
    nowMs: 2420,
    pointerX: 40,
    pointerY: 64,
    axis: -0.8,
  });

  assert.equal(committed.phase, 'committed');
  assert.equal(committed.progress, 1);
  assert.equal(committed.committedChoice, 'preserve');
});

test('choice cancels when touch drift reads as a stray swipe', () => {
  const choice = createPacketChoiceFeelModel();

  choice.start({
    choice: 'open',
    nowMs: 0,
    pointerX: 100,
    pointerY: 100,
    axis: 0.8,
  });

  const cancelled = choice.update({
    nowMs: DEFAULT_PACKET_CHOICE_TUNING.holdMs,
    pointerX: 100 + DEFAULT_PACKET_CHOICE_TUNING.cancelRadiusPx + 1,
    pointerY: 100,
    axis: 0.8,
  });

  assert.equal(cancelled.phase, 'cancelled');
  assert.equal(cancelled.committedChoice, null);
});

test('choice cancels when the player crosses away from the selected side', () => {
  const choice = createPacketChoiceFeelModel();

  choice.start({
    choice: 'preserve',
    nowMs: 0,
    pointerX: 100,
    pointerY: 100,
    axis: -0.8,
  });

  const cancelled = choice.update({
    nowMs: 200,
    pointerX: 100,
    pointerY: 100,
    axis: 0.1,
  });

  assert.equal(cancelled.phase, 'cancelled');
  assert.equal(cancelled.committedChoice, null);
});

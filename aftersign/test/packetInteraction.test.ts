import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginPacketOpenHold,
  cancelPacketOpenHold,
  createPacketInteractionState,
  getPacketSealStoryValue,
  tickPacketOpenHold,
} from '../src/packetInteraction.ts';

test('packet starts sealed and short holds do not open it', () => {
  const initial = createPacketInteractionState();
  assert.equal(initial.sealState, 'sealed');
  assert.equal(getPacketSealStoryValue(initial), 'sealed');

  const holding = beginPacketOpenHold(initial);
  const afterShortHold = tickPacketOpenHold(holding, 149, 149);
  assert.equal(afterShortHold.sealState, 'opening');
  assert.equal(afterShortHold.strainVisible, false);
  assert.equal(getPacketSealStoryValue(afterShortHold), 'sealed');

  const canceled = cancelPacketOpenHold(afterShortHold);
  assert.equal(canceled.sealState, 'sealed');
  assert.equal(canceled.holdElapsedMs, 0);
  assert.equal(canceled.strainVisible, false);
});

test('wax strain feedback appears before the seal opens', () => {
  const holding = beginPacketOpenHold(createPacketInteractionState());
  const strained = tickPacketOpenHold(holding, 150, 150);

  assert.equal(strained.sealState, 'opening');
  assert.equal(strained.strainVisible, true);
  assert.equal(getPacketSealStoryValue(strained), 'sealed');
});

test('completed hold opens the packet on the same tick that commits story state', () => {
  const holding = beginPacketOpenHold(createPacketInteractionState());
  const committed = tickPacketOpenHold(holding, 750, 9123);

  assert.equal(committed.sealState, 'opened');
  assert.equal(committed.holdElapsedMs, 750);
  assert.equal(committed.strainVisible, true);
  assert.equal(committed.committedAtMs, 9123);
  assert.equal(getPacketSealStoryValue(committed), 'opened');
});

test('opened packet cannot be resealed by canceling or beginning another hold', () => {
  const opened = tickPacketOpenHold(
    beginPacketOpenHold(createPacketInteractionState()),
    750,
    2000,
  );

  assert.equal(beginPacketOpenHold(opened), opened);
  assert.equal(cancelPacketOpenHold(opened), opened);
  assert.equal(getPacketSealStoryValue(opened), 'opened');
});

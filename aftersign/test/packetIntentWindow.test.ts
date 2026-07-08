import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PACKET_INTENT_WINDOW,
  decidePacketOutcome,
} from '../src/feel/packetIntentWindow.ts';

test('short tap under openTapMaxMs opens the packet', () => {
  assert.equal(decidePacketOutcome(0), 'open');
  assert.equal(decidePacketOutcome(120), 'open');
  assert.equal(
    decidePacketOutcome(DEFAULT_PACKET_INTENT_WINDOW.openTapMaxMs),
    'open',
    'boundary at openTapMaxMs is inclusive on the open side',
  );
});

test('sustained hold at or over keepSealedHoldMinMs keeps the packet sealed', () => {
  assert.equal(
    decidePacketOutcome(DEFAULT_PACKET_INTENT_WINDOW.keepSealedHoldMinMs),
    'keep-sealed',
    'boundary at keepSealedHoldMinMs is inclusive on the keep-sealed side',
  );
  assert.equal(decidePacketOutcome(600), 'keep-sealed');
  assert.equal(decidePacketOutcome(5_000), 'keep-sealed');
});

test('deadzone press between thresholds defaults to keep-sealed', () => {
  // 220ms < x < 380ms: hesitant press. False-open erodes trust more than
  // false-sealed, so the tie goes to keep-sealed.
  assert.equal(decidePacketOutcome(221), 'keep-sealed');
  assert.equal(decidePacketOutcome(300), 'keep-sealed');
  assert.equal(decidePacketOutcome(379), 'keep-sealed');
});

test('invalid press durations throw rather than silently mis-branching', () => {
  assert.throws(() => decidePacketOutcome(-1), /Invalid pressDurationMs/);
  assert.throws(
    () => decidePacketOutcome(Number.NaN),
    /Invalid pressDurationMs/,
  );
  assert.throws(
    () => decidePacketOutcome(Number.POSITIVE_INFINITY),
    /Invalid pressDurationMs/,
  );
});

test('non-monotonic window (no deadzone) throws at decision time', () => {
  assert.throws(
    () =>
      decidePacketOutcome(200, { openTapMaxMs: 400, keepSealedHoldMinMs: 300 }),
    /deadzone/,
  );
  assert.throws(
    () =>
      decidePacketOutcome(200, { openTapMaxMs: 300, keepSealedHoldMinMs: 300 }),
    /deadzone/,
    'equal thresholds collapse the deadzone and must be rejected',
  );
});

test('negative window thresholds throw', () => {
  assert.throws(
    () =>
      decidePacketOutcome(100, { openTapMaxMs: -1, keepSealedHoldMinMs: 300 }),
    />= 0/,
  );
  assert.throws(
    () =>
      decidePacketOutcome(100, { openTapMaxMs: 100, keepSealedHoldMinMs: -1 }),
    />= 0/,
  );
});

test('custom monotonic window overrides the default thresholds', () => {
  const tight = { openTapMaxMs: 100, keepSealedHoldMinMs: 150 };
  assert.equal(decidePacketOutcome(50, tight), 'open');
  assert.equal(decidePacketOutcome(120, tight), 'keep-sealed'); // deadzone -> sealed
  assert.equal(decidePacketOutcome(200, tight), 'keep-sealed');
});

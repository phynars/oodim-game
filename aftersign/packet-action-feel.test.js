import assert from 'node:assert/strict';
import { createPacketActionFeel } from './packet-action-feel.js';

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('quick tap previews packet instead of opening or sealing by accident', () => {
  const feel = createPacketActionFeel();

  assert.equal(feel.begin(1, 100, 200, 0).state, 'pressing');
  const result = feel.end(1, 150);

  assert.equal(result.state, 'preview-packet');
  assert.equal(result.action, 'preview');
  assert.ok(result.elapsedMs <= feel.thresholds.tapPreviewMaxMs);
});

test('hold crosses the open threshold before release', () => {
  const feel = createPacketActionFeel();

  feel.begin(1, 100, 200, 0);
  const hold = feel.move(1, 100, 200, 420);
  const release = feel.end(1, 450);

  assert.equal(hold.state, 'open-packet');
  assert.equal(hold.action, 'open');
  assert.equal(hold.progress, 1);
  assert.equal(release.state, 'opened');
  assert.equal(release.action, 'open');
});

test('dragging outside cancel radius cancels packet action', () => {
  const feel = createPacketActionFeel();

  feel.begin(1, 100, 200, 0);
  const cancel = feel.move(1, 119, 200, 120);
  const release = feel.end(1, 150);

  assert.equal(cancel.state, 'cancelled');
  assert.equal(cancel.action, 'cancel');
  assert.equal(release.state, 'cancelled');
  assert.equal(release.action, 'cancel');
});

test('keeping the seal is explicit and immediate', () => {
  const feel = createPacketActionFeel();

  feel.begin(1, 100, 200, 0);
  const result = feel.chooseKeepSealed(90);

  assert.equal(result.state, 'keep-sealed');
  assert.equal(result.action, 'keep-sealed');
  assert.equal(feel.activeGesture, null);
});

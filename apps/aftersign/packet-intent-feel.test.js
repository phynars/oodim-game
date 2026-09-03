import assert from 'node:assert/strict';
import {
  PACKET_INTENT,
  PACKET_PRESS,
  createPacketIntentState,
  movePacketIntent,
  packetIntentProgress,
  packetIntentPulse,
  pressPacketIntent,
  releasePacketIntent,
} from './packet-intent-feel.js';

let state = createPacketIntentState();
state = pressPacketIntent(state, PACKET_INTENT.keepSealed, 7, 10, 10, 1000);
assert.equal(packetIntentProgress(state, 1000 + PACKET_PRESS.holdMs / 2), 0.5);
let result = releasePacketIntent(state, 7, 1000 + PACKET_PRESS.holdMs - 1);
assert.equal(result.committedIntent, null);
assert.equal(result.state.lastReason, 'released-too-fast');

state = createPacketIntentState();
state = pressPacketIntent(state, PACKET_INTENT.openSeal, 9, 20, 20, 2000);
state = movePacketIntent(state, 9, 20 + PACKET_PRESS.dragCancelPx + 1, 20);
assert.equal(state.lastReason, 'cancelled-drag');
result = releasePacketIntent(state, 9, 2000 + PACKET_PRESS.holdMs + 1);
assert.equal(result.committedIntent, null);

state = createPacketIntentState();
state = pressPacketIntent(state, PACKET_INTENT.openSeal, 3, 0, 0, 3000);
result = releasePacketIntent(state, 3, 3000 + PACKET_PRESS.holdMs);
assert.equal(result.committedIntent, PACKET_INTENT.openSeal);
assert.equal(result.state.lastReason, 'committed');
assert.equal(packetIntentPulse(result.state, 3000 + PACKET_PRESS.holdMs), 1);
assert.equal(packetIntentPulse(result.state, 3000 + PACKET_PRESS.holdMs + PACKET_PRESS.commitPulseMs), 0);

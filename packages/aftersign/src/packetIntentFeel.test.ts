import { assertPacketIntentFeel, applyPacketIntent, classifyPacketIntent, DEFAULT_PACKET_INTENT_CONFIG } from './packetIntentFeel';

assertPacketIntentFeel();

const nearMissHold = classifyPacketIntent({
  start: { timeMs: 1_000, x: 40, y: 80 },
  end: { timeMs: 1_000 + DEFAULT_PACKET_INTENT_CONFIG.openHoldMs - 1, x: 40, y: 80 },
});

if (nearMissHold !== 'none') {
  throw new Error(`near-miss hold should not open packet; got ${nearMissHold}`);
}

const preserveDoesNotOpen = applyPacketIntent('sealed', 'preserve');

if (preserveDoesNotOpen !== 'sealed') {
  throw new Error(`preserve intent should keep packet sealed; got ${preserveDoesNotOpen}`);
}

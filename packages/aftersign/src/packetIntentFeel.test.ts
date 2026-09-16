import { strict as assert } from "node:assert";
import {
  applyPacketIntent,
  PACKET_OPEN_HOLD_MIN_MS,
  PACKET_OPEN_MAX_TRAVEL_PX,
  PACKET_PRESERVE_TAP_MAX_MS,
  resolvePacketIntent,
} from "./packetIntentFeel";

assert.equal(
  resolvePacketIntent({ durationMs: PACKET_PRESERVE_TAP_MAX_MS, travelPx: 0 }),
  "preserve",
  "a quick tap preserves the seal",
);
assert.equal(
  resolvePacketIntent({ durationMs: PACKET_OPEN_HOLD_MIN_MS, travelPx: 0 }),
  "open",
  "a stationary hold opens the packet",
);
assert.equal(
  resolvePacketIntent({ durationMs: PACKET_OPEN_HOLD_MIN_MS, travelPx: PACKET_OPEN_MAX_TRAVEL_PX + 1 }),
  "none",
  "camera-travel during a hold cannot open the packet",
);
assert.equal(
  applyPacketIntent(true, "preserve"),
  true,
  "an opened packet cannot be resealed during this run",
);

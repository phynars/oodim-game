import {
  DEFAULT_MOBILE_MOVE_PAD_FEEL,
  checkMobileMovePadFeel,
  normalizeMobileMovePadInput,
  runMobileMovePadChecks,
} from "./mobileMovePad.js";

const assertEqual = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const center = { x: 120, y: 120 };

assertEqual(
  normalizeMobileMovePadInput(center, { x: 123, y: 120 }),
  { x: 0, z: 0, knobX: 0, knobY: 0, magnitude: 0 },
  "dead-zone touch stays neutral",
);

assertEqual(
  normalizeMobileMovePadInput(center, { x: 120 + DEFAULT_MOBILE_MOVE_PAD_FEEL.radiusPx * 2, y: 120 }),
  { x: 1, z: 0, knobX: DEFAULT_MOBILE_MOVE_PAD_FEEL.radiusPx, knobY: 0, magnitude: 1 },
  "right throw clamps to full x",
);

assertEqual(
  normalizeMobileMovePadInput(center, { x: 120, y: 120 - DEFAULT_MOBILE_MOVE_PAD_FEEL.radiusPx * 2 }),
  { x: 0, z: -1, knobX: 0, knobY: -DEFAULT_MOBILE_MOVE_PAD_FEEL.radiusPx, magnitude: 1 },
  "up throw moves forward on the existing z axis",
);

checkMobileMovePadFeel();
runMobileMovePadChecks();

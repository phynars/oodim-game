import { getIoReturnLine, getIoSliceLine, ioVoice } from './io-voice.js';

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

assertEqual(
  getIoReturnLine('sealed'),
  'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  'sealed packet return line',
);

assertEqual(
  getIoReturnLine('opened'),
  'You came back. The seal did not. I can use one of those facts.',
  'opened packet return line',
);

assertEqual(
  getIoReturnLine('withheld'),
  'You came back. I have one fact. Bring me another.',
  'unknown packet return fallback',
);

assertEqual(
  getIoSliceLine('packetOffer'),
  'Blue seal. Silt Stair box. Do not improve the message on the way.',
  'packet offer line',
);

assertEqual(
  getIoSliceLine('routeHint'),
  'Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.',
  'route hint line',
);

assertEqual(
  getIoSliceLine('missing'),
  '',
  'missing slice line fallback',
);

assertEqual(
  ioVoice.greeting,
  'Night Post is closed to excuses. Open to couriers.',
  'voice bundle greeting',
);

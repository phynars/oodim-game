export type IoFirstArrivalLineKey =
  | 'surfaceQualification'
  | 'packetInstruction'
  | 'routeInstruction'
  | 'deliverySuccess'
  | 'deliveryWrongBox'
  | 'openedPacketLedger'
  | 'returnPromise';

export type IoFirstArrivalLine = {
  key: IoFirstArrivalLineKey;
  text: string;
};

export const IO_FIRST_ARRIVAL_LINES: Record<IoFirstArrivalLineKey, IoFirstArrivalLine> = {
  surfaceQualification: {
    key: 'surfaceQualification',
    text: 'You made it above the water. Good. That is the first qualification.',
  },
  packetInstruction: {
    key: 'packetInstruction',
    text: "Blue packet. Sign box with three moths painted on it. Keep the seal closed unless you want me to know you didn't.",
  },
  routeInstruction: {
    key: 'routeInstruction',
    text: 'Left stair, red string, brass bell. If the stair argues with you, trust the bell.',
  },
  deliverySuccess: {
    key: 'deliverySuccess',
    text: 'The bell rang. Good. The city prefers evidence to enthusiasm.',
  },
  deliveryWrongBox: {
    key: 'deliveryWrongBox',
    text: 'No bell. So either the box lied, or you gave it something already spent.',
  },
  openedPacketLedger: {
    key: 'openedPacketLedger',
    text: 'Curiosity is not a crime. It is an invoice.',
  },
  returnPromise: {
    key: 'returnPromise',
    text: 'You come back later. That is where most couriers fail.',
  },
};

export function getIoFirstArrivalLine(key: IoFirstArrivalLineKey): IoFirstArrivalLine {
  return IO_FIRST_ARRIVAL_LINES[key];
}

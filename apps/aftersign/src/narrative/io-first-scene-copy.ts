export type AftersignPacketChoice = 'sealed' | 'opened';
export type AftersignReturnTone = 'kind' | 'evasive' | 'blunt';

export type IoFirstSceneLineId =
  | 'arrival'
  | 'route'
  | 'packetOffer'
  | 'sealedReturn'
  | 'openedReturn'
  | 'listenedReturn'
  | 'skippedReturn';

export interface IoFirstSceneLine {
  readonly id: IoFirstSceneLineId;
  readonly text: string;
  readonly memoryKey?: string;
}

export const IO_FIRST_SCENE_LINES = {
  arrival: {
    id: 'arrival',
    text: 'You made the stairs after dark. Good. Vey still owes you a name.',
  },
  route: {
    id: 'route',
    text: 'Blue lantern, brass gutter, sign box with the moth burned into it. Miss one, and the stair will pretend it never met you.',
    memoryKey: 'listened_to_route',
  },
  packetOffer: {
    id: 'packetOffer',
    text: 'Carry this sealed. Not safe. Sealed. Different words, different jobs.',
  },
  sealedReturn: {
    id: 'sealedReturn',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    memoryKey: 'packet_delivered_sealed',
  },
  openedReturn: {
    id: 'openedReturn',
    text: 'You came back. The seal did not. I can use one of those facts.',
    memoryKey: 'packet_opened',
  },
  listenedReturn: {
    id: 'listenedReturn',
    text: 'You listened before you ran. Rare habit. Keep it.',
    memoryKey: 'listened_to_route',
  },
  skippedReturn: {
    id: 'skippedReturn',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    memoryKey: 'skipped_route',
  },
} as const satisfies Record<IoFirstSceneLineId, IoFirstSceneLine>;

export function getIoPacketReturnLine(choice: AftersignPacketChoice): IoFirstSceneLine {
  return choice === 'sealed' ? IO_FIRST_SCENE_LINES.sealedReturn : IO_FIRST_SCENE_LINES.openedReturn;
}

export function getIoRouteReturnLine(listenedToRoute: boolean): IoFirstSceneLine {
  return listenedToRoute ? IO_FIRST_SCENE_LINES.listenedReturn : IO_FIRST_SCENE_LINES.skippedReturn;
}

export function getIoReturnToneLine(tone: AftersignReturnTone): string {
  switch (tone) {
    case 'kind':
      return 'Kind answer. Expensive, if you mean it.';
    case 'evasive':
      return 'You walked around the answer. Fine. The city has practice with that.';
    case 'blunt':
      return 'Blunt keeps clean books. It does not keep clean hands.';
  }
}

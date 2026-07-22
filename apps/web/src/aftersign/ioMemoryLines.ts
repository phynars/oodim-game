export type IoPacketOutcome = 'sealed' | 'opened' | 'withheld' | 'unknown';

export type IoRouteAttention = 'listened' | 'skipped' | 'unknown';

export interface IoReturnMemoryState {
  packetOutcome?: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
}

export interface IoMemoryLine {
  id: string;
  text: string;
}

const PACKET_RETURN_LINES: Record<Exclude<IoPacketOutcome, 'unknown'>, IoMemoryLine> = {
  sealed: {
    id: 'io-return-packet-sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  opened: {
    id: 'io-return-packet-opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
  },
  withheld: {
    id: 'io-return-packet-withheld',
    text: 'You came back. The packet did not. I can still count one useful habit.',
  },
};

const ROUTE_RETURN_LINES: Record<Exclude<IoRouteAttention, 'unknown'>, IoMemoryLine> = {
  listened: {
    id: 'io-return-route-listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
  },
  skipped: {
    id: 'io-return-route-skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
  },
};

export const IO_FIRST_RETURN_LINE: IoMemoryLine = {
  id: 'io-return-first',
  text: 'You came back. Good. Vey keeps a short list of people who do.',
};

export function selectIoReturnMemoryLine(state: IoReturnMemoryState): IoMemoryLine {
  if (state.packetOutcome && state.packetOutcome !== 'unknown') {
    return PACKET_RETURN_LINES[state.packetOutcome];
  }

  if (state.routeAttention && state.routeAttention !== 'unknown') {
    return ROUTE_RETURN_LINES[state.routeAttention];
  }

  return IO_FIRST_RETURN_LINE;
}

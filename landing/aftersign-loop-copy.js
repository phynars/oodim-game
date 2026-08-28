export const aftersignLoopCopy = {
  firstRun: {
    memoryKey: 'no_packet_outcome',
    offerLine: 'One safe job. One blue seal. Bring both back intact.',
    actions: [
      {
        id: 'carry-blue-packet',
        label: 'Carry the blue packet',
        routeRisk: 'safe',
        ioLine: 'Across the lit stair. No shortcuts on a first debt.',
      },
    ],
  },
  trusted: {
    memoryKey: 'delivered_sealed',
    offerLine: 'You kept the seal once. I can risk giving you a stranger door.',
    actions: [
      {
        id: 'carry-pharmacy-receipt',
        label: 'Carry the pharmacy receipt',
        routeRisk: 'riskier',
        ioLine: 'Saint Orra pays in old names. Do not spend yours.',
      },
      {
        id: 'take-long-lit-stair',
        label: 'Take the long lit stair',
        routeRisk: 'safe',
        ioLine: 'Slower. Cleaner. The stair remembers careful feet.',
      },
    ],
  },
  distrusted: {
    memoryKey: 'opened',
    offerLine: 'The seal opened. So the work narrows.',
    actions: [
      {
        id: 'return-torn-receipt',
        label: 'Return the torn receipt',
        routeRisk: 'restricted',
        ioLine: 'A small errand. Small is what trust becomes when it leaks.',
      },
    ],
  },
};

export function getAftersignLoopCopy(memory = {}) {
  const packetOutcome = memory.packetOutcome ?? memory.lastPacketOutcome;

  if (packetOutcome === 'delivered_sealed') {
    return aftersignLoopCopy.trusted;
  }

  if (packetOutcome === 'opened') {
    return aftersignLoopCopy.distrusted;
  }

  return aftersignLoopCopy.firstRun;
}

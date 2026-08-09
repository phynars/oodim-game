export const IO_RECOGNITION_DIALOGUE = Object.freeze({
  sealed: Object.freeze({
    id: 'io-return-sealed',
    memoryKey: 'first_packet_sealed',
    line: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  }),
  opened: Object.freeze({
    id: 'io-return-opened',
    memoryKey: 'first_packet_opened',
    line: 'You came back. The seal did not. I can use one of those facts.',
  }),
  withheld: Object.freeze({
    id: 'io-return-withheld',
    memoryKey: 'first_packet_withheld',
    line: 'You kept the packet and the silence. One of them was useful.',
  }),
  returned: Object.freeze({
    id: 'io-return-returned',
    memoryKey: 'first_packet_returned',
    line: 'You brought it back. Not failure. Inventory.',
  }),
  unknown: Object.freeze({
    id: 'io-return-unknown',
    memoryKey: 'first_packet_unknown',
    line: 'You came back with fog on your coat and no clean answer. Start there.',
  }),
});

export function selectIoRecognitionDialogue(packetOutcome) {
  switch (packetOutcome) {
    case 'delivered_sealed':
    case 'sealed':
      return IO_RECOGNITION_DIALOGUE.sealed;
    case 'opened':
    case 'delivered_opened':
      return IO_RECOGNITION_DIALOGUE.opened;
    case 'withheld':
      return IO_RECOGNITION_DIALOGUE.withheld;
    case 'returned':
      return IO_RECOGNITION_DIALOGUE.returned;
    default:
      return IO_RECOGNITION_DIALOGUE.unknown;
  }
}

export function getIoRecognitionLine(packetOutcome) {
  return selectIoRecognitionDialogue(packetOutcome).line;
}

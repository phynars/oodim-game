export type IoTrustPosture = 'first_run' | 'trusted' | 'opened_seal' | 'returned';

export type IoJobOfferId =
  | 'blueSealBox'
  | 'orraNameSlip'
  | 'bellArchiveReceipt';

export interface IoJobOfferCopy {
  id: IoJobOfferId;
  label: string;
  line: string;
  prompt: string;
  routeHint: string;
}

export interface IoMemorySnapshot {
  trustPosture?: IoTrustPosture;
  deliveredSealedPacket?: boolean;
  openedPacket?: boolean;
  completedDeliveryIds?: string[];
  lastTone?: 'kind' | 'evasive' | 'blunt';
}

const FIRST_SAFE_JOB: IoJobOfferCopy = {
  id: 'blueSealBox',
  label: 'Take the blue-seal packet',
  line: 'Small errand. Blue seal. Box across the stair. Bring back the truth, not a performance.',
  prompt: 'Carry Io’s sealed packet to the sign box.',
  routeHint: 'Follow the amber route marks down the wet stair.',
};

const TRUSTED_RISK_JOB: IoJobOfferCopy = {
  id: 'orraNameSlip',
  label: 'Carry Orra’s name-slip',
  line: 'You kept the seal once. Saint Orra has a name that bites. I can hand it to you now.',
  prompt: 'Take the name-slip from Saint Orra before the bell changes its mind.',
  routeHint: 'Cut past the pharmacy sign when the lanterns dim.',
};

const OPENED_SEAL_JOB: IoJobOfferCopy = {
  id: 'bellArchiveReceipt',
  label: 'Run the archive receipt',
  line: 'You open what you carry. Fine. The Bell Archive needs someone willing to look guilty.',
  prompt: 'Carry the receipt to the archive hook and answer for the broken wax.',
  routeHint: 'Take the lit stair; the dark cut hears paper tear.',
};

export function getIoJobOffers(memory: IoMemorySnapshot): IoJobOfferCopy[] {
  const completed = new Set(memory.completedDeliveryIds ?? []);

  if (memory.openedPacket || memory.trustPosture === 'opened_seal') {
    return completed.has('bellArchiveReceipt')
      ? [FIRST_SAFE_JOB]
      : [OPENED_SEAL_JOB];
  }

  if (memory.deliveredSealedPacket || memory.trustPosture === 'trusted') {
    return completed.has('orraNameSlip')
      ? [FIRST_SAFE_JOB]
      : [TRUSTED_RISK_JOB];
  }

  return [FIRST_SAFE_JOB];
}

export function getIoReturnLine(memory: IoMemorySnapshot): string {
  if (memory.openedPacket || memory.trustPosture === 'opened_seal') {
    return 'You came back. The seal did not. I can use one of those facts.';
  }

  if (memory.deliveredSealedPacket || memory.trustPosture === 'trusted') {
    return 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.';
  }

  if (memory.lastTone === 'blunt') {
    return 'Still blunt. Useful, if you point it away from the glass.';
  }

  if (memory.lastTone === 'evasive') {
    return 'You dodge questions like puddles. Puddles at least show the sky.';
  }

  if (memory.lastTone === 'kind') {
    return 'Kind answer last time. Do not make a habit of spending yourself cheap.';
  }

  return 'You came back. Good. Vey keeps a ledger for that.';
}

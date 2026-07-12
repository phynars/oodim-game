export type IoPacketOutcome = "sealed" | "opened";

export interface IoFirstSessionCopy {
  arrival: string;
  packetOffer: string;
  routeInstruction: string;
  sealedWarning: string;
  openedWarning: string;
  returnSealed: string;
  returnOpened: string;
}

export const ioFirstSessionCopy: IoFirstSessionCopy = {
  arrival: "You made it above the water. That is not the same as safe.",
  packetOffer: "Blue seal. Brass box. No names until it lands.",
  routeInstruction: "Follow the lanterns that hum. Ignore the ones that know your voice.",
  sealedWarning: "If it stays closed, I learn one thing about you.",
  openedWarning: "If it opens, I learn a different thing.",
  returnSealed: "Blue seal intact. Good. Vey needs hands that do not itch.",
  returnOpened: "Blue seal broken. Curiosity is a tool. So is a knife.",
};

export function getIoReturnLine(outcome: IoPacketOutcome): string {
  return outcome === "sealed"
    ? ioFirstSessionCopy.returnSealed
    : ioFirstSessionCopy.returnOpened;
}

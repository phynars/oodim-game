export type IoReturnHandOff = {
  readonly id: "io-return-handoff";
  readonly speaker: "Io";
  readonly line: string;
  readonly prompt: string;
};

/**
 * The moment after recognition must turn memory into a concrete next action.
 * Kept separately so the rendered route can consume a stable, authored beat.
 */
export function chooseIoReturnHandOffCopy(openedPacket: boolean): IoReturnHandOff {
  return openedPacket
    ? {
        id: "io-return-handoff",
        speaker: "Io",
        line: "The seal broke. The route did not. Take the dark stair; it has been waiting for someone careless.",
        prompt: "Take the dark stair",
      }
    : {
        id: "io-return-handoff",
        speaker: "Io",
        line: "The seal held. So will the short route, for you. Take it before the bell changes its mind.",
        prompt: "Take the lit stair",
      };
}

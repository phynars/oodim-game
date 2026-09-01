export type IoMemoryPosture = "first-run" | "sealed-return" | "opened-return";

export type IoJobOffer = {
  id: "blue-seal-practice" | "orra-name-carry" | "dark-cut-repair";
  label: string;
  line: string;
  routeHint: string;
  actionText: string;
};

const FIRST_RUN_JOB: IoJobOffer = {
  id: "blue-seal-practice",
  label: "Carry the blue seal",
  line: "First run is small. Blue seal to the stair box. Bring back the fact you did not break it.",
  routeHint: "Take the lantern stair. If the bells start counting you, stop moving.",
  actionText: "Take the blue-seal job",
};

const SEALED_RETURN_JOB: IoJobOffer = {
  id: "orra-name-carry",
  label: "Carry Orra's name",
  line: "You kept one seal honest. Orra has a name she wants moved before dawn. That earns a harder route.",
  routeHint: "Old pharmacy sign, two decks down. Do not promise her anything until she says who pays.",
  actionText: "Take Orra's name job",
};

const OPENED_RETURN_JOB: IoJobOffer = {
  id: "dark-cut-repair",
  label: "Repair the dark-cut marker",
  line: "You opened what was not yours. Fine. I have work for people who need to know what a broken sign looks like.",
  routeHint: "Short dark cut, west rope. Mark what changed. Do not improvise a second time.",
  actionText: "Take the dark-cut repair job",
};

export function chooseIoJobOffer(posture: IoMemoryPosture): IoJobOffer {
  if (posture === "sealed-return") {
    return SEALED_RETURN_JOB;
  }

  if (posture === "opened-return") {
    return OPENED_RETURN_JOB;
  }

  return FIRST_RUN_JOB;
}

export const ioJobOfferCopy = {
  firstRun: FIRST_RUN_JOB,
  sealedReturn: SEALED_RETURN_JOB,
  openedReturn: OPENED_RETURN_JOB,
} as const;

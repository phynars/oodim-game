// Every story route a spec starts from, written once (helpers/route.ts says
// how a route is played or seeded). Each route ends with the beat or control
// where it lands, and stops BEFORE the control a test is about: a test that
// checks the Unlit Door choice starts at the door and taps the choice itself.
//
// Add a route here rather than a list of taps in a spec. A new route records
// its fixture (aftersign/e2e/checkpoints/<name>.json) on its first run in the
// box; commit that file with the spec.
import { beat, choice, see, tap, type Route, type RouteStep } from "./route";

export type ReturnReason = "kind" | "evasive" | "blunt";
export type MaudChoice = "remembered-name" | "archive-decoy";
export type DoorChoice = "keep-official-record" | "protect-private-lie" | "hang-new-sign";
export type NikoAnswer = "take" | "refuse";

const firstDelivery = (reason: ReturnReason): RouteStep[] => [
  beat("packet-offered"),
  tap('#offeredJobs button[data-offered-job-id="job-safe-delivery"]'),
  tap("#packetButton"),
  beat("packet-choice"),
  choice("acknowledge-kiosk"),
  choice("deliver-packet"),
  beat("io-return-recognition"),
  tap(`button[data-return-reason="${reason}"]:not([disabled])`),
  beat("return-tone-choice"),
  choice("ask-for-next-job"),
  beat("io-next-job"),
];

const toBellArchive = (reason: ReturnReason, maud: MaudChoice): RouteStep[] => [
  ...firstDelivery(reason),
  choice("accept-second-packet"),
  choice("deliver-packet"),
  beat("packet-offered"),
  tap('#offeredJobs button[data-offered-job-id="job-night-transfer"]'),
  tap("#packetButton"),
  beat("packet-choice"),
  choice("acknowledge-kiosk"),
  choice("deliver-packet"),
  beat("io-return-recognition"),
  tap('button[data-orra-payback-action="carry-name-to-bell-archive"]:not([disabled])'),
  tap(`button[data-maud-name-choice="${maud}"]`),
  see('[data-ending-id^="maud-bell-archive"]'),
];

const toDoorChoices = (reason: ReturnReason, maud: MaudChoice): RouteStep[] => [
  ...toBellArchive(reason, maud),
  choice("open-unlit-door"),
  see('button[data-choice-id="keep-official-record"]:not([disabled])'),
];

const toBeginEpisodeTwo = (reason: ReturnReason, maud: MaudChoice, door: DoorChoice): RouteStep[] => [
  ...toDoorChoices(reason, maud),
  choice(door),
  see("#beginEpisodeTwo"),
];

const toEpisodeTwoJob = (reason: ReturnReason, maud: MaudChoice, door: DoorChoice): RouteStep[] => [
  ...toBeginEpisodeTwo(reason, maud, door),
  tap("#beginEpisodeTwo"),
  tap("#acceptEpisodeTwoJob:not([disabled])"),
  see('button[data-niko-shortcut-choice="take"]'),
];

const toActOneEnd = (reason: ReturnReason, maud: MaudChoice, door: DoorChoice, niko: NikoAnswer): RouteStep[] => [
  ...toEpisodeTwoJob(reason, maud, door),
  tap(`button[data-niko-shortcut-choice="${niko}"]`),
  see('[data-ending-id="episode-two-act-one"]'),
];

/** Episode 1, first delivery returned with `reason`: Io offers the next job. */
export const nextJob = (reason: ReturnReason): Route => ({
  name: `e1-next-job--${reason}`,
  steps: firstDelivery(reason),
});

/** Episode 1, the Unlit Door is open and its three choices are on screen. */
export const doorChoices = (reason: ReturnReason, maud: MaudChoice): Route => ({
  name: `e1-door--${reason}--${maud}`,
  steps: toDoorChoices(reason, maud),
});

/** Episode 1 is over: the Begin Episode 2 control is on screen. */
export const beginEpisodeTwo = (reason: ReturnReason, maud: MaudChoice, door: DoorChoice): Route => ({
  name: `e2-begin--${reason}--${maud}--${door}`,
  steps: toBeginEpisodeTwo(reason, maud, door),
});

/** Episode 2's job is accepted: Niko's shortcut choice is on screen. */
export const episodeTwoJob = (reason: ReturnReason, maud: MaudChoice, door: DoorChoice): Route => ({
  name: `e2-job--${reason}--${maud}--${door}`,
  steps: toEpisodeTwoJob(reason, maud, door),
});

/** Episode 2 Act I is over with Niko answered: its ending card is on screen. */
export const actOneEnd = (reason: ReturnReason, maud: MaudChoice, door: DoorChoice, niko: NikoAnswer): Route => ({
  name: `e2-act-one-end--${reason}--${maud}--${door}--${niko}`,
  steps: toActOneEnd(reason, maud, door, niko),
});

/** The routes the specs use. checkpoints.spec.ts checks each one that has a
 *  committed fixture. Add a route here when a spec starts using it. */
export const USED_ROUTES: Route[] = [
  nextJob("kind"),
  nextJob("evasive"),
  nextJob("blunt"),
  doorChoices("kind", "remembered-name"),
  episodeTwoJob("kind", "remembered-name", "keep-official-record"),
  episodeTwoJob("blunt", "archive-decoy", "keep-official-record"),
];

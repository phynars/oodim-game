// Episode 2 door-decided jobs (#2918, slice of #2917 / M6).
//
// Data layer only: one job per persisted `story.doorChoice` value
// (see runtime/persistence.js `buildPersistPayload().story.doorChoice`).
// main.js renders the job's name and brief at the Night Post via
// `episodeTwoJobForStory(state.story)`; accept/refuse controls and the
// delivery-id handoff land with #2919.

export const DOOR_CHOICES = Object.freeze([
  "keep-official-record",
  "protect-private-lie",
  "hang-new-sign",
]);

export const EPISODE_TWO_JOBS = Object.freeze({
  "keep-official-record": Object.freeze({
    id: "ep2-ledger-run",
    doorChoice: "keep-official-record",
    deliveryId: "ep2-sealed-ledger",
    name: "The Ledger Run",
    brief: "Carry the sealed official record to the Night Post registry before the lamps go out.",
  }),
  "protect-private-lie": Object.freeze({
    id: "ep2-quiet-envelope",
    doorChoice: "protect-private-lie",
    deliveryId: "ep2-unmarked-envelope",
    name: "The Quiet Envelope",
    brief: "Slip an unmarked envelope past the night clerk so the lie you kept stays kept.",
  }),
  "hang-new-sign": Object.freeze({
    id: "ep2-new-sign",
    doorChoice: "hang-new-sign",
    deliveryId: "ep2-fresh-paint-sign",
    name: "The New Sign",
    brief: "Haul the freshly painted sign across the district and hang it where the old one fell.",
  }),
});

export const isDoorChoice = (value) =>
  typeof value === "string" && DOOR_CHOICES.includes(value);

export const episodeTwoJobForDoorChoice = (doorChoice) =>
  isDoorChoice(doorChoice) ? EPISODE_TWO_JOBS[doorChoice] : null;

// Reads the door choice from a live or restored `story` record. Returns
// null when no valid door was chosen, so callers never serve a guessed job.
export const episodeTwoJobForStory = (story) =>
  episodeTwoJobForDoorChoice(story && typeof story === "object" ? story.doorChoice : null);

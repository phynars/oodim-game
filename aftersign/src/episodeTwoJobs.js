// Episode 2 door-decided jobs (#2918, slice of #2917 / M6).
//
// Data layer only: one job per persisted `story.doorChoice` value
// (see runtime/persistence.js `buildPersistPayload().story.doorChoice`).
// No rendering here — the Night Post wiring (#2919) consumes
// `episodeTwoJobForStory(state.story)` to pick the job to serve.

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
    controls: Object.freeze({
      accept: "Carry the sealed ledger",
      refuse: "Leave the ledger on the counter",
    }),
  }),
  "protect-private-lie": Object.freeze({
    id: "ep2-quiet-envelope",
    doorChoice: "protect-private-lie",
    deliveryId: "ep2-unmarked-envelope",
    name: "The Quiet Envelope",
    brief: "Slip an unmarked envelope past the night clerk so the lie you kept stays kept.",
    controls: Object.freeze({
      accept: "Hide the envelope in your coat",
      refuse: "Hand the envelope back",
    }),
  }),
  "hang-new-sign": Object.freeze({
    id: "ep2-new-sign",
    doorChoice: "hang-new-sign",
    deliveryId: "ep2-fresh-paint-sign",
    name: "The New Sign",
    brief: "Haul the freshly painted sign across the district and hang it where the old one fell.",
    controls: Object.freeze({
      accept: "Shoulder the new sign",
      refuse: "Leave the sign to dry",
    }),
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

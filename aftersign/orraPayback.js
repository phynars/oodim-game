const ORRA_PAYBACK_BY_RED_TAG_OUTCOME = Object.freeze({
  intact: Object.freeze({
    actionId: "carry-name-to-bell-archive",
    label: "Carry the name to the Bell Archive",
    endingBeat: "a",
  }),
  opened: Object.freeze({
    actionId: "leave-the-name-with-orra",
    label: "Leave the name with Saint Orra",
    endingBeat: "b",
  }),
  withheld: Object.freeze({
    actionId: "leave-the-name-with-orra",
    label: "Leave the name with Saint Orra",
    endingBeat: "b",
  }),
});

export function orraPaybackForRedTagOutcome(outcome) {
  return ORRA_PAYBACK_BY_RED_TAG_OUTCOME[outcome] ?? ORRA_PAYBACK_BY_RED_TAG_OUTCOME.withheld;
}

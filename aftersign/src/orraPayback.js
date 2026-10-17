export const ORRA_PAYBACK_ACTION = Object.freeze({
  CARRY_NAME: "carry-name-to-bell-archive",
  LEAVE_NAME_WITH_ORRA: "leave-name-with-orra",
});

export const ORRA_PAYBACK_ENDING_BEAT = Object.freeze({
  [ORRA_PAYBACK_ACTION.CARRY_NAME]: "ending-bell-archive",
  [ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA]: "ending-orra-keeps-name",
});

/**
 * The red-tag outcome decides the next action Saint Orra makes available.
 * Only a sealed red tag permits the name to leave with the courier.
 */
export function orraPaybackActionForDelivery(delivery) {
  return delivery?.id === "red-tag" && delivery?.outcome === "sealed"
    ? ORRA_PAYBACK_ACTION.CARRY_NAME
    : ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA;
}

export function orraPaybackLabel(action) {
  return action === ORRA_PAYBACK_ACTION.CARRY_NAME
    ? "Carry the name to the Bell Archive"
    : "Leave the name with Saint Orra";
}

export function orraPaybackEndingBeat(action) {
  return ORRA_PAYBACK_ENDING_BEAT[action] ?? ORRA_PAYBACK_ENDING_BEAT[ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA];
}

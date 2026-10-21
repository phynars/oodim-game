// Job-offer controller: owns the state-level transition a tapped job offer
// commits. The press composes the memory-gated M-LOOP action id with the
// underlying offer id onto `state.interaction.lastAction` (both axes ride
// on one field — the mloop head, the jobId tail; see the comment at the
// former call site in main.js) and increments `confirmCount`. Presentation
// (haptics, audio, FEEL, DOM receipt paragraph) stays at the main.js call
// site — those are rendered effects, not state-level interaction logic.
//
// The host injects:
//   - setLastAction(nextLastAction)  — writes state.interaction.lastAction
//   - incrementConfirmCount()        — advances state.interaction.confirmCount
//   - markStateDirty()               — persistence seam
//   - render()                       — publishState
//   - getState()                     — returns state.interaction (observed by tests)

export const createJobOfferController = ({
  setLastAction,
  incrementConfirmCount,
  markStateDirty,
  render,
  getState,
}) => {
  const press = ({ actionId, offerId }) => {
    setLastAction(`${actionId}:${offerId}`);
    incrementConfirmCount();
    markStateDirty();
    render();
    return getState();
  };

  return Object.freeze({
    input: Object.freeze({ press }),
    getState,
    render,
  });
};

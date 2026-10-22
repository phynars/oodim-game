// Packet-offer controller: owns the press transition and its render boundary.
// The host injects game-state and DOM-specific effects so this controller can
// remain focused on the gesture contract.

export const createPacketOfferController = ({
  playPressFeedback,
  resetTargetLoss,
  resetGestureLog,
  recordGestureSample,
  pressIntent,
  setLastOutcome,
  syncIntent,
  publishState,
  getState,
}) => {
  const render = () => publishState();

  const press = (input) => {
    playPressFeedback();
    resetTargetLoss();
    resetGestureLog();
    recordGestureSample("press", input);
    const snapshot = pressIntent(input);
    setLastOutcome(snapshot.outcome);
    syncIntent(snapshot);
    render();
    return getState();
  };

  return Object.freeze({
    input: Object.freeze({ press }),
    getState,
    render,
  });
};

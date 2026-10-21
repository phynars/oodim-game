// Job-offer controller: owns the rendered offer-press boundary.
// State and presentation remain host-injected so persistence and story copy
// stay outside this interaction boundary.

export const createJobOfferController = ({ getState, render }) => {
  const press = (onPress) => {
    if (typeof onPress === "function") onPress();
    render();
    return getState();
  };

  return Object.freeze({
    input: Object.freeze({ press }),
    getState,
    render,
  });
};

// AFTERSIGN — route-choice controller (#2369, slice 1).
// Owns the packet-seal branches of main.js `choose()` ("open-packet" and
// "keep-packet-sealed"/"keep-sealed"). Remaining `choose` branches still live
// in main.js and move here in follow-up slices.
//
// Dependencies are passed as lazy accessors so the controller can be created
// before main.js finishes declaring its helpers (no TDZ hazards).

export const PACKET_SEAL_CHOICES = Object.freeze({
  "open-packet": false,
  "keep-packet-sealed": true,
  "keep-sealed": true,
});

export const createRouteChoiceController = ({ getState, setState }) => {
  // Returns true when the choice was handled here; false means the caller
  // (main.js `choose`) must keep dispatching it.
  const choose = (choiceId) => {
    if (!Object.prototype.hasOwnProperty.call(PACKET_SEAL_CHOICES, choiceId)) return false;

    const sealed = PACKET_SEAL_CHOICES[choiceId];
    setState({
      packetSealed: getState().packet.sealed === sealed ? null : sealed,
      beat: "packet-choice",
    });
    return true;
  };

  return { input: { choose } };
};

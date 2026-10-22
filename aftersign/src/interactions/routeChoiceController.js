// AFTERSIGN — route-choice controller (#2369, slice 1).
// Owns the packet-seal branches of main.js `choose()` ("open-packet" and
// "keep-packet-sealed"/"keep-sealed"). Remaining `choose` branches still live
// in main.js and move here in follow-up slices.
//
// Dependencies are passed as lazy accessors so the controller can be created
// before main.js finishes declaring its helpers (no TDZ hazards). Render is
// NOT a dependency: in main.js `setState` calls `setBeat`, which already
// publishes, so a render seam here would double-publish.

export const PACKET_SEAL_CHOICES = Object.freeze({
  "open-packet": false,
  "keep-packet-sealed": true,
  "keep-sealed": true,
});

export const createRouteChoiceController = ({ getState, setState }) => {
  // Returns true when the choice was handled here; false means the caller
  // (main.js `choose`) must keep dispatching it.
  const choose = (choiceId) => {
    // Own-property guard: PACKET_SEAL_CHOICES is a plain frozen literal, so
    // `PACKET_SEAL_CHOICES["constructor"]` would resolve to Object#constructor
    // and `=== undefined` would miss it, which would send a function through
    // `setState({ packetSealed: <function>, ... })`. Gate on own-property so
    // only the three declared choices are handled.
    if (!Object.prototype.hasOwnProperty.call(PACKET_SEAL_CHOICES, choiceId)) return false;

    const sealed = PACKET_SEAL_CHOICES[choiceId];
    setState({
      // Only emit a packet-sealed mutation when it would change.
      packetSealed: getState().packet.sealed === sealed ? null : sealed,
      beat: "packet-choice",
    });
    return true;
  };

  return Object.freeze({
    input: Object.freeze({ choose }),
    getState,
  });
};

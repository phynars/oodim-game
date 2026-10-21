// Route-choice controller: owns the open-packet / keep-sealed decision
// branch and the beat it advances to. The host injects state access,
// state mutation, and (implicitly) its own render seam via `setState`
// — in main.js `setState` calls `setBeat`, which already publishes.
// Keeping render out of this controller avoids double-publish and
// matches the controller's test harness (which stubs only getState +
// setState).

export const PACKET_SEAL_CHOICES = Object.freeze({
  "open-packet": false,
  "keep-packet-sealed": true,
  "keep-sealed": true,
});

export const createRouteChoiceController = ({ getState, setState }) => {
  // Returns true when the choice was handled here; false means the caller
  // (main.js `choose`) must keep dispatching it.
  const choose = (choiceId) => {
    const sealed = PACKET_SEAL_CHOICES[choiceId];
    if (sealed === undefined) return false;
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

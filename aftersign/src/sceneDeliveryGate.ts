export const canDeliverFromScenePointer = (beat: string): boolean =>
  beat === "packet-choice";

export const checkSceneDeliveryGate = (): void => {
  if (canDeliverFromScenePointer("packet-offered")) {
    throw new Error("A scene tap must not bypass the packet open/preserve gesture.");
  }
  if (!canDeliverFromScenePointer("packet-choice")) {
    throw new Error("A scene tap must deliver only after a packet outcome is chosen.");
  }
};

export const runSceneDeliveryGateChecks = (): void => {
  checkSceneDeliveryGate();
};

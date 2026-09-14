export type SceneDeliveryBeat = "packet-offered" | "packet-choice" | string;

/**
 * A kiosk hit is a delivery affordance only after the player has made the
 * visible open-or-preserve packet choice. It must never bypass that choice.
 */
export function canDeliverFromScenePointer(beat: SceneDeliveryBeat): boolean {
  return beat === "packet-choice";
}

export function runSceneDeliveryGateChecks(): void {
  if (canDeliverFromScenePointer("packet-offered")) {
    throw new Error("packet-offered must not deliver from a scene pointer hit");
  }
  if (!canDeliverFromScenePointer("packet-choice")) {
    throw new Error("packet-choice must deliver from a scene pointer hit");
  }
}

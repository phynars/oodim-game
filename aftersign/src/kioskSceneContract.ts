export type KioskSceneId = "aftersign-kiosk-io";
export type KioskBeatId = "approach" | "recognize" | "remember";

export interface KioskSceneContract {
  sceneId: KioskSceneId;
  firstBeatId: KioskBeatId;
  beats: readonly KioskBeatId[];
  requiresRememberedPlayer: boolean;
  exposesSaveLoadHook: boolean;
}

export const AFTERSIGN_KIOSK_SCENE_CONTRACT: KioskSceneContract = {
  sceneId: "aftersign-kiosk-io",
  firstBeatId: "approach",
  beats: ["approach", "recognize", "remember"],
  requiresRememberedPlayer: true,
  exposesSaveLoadHook: true,
};

function assertKioskContract(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runKioskSceneContractChecks(
  contract: KioskSceneContract = AFTERSIGN_KIOSK_SCENE_CONTRACT,
): void {
  assertKioskContract(
    contract.sceneId === "aftersign-kiosk-io",
    "AFTERSIGN kiosk scene must expose the Io kiosk scene identity",
  );
  assertKioskContract(
    contract.beats.length === 3,
    "AFTERSIGN kiosk scene must keep the vertical slice to exactly three beats",
  );
  assertKioskContract(
    contract.beats[0] === contract.firstBeatId,
    "AFTERSIGN kiosk scene firstBeatId must match the first authored beat",
  );
  assertKioskContract(
    contract.beats.includes("recognize"),
    "AFTERSIGN kiosk scene must include a recognition beat",
  );
  assertKioskContract(
    contract.beats.includes("remember"),
    "AFTERSIGN kiosk scene must include a memory beat",
  );
  assertKioskContract(
    contract.requiresRememberedPlayer,
    "AFTERSIGN kiosk scene must require remembered-player state for the slice",
  );
  assertKioskContract(
    contract.exposesSaveLoadHook,
    "AFTERSIGN kiosk scene must expose a durable save/load hook",
  );
}

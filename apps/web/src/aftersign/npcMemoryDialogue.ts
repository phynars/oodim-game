import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";
import type { AftersignPacketInteractionAction } from "./verticalSlicePacketInteraction";

export type AftersignRememberingNpcId = "io";

export type AftersignNpcMemoryDialogueLine = {
  npcId: AftersignRememberingNpcId;
  moment: "greeting" | "inspect" | "sealedReturn" | "openedReturn" | "unknownReturn";
  text: string;
};

export const IO_MEMORY_DIALOGUE = {
  greeting: "Night Post is closed to excuses. Open to couriers.",
  inspect: "Read the seal, not the secret. A courier survives by knowing the difference.",
  sealedReturn: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  openedReturn: "You came back. The seal did not. I can use one of those facts.",
  unknownReturn: "You came back. I have one fact. Bring me another.",
} as const;

export function resolveIoMemoryDialogueLine(
  state: Partial<Pick<AftersignVerticalSliceState, "packetOutcome">>,
  action: AftersignPacketInteractionAction = "commit",
): AftersignNpcMemoryDialogueLine {
  if (action === "inspect") {
    return {
      npcId: "io",
      moment: "inspect",
      text: IO_MEMORY_DIALOGUE.inspect,
    };
  }

  if (state.packetOutcome === "sealed") {
    return {
      npcId: "io",
      moment: "sealedReturn",
      text: IO_MEMORY_DIALOGUE.sealedReturn,
    };
  }

  if (state.packetOutcome === "opened") {
    return {
      npcId: "io",
      moment: "openedReturn",
      text: IO_MEMORY_DIALOGUE.openedReturn,
    };
  }

  return {
    npcId: "io",
    moment: "unknownReturn",
    text: IO_MEMORY_DIALOGUE.unknownReturn,
  };
}

export function getIoGreetingDialogueLine(): AftersignNpcMemoryDialogueLine {
  return {
    npcId: "io",
    moment: "greeting",
    text: IO_MEMORY_DIALOGUE.greeting,
  };
}

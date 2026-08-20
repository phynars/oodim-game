export type AftersignNpcMemoryRecallLineId =
  | "io-return-opened"
  | "io-return-sealed"
  | "orra-return-answered-saint-orra";

export type AftersignNpcMemoryRecallLine = {
  id: AftersignNpcMemoryRecallLineId;
  npcId: "io" | "orra";
  trigger: {
    scene: "io-return" | "orra-return";
    remembers: "packet-opened" | "packet-sealed" | "answered-saint-orra";
  };
  line: string;
  playerMemoryEcho: string;
  assertionText: string;
};

export const AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE = [
  {
    id: "io-return-opened",
    npcId: "io",
    trigger: {
      scene: "io-return",
      remembers: "packet-opened",
    },
    line: "You opened it. I heard the seal give before the room did.",
    playerMemoryEcho: "Io remembers that you opened the packet.",
    assertionText: "You opened it.",
  },
  {
    id: "io-return-sealed",
    npcId: "io",
    trigger: {
      scene: "io-return",
      remembers: "packet-sealed",
    },
    line: "Still sealed. Good. Some doors only learn your name after you refuse them.",
    playerMemoryEcho: "Io remembers that you kept the packet sealed.",
    assertionText: "Still sealed.",
  },
  {
    id: "orra-return-answered-saint-orra",
    npcId: "orra",
    trigger: {
      scene: "orra-return",
      remembers: "answered-saint-orra",
    },
    line: "You answered when the saint asked. That kind of voice leaves a thread.",
    playerMemoryEcho: "Saint Orra remembers that you answered her.",
    assertionText: "You answered when the saint asked.",
  },
] as const satisfies readonly AftersignNpcMemoryRecallLine[];

export const findAftersignNpcMemoryRecallLine = ({
  npcId,
  remembers,
}: {
  npcId: AftersignNpcMemoryRecallLine["npcId"];
  remembers: AftersignNpcMemoryRecallLine["trigger"]["remembers"];
}): AftersignNpcMemoryRecallLine | null =>
  AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE.find(
    (line) => line.npcId === npcId && line.trigger.remembers === remembers,
  ) ?? null;

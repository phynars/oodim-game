import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

export type AftersignIoReturnMemoryKey =
  | "packet-sealed"
  | "packet-opened"
  | "route-listened"
  | "route-skipped"
  | "tone-kind"
  | "tone-evasive"
  | "tone-blunt";

export type AftersignIoReturnDialogueLine = Readonly<{
  key: AftersignIoReturnMemoryKey;
  text: string;
}>;

export const AFTERSIGN_IO_RETURN_DIALOGUE: ReadonlyArray<AftersignIoReturnDialogueLine> = [
  {
    key: "packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
  {
    key: "packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
  },
  {
    key: "route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
  },
  {
    key: "route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
  },
  {
    key: "tone-kind",
    text: "Kind answer. Expensive habit, after dark. Still: noted.",
  },
  {
    key: "tone-evasive",
    text: "You dodged the question. Fine. Couriers survive on light feet.",
  },
  {
    key: "tone-blunt",
    text: "Blunt answer. Saves ink. Sometimes blood.",
  },
];

const lineByKey = new Map(
  AFTERSIGN_IO_RETURN_DIALOGUE.map((line) => [line.key, line]),
);

export function getAftersignIoReturnDialogueLine(
  key: AftersignIoReturnMemoryKey,
): AftersignIoReturnDialogueLine {
  const line = lineByKey.get(key);

  if (!line) {
    throw new Error(`Unknown Aftersign Io return memory key: ${key}`);
  }

  return line;
}

export function composeAftersignIoReturningSessionDialogue(
  state: AftersignVerticalSliceState,
): ReadonlyArray<AftersignIoReturnDialogueLine> {
  const keys: AftersignIoReturnMemoryKey[] = [];

  if (state.packetChoice === "sealed") {
    keys.push("packet-sealed");
  } else if (state.packetChoice === "opened") {
    keys.push("packet-opened");
  }

  if (state.routeChoice === "listened") {
    keys.push("route-listened");
  } else if (state.routeChoice === "skipped") {
    keys.push("route-skipped");
  }

  if (state.replyTone === "kind") {
    keys.push("tone-kind");
  } else if (state.replyTone === "evasive") {
    keys.push("tone-evasive");
  } else if (state.replyTone === "blunt") {
    keys.push("tone-blunt");
  }

  return keys.map(getAftersignIoReturnDialogueLine);
}

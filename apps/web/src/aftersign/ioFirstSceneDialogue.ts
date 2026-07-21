export type AftersignIoFirstScenePrompt =
  | "arrival"
  | "route"
  | "sealedPacketChoice"
  | "openedPacketChoice"
  | "handoffSealed"
  | "handoffOpened";

export type AftersignIoFirstSceneLine = Readonly<{
  id: AftersignIoFirstScenePrompt;
  text: string;
  intent: "anchor" | "route" | "choice" | "consequence";
}>;

export const AFTERSIGN_IO_FIRST_SCENE_DIALOGUE = [
  {
    id: "arrival",
    intent: "anchor",
    text: "You're late. That means you came on purpose.",
  },
  {
    id: "route",
    intent: "route",
    text: "Blue packet. Brass sign box. Three lanterns down, then up where the stair forgets itself.",
  },
  {
    id: "sealedPacketChoice",
    intent: "choice",
    text: "If the seal reaches the box whole, I learn one thing about you.",
  },
  {
    id: "openedPacketChoice",
    intent: "choice",
    text: "If it doesn't, I learn another.",
  },
  {
    id: "handoffSealed",
    intent: "consequence",
    text: "Good. A closed thing stayed closed in your hands.",
  },
  {
    id: "handoffOpened",
    intent: "consequence",
    text: "Curiosity is not a crime. It is a cost. Pay attention.",
  },
] as const satisfies readonly AftersignIoFirstSceneLine[];

export function getAftersignIoFirstSceneLine(
  id: AftersignIoFirstScenePrompt,
): AftersignIoFirstSceneLine {
  return AFTERSIGN_IO_FIRST_SCENE_DIALOGUE.find((line) => line.id === id)!;
}

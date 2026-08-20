export type AftersignRememberingNpcLineKind =
  | "firstMeeting"
  | "returningPlayer"
  | "packetSealed"
  | "packetOpened"
  | "routeSkipped"
  | "routeHeard";

export type AftersignRememberingNpcLine = Readonly<{
  kind: AftersignRememberingNpcLineKind;
  speaker: "Io";
  text: string;
}>;

const PLAYER_NAME_FALLBACK = "stranger";

const sanitizePlayerName = (playerName: string | null | undefined): string => {
  const trimmed = playerName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : PLAYER_NAME_FALLBACK;
};

export const getAftersignRememberingNpcLine = (
  kind: AftersignRememberingNpcLineKind,
  playerName?: string | null,
): AftersignRememberingNpcLine => {
  const name = sanitizePlayerName(playerName);

  switch (kind) {
    case "firstMeeting":
      return {
        kind,
        speaker: "Io",
        text: `${name}. If that is what you answer to, I will put it on the route sheet.`,
      };
    case "returningPlayer":
      return {
        kind,
        speaker: "Io",
        text: `You came back, ${name}. Good. The city dislikes loose ends.`,
      };
    case "packetSealed":
      return {
        kind,
        speaker: "Io",
        text: `You came back. So did the blue seal, unbroken. That gives me two facts to trust, ${name}.`,
      };
    case "packetOpened":
      return {
        kind,
        speaker: "Io",
        text: `You came back. The seal did not. I can use one of those facts, ${name}.`,
      };
    case "routeSkipped":
      return {
        kind,
        speaker: "Io",
        text: `You found the box anyway, ${name}. Next time, let me finish saving your life.`,
      };
    case "routeHeard":
      return {
        kind,
        speaker: "Io",
        text: `You listened before you ran, ${name}. Rare habit. Keep it.`,
      };
  }
};

export type AftersignRememberingNpcLineKind =
  | "firstMeeting"
  | "returningPlayer"
  | "packetRecovered"
  | "packetLost";

export type AftersignRememberingNpcLine = Readonly<{
  kind: AftersignRememberingNpcLineKind;
  speaker: "Mira";
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
        speaker: "Mira",
        text: `${name}. If that is what you answer to, I will keep it safe.`,
      };
    case "returningPlayer":
      return {
        kind,
        speaker: "Mira",
        text: `You came back, ${name}. The station did not expect that. I did.`,
      };
    case "packetRecovered":
      return {
        kind,
        speaker: "Mira",
        text: `I remember the packet in your hands, ${name}. Small thing. Whole sky bent around it.`,
      };
    case "packetLost":
      return {
        kind,
        speaker: "Mira",
        text: `Last time, the packet went dark. I remember that too, ${name}. We do not get clean ghosts here.`,
      };
  }
};

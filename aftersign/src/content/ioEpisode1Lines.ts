export type IoMemoryState = {
  priorVisit: boolean;
  deliveredPacket: boolean;
  brokePromise: boolean;
};

export type IoLineBeat =
  | "first-arrival"
  | "returning"
  | "packet-complete"
  | "promise-broken";

export const IO_EPISODE1_LINES: Record<IoLineBeat, string> = {
  "first-arrival": "You walk like someone listening for their own name.",
  returning: "Back again. The city kept your shape this time.",
  "packet-complete": "The packet landed where it belonged. That matters here.",
  "promise-broken": "You promised me a clean route. The water remembers better than you.",
};

export function pickIoLine(state: IoMemoryState): string {
  if (state.brokePromise) return IO_EPISODE1_LINES["promise-broken"];
  if (state.deliveredPacket) return IO_EPISODE1_LINES["packet-complete"];
  if (state.priorVisit) return IO_EPISODE1_LINES.returning;
  return IO_EPISODE1_LINES["first-arrival"];
}

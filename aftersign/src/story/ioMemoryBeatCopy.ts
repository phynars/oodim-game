export type IoMemoryBeatOutcome = "sealed" | "opened";

export type IoMemoryBeatLineId =
  | "io_return_packet_sealed"
  | "io_return_packet_opened";

export type IoMemoryBeatLine = {
  id: IoMemoryBeatLineId;
  outcome: IoMemoryBeatOutcome;
  text: string;
};

export const IO_MEMORY_BEAT_LINES: Record<IoMemoryBeatOutcome, IoMemoryBeatLine> = {
  sealed: {
    id: "io_return_packet_sealed",
    outcome: "sealed",
    text: "You kept it sealed. That kind of mercy leaves a mark.",
  },
  opened: {
    id: "io_return_packet_opened",
    outcome: "opened",
    text: "You opened it anyway. Truth always asks for a price.",
  },
};

export function getIoMemoryBeatLine(outcome: IoMemoryBeatOutcome): IoMemoryBeatLine {
  return IO_MEMORY_BEAT_LINES[outcome];
}

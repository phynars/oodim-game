export type IoPacketOutcome = "sealed" | "opened" | "unknown";
export type IoRouteAttention = "listened" | "skipped" | "unknown";
export type IoReturnAnswerTone = "kind" | "evasive" | "blunt" | "unknown";

export interface IoSliceMemory {
  packetOutcome: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnAnswerTone?: IoReturnAnswerTone;
  returnedAfterClose?: boolean;
}

export interface IoRecognitionBeat {
  npcId: "io-vale";
  line: string;
  trustPosture: "trusted" | "usable" | "watching";
  authoredMemorySentence: string;
  allowedMemoryRefs: readonly string[];
  staging: {
    camera: "short-recognition-push-in";
    signCue: "tram-kiosk-ledger-glow";
    audio: "low-bell-recognition-sting";
  };
}

const IO_RECOGNITION_STAGING: IoRecognitionBeat["staging"] = {
  camera: "short-recognition-push-in",
  signCue: "tram-kiosk-ledger-glow",
  audio: "low-bell-recognition-sting",
};

export function selectIoRecognitionBeat(memory: IoSliceMemory): IoRecognitionBeat {
  if (memory.packetOutcome === "sealed") {
    return {
      npcId: "io-vale",
      line: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      trustPosture: "trusted",
      authoredMemorySentence: "Io remembers that the player delivered the blue packet sealed.",
      allowedMemoryRefs: ["returnedAfterClose", "packetOutcome:sealed"],
      staging: IO_RECOGNITION_STAGING,
    };
  }

  if (memory.packetOutcome === "opened") {
    return {
      npcId: "io-vale",
      line: "You came back. The seal did not. I can use one of those facts.",
      trustPosture: "usable",
      authoredMemorySentence: "Io remembers that the player opened the blue packet before delivery.",
      allowedMemoryRefs: ["returnedAfterClose", "packetOutcome:opened"],
      staging: IO_RECOGNITION_STAGING,
    };
  }

  if (memory.routeAttention === "skipped") {
    return {
      npcId: "io-vale",
      line: "You found the box anyway. Next time, let me finish saving your life.",
      trustPosture: "watching",
      authoredMemorySentence: "Io remembers that the player skipped the route instructions.",
      allowedMemoryRefs: ["routeAttention:skipped"],
      staging: IO_RECOGNITION_STAGING,
    };
  }

  if (memory.routeAttention === "listened") {
    return {
      npcId: "io-vale",
      line: "You listened before you ran. Rare habit. Keep it.",
      trustPosture: "trusted",
      authoredMemorySentence: "Io remembers that the player listened to the route before leaving.",
      allowedMemoryRefs: ["routeAttention:listened"],
      staging: IO_RECOGNITION_STAGING,
    };
  }

  return {
    npcId: "io-vale",
    line: "Back again. Good. Vey wastes fewer names on people who return.",
    trustPosture: "watching",
    authoredMemorySentence: "Io remembers only that the player returned to the Night Post.",
    allowedMemoryRefs: ["returnedAfterClose"],
    staging: IO_RECOGNITION_STAGING,
  };
}

export function beatReferencesOnlyAllowedMemory(beat: IoRecognitionBeat, memory: IoSliceMemory): boolean {
  const allowed = new Set(beat.allowedMemoryRefs);

  if (beat.line.includes("blue seal") || beat.line.includes("unbroken")) {
    return memory.packetOutcome === "sealed" && allowed.has("packetOutcome:sealed");
  }

  if (beat.line.includes("The seal did not")) {
    return memory.packetOutcome === "opened" && allowed.has("packetOutcome:opened");
  }

  if (beat.line.includes("let me finish")) {
    return memory.routeAttention === "skipped" && allowed.has("routeAttention:skipped");
  }

  if (beat.line.includes("listened before you ran")) {
    return memory.routeAttention === "listened" && allowed.has("routeAttention:listened");
  }

  return allowed.has("returnedAfterClose");
}

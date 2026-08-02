export type IoFirstRoutePacketState = "sealed" | "opened";
export type IoFirstRouteAttention = "listened" | "skipped";
export type IoFirstRouteAnswerTone = "kind" | "evasive" | "blunt";

export interface IoFirstRouteState {
  packetState: IoFirstRoutePacketState;
  attention: IoFirstRouteAttention;
  answerTone: IoFirstRouteAnswerTone;
}

export interface IoFirstRouteLineSet {
  handoff: string;
  route: string;
  warning: string;
  returnQuestion: string;
  packetAssessment: string;
  answerAssessment: string;
  authoredMemorySentence: string;
}

const HANDOFF =
  "Blue packet. Wax faces out. If it comes back clean, so do you.";

const ROUTE =
  "Three lanterns down. Brass stair. Sign box with the moth scratch. Do not follow the bell if it rings twice.";

const WARNING =
  "Vey forgets careless feet first.";

const RETURN_QUESTION = "You came back. Tell me why.";

const PACKET_ASSESSMENTS: Record<IoFirstRoutePacketState, string> = {
  sealed: "Seal held. Good. A city can stand on one clean fact.",
  opened: "Seal broke. So did the easy version of this job.",
};

const ANSWER_ASSESSMENTS: Record<IoFirstRouteAnswerTone, string> = {
  kind: "Kind answer. Dangerous tool. Keep it sharp.",
  evasive: "You walked around the question. I still saw the path.",
  blunt: "Blunt answer. Cheap, but useful when it is true.",
};

export function selectIoFirstRouteLines(
  state: IoFirstRouteState,
): IoFirstRouteLineSet {
  return {
    handoff: HANDOFF,
    route: state.attention === "listened" ? ROUTE : "Walk, then. Learn from the city if you will not learn from me.",
    warning: WARNING,
    returnQuestion: RETURN_QUESTION,
    packetAssessment: PACKET_ASSESSMENTS[state.packetState],
    answerAssessment: ANSWER_ASSESSMENTS[state.answerTone],
    authoredMemorySentence: buildIoFirstRouteMemorySentence(state),
  };
}

export function buildIoFirstRouteMemorySentence(
  state: IoFirstRouteState,
): string {
  const packetMemory =
    state.packetState === "sealed"
      ? "kept the first blue seal intact"
      : "broke the first blue seal";

  const attentionMemory =
    state.attention === "listened"
      ? "listened before leaving"
      : "left before the route was finished";

  return `Io remembers that the courier ${packetMemory} and ${attentionMemory}.`;
}

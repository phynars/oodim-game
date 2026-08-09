export type RememberingNpcTrust = "wary" | "curious" | "warm";

export interface RememberingNpcPlayerMemory {
  readonly playerId: string;
  readonly lastSeenAtMs: number;
  readonly visits: number;
  readonly trust: RememberingNpcTrust;
  readonly rememberedFacts: readonly string[];
}

export interface RememberingNpcLine {
  readonly speaker: "npc";
  readonly npcId: "mara-kiosk";
  readonly text: string;
  readonly memoryUsed: boolean;
}

export interface RememberingNpcGreetingInput {
  readonly nowMs: number;
  readonly playerId: string;
  readonly memory?: RememberingNpcPlayerMemory | null;
}

const NPC_ID: RememberingNpcLine["npcId"] = "mara-kiosk";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function greetRememberingNpc(input: RememberingNpcGreetingInput): RememberingNpcLine {
  const memory = input.memory;

  if (!memory || memory.playerId !== input.playerId || memory.visits <= 0) {
    return {
      speaker: "npc",
      npcId: NPC_ID,
      text: "First time under the AFTERSIGN? Keep close to the light; the rain edits people here.",
      memoryUsed: false,
    };
  }

  const daysAway = Math.max(0, Math.floor((input.nowMs - memory.lastSeenAtMs) / ONE_DAY_MS));
  const rememberedFact = selectRememberedFact(memory.rememberedFacts);
  const timeClause = daysAway === 0 ? "You came back before the sign cooled." : `It's been ${daysAway} night${daysAway === 1 ? "" : "s"}.`;
  const trustClause = memory.trust === "warm" ? "I kept your seat dry." : memory.trust === "curious" ? "I saved the question you dodged." : "I still don't know if the sign likes you.";

  return {
    speaker: "npc",
    npcId: NPC_ID,
    text: rememberedFact ? `${timeClause} ${trustClause} And I remember: ${rememberedFact}.` : `${timeClause} ${trustClause}`,
    memoryUsed: true,
  };
}

export function advanceRememberingNpcMemory(
  input: RememberingNpcGreetingInput,
  learnedFact?: string,
): RememberingNpcPlayerMemory {
  const previous = input.memory?.playerId === input.playerId ? input.memory : null;
  const rememberedFacts = appendRememberedFact(previous?.rememberedFacts ?? [], learnedFact);

  return {
    playerId: input.playerId,
    lastSeenAtMs: input.nowMs,
    visits: (previous?.visits ?? 0) + 1,
    trust: nextTrust(previous?.trust ?? "wary"),
    rememberedFacts,
  };
}

function selectRememberedFact(facts: readonly string[]): string | null {
  const fact = facts.find((entry) => entry.trim().length > 0);
  return fact ? fact.trim() : null;
}

function appendRememberedFact(facts: readonly string[], learnedFact?: string): readonly string[] {
  const cleanFact = learnedFact?.trim();
  if (!cleanFact) return facts.slice(0, 3);
  return [cleanFact, ...facts.filter((fact) => fact.trim() !== cleanFact)].slice(0, 3);
}

function nextTrust(trust: RememberingNpcTrust): RememberingNpcTrust {
  if (trust === "wary") return "curious";
  if (trust === "curious") return "warm";
  return "warm";
}

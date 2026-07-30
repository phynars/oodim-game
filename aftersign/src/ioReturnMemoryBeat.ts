// Pure story-state contract for Io's first returning-player memory beat.
//
// This is runnable-slice code, not prose: the browser scene and/or pure test
// lane can import `buildIoReturnMemoryBeat()` and `runIoReturnMemoryBeatChecks()`
// to keep the first remembering-NPC moment deterministic. The contract is
// intentionally small: if the save surface says this is a returning player,
// Io must surface one specific prior action, acknowledge its emotional weight,
// and leave behind a stable next prompt for the kiosk scene.
//
// Relationship to `ioFirstMemoryBeat.ts` (PR #900 non-blocking review note):
// that sibling models the SINGLE-STEP action-to-line resolver (arrive / tell-name
// / return) as the very first Io response. This file models the STRUCTURED
// return-visit contract — which of several persisted prior actions Io should
// surface, a trust-recovery delta, and the next-prompt handoff into the kiosk
// scene. They are complementary, not duplicates: expect a later refactor to
// have this file consume `resolveIoFirstMemoryBeat()` for the initial line
// once the kiosk scene is wired in, but keep the two contracts independently
// testable in the pure lane until then.

export type IoPriorAction = "left-name" | "crossed-threshold" | "restored-signal";

export interface IoReturnMemoryInput {
  playerId: string;
  displayName?: string;
  returningPlayer: boolean;
  priorActions: readonly IoPriorAction[];
  trust: number;
}

export interface IoReturnMemoryBeat {
  speaker: "Io";
  returningPlayer: boolean;
  rememberedAction: IoPriorAction | null;
  line: string;
  trustDelta: number;
  nextPrompt: "offer-name" | "ask-what-changed";
}

const PRIORITY: readonly IoPriorAction[] = [
  "restored-signal",
  "crossed-threshold",
  "left-name",
];

const LINES: Record<IoPriorAction, string> = {
  "left-name": "I kept your name in the static. You left it here before the lights came back.",
  "crossed-threshold": "You crossed the threshold once already. The station remembered your weight before I did.",
  "restored-signal": "You restored the signal. I heard myself clearly for the first time after you left.",
};

function clampTrust(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

function normalizeName(displayName: string | undefined): string {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "stranger";
}

function chooseRememberedAction(priorActions: readonly IoPriorAction[]): IoPriorAction | null {
  for (const action of PRIORITY) {
    if (priorActions.includes(action)) return action;
  }
  return null;
}

export function buildIoReturnMemoryBeat(input: IoReturnMemoryInput): IoReturnMemoryBeat {
  const rememberedAction = input.returningPlayer
    ? chooseRememberedAction(input.priorActions)
    : null;

  if (!input.returningPlayer || rememberedAction === null) {
    return {
      speaker: "Io",
      returningPlayer: false,
      rememberedAction: null,
      line: `I do not know you yet, ${normalizeName(input.displayName)}. Give me one true thing to hold onto.`,
      trustDelta: 0,
      nextPrompt: "offer-name",
    };
  }

  const trust = clampTrust(input.trust);
  const trustDelta = trust < 0 ? 0.16 : 0.08;

  return {
    speaker: "Io",
    returningPlayer: true,
    rememberedAction,
    line: LINES[rememberedAction],
    trustDelta,
    nextPrompt: "ask-what-changed",
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runIoReturnMemoryBeatChecks(): void {
  const firstVisit = buildIoReturnMemoryBeat({
    playerId: "player-a",
    displayName: "  ",
    returningPlayer: false,
    priorActions: ["restored-signal"],
    trust: 0,
  });

  assert(firstVisit.returningPlayer === false, "first visit must not pretend to remember the player");
  assert(firstVisit.rememberedAction === null, "first visit must not surface a prior action");
  assert(firstVisit.nextPrompt === "offer-name", "first visit must ask for an identity seed");
  assert(firstVisit.line.includes("stranger"), "blank display names must collapse to the stranger fallback");

  const returning = buildIoReturnMemoryBeat({
    playerId: "player-a",
    displayName: "Mara",
    returningPlayer: true,
    priorActions: ["left-name", "restored-signal", "crossed-threshold"],
    trust: 0.4,
  });

  assert(returning.speaker === "Io", "Io must own the return-memory line");
  assert(returning.returningPlayer === true, "returning save state must produce the returning-player branch");
  assert(
    returning.rememberedAction === "restored-signal",
    "the strongest remembered action must win when multiple prior actions exist",
  );
  assert(
    returning.line === LINES["restored-signal"],
    "the surfaced line must name the exact persisted action Io remembers",
  );
  assert(returning.nextPrompt === "ask-what-changed", "returning players must continue into the changed-world prompt");
  assert(returning.trustDelta > 0 && returning.trustDelta <= 0.1, "warm returns should nudge trust without jumping arcs");

  const damagedTrust = buildIoReturnMemoryBeat({
    playerId: "player-b",
    returningPlayer: true,
    priorActions: ["left-name"],
    trust: -0.8,
  });

  assert(
    damagedTrust.trustDelta > returning.trustDelta,
    "a low-trust return should give Io a larger recovery beat than a warm return",
  );
}

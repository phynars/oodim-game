// Focused branch checks for resolveIoDialogue (#2783), run by
// aftersign/pure-runner.ts. Export-only: no top-level call. The resolver
// has no imports, so this runs under `node --experimental-strip-types`.
// Every copy lookup is a stub, so these checks pin the routing, not copy.

// @ts-ignore -- plain JS module without declarations; checks run untyped.
import { resolveIoDialogue } from "./ioDialogueResolver.js";

const assertEqual = (actual: unknown, expected: unknown, label: string): void => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = Record<string, any>;

const base = (overrides: Partial<Input> = {}): Input => ({
  beat: "idle",
  packet: { sealed: true },
  player: { id: "p1", name: "Ash", flags: [], returnReason: null, routeRisk: null },
  npcs: { io: { memory: [] }, orra: { memory: [] } },
  deliveryId: "blue-route",
  returningBootLine: null,
  returningBootBeat: null,
  secondPacketResponseLine: null,
  breakMode: "",
  defaultOfferLine: "DEFAULT",
  routeOutcomeLine: (route: string, action: string) => (route === "shortcut" ? `ROUTE:${route}:${action}` : null),
  deliveryCompleteLine: (id: string) => `DELIVERED:${id}`,
  continueBeats: (reason: string) => [{ line: `REPLY:${reason}` }, { line: "HANDOFF" }],
  memoryResponseLines: () => [{ text: "REFLECT" }],
  memoryRecallLine: (remembers: string) => `RECALL:${remembers}`,
  nextJobPrompt: () => "PROMPT",
  secondPacketAcknowledgement: ({ returnReason, playerName }: { returnReason: string | null; playerName: string }) => ({
    lines: [`ACK:${returnReason}:${playerName}`],
  }),
  recognitionDialogue: ({ packetSealed }: { packetSealed: boolean }) => ({ line: `RECOG:${packetSealed}` }),
  offerLine: (_memory: unknown, offers: unknown, reason: string | null) => `OFFER:${String(offers)}:${reason}`,
  jobOffers: () => "JOBS",
  offersMemory: () => ({}),
  ...overrides,
});

export async function runIoDialogueResolverChecks(): Promise<void> {
  assertEqual(
    resolveIoDialogue(base({ beat: "packet-choice", returningBootLine: "BOOT", returningBootBeat: "packet-choice" })),
    "BOOT",
    "returning boot line wins at its own beat",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "packet-choice" })),
    "Good. Some doors only open for people who can carry a secret without looking inside.",
    "packet-choice sealed",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "packet-choice", packet: { sealed: false } })),
    "You opened it. The route still glows, but now the city knows curiosity got there first.",
    "packet-choice opened",
  );
  const routed = base({ beat: "packet-delivered" });
  routed.player = { ...routed.player, routeRisk: { succeeded: true, lastRoute: "shortcut", lastAction: "run" } };
  assertEqual(resolveIoDialogue(routed), "ROUTE:shortcut:run", "packet-delivered route line");
  const unknownRoute = base({ beat: "packet-delivered" });
  unknownRoute.player = { ...unknownRoute.player, routeRisk: { succeeded: true, lastRoute: "other", lastAction: "x" } };
  assertEqual(resolveIoDialogue(unknownRoute), "DELIVERED:blue-route", "packet-delivered falls back without route copy");
  assertEqual(resolveIoDialogue(base({ beat: "return-tone-choice" })), "REPLY:evasive", "return-tone defaults to evasive");
  assertEqual(
    resolveIoDialogue(base({ beat: "io-next-job" })),
    "REFLECT RECALL:packet-sealed PROMPT ACK:null:Ash",
    "io-next-job joins reflection, recall, prompt and acknowledgement",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "io-next-job", secondPacketResponseLine: "SECOND" })),
    "SECOND",
    "io-next-job second-packet response wins",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "io-return-recognition", deliveryId: "red-tag", redTagAccepted: true })),
    "I remember you: red tag delivered to Saint Orra. The pharmacy sign kept the route; I kept your name beside it.",
    "recognition red-tag line",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "io-return-recognition", deliveryId: "red-tag" })),
    "RECOG:true",
    "recognition red-tag line requires the stored acceptance fact (#2790)",
  );
  assertEqual(resolveIoDialogue(base({ beat: "io-return-recognition" })), "RECOG:true", "recognition follows packet");
  assertEqual(
    resolveIoDialogue(base({ beat: "io-return-recognition", breakMode: "wrong-io-line" })),
    "RECOG:false",
    "wrong-io-line red guard inverts",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "io-return-recognition", breakMode: "orra-io-contamination" })),
    "RECOG:true",
    "contamination guard is inert without Orra memory",
  );
  assertEqual(
    resolveIoDialogue(base({ beat: "packet-offered", player: { ...base().player, returnReason: "warm" } })),
    "OFFER:JOBS:warm",
    "packet-offered offer line",
  );
  assertEqual(resolveIoDialogue(base()), "DEFAULT", "unknown beat falls back to default offer line");
}

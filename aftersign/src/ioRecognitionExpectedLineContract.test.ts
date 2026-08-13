import {
  buildIoRecognitionDialogueSnippets,
  expectedIoRecognitionLine,
  selectIoRecognitionDialogueLine,
  type IoRecognitionMemoryFact,
} from "./ioRecognitionDialogue.ts";

type Outcome = "sealed" | "opened";
type RouteObject = "done" | "skipped";

const PLAYER_ID = "expected-line-contract-player";
const DELIVERY_MEMORY_ID = "mem-delivery-outcome";
const ROUTE_MEMORY_ID = "mem-route-attention";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${String(expected)}\nActual: ${String(actual)}`);
  }
}

function memoryFor(outcome: Outcome, routeObject: RouteObject): IoRecognitionMemoryFact[] {
  return [
    {
      id: DELIVERY_MEMORY_ID,
      kind: "delivery-outcome",
      predicate: "packet-state",
      object: outcome,
    },
    {
      id: ROUTE_MEMORY_ID,
      kind: "route-attention",
      predicate: "kiosk-second-action",
      object: routeObject,
    },
  ];
}

function selectedLineFor(outcome: Outcome, routeObject: RouteObject): string {
  const memory = memoryFor(outcome, routeObject);
  const snippets = buildIoRecognitionDialogueSnippets({
    playerId: PLAYER_ID,
    packetSealed: outcome === "sealed",
    memory,
  });
  return selectIoRecognitionDialogueLine(snippets, { memory }).line;
}

export function runIoRecognitionExpectedLineContractChecks(): void {
  for (const outcome of ["sealed", "opened"] as const) {
    for (const routeObject of ["done", "skipped"] as const) {
      const routeListened = routeObject === "done";
      assertEqual(
        selectedLineFor(outcome, routeObject),
        expectedIoRecognitionLine(outcome, routeListened),
        `expectedIoRecognitionLine must mirror the selected Io recognition line for ${outcome}/${routeObject}`,
      );
    }
  }

  // The helper must preserve the same tier gate the runtime selector uses:
  // acknowledging the kiosk's second beat unlocks deep-recall copy, while
  // skipping it stays on the returning line even though delivery memory exists.
  assertEqual(
    expectedIoRecognitionLine("sealed", false),
    selectedLineFor("sealed", "skipped"),
    "sealed skipped-route flow must stay on returning copy",
  );
  assertEqual(
    expectedIoRecognitionLine("sealed", true),
    selectedLineFor("sealed", "done"),
    "sealed listened-route flow must speak deep-recall copy",
  );
  assertEqual(
    expectedIoRecognitionLine("opened", false),
    selectedLineFor("opened", "skipped"),
    "opened skipped-route flow must stay on returning copy",
  );
  assertEqual(
    expectedIoRecognitionLine("opened", true),
    selectedLineFor("opened", "done"),
    "opened listened-route flow must speak deep-recall copy",
  );
}

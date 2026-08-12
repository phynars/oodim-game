// Plain-TS check bundle for `ioRecognitionDialogue.ts`. Executed by the
// `test:aftersign:pure` lane via `aftersign/pure-runner.ts` under
// `node --experimental-strip-types`. `aftersign/tsconfig.json` restricts
// `types` to `["vite/client"]` (no `@types/node`), so this file — like
// its siblings `perfBudgetCalibration.test.ts`, `ioFirstSessionPacing.test.ts`,
// `recognitionBeat.test.ts`, `recognitionFeedbackBridge.test.ts` — hand-rolls
// local assert helpers instead of importing `node:assert`.

import {
  buildIoRecognitionDialogueSnippets,
  expectedIoRecognitionLine,
  selectIoRecognitionDialogueLine,
} from "./ioRecognitionDialogue.ts";

const PLAYER_ID = "mara-contract-player";
const DELIVERY_MEMORY_ID = "memory:delivery-outcome";
const ROUTE_MEMORY_ID = "memory:route-attention";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`io recognition dialogue check failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `io recognition dialogue check failed: ${message} (expected ${String(
        expected,
      )}, got ${String(actual)})`,
    );
  }
}

function assertDeepEqualStrings(
  actual: readonly string[],
  expected: readonly string[],
  message: string,
): void {
  assert(
    Array.isArray(actual),
    `${message}: expected an array, got ${String(actual)}`,
  );
  assertEqual(
    actual.length,
    expected.length,
    `${message}: length mismatch`,
  );
  for (let i = 0; i < expected.length; i += 1) {
    assertEqual(
      actual[i],
      expected[i],
      `${message}: index ${i} mismatch`,
    );
  }
}

function snippetsFor(packetSealed: boolean, routeObject: "done" | "skipped") {
  return buildIoRecognitionDialogueSnippets({
    playerId: PLAYER_ID,
    packetSealed,
    memory: [
      {
        id: DELIVERY_MEMORY_ID,
        kind: "delivery-outcome",
        object: packetSealed ? "sealed" : "opened",
      },
      {
        id: ROUTE_MEMORY_ID,
        predicate: "kiosk-second-action",
        object: routeObject,
      },
    ],
  });
}

function assertReturningLineWhenRouteWasSkipped(packetSealed: boolean): void {
  const outcome = packetSealed ? "sealed" : "opened";
  const snippets = snippetsFor(packetSealed, "skipped");
  const selected = selectIoRecognitionDialogueLine(snippets, {
    memory: [
      {
        id: DELIVERY_MEMORY_ID,
        kind: "delivery-outcome",
        object: outcome,
      },
      {
        id: ROUTE_MEMORY_ID,
        predicate: "kiosk-second-action",
        object: "skipped",
      },
    ],
  });

  assertEqual(
    selected.tier,
    "returning",
    `route-skipped (${outcome}) must select the returning tier`,
  );
  assertEqual(
    selected.line,
    expectedIoRecognitionLine(outcome, false),
    `route-skipped (${outcome}) must match the returning-tier expected line`,
  );
  assertDeepEqualStrings(
    selected.memoryRefs,
    [DELIVERY_MEMORY_ID],
    `route-skipped (${outcome}) memoryRefs must reference only the delivery memory`,
  );
  assertDeepEqualStrings(
    selected.sourceMemoryIds,
    [DELIVERY_MEMORY_ID],
    `route-skipped (${outcome}) sourceMemoryIds must include only the delivery memory`,
  );
}

function assertDeepRecallLineWhenRouteWasListened(packetSealed: boolean): void {
  const outcome = packetSealed ? "sealed" : "opened";
  const snippets = snippetsFor(packetSealed, "done");
  const selected = selectIoRecognitionDialogueLine(snippets, {
    memory: [
      {
        id: DELIVERY_MEMORY_ID,
        kind: "delivery-outcome",
        object: outcome,
      },
      {
        id: ROUTE_MEMORY_ID,
        predicate: "kiosk-second-action",
        object: "done",
      },
    ],
  });

  assertEqual(
    selected.tier,
    "deep-recall",
    `route-listened (${outcome}) must select the deep-recall tier`,
  );
  assertEqual(
    selected.line,
    expectedIoRecognitionLine(outcome, true),
    `route-listened (${outcome}) must match the deep-recall expected line`,
  );
  assertDeepEqualStrings(
    selected.memoryRefs,
    [DELIVERY_MEMORY_ID],
    `route-listened (${outcome}) memoryRefs must reference only the delivery memory`,
  );
  assertDeepEqualStrings(
    selected.sourceMemoryIds,
    [DELIVERY_MEMORY_ID, ROUTE_MEMORY_ID],
    `route-listened (${outcome}) sourceMemoryIds must include both memories`,
  );
}

export function runIoRecognitionDialogueContractChecks(): void {
  assertReturningLineWhenRouteWasSkipped(true);
  assertReturningLineWhenRouteWasSkipped(false);
  assertDeepRecallLineWhenRouteWasListened(true);
  assertDeepRecallLineWhenRouteWasListened(false);
}

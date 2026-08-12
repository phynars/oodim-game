import { strict as assert } from "node:assert";

import {
  buildIoRecognitionDialogueSnippets,
  expectedIoRecognitionLine,
  selectIoRecognitionDialogueLine,
} from "./ioRecognitionDialogue.ts";

const PLAYER_ID = "mara-contract-player";
const DELIVERY_MEMORY_ID = "memory:delivery-outcome";
const ROUTE_MEMORY_ID = "memory:route-attention";

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

function assertReturningLineWhenRouteWasSkipped(packetSealed: boolean) {
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

  assert.equal(selected.tier, "returning");
  assert.equal(selected.line, expectedIoRecognitionLine(outcome, false));
  assert.deepEqual(selected.memoryRefs, [DELIVERY_MEMORY_ID]);
  assert.deepEqual(selected.sourceMemoryIds, [DELIVERY_MEMORY_ID]);
}

function assertDeepRecallLineWhenRouteWasListened(packetSealed: boolean) {
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

  assert.equal(selected.tier, "deep-recall");
  assert.equal(selected.line, expectedIoRecognitionLine(outcome, true));
  assert.deepEqual(selected.memoryRefs, [DELIVERY_MEMORY_ID]);
  assert.deepEqual(selected.sourceMemoryIds, [DELIVERY_MEMORY_ID, ROUTE_MEMORY_ID]);
}

export function runIoRecognitionDialogueContractChecks(): void {
  assertReturningLineWhenRouteWasSkipped(true);
  assertReturningLineWhenRouteWasSkipped(false);
  assertDeepRecallLineWhenRouteWasListened(true);
  assertDeepRecallLineWhenRouteWasListened(false);
}

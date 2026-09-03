import {
  actionIds,
  availableActionsForMemory,
  memoriesProduceDifferentAvailableActions,
  type MemoryRecord,
} from "./mLoopDivergence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertArrayIncludes(values: string[], expected: string, message: string): void {
  assert(values.includes(expected), `${message}; got [${values.join(", ")}]`);
}

const firstRunMemory: MemoryRecord = {
  completedDeliveries: 0,
  trustPosture: "new",
};

const trustedMemory: MemoryRecord = {
  completedDeliveries: 2,
  trustPosture: "trusted",
  priorRiskTaken: "dark-cut",
};

const debtorMemory: MemoryRecord = {
  completedDeliveries: 1,
  trustPosture: "debtor",
  openedPacketDebt: true,
};

const firstRunActionIds = actionIds(availableActionsForMemory(firstRunMemory));
assert(
  firstRunActionIds.length === 1,
  `first-run player should see exactly one safe action; got [${firstRunActionIds.join(", ")}]`,
);
assertArrayIncludes(
  firstRunActionIds,
  "job-safe-kiosk-return",
  "first-run player should be offered the safe kiosk return job",
);

const trustedActionIds = actionIds(availableActionsForMemory(trustedMemory));
assertArrayIncludes(
  trustedActionIds,
  "job-sealed-packet",
  "trusted courier memory should unlock a different job action",
);
assertArrayIncludes(
  trustedActionIds,
  "route-dark-cut-known",
  "dark-cut memory should unlock a route action, not only dialogue",
);

const debtorActionIds = actionIds(availableActionsForMemory(debtorMemory));
assertArrayIncludes(
  debtorActionIds,
  "orra-price-debt",
  "opened-packet debt should surface as a price action",
);

assert(
  memoriesProduceDifferentAvailableActions(firstRunMemory, trustedMemory),
  "different trust/completion memory records must produce different available actions",
);
assert(
  memoriesProduceDifferentAvailableActions(firstRunMemory, debtorMemory),
  "debt memory must produce a different available action set",
);

console.log("mLoopDivergence assertions passed");

// Pure-logic contract test for deliverySnapshotState.
//
// Soren's #2269 review (AI007): the helper changed in isolation is just
// a shallow spread, but the LOAD-BEARING claim is that `delivery.id`
// (round-1 "blue-packet" vs round-2 "red-tag") survives the write side
// of a save. #2267's reload-after-Ask-for-next-job bug is READ-side —
// the restore paths in `aftersign/main.js` were hardcoding `id:
// "blue-packet"` and discarding the saved id — but a passing roundtrip
// here is the WRITE-side contract the restore paths rely on.
//
// This file sits in the aftersign/src/*.test.js grey zone (sibling to
// the module it covers). It is intentionally plain-Node runnable: the
// `test:aftersign:pure` lane invokes pure-runner.ts which imports
// `.test.ts` modules; this `.test.js` export is picked up by the same
// runner once registered (see pure-runner.ts's checklist).
//
// Export-only (no top-level invocation). The pure-runner calls
// `runDeliverySnapshotStateChecks()` itself.

import { deliverySnapshotState } from "./deliverySnapshotState.js";

const assert = (cond, msg) => {
  if (!cond) {
    throw new Error(`deliverySnapshotState check failed: ${msg}`);
  }
};

const assertDeepEqual = (actual, expected, label) => {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(
      `deliverySnapshotState check failed (${label}): expected ${b}, got ${a}`,
    );
  }
};

export const runDeliverySnapshotStateChecks = () => {
  // ROUND 1 (blue packet, undelivered) — the id/outcome pair the save
  // layer reads back on reload.
  {
    const packet = {
      delivered: false,
      route: null,
      sealed: true,
      deliveredAt: null,
    };
    const delivery = { id: "blue-packet", outcome: "unknown" };
    const snap = deliverySnapshotState(packet, delivery);
    assertDeepEqual(
      snap,
      { packet, delivery },
      "round-1 blue-packet roundtrip",
    );
  }

  // ROUND 2 (red-tag handoff, not yet delivered) — this is the shape a
  // reload at the `io-next-job` beat MUST preserve. The restore side
  // (aftersign/main.js) was hardcoding `id: "blue-packet"` and
  // discarding `delivery.id === "red-tag"` from the saved snapshot;
  // asserting the write side here is the contract that bug violates.
  {
    const packet = {
      delivered: false,
      route: null,
      sealed: true,
      deliveredAt: null,
    };
    const delivery = { id: "red-tag", outcome: "unknown" };
    const snap = deliverySnapshotState(packet, delivery);
    assert(
      snap.delivery.id === "red-tag",
      `red-tag id preserved — got ${snap.delivery.id}`,
    );
    assert(
      snap.delivery.outcome === "unknown",
      `red-tag outcome preserved — got ${snap.delivery.outcome}`,
    );
  }

  // ROUND 2 DELIVERED (red-tag completed) — covers the second symptom
  // in #2267 (post-delivery reload). The helper writes it; the restore
  // side has to read it back.
  {
    const packet = {
      delivered: true,
      route: "lit-stair",
      sealed: false,
      deliveredAt: 123456,
    };
    const delivery = { id: "red-tag", outcome: "opened" };
    const snap = deliverySnapshotState(packet, delivery);
    assertDeepEqual(
      snap,
      { packet, delivery },
      "red-tag delivered roundtrip",
    );
  }

  // SHALLOW CLONE — mutating the snapshot MUST NOT mutate the inputs
  // (the state graph the live reducer owns). This is the only
  // behavioral guarantee callers rely on besides field preservation.
  {
    const packet = { delivered: false, sealed: true };
    const delivery = { id: "red-tag", outcome: "unknown" };
    const snap = deliverySnapshotState(packet, delivery);
    snap.packet.sealed = false;
    snap.delivery.outcome = "mutated";
    assert(packet.sealed === true, "packet.sealed un-mutated after snapshot edit");
    assert(
      delivery.outcome === "unknown",
      "delivery.outcome un-mutated after snapshot edit",
    );
  }
};

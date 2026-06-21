// Import-path canary for the relocated multiplayer harness (#162).
//
// Purpose: prove that an agar/e2e/ spec can reach the shared harness at
// `e2e-shared/multiplayer/harness` without forking it into agar/e2e/lib/.
// The first agar-02 implementer will see this file and know which path
// to import from — no detective work, no parallel copy.
//
// This is NOT a real gameplay test. agar-01 (Durable Object + ws echo)
// and agar-02 (authoritative tick) ship the real specs. Until then, the
// canary keeps the import path live so a future package-manager hoist
// or workspace reshuffle can't quietly break it.

import { expect, test } from "@playwright/test";

import { pureReplay, type Reducer, type Tape } from "../../e2e-shared/multiplayer/harness";

interface Counter {
  readonly n: number;
}
const incReducer: Reducer<Counter, number> = (prev, e) => ({
  n: prev.n + e.input,
});

test("agar e2e can import pureReplay from e2e-shared/multiplayer", () => {
  const tape: Tape<number> = [];
  const out = pureReplay<Counter, number>({ n: 0 }, tape, incReducer);
  expect(out.n).toBe(0);
});

// AFTERSIGN slice-1 story-state contract — unit tests.
//
// Runs the three required tests from docs/flagship/story-state-contract.md
// (§ "Required tests") plus the red-polarity break-mode check.
//
// Run: node --test aftersign/tests/story-state.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  createFlagshipGameSurface,
  installFlagshipGameSurface,
  createInMemoryServerStore,
  createMemoryLocalStore,
  AFTERSIGN_STORY_CONSTANTS,
} from "../src/story-state.js";

const {
  SEALED_MEMORY_ID,
  OPENED_MEMORY_ID,
  SEALED_LINE_FRAGMENT,
  OPENED_LINE_FRAGMENT,
  DELIVERY_ID,
} = AFTERSIGN_STORY_CONSTANTS;

function freshWorld(overrides = {}) {
  return {
    playerId: "test-player",
    mode: "test",
    serverStore: createInMemoryServerStore(),
    localStore: createMemoryLocalStore(),
    ...overrides,
  };
}

test("installFlagshipGameSurface wires window.__game with version 1", () => {
  const target = {};
  const surface = installFlagshipGameSurface(target, freshWorld());
  assert.equal(target.__game, surface);
  assert.equal(target.__game.version, 1);
  assert.equal(target.__game.build.slug, "aftersign");
  assert.equal(target.__game.scene.ready, true);
  assert.equal(target.__game.scene.beat, "arrival");
  assert.equal(typeof target.__game.input.choose, "function");
  assert.equal(typeof target.__game.input.forceReload, "function");
  assert.equal(typeof target.__game.input.forceSave, "function");
  assert.equal(typeof target.__game.input.waitForStoryIdle, "function");
});

// Test 1 from the contract: story-state invariants after a sealed delivery.
test("first-session sealed delivery advances beats and delivery outcome", async () => {
  const g = createFlagshipGameSurface(freshWorld());

  assert.equal(g.scene.beat, "arrival");
  assert.equal(g.delivery.outcome, "unknown");
  assert.equal(g.player.flags.io_intro_seen, false);
  assert.equal(g.npcs.io.trustPosture, "untested");

  await g.input.choose("keep-sealed");
  assert.equal(g.scene.beat, "packet-choice");

  await g.input.choose("deliver-packet");
  assert.equal(g.scene.beat, "packet-delivered");
  assert.equal(g.delivery.outcome, "sealed");
  assert.equal(g.delivery.id, DELIVERY_ID);
  assert.equal(g.player.flags.io_intro_seen, true);
  assert.equal(g.npcs.io.trustPosture, "trusted-seal");

  const memory = g.npcs.io.memories.find((m) => m.id === SEALED_MEMORY_ID);
  assert.ok(memory, "sealed memory must exist after delivery");
  assert.equal(memory.source, "server");
  assert.equal(memory.kind, "delivery-outcome");
  assert.equal(memory.deliveryId, DELIVERY_ID);
});

test("open-then-deliver produces the opened outcome and useful-breach posture", async () => {
  const g = createFlagshipGameSurface(freshWorld());
  await g.input.choose("open-packet");
  await g.input.choose("deliver-packet");
  assert.equal(g.delivery.outcome, "opened");
  assert.equal(g.npcs.io.trustPosture, "useful-breach");
  const memory = g.npcs.io.memories.find((m) => m.id === OPENED_MEMORY_ID);
  assert.ok(memory, "opened memory must exist after delivery");
  assert.equal(memory.source, "server");
});

// Test 2 from the contract: NPC memory round-trip across a durable reload.
test("sealed round-trip: forceReload with cleared local state recovers server memory", async () => {
  const world = freshWorld();
  const gA = createFlagshipGameSurface(world);
  await gA.input.choose("keep-sealed");
  await gA.input.choose("deliver-packet");
  await gA.input.forceSave();
  const savedRevision = gA.save.revision;
  assert.ok(savedRevision > 0, "revision must advance after forceSave");
  assert.equal(gA.save.authority, "server");
  assert.equal(gA.save.dirty, false);

  // Session B: forceReload with clearLocalState — must survive because save is
  // held by the server store, not localStorage.
  await gA.input.forceReload({ clearLocalState: true });
  await gA.input.choose("return-to-io");

  assert.equal(gA.scene.beat, "io-return-recognition");
  const memory = gA.npcs.io.memories.find((m) => m.id === SEALED_MEMORY_ID);
  assert.ok(memory, "server-backed memory survives cleared local state");
  assert.equal(memory.source, "server");
  assert.ok(
    gA.npcs.io.lastLine.includes(SEALED_LINE_FRAGMENT),
    `Io line must contain "${SEALED_LINE_FRAGMENT}", got: ${gA.npcs.io.lastLine}`
  );
  assert.deepEqual(gA.npcs.io.lastLineMemoryRefs, [SEALED_MEMORY_ID]);
  assert.equal(gA.save.lastLoadProof.source, "server");
  assert.equal(gA.save.lastLoadProof.playerId, "test-player");
  assert.equal(gA.save.lastLoadProof.revision, savedRevision);
});

test("opened round-trip: line contains the opened fragment and correct memory ref", async () => {
  const world = freshWorld();
  const g = createFlagshipGameSurface(world);
  await g.input.choose("open-packet");
  await g.input.choose("deliver-packet");
  await g.input.forceSave();
  await g.input.forceReload({ clearLocalState: true });
  await g.input.choose("return-to-io");

  assert.ok(
    g.npcs.io.lastLine.includes(OPENED_LINE_FRAGMENT),
    `Io line must contain "${OPENED_LINE_FRAGMENT}", got: ${g.npcs.io.lastLine}`
  );
  assert.deepEqual(g.npcs.io.lastLineMemoryRefs, [OPENED_MEMORY_ID]);
});

// Test 3 from the contract: durable save/load survives cleared local state.
test("durable save/load: player.id, flag, memory, revision all survive clearLocalState", async () => {
  const world = freshWorld();
  const g = createFlagshipGameSurface(world);

  await g.input.choose("keep-sealed");
  await g.input.choose("deliver-packet");
  await g.input.forceSave();
  const revisionBefore = g.save.revision;

  await g.input.forceReload({ clearLocalState: true });

  assert.equal(g.player.id, "test-player");
  assert.equal(g.player.flags.io_intro_seen, true);
  assert.ok(g.save.revision >= revisionBefore, "revision must be monotonic across reload");
  assert.equal(g.save.authority, "server");
  assert.equal(g.save.lastLoadProof.source, "server");
  const memory = g.npcs.io.memories.find((m) => m.id === SEALED_MEMORY_ID);
  assert.ok(memory, "memory survived the reload");
});

// Red polarity: FLAGSHIP_BREAK_MODE=drop-memory must fail the memory round-trip.
test("break mode drop-memory: Io memory absent after reload → recognition line has no memory refs", async () => {
  const world = freshWorld({ breakMode: "drop-memory" });
  const g = createFlagshipGameSurface(world);

  await g.input.choose("keep-sealed");
  await g.input.choose("deliver-packet");
  await g.input.forceSave();
  await g.input.forceReload({ clearLocalState: true });
  await g.input.choose("return-to-io");

  const memory = g.npcs.io.memories.find((m) => m.id === SEALED_MEMORY_ID);
  assert.equal(memory, undefined, "drop-memory must strip the memory on reload");
  assert.deepEqual(g.npcs.io.lastLineMemoryRefs, []);
  assert.ok(
    !g.npcs.io.lastLine.includes(SEALED_LINE_FRAGMENT),
    "recognition line must not claim the memory when it's dropped"
  );
});

// Red polarity: FLAGSHIP_BREAK_MODE=wrong-io-line speaks the swapped line.
test("break mode wrong-io-line: sealed outcome speaks the opened line and fails fragment check", async () => {
  const world = freshWorld({ breakMode: "wrong-io-line" });
  const g = createFlagshipGameSurface(world);

  await g.input.choose("keep-sealed");
  await g.input.choose("deliver-packet");
  await g.input.forceSave();
  await g.input.forceReload({ clearLocalState: true });
  await g.input.choose("return-to-io");

  assert.ok(
    !g.npcs.io.lastLine.includes(SEALED_LINE_FRAGMENT),
    "wrong-io-line must not produce the correct sealed fragment"
  );
  // The line still references the sealed memory id (the bug is line/text mismatch,
  // not a missing memory) — the harness catches it via the fragment check.
  assert.deepEqual(g.npcs.io.lastLineMemoryRefs, [SEALED_MEMORY_ID]);
});

// Red polarity: FLAGSHIP_BREAK_MODE=local-only-save fails the durable proof.
test("break mode local-only-save: state does NOT survive clearLocalState", async () => {
  const world = freshWorld({ breakMode: "local-only-save" });
  const g = createFlagshipGameSurface(world);

  await g.input.choose("keep-sealed");
  await g.input.choose("deliver-packet");
  await g.input.forceSave();
  assert.equal(g.save.authority, "local-fallback", "local-only-save must not claim server authority");

  await g.input.forceReload({ clearLocalState: true });
  await g.input.choose("return-to-io");

  const memory = g.npcs.io.memories.find((m) => m.id === SEALED_MEMORY_ID);
  assert.equal(memory, undefined, "local-only-save memory is gone after clearLocalState");
  assert.notEqual(
    g.save.lastLoadProof.source,
    "server",
    "durable proof must not report server after local-only-save"
  );
});

// Harness quiescence primitive works.
test("waitForStoryIdle resolves after a choice mutation", async () => {
  const g = createFlagshipGameSurface(freshWorld());
  const settled = g.input.waitForStoryIdle();
  await g.input.choose("keep-sealed");
  await settled;
  assert.equal(g.scene.beat, "packet-choice");
});

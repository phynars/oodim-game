import assert from "node:assert/strict";

import {
  advanceRememberingNpcMemory,
  greetRememberingNpc,
  type RememberingNpcPlayerMemory,
} from "./rememberingNpc";

const NOW_MS = Date.UTC(2026, 6, 4, 22, 15, 0);

export function checkFirstGreetingDoesNotPretendToRemember(): void {
  const line = greetRememberingNpc({ nowMs: NOW_MS, playerId: "player-a" });

  assert.equal(line.speaker, "npc");
  assert.equal(line.npcId, "mara-kiosk");
  assert.equal(line.memoryUsed, false);
  assert.match(line.text, /First time under the AFTERSIGN\?/);
}

export function checkReturnGreetingUsesOnlyMatchingPlayerMemory(): void {
  const matchingMemory: RememberingNpcPlayerMemory = {
    playerId: "player-a",
    lastSeenAtMs: NOW_MS - 2 * 24 * 60 * 60 * 1000,
    visits: 2,
    trust: "curious",
    rememberedFacts: ["you would not give the clerk your real name"],
  };
  const line = greetRememberingNpc({ nowMs: NOW_MS, playerId: "player-a", memory: matchingMemory });

  assert.equal(line.memoryUsed, true);
  assert.match(line.text, /It's been 2 nights\./);
  assert.match(line.text, /I saved the question you dodged\./);
  assert.match(line.text, /you would not give the clerk your real name/);

  const wrongPlayerLine = greetRememberingNpc({ nowMs: NOW_MS, playerId: "player-b", memory: matchingMemory });
  assert.equal(wrongPlayerLine.memoryUsed, false);
  assert.match(wrongPlayerLine.text, /First time under the AFTERSIGN\?/);
}

export function checkMemoryAdvanceIsSmallDurableAndBounded(): void {
  const firstMemory = advanceRememberingNpcMemory(
    { nowMs: NOW_MS, playerId: "player-a" },
    "asked about the burned timetable",
  );

  assert.deepEqual(firstMemory, {
    playerId: "player-a",
    lastSeenAtMs: NOW_MS,
    visits: 1,
    trust: "curious",
    rememberedFacts: ["asked about the burned timetable"],
  });

  const nextMemory = advanceRememberingNpcMemory(
    { nowMs: NOW_MS + 1000, playerId: "player-a", memory: firstMemory },
    "left the kiosk bell ringing",
  );

  assert.equal(nextMemory.visits, 2);
  assert.equal(nextMemory.trust, "warm");
  assert.deepEqual(nextMemory.rememberedFacts, ["left the kiosk bell ringing", "asked about the burned timetable"]);
}

export function runRememberingNpcChecks(): void {
  checkFirstGreetingDoesNotPretendToRemember();
  checkReturnGreetingUsesOnlyMatchingPlayerMemory();
  checkMemoryAdvanceIsSmallDurableAndBounded();
}

runRememberingNpcChecks();

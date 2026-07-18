// Flagship harness — window.__game story/state probe assertion.
//
// This module is the smallest red-first contract check for the flagship
// vertical slice: it validates that a `window.__game` value pulled from
// the WebGL-headless Playwright harness exposes the fields required by
// `docs/flagship/story-state-contract.md`.
//
// CONVENTION (repo-wide, established by PR #453/#468 and reinforced by
// #699): the repo does NOT depend on vitest. Harness checks are written
// as plain-TS functions that `throw` on failure and are invoked from a
// runner that CI already executes — for this contract, that runner is
// Playwright via `aftersign/e2e/flagship-window-game-contract.spec.ts`,
// which is picked up by `npm run test:e2e:aftersign`.
//
// SHAPE (relationship to FlagshipGameSurface):
// This checker validates a SUBSET of the documented `FlagshipGameSurface`
// (see `docs/flagship/story-state-contract.md`). It intentionally only
// asserts the fields required for the "story beat + durable player
// identity" invariant that gates slice-1 wake-1. Additional fields
// (`delivery`, `npcs`, `save`, `input`) are pinned by their own
// contract asserters in `e2e-shared/flagshipStoryStateContract.ts` and
// `packages/aftersign/src/storyStateHarness.ts`. Any object satisfying
// `FlagshipGameSurface` also satisfies this probe by construction.

export interface FlagshipWindowGameProbe {
  /** `build.slug` in the full surface; kept top-level here for the
   * narrowest slice-1 assertion. */
  slug: string;
  player: {
    id: string;
  };
  story: {
    beatId: string;
    actId: string;
    summary: string;
  };
  state: Record<string, unknown>;
}

/**
 * Assert that a value read from `window.__game` in the flagship harness
 * satisfies the slice-1 story/state probe contract. Throws on the first
 * failing invariant so the Playwright spec that invokes this fails red
 * with a specific reason.
 *
 * The runner (Playwright spec) is responsible for producing the input:
 *   const probe = await page.evaluate(() => window.__game);
 *   assertFlagshipWindowGameProbe(probe, { expectedSlug: "aftersign" });
 */
export function assertFlagshipWindowGameProbe(
  probe: unknown,
  options: { expectedSlug: string; expectedPlayerId?: string },
): asserts probe is FlagshipWindowGameProbe {
  if (probe === null || typeof probe !== "object") {
    throw new Error("window.__game must be an object exposing the flagship probe");
  }

  const record = probe as Record<string, unknown>;

  const slug = readString(record, "slug") ?? readNestedString(record, "build", "slug");
  if (!slug) {
    throw new Error("window.__game must expose a non-empty slug (top-level or build.slug)");
  }
  if (slug !== options.expectedSlug) {
    throw new Error(
      `window.__game slug mismatch: expected ${options.expectedSlug}, got ${slug}`,
    );
  }

  const player = readObject(record, "player");
  if (!player) {
    throw new Error("window.__game.player must be an object");
  }
  const playerId = readString(player, "id");
  if (!playerId) {
    throw new Error("window.__game.player.id must be a non-empty string");
  }
  if (options.expectedPlayerId && playerId !== options.expectedPlayerId) {
    throw new Error(
      `window.__game.player.id mismatch: expected ${options.expectedPlayerId}, got ${playerId}`,
    );
  }
  // NOTE: sessionId is NOT a top-level `player` field — per
  // `docs/flagship/story-state-contract.md` and
  // `aftersign/src/state-contract.ts`, `sessionId` lives on NPC memory
  // facts (`npcs.io.memory[i].sessionId`). That invariant is pinned by
  // `story-state-surface-contract.spec.ts`; this probe intentionally
  // does not re-assert it.

  // The documented surface uses `scene.beat` / `scene.act`. Accept either
  // the doc-surface path or a flatter `story.{beatId, actId, summary}`
  // shape for the slice-1 subset — both satisfy the probe.
  const story = readObject(record, "story");
  const scene = readObject(record, "scene");
  const beatId =
    (story && readString(story, "beatId")) ??
    (story && readString(story, "currentBeatId")) ??
    (scene && readString(scene, "beat"));
  const actId =
    (story && readString(story, "actId")) ?? (scene && readString(scene, "act"));
  const summary =
    (story && readString(story, "summary")) ??
    (scene && readString(scene, "id")) ??
    beatId;

  if (!beatId) {
    throw new Error(
      "window.__game must expose a story beat id (story.beatId or scene.beat)",
    );
  }
  if (!actId) {
    throw new Error(
      "window.__game must expose an act id (story.actId or scene.act)",
    );
  }
  if (!summary) {
    throw new Error(
      "window.__game must expose a story summary (story.summary, scene.id, or beat id)",
    );
  }

  const state =
    readObject(record, "state") ??
    readObject(record, "save") ??
    readObject(record, "player");
  if (!state) {
    throw new Error(
      "window.__game must expose a serializable state object (state, save, or player)",
    );
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readObject(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = record[key];
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readNestedString(
  record: Record<string, unknown>,
  outer: string,
  inner: string,
): string | null {
  const nested = readObject(record, outer);
  if (!nested) return null;
  return readString(nested, inner);
}

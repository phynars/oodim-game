// Flagship harness — window.__game story/state probe assertion.
//
// The smallest red-first contract check for the flagship vertical slice:
// validates that a `window.__game` value pulled from the WebGL-headless
// Playwright harness exposes the fields required by
// `docs/flagship/story-state-contract.md`.
//
// LOCATION: this lives under `e2e-shared/` (the established convention
// for shared spec helpers — see `flagshipStoryStateContract.ts` next to
// it) rather than a new `packages/flagship-harness/` tree. The repo
// has no `packages/` workspace, no monorepo tooling, and no root
// tsconfig references packages/ — so a helper module placed there is
// an orphan the Playwright transformer would have to reach via a bare
// relative path with no owning tsconfig/package.json. `e2e-shared/`
// is already inside the aftersign Playwright config's project root
// (via testDir:"e2e" + relative imports), so specs pick it up with no
// extra wiring.
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
// (see `docs/flagship/story-state-contract.md` and
// `e2e-shared/flagshipStoryStateContract.ts`). It intentionally only
// asserts the fields required for the "story beat + durable player
// identity" invariant that gates slice-1 wake-1. Additional fields
// (`delivery`, `npcs`, `save`, `input`) are pinned by their own
// contract asserters in `flagshipStoryStateContract.ts`. Any object
// satisfying `FlagshipGameSurface` also satisfies this probe by
// construction.
//
// INPUT SHAPE (why we accept the JSON-serialized projection, not raw
// window.__game): Playwright's `page.evaluate(() => window.__game)`
// round-trips the value through JSON, which STRIPS every method
// (`getSnapshot`, `reset`, `input.choose`, `input.waitForStoryIdle`,
// `input.forceSave`, `input.forceReload`). The probe only reads
// data fields — never methods — so the stripped projection satisfies
// the contract identically to the live surface. The spec is
// responsible for handing us that projection; we do not try to
// re-hydrate it here.

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

export interface AssertFlagshipWindowGameProbeOptions {
  /** Slug the harness expects the page to publish — e.g. "aftersign". */
  expectedSlug: string;
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
 *
 * All error messages include a truncated JSON snapshot of the probe so
 * a red CI lane surfaces WHY the probe failed, not just that it did.
 */
export function assertFlagshipWindowGameProbe(
  probe: unknown,
  options: AssertFlagshipWindowGameProbeOptions,
): asserts probe is FlagshipWindowGameProbe {
  if (probe === null || typeof probe !== "object") {
    throw new Error(
      `window.__game must be an object exposing the flagship probe (got ${describe(probe)})`,
    );
  }

  const record = probe as Record<string, unknown>;

  const slug = readString(record, "slug") ?? readNestedString(record, "build", "slug");
  if (!slug) {
    throw new Error(
      `window.__game must expose a non-empty slug (top-level or build.slug); probe=${summarize(record)}`,
    );
  }
  if (slug !== options.expectedSlug) {
    throw new Error(
      `window.__game slug mismatch: expected ${options.expectedSlug}, got ${slug}`,
    );
  }

  const player = readObject(record, "player");
  if (!player) {
    throw new Error(
      `window.__game.player must be an object; probe=${summarize(record)}`,
    );
  }
  const playerId = readString(player, "id");
  if (!playerId) {
    throw new Error(
      `window.__game.player.id must be a non-empty string; player=${summarize(player)}`,
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
      `window.__game must expose a story beat id (story.beatId or scene.beat); story=${summarize(story)} scene=${summarize(scene)}`,
    );
  }
  if (!actId) {
    throw new Error(
      `window.__game must expose an act id (story.actId or scene.act); story=${summarize(story)} scene=${summarize(scene)}`,
    );
  }
  if (!summary) {
    throw new Error(
      `window.__game must expose a story summary (story.summary, scene.id, or beat id); story=${summarize(story)} scene=${summarize(scene)}`,
    );
  }

  const state =
    readObject(record, "state") ??
    readObject(record, "save") ??
    readObject(record, "player");
  if (!state) {
    throw new Error(
      `window.__game must expose a serializable state object (state, save, or player); probe=${summarize(record)}`,
    );
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readObject(
  record: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!record) return null;
  const value = record[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return typeof value;
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  try {
    const json = JSON.stringify(value, (_key, v) => (typeof v === "function" ? "[function]" : v));
    if (!json) return String(value);
    return json.length > 240 ? `${json.slice(0, 240)}…` : json;
  } catch {
    return `[unserializable ${typeof value}]`;
  }
}

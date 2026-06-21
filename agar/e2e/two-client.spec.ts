import { test } from "@playwright/test";
import {
  canonical,
  expectConverge,
  driveTape,
  disconnect,
  reconnect,
  assertClientSurface,
  readAppliedLog,
} from "../../e2e-shared/multiplayer/playwright-binding";
import type { PageLike, Tape } from "../../e2e-shared/multiplayer/harness";

// agar slice 4/4 — TWO-CLIENT e2e (#180). THE RUNG.
//
// Merge gate per #180:
//   • Two contexts join the same room.
//   • Both render each other's positions (canonical state agrees).
//   • Client prediction reconciles to the server snapshot.
//   • Ordering invariant: DO apply-order == canonical (tick, clientId, seq).
//   • Reconnect-replay: one client drops, reconnects, converges.
//   • Zero `waitForTimeout`. Quiesce on tick boundaries only.
//   • Fixture `desync-broken` server (drops every 7th input) goes RED.
//
// This spec consumes the harness primitives from `e2e-shared/multiplayer`
// directly — per #129's "second multiplayer game must reuse them as-is"
// clause. Do NOT clone the primitives into `agar/e2e/lib/`.
//
// FIXTURE SWITCH
//   AGAR_SERVER_FIXTURE=desync-broken
//     The webServer in playwright.config.ts boots the sibling worker at
//     `agar/server/fixture/desync-broken/worker.ts` instead of the
//     production DO. The same spec runs RED against it (`expectConverge`
//     and `expectCanonicalApplied` both throw — the fixture's dropped
//     events make the per-peer canonical states diverge AND make the
//     applied-log come up short by ~⅐ of the tape) and GREEN against
//     main. The fixture is in-repo (not a separate broken branch) per
//     #180's "Required failing fixture" clause.
//
// ROOM MODEL
//   The DO routes by `match:${seedParam}`. Two contexts hitting the same
//   `?seed=` land in the same DO. The harness uses that seed as the
//   room key; `clientId` is supplied per-context via `?clientId=` so the
//   server has a stable per-socket identity (the harness's `driveTape`
//   reads `__game.clientId` to fan tape events to the right page).

const ROOM_SEED = 4242;
const PLAYERS = ["A", "B"] as const;

// Deterministic tape. Two clients, interleaved inputs across ticks. Per
// #180 + the harness contract: events are keyed by (tick, clientId, seq);
// `driveTape` fans them per-client. We keep the tape small (~16 events)
// so the suite is fast; the merge gate is convergence, not throughput.
const TAPE: Tape<{ dir: "up" | "down" | "left" | "right" | "none" }> = [
  { tick: 1,  clientId: "A", seq: 0, input: { dir: "right" } },
  { tick: 1,  clientId: "B", seq: 0, input: { dir: "down"  } },
  { tick: 3,  clientId: "A", seq: 1, input: { dir: "right" } },
  { tick: 3,  clientId: "B", seq: 1, input: { dir: "down"  } },
  { tick: 5,  clientId: "A", seq: 2, input: { dir: "down"  } },
  { tick: 5,  clientId: "B", seq: 2, input: { dir: "left"  } },
  { tick: 7,  clientId: "A", seq: 3, input: { dir: "left"  } },
  { tick: 7,  clientId: "B", seq: 3, input: { dir: "left"  } },
  { tick: 9,  clientId: "A", seq: 4, input: { dir: "up"    } },
  { tick: 9,  clientId: "B", seq: 4, input: { dir: "up"    } },
  { tick: 11, clientId: "A", seq: 5, input: { dir: "none"  } },
  { tick: 11, clientId: "B", seq: 5, input: { dir: "right" } },
  { tick: 13, clientId: "A", seq: 6, input: { dir: "right" } },
  { tick: 13, clientId: "B", seq: 6, input: { dir: "right" } },
  { tick: 15, clientId: "A", seq: 7, input: { dir: "down"  } },
  { tick: 15, clientId: "B", seq: 7, input: { dir: "up"    } },
];

// Second tape used post-reconnect — drives both clients past the
// reconnect boundary so the convergence check has work to chew on.
const TAPE_POST_RECONNECT: Tape<{
  dir: "up" | "down" | "left" | "right" | "none";
}> = [
  { tick: 17, clientId: "A", seq: 8, input: { dir: "right" } },
  { tick: 17, clientId: "B", seq: 8, input: { dir: "right" } },
  { tick: 19, clientId: "A", seq: 9, input: { dir: "down"  } },
  { tick: 19, clientId: "B", seq: 9, input: { dir: "left"  } },
];

/**
 * Assert the page's appliedLog is canonical for `tape`. Two conditions:
 *
 *   1. Every tape event appears in the log exactly once, identified by
 *      `clientId:seq`. A dropped event (the desync-broken fixture's
 *      "drop every 7th input" break) trips this — the count mismatches
 *      and the error names the missing `clientId:seq` pair.
 *   2. The log is sorted in canonical (tick asc, clientId-lex asc, seq
 *      asc) order. A DO that drains its per-client queues out of
 *      clientId-lex order, or applies events out of per-client seq
 *      order within a tick, trips this with the specific index.
 *
 * The absolute `tick` numbers in the log are NOT compared against the
 * tape's `tick` field (see the call-site comment for why).
 */
async function expectCanonicalApplied<T>(
  page: PageLike,
  tape: Tape<T>,
): Promise<void> {
  const log = await readAppliedLog(page);
  if (!Array.isArray(log)) {
    throw new Error(
      `expectCanonicalApplied: appliedLog is not an array (typeof=${typeof log})`,
    );
  }
  const KEY = /^(\d+):([^:]+):(\d+)$/;
  const parsed: Array<{ key: string; tick: number; clientId: string; seq: number }> = [];
  for (const entry of log) {
    if (typeof entry !== "string") {
      throw new Error(
        `expectCanonicalApplied: appliedLog entry is not a string: ${JSON.stringify(entry)}`,
      );
    }
    const m = KEY.exec(entry);
    if (!m) {
      throw new Error(
        `expectCanonicalApplied: appliedLog entry "${entry}" does not match "tick:clientId:seq" shape`,
      );
    }
    parsed.push({
      key: entry,
      tick: Number(m[1]),
      clientId: m[2]!,
      seq: Number(m[3]),
    });
  }

  // (1) Every tape event present, matched on (clientId, seq).
  const logPairs = new Set(parsed.map((p) => `${p.clientId}:${p.seq}`));
  const missing: string[] = [];
  for (const ev of tape) {
    const pair = `${ev.clientId}:${ev.seq}`;
    if (!logPairs.has(pair)) missing.push(pair);
  }
  if (missing.length > 0) {
    throw new Error(
      `expectCanonicalApplied: appliedLog is missing tape events (clientId:seq): ${missing.join(
        ", ",
      )}. The DO dropped or never received these inputs.`,
    );
  }
  if (parsed.length !== tape.length) {
    throw new Error(
      `expectCanonicalApplied: appliedLog length ${parsed.length} ≠ tape length ${tape.length} (every event present, but extras detected — duplicate apply?)`,
    );
  }

  // (2) Log is in canonical (tick asc, clientId-lex asc, seq asc) order.
  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1]!;
    const cur = parsed[i]!;
    const order =
      prev.tick !== cur.tick
        ? prev.tick - cur.tick
        : prev.clientId !== cur.clientId
          ? prev.clientId < cur.clientId
            ? -1
            : 1
          : prev.seq - cur.seq;
    if (order > 0) {
      throw new Error(
        `expectCanonicalApplied: appliedLog out of canonical order at index ${i}: "${prev.key}" before "${cur.key}". Canonical order is (tick asc, clientId-lex asc, seq asc).`,
      );
    }
  }
}

test.describe("agar slice 4 — two-client convergence (the rung)", () => {
  test("two contexts in one room see each other; ordering + reconnect-replay all converge", async ({
    browser,
  }) => {
    // Two browser contexts = two independent cookie jars, ws connections,
    // and worker isolates. This is the multiplayer reality the rung
    // exists to prove.
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Both contexts join the SAME room (same ?seed=), with distinct
      // ?clientId=. The DO's `idFromName('match:${seed}')` routes both
      // sockets to the same DO instance — that's the room.
      await Promise.all([
        pageA.goto(`/agar/?seed=${ROOM_SEED}&clientId=${PLAYERS[0]}`),
        pageB.goto(`/agar/?seed=${ROOM_SEED}&clientId=${PLAYERS[1]}`),
      ]);

      // Surface preflight on both — fails loud and by name if the agar
      // client doesn't expose the 8 normative fields (incl. clientId).
      // The harness's drive primitives need clientId to fan tape events.
      const pages: readonly PageLike[] = [
        pageA as unknown as PageLike,
        pageB as unknown as PageLike,
      ];
      await assertClientSurface(pages[0]!);
      await assertClientSurface(pages[1]!);

      // ── 1. Drive the deterministic tape across both clients ─────────
      await driveTape(pages, TAPE, { seed: ROOM_SEED });

      // ── 2. Convergence: structural equality on canonical state ──────
      // Both pages must agree on the full roster (both players' state),
      // not just their own. expectConverge quiesces on tick boundaries
      // via canonical(); zero wallclock.
      await expectConverge(pages);

      // ── 3. Ordering invariant: DO apply-order == canonical order ────
      // Each page's appliedLog must be in canonical
      // (tick asc, clientId-lex, seq asc) order AND must contain
      // exactly one `tick:clientId:seq` key per tape event (matched on
      // `clientId:seq` — the DO assigns the absolute `tick`, the
      // harness picks the relative order). This is the merge gate:
      //
      //   • dropped event   → entry count mismatch (catches the
      //     desync-broken fixture's "drop every 7th input" break).
      //   • re-ordered apply → canonical-sort check fails on the actual
      //     log (catches a DO that drains pending out of clientId-lex
      //     order, or out of per-client seq order).
      //
      // We don't compare against the tape's absolute `tick` values:
      // the DO assigns tick at drain time (wall-clock 50ms), and the
      // harness's `tickTo(target)` only guarantees the DO is at AT
      // LEAST `target-1` before sending — never exactly `target-1`.
      // A wall-clock-faster DO than the harness loop would still apply
      // every event in canonical order, just at higher tick numbers.
      // The merge gate is "canonical order + every event present",
      // not "absolute ticks match the tape's wallclock estimate".
      await expectCanonicalApplied(pages[0]!, TAPE);
      await expectCanonicalApplied(pages[1]!, TAPE);

      // ── 4. Reconnect-replay equivalence ─────────────────────────────
      // Drop B mid-session, drive more inputs through both A and B
      // (B's go into its outbox — the harness queues until reconnect),
      // then reconnect B and assert convergence. The DO must replay
      // missed state on reconnect; B's final canonical equals A's.
      await disconnect(pages[1]!);
      await driveTape(pages, TAPE_POST_RECONNECT, { seed: ROOM_SEED });
      await reconnect(pages[1]!);

      // Final canonical equality is the merge gate. If the DO failed to
      // replay missed state, B's roster lags A's and structural equality
      // fails with a precise diff in the message.
      await expectConverge(pages);

      // Final ordering check — the combined tape's apply-order must
      // still be canonical on the never-disconnected client.
      const fullTape: Tape<{
        dir: "up" | "down" | "left" | "right" | "none";
      }> = [...TAPE, ...TAPE_POST_RECONNECT];
      await expectCanonicalApplied(pages[0]!, fullTape);
      await expectCanonicalApplied(pages[1]!, fullTape);

      // Sanity belt-and-suspenders: read the canonical roster off A
      // and confirm BOTH players are present. A spec that "converges"
      // because both sides see an empty roster is a vacuous pass; the
      // rung exists precisely to prevent that.
      const finalA = (await canonical(pages[0]!)) as {
        players?: Record<string, unknown>;
      } | null;
      if (
        !finalA ||
        typeof finalA !== "object" ||
        !finalA.players ||
        typeof finalA.players !== "object"
      ) {
        throw new Error(
          "two-client merge gate: canonical.players roster missing — the " +
            "single-client (slice 3) WorldState shape is not enough for #180. " +
            "Server must expose a per-clientId roster.",
        );
      }
      const roster = Object.keys(finalA.players);
      if (!roster.includes(PLAYERS[0]) || !roster.includes(PLAYERS[1])) {
        throw new Error(
          `two-client merge gate: canonical.players roster ${JSON.stringify(
            roster,
          )} missing one of ${JSON.stringify(PLAYERS)} — both contexts must ` +
            "appear on each peer for the rung to count.",
        );
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

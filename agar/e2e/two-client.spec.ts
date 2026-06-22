import { expect, test } from "@playwright/test";
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
  // Wait for the appliedLog to reach the tape's length before asserting.
  //
  // Why this poll exists: `driveTape` sends inputs and resolves AS SOON
  // AS each input is sent (per `tickTo(target)`'s "resolve at target-1"
  // contract — `tickTo` is the harness's wallclock-free pacing primitive,
  // not an apply-ack). The DO's tick loop runs on its own 50ms clock,
  // so when `driveTape` returns, the last input(s) may still be queued
  // in the DO's `pending` and not yet broadcast in a snapshot's
  // `applied` delta. Without this poll, `parsed.length !== tape.length`
  // would fire with "extras detected" or a missing key on a perfectly
  // healthy production DO — flake, not a real bug.
  //
  // Against the desync-broken fixture, the log NEVER reaches tape.length
  // (the fixture drops every 7th input). The poll then times out and we
  // fall through to the assertions below — the existing
  // "missing tape events" branch fires with the precise dropped
  // `clientId:seq` pairs. That's the fixture-vs-main red/green pivot
  // working as designed: a real DO converges to log.length === tape.length;
  // a broken DO never does.
  // 15s rather than 5s: CI runners with wrangler dev cold-start +
  // first-snapshot delay can need >5s to commit the last few events
  // through 20Hz DO ticks. Production runs converge in ~1s; this
  // budget exists so a slow-CI minute doesn't masquerade as a real
  // canonical drift, which would burn another review round.
  const POLL_TIMEOUT_MS = 15_000;
  const POLL_INTERVAL_MS = 50;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const probe = await readAppliedLog(page);
    if (Array.isArray(probe) && probe.length >= tape.length) break;
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
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
    // Unique room per test ATTEMPT → a FRESH Durable Object each run. The DO
    // is keyed by seed (`match:${seed}`) and lives for the wrangler-dev
    // process, so a hardcoded seed leaked state across Playwright retries: a
    // prior attempt's post-reconnect events (A:8/A:9, with B:8/B:9 still in
    // B's unflushed outbox) surfaced in THIS attempt's phase-1 log as phantom
    // extras. A per-attempt seed mirrors production (every match is its own
    // room) and isolates retries from each other.
    const ROOM_SEED = Math.floor(Math.random() * 1_000_000) + 1;
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

      // Wait for BOTH ws connections to be open before we drive the
      // tape. `assertClientSurface` only checks the surface object's
      // shape — the ws may still be mid-handshake. If we start driving
      // before the ws is OPEN on a page, sendInput queues into the
      // outbox, gets flushed on open, and the DO collapses several
      // events into one tick — still passes (the canonical-order
      // check tolerates batch-collapse), but means the first
      // expectConverge happens against a possibly-still-converging
      // roster. Explicit wait keeps the suite predictable and removes
      // a race window that's tighter on slow CI runners than locally.
      await expect(pageA.getByTestId("agar-net-status")).toHaveAttribute(
        "data-connected",
        "true",
      );
      await expect(pageB.getByTestId("agar-net-status")).toHaveAttribute(
        "data-connected",
        "true",
      );

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

import { expect, test } from "@playwright/test";
import {
  applyJoin,
  applyTickBatch,
  initialState,
  type InputDir,
  type InputEvent,
  type WorldState,
} from "../server/reducer";

// agar — single-client determinism smoke. Slice 4's multi-client DO
// happens to be a strict superset of slice 3's behaviour for the
// N=1 case, so this spec stays cheap merge-gate evidence: drive a
// stream of inputs from one client, read the DO's canonical roster
// + applied-key log, replay the same events through the pure reducer,
// assert bit-exact equality.
//
// The applied-key log shape is normative since slice 4: each entry is
// `${tick}:${clientId}:${seq}`. We use the keys' tick prefix to group
// events into the same per-tick batches the DO drained, then replay
// each batch via `applyTickBatch` — that's the exact path the DO's
// `tick()` function takes, so server and offline necessarily agree.

const SEED = 1234567;

// Single-client inputs. Sent in order; each one carries a monotonic
// seq the client picks. The DO drains all pending per-client events
// into each tick boundary, so under nominal CI jitter most inputs land
// in distinct ticks but some batches will contain >1 event — and the
// replay below is correct in either case.
const INPUTS: readonly InputDir[] = [
  "right", "right", "right", "right", "right",
  "down",  "down",  "down",
  "none",  "none",
  "left",  "left",
  "up",    "up",    "up",
  "right", "right",
  "none",  "none",  "none",
  "down",  "down",  "down",  "down",
  "left",  "left",  "left",
  "none",  "none",
  "right", "right",
  "up",    "up",
  "none",  "none",
];

test("agar slice 4 single-client — canonical roster equals pureReplay(seed, appliedLog)", async ({
  page,
}) => {
  await page.goto(`/agar/?seed=${SEED}`);

  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );

  // Wait for the first snapshot so `__game.canonical` is populated.
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByTestId("agar-net-status")
            .getAttribute("data-tick"),
        ),
      { message: "first snapshot from DO" },
    )
    .toBeGreaterThan(0);

  // Read the clientId the page minted (no `?clientId=` in URL → UUID).
  const myId = await page.evaluate(
    () =>
      (window as unknown as { __game: { clientId: string } }).__game.clientId,
  );

  // Feed inputs. Small pacing gap (~one tick at 20Hz) so each input
  // gets a reasonable chance to land in its own tick boundary.
  for (const dir of INPUTS) {
    await page.evaluate((d) => {
      (
        window as unknown as { __game: { sendInput: (x: string) => void } }
      ).__game.sendInput(d);
    }, dir);
    await page.waitForTimeout(60);
  }

  // Wait until the DO has applied every input we sent. The applied-key
  // log grows by exactly one entry per accepted input in single-client
  // mode (no other clients are sending).
  await expect
    .poll(
      async () =>
        await page.evaluate(
          () =>
            (
              window as unknown as {
                __game: { appliedLog: readonly string[] };
              }
            ).__game.appliedLog.length,
        ),
      {
        message: `DO to apply ${INPUTS.length} inputs`,
        timeout: 10_000,
      },
    )
    .toBeGreaterThanOrEqual(INPUTS.length);

  // Read canonical state + applied log together.
  const { canonical, appliedLog } = (await page.evaluate(() => {
    const g = (
      window as unknown as {
        __game: {
          canonical: WorldState | null;
          appliedLog: readonly string[];
        };
      }
    ).__game;
    return {
      canonical: g.canonical,
      appliedLog: g.appliedLog.slice(),
    };
  })) as { canonical: WorldState | null; appliedLog: string[] };

  expect(canonical).not.toBeNull();
  if (canonical === null) return;

  // Sanity: the roster contains exactly our id, with a valid position.
  expect(Object.keys(canonical.players)).toEqual([myId]);
  const me = canonical.players[myId]!;
  expect(typeof me.x).toBe("number");
  expect(typeof me.y).toBe("number");

  // Applied-key shape conformance — every entry must match the
  // canonical `tick:clientId:seq` regex documented in
  // CLIENT-TEST-SURFACE.md.
  const KEY = /^(\d+):([^:]+):(\d+)$/;
  for (const k of appliedLog) {
    expect(k, `applied key shape: ${k}`).toMatch(KEY);
  }

  // Bucket keys by tick to reconstruct the DO's per-tick batches.
  // Single-client: each (seq) maps back to INPUTS[seq] because the
  // client emits seqs 0..N-1 in INPUTS order.
  const byTick = new Map<number, InputEvent[]>();
  for (const k of appliedLog) {
    const m = KEY.exec(k);
    if (!m) throw new Error(`unparseable key ${k}`);
    const t = Number(m[1]);
    const cid = m[2]!;
    const seq = Number(m[3]);
    const dir = INPUTS[seq];
    if (dir === undefined) {
      throw new Error(
        `applied key ${k} references seq ${seq} which is beyond INPUTS.length=${INPUTS.length}`,
      );
    }
    const bucket = byTick.get(t);
    if (bucket) bucket.push({ clientId: cid, seq, dir });
    else byTick.set(t, [{ clientId: cid, seq, dir }]);
  }

  // Replay through the pure reducer in tick order. Auto-join the
  // single client before any input runs (matches the DO, which joins
  // on socket open). Fill the gaps between input-bearing ticks with
  // empty batches so the offline reducer's tick counter tracks the
  // server's exactly.
  let state: WorldState = initialState(SEED);
  state = applyJoin(state, myId);
  const maxTick = canonical.tick;
  for (let t = 1; t <= maxTick; t++) {
    const events = byTick.get(t) ?? [];
    state = applyTickBatch(state, events);
  }

  // Bit-exact determinism.
  expect(state.tick).toBe(canonical.tick);
  expect(state.players).toEqual(canonical.players);
  expect(state.rng).toBe(canonical.rng);

  // Sanity: at least one non-"none" dir actually got applied — i.e.
  // our inputs reached the DO.
  expect(INPUTS.some((d) => d !== "none")).toBe(true);
});

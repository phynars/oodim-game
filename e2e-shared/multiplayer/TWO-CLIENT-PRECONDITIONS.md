# Two-client multiplayer test pre-conditions

Binding spec for any two-client e2e against the agar Durable Object (and
any future DO that uses the same broadcast-to-live-sockets shape). These
are the pre-conditions that, if violated, produce a RED merge gate for
benign reasons — which would invite "relax the equality" as the fix and
collapse the merge gate back to PR-#440-style theatre.

Refs #234 (multiplayer-convergence spec), #180 (the rung).

---

## Pre-condition 1 — Both clients WS-open BEFORE the first `sendInput`

### The trap

The agar DO (`agar/server/worker.ts`) broadcasts each tick's snapshot only
to the sockets that are connected AT THAT TICK. It does NOT replay the
historical apply-stream to a late joiner.

- Server: `for (const s of this.sockets) { s.send(snapshot); }`
  (`agar/server/worker.ts:92-97`).
- Client: `appliedLog.push(parsed.dir)` on EVERY received snapshot
  (`agar/src/main.ts:207`).

So if client B connects after client A has driven N inputs, B's
`appliedLog` is empty for those N ticks. `A.appliedLog == B.appliedLog`
fails — for a benign join-race reason, not an ordering bug.

### The required shape

```ts
// Open BOTH pages and wait for each to report ws-connected BEFORE any
// sendInput call on either page.
await Promise.all([pageA.goto(url), pageB.goto(url)]);
for (const p of [pageA, pageB]) {
  await p
    .locator('[data-testid=agar-net-status][data-connected=true]')
    .waitFor();
}
// Only NOW drive the tape.
await driveTape(pageA, tape);
```

The `data-connected=true` probe is already installed at
`agar/src/main.ts:163` — use it, do not `waitForTimeout`.

### Reconnect-spec corollary

For the reconnect test, B's post-reconnect `appliedLog` resumes at the
post-reconnect tick (DO does not replay history). The equality window
must be NAMED EXPLICITLY:

```ts
// Capture B's tick at disconnect; B's appliedLog covers ticks [1..T_b].
// After B reconnects, B observes ticks [T_b_resume..end].
// The comparable window is the intersection — assert per-tick alignment
// inside that window, not on full-array equality.
expect(B.appliedLog.slice(-k)).toEqual(A.appliedLog.slice(-k));
// where k = B.appliedLog.length post-reconnect-quiesced.
```

Do NOT just assert `A.canonical === B.canonical` — canonical alone can
converge even if the ordering inside the window diverged (latest-input-
wins can collapse different orders to the same terminal position).

---

## Pre-condition 2 — Per-test unique seeds (seed IS the DO routing key)

### The trap

`agar/server/worker.ts:167` routes via:

```ts
const id = env.ECHO_ROOM.idFromName(`match:${seedParam}`);
```

`seed` is BOTH the reducer determinism dial AND the DO routing key. Two
spec files using the same `?seed=` value share ONE DO instance across
parallel Playwright workers. `tick.spec.ts` already hardcodes a seed —
adding the convergence + reconnect specs with the same default seed will
cross-contaminate them.

### The required shape

Per-test unique seed, derived from test identity:

```ts
function uniqueSeed(testInfo: TestInfo): number {
  // Hash the test title + worker index into a deterministic int.
  // Tests in the same file get distinct seeds; reruns of the same test
  // get the same seed (replay determinism preserved).
  const key = `${testInfo.workerIndex}:${testInfo.title}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }
  return (h >>> 0) || 1;
}

test("convergence", async ({ page }, testInfo) => {
  const seed = uniqueSeed(testInfo);
  await page.goto(`/?seed=${seed}`);
  // ...
});
```

### Long-term shape (deferred to a sibling issue, NOT #234)

Decouple routing from determinism: accept `?room=` for the DO key,
keep `?seed=` for the reducer seed. `seed` is a determinism dial; it
should not also be a routing dial. Out of scope for the convergence
spec — per-test-unique-seeds is the cheaper unblock now — but worth a
follow-up issue when slice 4 lands.

---

## Verification checklist for any new two-client spec

Before approving a two-client spec PR, confirm:

- [ ] Both pages reach `[data-connected=true]` BEFORE any `sendInput`.
- [ ] Per-test unique seed (no shared `SEED` constant across spec files).
- [ ] Equality window is named explicitly when reconnect is involved
      (not blanket `expect(A.appliedLog).toEqual(B.appliedLog)`).
- [ ] No `waitForTimeout` anywhere.
- [ ] Spec goes RED against `DESYNC_BROKEN=1` build flag (see
      `FIXTURE-DESYNC-BROKEN.md`) — fixture polarity is the merge gate.

---

_Refs #234. Filed by Soren as binding pre-spec so the merge gate the
studio is about to lean on is a real test, not a binding-still-loads
probe._

# `fixture/desync-broken` — the failing-fixture merge gate for #180

This directory is a **deliberately broken** agar server, kept in-repo as
the receipt that the two-client e2e at `agar/e2e/two-client.spec.ts`
genuinely catches multiplayer divergence. Per #180's acceptance:

> **Required failing fixture:** a deliberately broken DO (drops every
> 7th input), kept in-repo as `fixture/desync-broken` — the suite goes
> **red** against it and **green** against `main`.

## How to run the e2e against this fixture

Set `AGAR_SERVER_FIXTURE=desync-broken` before invoking the two-client
suite. `agar/playwright.config.ts`'s second webServer reads that env
var and boots `agar/server/fixture/desync-broken/worker.ts` instead of
the production `agar/server/worker.ts`. Same baseURL, same port, same
spec — the only difference is the server code path.

```sh
AGAR_SERVER_FIXTURE=desync-broken npx playwright test --config agar/playwright.config.ts agar/e2e/two-client.spec.ts
# expected: suite goes RED at expectConverge or expectOrderingInvariant.

npx playwright test --config agar/playwright.config.ts agar/e2e/two-client.spec.ts
# expected: suite goes GREEN.
```

## The single break

The fixture drops every 7th input it receives (1-indexed across the
combined input stream from all sockets in a room). All other code paths
are byte-identical to the production DO — same reducer, same tick loop,
same snapshot shape, same routing. The break is one `if` statement,
intentionally narrow, so that:

- `expectConverge` between the never-dropped peer and the dropped one
  diverges (their canonical rosters drift apart).
- `expectOrderingInvariant` against the supplied tape catches the
  missing event in the applied-log.

This mirrors the harness's own `HARNESS_BREAK_MODE=drop-every-7th`
self-test (see `e2e-shared/multiplayer/harness.ts`) — same break, but
exercised server-side so the failure is end-to-end, not unit-level.

## Why a fixture worker, not a `HARNESS_BREAK_MODE` env

The harness self-test runs the PURE pieces of the harness under a
break mode. #180's rung is the integration: a real DO, a real ws, two
real browser contexts. The break has to live on the SERVER side of
the wire for the e2e to be the merge gate it claims to be. A
client-side break would prove only that the harness primitives detect
client-side drift; the rung proves the harness detects SERVER-AUTHORITATIVE
drift, which is the whole point of the agar epic.

## Why in-repo, not a separate broken branch

A broken branch would rot — nobody runs it, the harness contract
drifts, and the next person who touches the harness has no signal that
their refactor accidentally made the test unfalsifiable. In-repo means
the fixture lives next to the production server, gets type-checked on
every build, and the CI matrix can run the suite against both code
paths from one workflow file.

## Boundary: do NOT generalise

This fixture exists for ONE assertion: that the two-client e2e is
falsifiable. Do not:

- add more break modes (per-input vs per-snapshot vs RNG drift) — that
  belongs in the harness's `HARNESS_BREAK_MODE` matrix, not here;
- consume the fixture from production code paths;
- expand the directory into a "test-double agar server" — keep it as a
  single-file `worker.ts` that diffs minimally against the production
  worker. The smaller the diff, the more credible the receipt.

Refs #180, #129.

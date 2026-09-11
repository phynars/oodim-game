# Handoff: io-greeting parallel-contract rejection (Refs #1720)

PR #1720 revision **deletes** `aftersign/io-greeting.js`. Soren's
REQUEST_CHANGES review was correct, and it is the FOURTH repetition of
the parallel-contract pattern already documented in `HANDOFF-1535.md`,
`HANDOFF-1694.md`, and `HANDOFF-1698.md`.

## Why deletion, not wire-up

Three failures compound in the one file:

1. **Zero consumers.** No import of `IO_FIRST_CONTACT_GREETING` or
   `createIoFirstContactGreeting` anywhere in the tree. No
   `aftersign/main.js` wiring, no consumer under
   `apps/web/src/aftersign/`, no spec.
2. **Invisible to typecheck.** File lives at repo-root `aftersign/`,
   outside both TypeScript project scopes (`aftersign/tsconfig.json`
   `include: ["src"]` and `apps/web`'s
   `include: ["../apps/web/src/aftersign/**/*.ts"]`), and neither
   config sets `allowJs`. `typecheck:aftersign` cannot see it.
3. **Parallel vocabulary for a beat that already ships.** Io's
   first-contact line is not a missing surface — it is the `arrival`
   entry in `apps/web/src/aftersign/ioFirstSceneDialogue.ts`:

   ```ts
   {
     id: "arrival",
     intent: "anchor",
     text: "You made the stairs after dark. Good. Vey still owes you a name.",
   }
   ```

   That line is already reached by the runtime through
   `resolveAftersignRememberingNpcDialogue` (see
   `apps/web/src/aftersign/harness/bootWindowGame.ts` line 1173 —
   `getRememberingNpcDialogue`) and pinned by
   `ioFirstSceneDialogue.test.ts` +
   `windowGameHarnessBoot.test.ts` (line 1000, asserts the authored
   line comes back from the shipped resolver).

   `io-greeting.js` proposed a SECOND anchor line ("Night Post. If
   you're here for a name, bring one worth carrying.") with a
   parallel vocabulary — `IO_FIRST_CONTACT_GREETING` vs the shipped
   `AFTERSIGN_IO_FIRST_SCENE_DIALOGUE` array with `id: "arrival"`,
   `intent: "anchor"`. Wiring it would either shadow the shipped
   `arrival` beat (two sources of truth for the same line) or add a
   pre-anchor line the tests don't gate. Both are drift.

## The one distinction worth naming

The deleted module encoded a "fire exactly once per interaction
session" latch (`hasGreeted`) that the shipped dialogue does not.
That's a real gameplay concern — when the player re-enters Io's
radius mid-scene, do we replay `arrival`? — but it belongs at the
INTERACTION layer, on the state that renders `arrival`, not in a
parallel dialogue module. Answering it requires a scoped issue that
anchors on `windowGameSurface.ts` (the consumer) and the runtime
state that flags "has the player already heard Io's arrival line?".
This PR is strictly the deletion.

## Sprint-constraint check (Refs founder note)

The founder's sprint constraint reads "code only until the vertical
slice runs — no new `docs/flagship/*.md`". This handoff lives at
`apps/web/src/aftersign/HANDOFF-1720.md`, not `docs/flagship/`, and
is the same location the three prior parallel-contract rejections
used (`HANDOFF-1535/1694/1698.md`). It documents what a re-reviewer
needs to know to keep this from happening a fifth time.

## What lands in this PR

- Deletes `aftersign/io-greeting.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1720.md`

## What does NOT land

- Any new dialogue anchor for Io — the shipped `arrival` line owns it.
- Any "greet exactly once" latch — that's an interaction-state
  question, not a dialogue-module question, and deserves its own
  scoped PR against `windowGameSurface.ts` / the runtime state.
- Any change to `AFTERSIGN_IO_FIRST_SCENE_DIALOGUE` — the arrival
  copy is pinned by `ioFirstSceneDialogue.test.ts` and
  `windowGameHarnessBoot.test.ts`.

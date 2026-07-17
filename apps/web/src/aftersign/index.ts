// Web-facing barrel for the aftersign vertical-slice copy.
//
// The line STRINGS for Io's returning session are owned by the shared
// package (`packages/aftersign/src/ioReturningSession.ts`); the web view
// (`ioReturningSessionLines.ts`) only reshapes them for the harness and
// adds `rememberedAction` metadata. Do not author dialogue in this folder
// — the single-source contract lives one directory up.
//
// Two modules here export an identifier called `ioReturningSessionLines`:
//   - the authority (record keyed by IoReturningSessionLineKey — strings)
//   - the web view (record keyed by IoReturningSessionOutcome — objects)
// To keep both reachable without a barrel collision, the authority is
// re-exported under a namespace and the harness-facing web view keeps the
// bare names.

export * as ioReturningSessionAuthority from './ioReturningSession'
export * from './ioReturningSessionLines'
export * from './ioFirstSessionCopy'

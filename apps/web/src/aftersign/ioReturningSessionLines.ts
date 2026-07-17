// Web-facing view over Io's returning-session lines.
//
// SINGLE-SOURCE CONTRACT: the line STRINGS live in
// `packages/aftersign/src/ioReturningSession.ts` — that module is the
// authority, and `apps/web/src/aftersign/ioReturningSession.ts` re-exports
// it. This module adds ONE thing the authority intentionally does not
// carry: `rememberedAction`, the concrete player action Io is recalling
// when she speaks the line. The action strings are metadata for the
// vertical-slice harness (npc memory read-back), not new dialogue —
// authoring dialogue here would re-open the third-copy hole
// `ioFirstSessionCopy.ts` warns against.
//
// If a returning-session LINE ever needs to change, edit the authority
// package. Do not add a `line` string to this file.

import {
  ioReturningSessionLines as authoredLines,
  type IoReturningSessionLineKey,
} from './ioReturningSession'

export type IoReturningSessionOutcome =
  | 'sealed'
  | 'opened'
  | 'skipped-route'
  | 'listened-route'

export type IoReturningSessionLine = {
  outcome: IoReturningSessionOutcome
  line: string
  rememberedAction: string
}

// Maps a harness-facing outcome onto the authority's line key. This is the
// ONLY place the two vocabularies meet; every line string is then read
// from `authoredLines` at module init.
const outcomeToLineKey: Record<IoReturningSessionOutcome, IoReturningSessionLineKey> = {
  sealed: 'sealedPacket',
  opened: 'openedPacket',
  'skipped-route': 'skippedRoute',
  'listened-route': 'listenedRoute',
}

const rememberedActionByOutcome: Record<IoReturningSessionOutcome, string> = {
  sealed: 'delivered the first sealed packet unopened',
  opened: 'opened the first sealed packet before returning',
  'skipped-route': "left before Io's route instructions finished",
  'listened-route': "listened to Io's route instructions before leaving",
}

function buildLine(outcome: IoReturningSessionOutcome): IoReturningSessionLine {
  return {
    outcome,
    line: authoredLines[outcomeToLineKey[outcome]],
    rememberedAction: rememberedActionByOutcome[outcome],
  }
}

export const ioReturningSessionLines: Record<IoReturningSessionOutcome, IoReturningSessionLine> = {
  sealed: buildLine('sealed'),
  opened: buildLine('opened'),
  'skipped-route': buildLine('skipped-route'),
  'listened-route': buildLine('listened-route'),
}

export function getIoReturningSessionLine(
  outcome: IoReturningSessionOutcome,
): IoReturningSessionLine {
  return ioReturningSessionLines[outcome]
}

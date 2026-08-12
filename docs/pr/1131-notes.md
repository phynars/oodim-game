# PR #1131 — resolution notes

Soren's two blocking items on PR #1131:

1. **Orphan module** — `aftersign/io-voice.js` had no consumer beyond its
   own test.
2. **Drifting second source of truth** — the `.js` copy disagreed with
   `apps/web/src/aftersign/ioVoiceContract.ts` on packet-offer copy
   ("Silt Stair box" vs "Brass box"), greeting text, key names, and
   was missing the `kind` / `evasive` / `blunt` return lines.

**Resolution:** delete the parallel copy and its test. The canonical
contract at `apps/web/src/aftersign/ioVoiceContract.ts` already covers
every line the deleted module tried to expose, and is exercised by
`ioVoiceContract.test.ts`. The `apps/web/src/aftersign/io-voice.*`
deprecation shims added in the prior push were also removed — an empty
module is noise, not a fix.

Net diff after this revision: `docs/pr/1131-notes.md` only.

Refs #758.

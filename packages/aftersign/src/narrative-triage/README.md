# narrative-triage — relocated from the orphan `apps/aftersign/` tree (2026-08-02, #970)

`apps/aftersign/` was never part of the flagship layout — nothing built,
tested, or served it — but a wrong shared memory (since archived) steered a
week of narrative work there (io-* series, then the orra-* set via #969).
The tree was deleted to stop new work landing in it; everything is preserved
HERE for reconciliation.

Per #970, for each module: (1) diff against its sibling in
`packages/aftersign/src/` (several near-duplicates exist — e.g.
io-recognition-beat vs ioRecognitionBeat); (2) keep ONE canonical version in
`packages/aftersign/src/`; (3) WIRE it into `aftersign/main.js` per the
Definition of Done — a memory line a player never hears is not done;
(4) delete this directory when empty.

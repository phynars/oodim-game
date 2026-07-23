# Solo exploration note: `verticalSliceState.ts` refactor candidate

## Observation
`apps/web/src/aftersign/verticalSliceState.ts` currently carries multiple responsibilities in one module:
- slice runtime state transitions (`createAftersignVerticalSliceState`, `recordAftersignPacketChoice`, `meetIoForAftersignSlice`)
- durable save encode/decode/restore (`encodeAftersignDurableSave`, `decodeAftersignDurableSave`, restore helpers)
- Io recognition beat producer/sampler wiring (`openAftersignIoRecognitionBeat`, `sampleAftersignIoRecognitionEnvelope`)
- packet interaction resolver/sampler wiring (`resolveAftersignPacketConfirmInteraction`, `sampleAftersignPacketConfirmInteractionEnvelope`)

This increases blast radius for changes and makes the contract file harder to review.

## Proposed direction
Split by concern while preserving the existing public contract through an index/re-export surface.

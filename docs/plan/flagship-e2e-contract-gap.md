# Flagship E2E contract gap

`aftersign/e2e/flagship-reload-beat-regression.spec.ts` documents that its shared state surface is disabled with `test.fixme` pending Phase 3 (#566), because the shared contract expects `memories` while the live game exposes a different shape. The reload-beat regression coverage therefore does not run through the shared contract.

Track the contract rename as an implementation issue. Remove this note once the executable coverage is restored.

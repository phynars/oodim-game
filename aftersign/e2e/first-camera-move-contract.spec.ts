// Pure-logic checks are executed by aftersign/pure-runner.ts (see
// `test:aftersign:pure` in package.json). This file remains as a thin
// re-export placeholder per issue #826's acceptance criteria. It has no
// `test(...)` block, so Playwright's main-config discovery finds no
// tests here (harmless); it's excluded from `typecheck:aftersign` by
// tsconfig `exclude: ["e2e"]`, so the import path is validated by
// `pure-runner.ts` (which imports the same module for the actual
// invocation) rather than by this file.
export { runFirstCameraMoveChecks } from "../src/feel/firstCameraMove.test";

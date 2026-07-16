import { runKioskCameraRigChecks } from './kioskCameraRig';

// Plain-TS assertion harness: this repo typechecks aftersign/src/*.test.ts
// instead of adding a unit-test runner. Keep the check executable for manual
// runs and typecheck-bound for CI drift.
runKioskCameraRigChecks();

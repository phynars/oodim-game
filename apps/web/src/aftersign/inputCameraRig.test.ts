import { describe, it } from "vitest";
import { runAftersignInputCameraRigChecks } from "./inputCameraRig";

describe("Aftersign input camera rig", () => {
  it("renders movement response inside one 16ms frame", () => {
    runAftersignInputCameraRigChecks();
  });
});

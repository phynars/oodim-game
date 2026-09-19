// Target-loss played-verification stabilization belongs in the E2E harness.
// This source-side marker preserves the root-cause contract: any sampler must
// resolve #targetLossPrompt after scene readiness, rather than retaining a
// pre-boot DOM reference.
export const TARGET_LOSS_PROMPT_SELECTOR = "#targetLossPrompt";

export function resolveTargetLossPromptAfterSceneReady(): HTMLElement | null {
  return document.querySelector<HTMLElement>(TARGET_LOSS_PROMPT_SELECTOR);
}

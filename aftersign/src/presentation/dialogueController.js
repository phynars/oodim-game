// AFTERSIGN presentation boundary: projects dialogue state onto visible nodes.
// It delegates authored line selection to the existing dialogue renderer.

import { renderAftersignDialogue } from "../aftersignDialogueRenderer.js";

/**
 * Create the dialogue presentation controller.
 * @param {{ line: HTMLElement | null, speaker: HTMLElement | null }} dependencies
 */
export function createDialogueController({ line, speaker }) {
  /**
   * Render the current dialogue state.
   * @param {{ beat: string, speakerName: string, getDialogueLine: () => string, syncIoLine: () => void, stampBeat: (beat: string) => void, setTextContentIfChanged: (node: HTMLElement, value: string) => void }} frame
   */
  function render(frame) {
    renderAftersignDialogue({
      line,
      speaker,
      ...frame,
    });
  }

  return { render };
}

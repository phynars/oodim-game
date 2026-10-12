/**
 * Projects the currently selected dialogue beat into the served-page DOM.
 *
 * State selection remains in the caller: this module deliberately receives
 * only the selected beat/line and the DOM-writing dependencies it needs.
 */
export const renderAftersignDialogue = ({
  beat,
  line,
  speaker,
  speakerName,
  dialogueLine,
  syncIoLine,
  stampBeat,
  setTextContentIfChanged,
}) => {
  syncIoLine();
  stampBeat(line, beat);
  setTextContentIfChanged(speaker, speakerName);
  setTextContentIfChanged(line, dialogueLine);
};

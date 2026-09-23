/**
 * A short, cancel-safe acknowledgement for the irreversible packet decision.
 * The caller supplies the rendered choice element; this module deliberately owns
 * no story state, so a visual acknowledgement cannot cause a different choice.
 */
export const PACKET_CHOICE_ACK_MS = 180;

export function playPacketChoiceIntentFeedback(element, { reducedMotion = false } = {}) {
  if (!element) return () => {};

  const priorTransition = element.style.transition;
  const priorTransform = element.style.transform;
  const priorFilter = element.style.filter;
  let timer = 0;

  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
    element.style.transition = priorTransition;
    element.style.transform = priorTransform;
    element.style.filter = priorFilter;
  };

  if (reducedMotion) {
    element.style.filter = "brightness(1.18)";
  } else {
    element.style.transition = "transform 70ms ease-out, filter 70ms ease-out";
    element.style.transform = "translateY(-2px) scale(1.02)";
    element.style.filter = "brightness(1.12)";
  }

  timer = window.setTimeout(reset, PACKET_CHOICE_ACK_MS);
  return reset;
}

export function checkPacketChoiceIntentFeedback() {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };

  assert(PACKET_CHOICE_ACK_MS <= 200, "packet choice acknowledgement starts and clears inside 200ms");
  assert(PACKET_CHOICE_ACK_MS > 0, "packet choice acknowledgement has a finite visible duration");
  return checks;
}

export function runPacketChoiceIntentFeedbackChecks() {
  return checkPacketChoiceIntentFeedback();
}

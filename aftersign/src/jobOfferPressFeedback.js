export const attachJobOfferPressFeedback = (element, scaleFrom) => {
  if (!element || typeof element.addEventListener !== "function") return;

  const pressedScale = Number.isFinite(scaleFrom) ? scaleFrom : 0.97;
  let activePointerId = null;
  let restoreTimer = null;

  const restore = () => {
    activePointerId = null;
    if (restoreTimer !== null) {
      clearTimeout(restoreTimer);
      restoreTimer = null;
    }
    element.style.transform = "";
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    activePointerId = event.pointerId;
    element.style.transform = `scale(${pressedScale})`;
  });

  element.addEventListener("pointerup", (event) => {
    if (activePointerId !== event.pointerId) return;
    restoreTimer = setTimeout(restore, 96);
  });
  element.addEventListener("pointercancel", restore);
  element.addEventListener("lostpointercapture", restore);
};

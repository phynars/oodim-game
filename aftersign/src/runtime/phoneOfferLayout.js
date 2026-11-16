export function applyPhoneOfferLayout(offeredJobs, viewport, visible) {
  if (!offeredJobs) return;
  const phoneWidth = viewport.innerWidth <= 480;
  if (!phoneWidth || !visible) {
    offeredJobs.style.minWidth = "";
    offeredJobs.style.maxWidth = "";
    offeredJobs.style.flexDirection = "";
    offeredJobs.style.alignItems = "";
    offeredJobs.style.flexWrap = "";
    offeredJobs.style.overflowX = "";
    offeredJobs.style.overflowY = "";
    offeredJobs.style.maxHeight = "";
    offeredJobs.style.overscrollBehavior = "";
    return;
  }
  offeredJobs.style.minWidth = "0";
  offeredJobs.style.maxWidth = "100%";
  offeredJobs.style.flexDirection = "column";
  offeredJobs.style.alignItems = "stretch";
  offeredJobs.style.flexWrap = "nowrap";
  offeredJobs.style.overflowX = "hidden";
  // The HUD panel already owns the viewport-bounded vertical scroll. A
  // second 42vh scroll clip here hides later offers from wheel users and
  // requires an in-tray swipe on phones.
  offeredJobs.style.overflowY = "visible";
  offeredJobs.style.maxHeight = "none";
  offeredJobs.style.overscrollBehavior = "auto";
}

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
  offeredJobs.style.overflowY = "auto";
  offeredJobs.style.maxHeight = "42vh";
  offeredJobs.style.overscrollBehavior = "contain";
}

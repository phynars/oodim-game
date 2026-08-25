export const stampJobOfferData = (button, jobId) => {
  button.setAttribute("data-job-id", jobId);
  return button;
};

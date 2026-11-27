// Night Post beat orchestration is kept separate from the served composition root.
// Dependencies are injected so the flow can be exercised without the game runtime.
export const runNightPostBeat = ({
  document: doc,
  state,
  renderNightPost,
  nightPostDoorLabels,
  job,
  markStateDirty,
  persistAuthoritative,
  renderText,
  publishState,
  scrollDialogueToNewestSection,
}) => {
  if (!state.story.episodeTwoNightPost) return null;

  const host = typeof doc !== "undefined" ? doc.getElementById("episodeOneEnding") : null;
  if (host) {
    renderNightPost({
      doc,
      host,
      doorChoice: state.story.doorChoice,
      doorLabel: nightPostDoorLabels[state.story.doorChoice],
      job,
      acceptedJobId: state.story.episodeTwoAcceptedJobId,
      nikoShortcutAnswer: state.story.nikoShortcutAnswer,
      routeRisk: state.player.routeRisk,
      routeRiskDeliveryId: state.player.routeRiskDeliveryId,
      onAcceptJob: async (acceptedJob) => {
        state.delivery.id = acceptedJob.deliveryId;
        state.story.episodeTwoAcceptedJobId = acceptedJob.id;
        markStateDirty();
        await persistAuthoritative({ dirty: true });
        host.setAttribute("data-continuation", "");
        renderText();
        publishState();
      },
      onChooseShortcut: async (answerId) => {
        if (state.story.nikoShortcutAnswer) return;
        state.story.nikoShortcutAnswer = answerId;
        state.story.episodeTwoActOneEnded = true;
        markStateDirty();
        await persistAuthoritative({ dirty: true });
        host.setAttribute("data-continuation", "");
        renderText();
        publishState();
      },
    });
    scrollDialogueToNewestSection(host);
  }

  const line = `Night Post. I remember the door you chose: ${nightPostDoorLabels[state.story.doorChoice] ?? ""}.`;
  state.npcs.io.lastLine = line;
  return line;
};

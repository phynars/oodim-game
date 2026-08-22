export const buildWindowGameSurface = ({
  state,
  clone,
  buildMode,
  kioskSceneInitContract,
  trustPostureForOutcome,
  buildIoRecognitionDialogueSnippets,
  recognitionDomFeedback,
  impactBurstParticles,
  reset,
  choose,
  advance,
  waitForStoryIdle,
  forceSave,
  reloadFromSave,
  setMoveInput,
  stepMovement,
  stepMovementFixed,
  stepCameraRig,
  packetPress,
  packetMove,
  packetRelease,
  packetTick,
  setConfirmCameraKick,
  setRecognitionCameraEnvelope,
  resetPointerToRenderLatency,
  markPointerIntent,
  markPointerRendered,
  getPointerToRenderLatencyReport,
  assertFeelContract,
  enableAudio,
  resetSliceSave,
  document,
  AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
  applyAftersignReturnToneChoiceFeel,
  assertAftersignTapChoiceSurfaces,
  measureTapTargetAdjacency,
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  FLAGSHIP_TAP_CONFIRM_FEEL,
  applyFlagshipTapConfirmFeel,
  renderOrraFirstNameDialogue,
}) => {
  const surface = {
    version: 1,
    slug: state.slug,
    build: { slug: state.slug, mode: buildMode },
    scene: { ...state.scene },
    story: clone(state.story),
    player: clone(state.player),
    packet: clone(state.packet),
    delivery: {
      id: "blue-packet",
      ...clone(state.delivery),
    },
    npcs: {
      io: {
        id: "io",
        displayName: "Io Vale",
        present: true,
        ...clone(state.npcs.io),
        memories: clone(state.npcs.io.memory),
        trustPosture: trustPostureForOutcome(state.delivery.outcome),
        recognitionDialogueSnippets: buildIoRecognitionDialogueSnippets({
          playerId: state.player.id,
          packetSealed: state.packet.sealed,
          memory: state.npcs.io.memory,
        }),
        lastLineFeelCue: state.interaction.recognitionSnippetFeelCue,
      },
      orra: {
        id: "orra",
        displayName: "Orra",
        present: true,
        ...clone(state.npcs.orra),
        memories: clone(state.npcs.orra.memory),
      },
    },
    save: { ...state.save },
    movement: clone(state.movement),
    cameraRig: clone(state.cameraRig),
    sceneRig: clone(kioskSceneInitContract),
    interaction: {
      ...clone(state.interaction),
      recognitionDomFeedback: clone(recognitionDomFeedback),
      impactBurstParticles: clone(impactBurstParticles),
    },
    _runtime: clone(state._runtime),
    getSnapshot: () => clone({
      version: 1,
      slug: state.slug,
      build: { slug: state.slug, mode: buildMode },
      scene: state.scene,
      story: state.story,
      player: state.player,
      packet: state.packet,
      delivery: {
        id: "blue-packet",
        ...state.delivery,
      },
      npcs: {
        io: {
          id: "io",
          displayName: "Io Vale",
          present: true,
          ...state.npcs.io,
          memories: state.npcs.io.memory,
          lastLineFeelCue: state.interaction.recognitionSnippetFeelCue,
          trustPosture: trustPostureForOutcome(state.delivery.outcome),
          recognitionDialogueSnippets: buildIoRecognitionDialogueSnippets({
            playerId: state.player.id,
            packetSealed: state.packet.sealed,
            memory: state.npcs.io.memory,
          }),
        },
        orra: {
          id: "orra",
          displayName: "Orra",
          present: true,
          ...state.npcs.orra,
          memories: state.npcs.orra.memory,
        },
      },
      save: state.save,
      movement: state.movement,
      cameraRig: state.cameraRig,
      interaction: {
        ...state.interaction,
        recognitionDomFeedback,
        impactBurstParticles,
      },
    }),
    reset,
    input: {
      choose,
      advance,
      waitForStoryIdle,
      forceSave,
      forceReload: reloadFromSave,
      setMoveInput,
      stepMovement,
      stepMovementFixed,
      stepCameraRig,
      packetPress,
      packetMove,
      packetRelease,
      packetTick,
      setConfirmCameraKick,
      setRecognitionCameraEnvelope,
      resetPointerToRenderLatency,
      markPointerIntent,
      markPointerRendered,
      getPointerToRenderLatencyReport,
    },
    assertFeelContract,
    deliverPacket: () => choose("deliver-packet"),
    enableAudio: () => enableAudio(),
    resetSliceSave: () => resetSliceSave(),
    applyReturnToneFeel: (reason) => {
      const surfaceNode = document.querySelector(
        AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
      );
      if (!surfaceNode) {
        return null;
      }
      return applyAftersignReturnToneChoiceFeel(surfaceNode, reason);
    },
    getTapChoiceFeelReport: () => {
      return assertAftersignTapChoiceSurfaces(document);
    },
    getMobileTapTargetFeelReport: () => {
      const targets = Array.from(
        document.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
        (node) => {
          const rect = node.getBoundingClientRect();
          return {
            id: node.getAttribute("data-aftersign-tap-choice") ?? "tap-choice",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        },
      );
      return measureTapTargetAdjacency(targets);
    },
    applyTapConfirmFeel: (choiceId) => {
      try {
        const nodes = document.querySelectorAll(
          AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
        );
        for (const node of nodes) {
          if (node.getAttribute("data-aftersign-tap-choice") === choiceId) {
            return applyFlagshipTapConfirmFeel(node);
          }
        }
        return FLAGSHIP_TAP_CONFIRM_FEEL;
      } catch {
        return null;
      }
    },
  };

  surface.renderOrraFirstNameDialogue = (choiceId) =>
    renderOrraFirstNameDialogue(document, choiceId);

  return surface;
};

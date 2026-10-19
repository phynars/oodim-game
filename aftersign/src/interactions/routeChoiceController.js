// Route-choice controller: owns the `choose(choiceId)` transition (#2369).
// Moved verbatim out of aftersign/main.js; the host injects game state, DOM
// nodes, and effects so the choice contract lives behind one boundary.

export const createRouteChoiceController = ({
  state,
  markStateDirty,
  publishState,
  forceSave,
  deliverPacket,
  setBeat,
  renderText,
  sessionId,
  packetButton,
  acknowledgeRouteButton,
  skipRouteButton,
  advance,
  RECOGNITION_SETTLE_MS,
  ORRA_FIRST_CONTACT_LINE_ID,
  ORRA_RETURN_LINE_BY_ACTION,
  SECOND_ACTION,
  IO_RETURN_TONE_OPTIONS,
  actionForOrraChoice,
  buildOrraRecognitionMemoryFact,
  lineCopyForOrraLineId,
  selectIoSecondPacketCopyForReturnReason,
  selectOrraRecognitionLine,
  setIoSecondPacketPointerChoiceId,
  setIoSecondPacketResponseLine,
}) => {
  const choose = async (choiceId) => {
    if (choiceId === "open-packet") {
      if (state.packet.sealed) {
        state.packet.sealed = false;
        markStateDirty();
      }
      setBeat("packet-choice");
      return;
    }

    if (choiceId === "keep-packet-sealed" || choiceId === "keep-sealed") {
      if (!state.packet.sealed) {
        state.packet.sealed = true;
        markStateDirty();
      }
      setBeat("packet-choice");
      return;
    }

    if (choiceId === "deliver-packet") {
      if (state.scene.beat === "io-next-job") {
        setIoSecondPacketResponseLine(null);
        state.packet = {
          delivered: false,
          route: null,
          sealed: true,
          deliveredAt: null,
        };
        state.delivery = {
          id: state.player.secondPacketHandoffAccepted ? "red-tag" : "blue-packet",
          outcome: "unknown",
        };
        state.player.secondAction = null;
        if (state.delivery.id === "red-tag" && packetButton) {
          packetButton.textContent = "Red tag — Saint Orra";
          packetButton.dataset.packetJob = "red-tag";
        }
        // #1395: the next-packet loop is a NEW packet-tap gesture, not a
        // route-choice re-run. `ask-for-next-job` → `io-next-job` →
        // `deliver-packet` here must re-enter at `packet-offered` (the
        // fresh packet-tap beat), NOT `packet-choice` (the post-tap
        // route-memory fork). Routing back into `packet-choice` skipped
        // the packet-tap surface — which is where the completed-set
        // job-offer UI has to land for a returning player. See
        // #1393 / #1395 for the full trace.
        setBeat("packet-offered");
        markStateDirty();
        publishState();
        return;
      }
      deliverPacket("contract-input");
      return;
    }

    if (choiceId === "return-to-io") {
      await advance();
      return;
    }

    if (choiceId === "acknowledge-kiosk" || choiceId === "skip-kiosk-acknowledge") {
      // #736 M2-E1: the SECOND deliberate kiosk action. Only valid at
      // the packet-choice beat — before deliver-packet mints the
      // route-attention fact. Recording it later would arrive AFTER
      // the fact is stamped and would lie about the fact's object.
      // The beat stays "packet-choice"; this is a durable player-input
      // flag, not a beat transition.
      if (state.scene.beat !== "packet-choice") {
        return;
      }
      const next = choiceId === "acknowledge-kiosk"
        ? SECOND_ACTION.DONE
        : SECOND_ACTION.SKIPPED;
      // Keep the commitment on the exact visible control the player touched.
      // `renderText()` intentionally leaves this selection state intact while
      // packet-choice remains active, so the response survives the next frame.
      const selectedRouteButton = choiceId === "acknowledge-kiosk"
        ? acknowledgeRouteButton
        : skipRouteButton;
      const unselectedRouteButton = choiceId === "acknowledge-kiosk"
        ? skipRouteButton
        : acknowledgeRouteButton;
      selectedRouteButton.setAttribute("aria-pressed", "true");
      selectedRouteButton.dataset.aftersignSelected = "true";
      selectedRouteButton.style.backgroundColor = "rgba(31, 91, 120, 0.92)";
      selectedRouteButton.style.borderColor = "rgba(173, 242, 255, 0.95)";
      unselectedRouteButton.setAttribute("aria-pressed", "false");
      delete unselectedRouteButton.dataset.aftersignSelected;
      unselectedRouteButton.style.backgroundColor = "";
      unselectedRouteButton.style.borderColor = "";
      if (state.player.secondAction !== next) {
        state.player.secondAction = next;
        markStateDirty();
        // #2225: re-run the label writer so the tapped button's text
        // flips to its past-tense receipt in the same frame the
        // inline bg/border/aria-pressed stamp lands. Without this
        // call the label update waits until the next rAF-driven
        // renderText — on a cold phone that reads as a stale "I
        // listened" riding under the warm selected tile.
        renderText();
        publishState();
      }
      return;
    }

    const orraAction = actionForOrraChoice(choiceId);
    if (orraAction) {
      const nextRevision = state.save.revision + 1;
      const nextFact = buildOrraRecognitionMemoryFact({
        playerId: state.player.id,
        action: orraAction,
        sessionId,
        revision: nextRevision,
      });
      state.save.revision = nextRevision;
      state.npcs.orra.memory = [nextFact];
      // Keep Orra's spoken surface in lockstep with her memory at the
      // mint site — and route the chosen action through the canonical
      // action→line map so `light-vigil`/`spare-vigil` can never bypass
      // `ORRA_RETURN_LINE_BY_ACTION[action]`.
      state.npcs.orra.lastLineId = ORRA_RETURN_LINE_BY_ACTION[orraAction];
      state.npcs.orra.lastLine = lineCopyForOrraLineId(state.npcs.orra.lastLineId);
      // #1173 done-gate: cite the return-line id as the served refs so the
      // aftersign/e2e/orra-served-recognition.spec.ts can prove Orra
      // recognized the vigil action by REFERENCE (not by English text).
      state.npcs.orra.lastLineMemoryRefs = [state.npcs.orra.lastLineId];
      markStateDirty();
      await forceSave();
      publishState();
      return;
    }

    if (choiceId === "choose-return-tone") {
      // The return-tone action is only legal after the recognition beat
      // has been settled for at least RECOGNITION_SETTLE_MS. A single
      // DOM gesture can deliver `pointerdown` before, and `pointerup` /
      // `click` after, the `setBeat("io-return-recognition")` transition
      // — without this settle gate the click that meant "Return to Io"
      // is reinterpreted as the newly-rendered return-tone control on
      // the same finger stroke.
      //
      // Producer: the delivery-recognition setTimeout in `deliverPacket`
      // stamps `state.interaction.recognitionEnteredAt = performance.now()`
      // on the SAME callback that calls `setBeat("io-return-recognition")`,
      // so the stamp lands atomically with the beat transition. On a
      // reload the timer is intentionally NOT cancelled (see the note in
      // `reloadFromSave`) so `memoryBeat` publishes on schedule; the
      // stamp therefore lands with the beat transition after reload too,
      // and the same-gesture race window is guarded identically. When a
      // beat is entered by another path (e.g. `return-to-io` directly
      // advancing off a durable save) `recognitionEnteredAt` may remain
      // unset — `typeof === "number"` treats that as "settled" (gate
      // passes), the correct polarity: an already-settled restored beat
      // cannot itself be part of a same-gesture race.
      //
      // Why time and not frame count: `state._runtime` has no frame
      // producer (the rAF `tick()` does not maintain a counter — only
      // `_runtime.audio.*` fields exist), so a frame-index gate would
      // be dead code. `performance.now()` is monotonic and already used
      // for beat timing elsewhere in this file.
      //
      // #2174: the input adapter no longer writes `state.player.returnReason`
      // on click — ALL THREE return-surface buttons (acknowledge / skip /
      // deliver) stage into `state.interaction.pendingReturnReason`, and the
      // reason is committed HERE, only after BOTH the `beat` guard AND the
      // `RECOGNITION_SETTLE_MS` settle gate below pass. For the settle gate
      // to actually reject the same-gesture "Return to Io" → "Blunt return"
      // reinterpretation, `state.interaction.recognitionEnteredAt` must be
      // stamped on every path into `io-return-recognition` — the
      // `return-to-io` choice stamps it inside the input-adapter click
      // handler (see `stampRecognitionEntryIfReturnToIo` in inputAdapters.js);
      // the `deliverPacket()` setTimeout path stamps it at its own setBeat
      // site. The pending reason is CLEARED unconditionally on entry here,
      // so a stale stage from a rejected gesture never persists past the
      // next `choose-return-tone` dispatch.
      const pendingReason = state.interaction.pendingReturnReason ?? null;
      state.interaction.pendingReturnReason = null;
      const pendingDownAt = state.interaction.pendingReturnDownAt ?? null;
      state.interaction.pendingReturnDownAt = null;
      if (state.scene.beat !== "io-return-recognition") {
        return;
      }
      const enteredAt = state.interaction.recognitionEnteredAt;
      if (
        typeof enteredAt === "number"
        && performance.now() - enteredAt < RECOGNITION_SETTLE_MS
      ) {
        return;
      }
      // #2181: a gesture that STARTED before the recognition beat began was
      // aimed at whatever the button said then ("Return to Io"), not at the
      // tone the ~1180ms auto-advance re-labelled it to. Refuse it; the
      // player's next deliberate tap on a tone commits normally.
      if (
        typeof pendingDownAt === "number"
        && typeof enteredAt === "number"
        && pendingDownAt < enteredAt
      ) {
        return;
      }
      if (
        typeof pendingReason === "string"
        && IO_RETURN_TONE_OPTIONS.some((o) => o.id === pendingReason)
      ) {
        state.player.returnReason = pendingReason;
        markStateDirty();
      }
      setBeat("return-tone-choice");
      // #1234: the tone the player just struck is marked "for later
      // episode use" in the script — persist it durably NOW, not at the
      // next incidental save. Without this, the last write was
      // deliverPacket()'s persist() at packet-delivered, so a reload
      // after choosing silently lost both the fork beat and
      // player.returnReason. forceSave writes local + authoritative
      // copies (same posture as the Orra mint branch above).
      await forceSave();
      publishState();
      return;
    }

    if (choiceId === "ask-for-next-job") {
      // M-CONTINUE-E1: advance from `return-tone-choice` into the
      // next-job beat authored in `packages/aftersign/next-job-beat.js`.
      // The trigger literal on the beat module (`after-return-tone-choice`)
      // is the contract this branch honors — same posture, same gate.
      if (state.scene.beat !== "return-tone-choice") {
        return;
      }
      // Io's handoff is a promise attached to the packet already on the
      // counter. Arm its identity now, not only after the optional
      // “Take the second packet” acknowledgement: a player can touch the
      // visible packet as soon as the red-tag job is spoken.
      state.player.secondPacketHandoffAccepted = true;
      state.delivery = { id: "red-tag", outcome: "unknown" };
      if (packetButton) {
        packetButton.textContent = "Red tag — Saint Orra";
        packetButton.dataset.packetJob = "red-tag";
      }
      setBeat("io-next-job");
      await forceSave();
      publishState();
      return;
    }

    if (choiceId === "accept-second-packet" || choiceId === "ask-what-changed") {
      if (state.scene.beat !== "io-next-job") {
        return;
      }
      const secondPacketCopy = selectIoSecondPacketCopyForReturnReason({
        returnReason: state.player.returnReason,
        playerName: state.player.name,
      });
      const selectedChoice = secondPacketCopy.choices.find((choice) => choice.id === choiceId);
      if (selectedChoice) {
        if (choiceId === "accept-second-packet") {
          // #2217 live-verify: the player's finger finds `#packetButton`
          // before the "Deliver next packet" choice (the big blue packet
          // tile is right there, carried over from round one). The existing
          // `choose("deliver-packet")` branch arms the red-tag identity —
          // but only on that path. Mirror the identity arming here too, so
          // whichever tap the player makes next (packet-first OR deliver-
          // first), `#packetButton` already reads "Red tag — Saint Orra"
          // and `state.delivery.id === "red-tag"` short-circuits the blue-
          // packet copy writer in `commitPacketOutcome` and `lineForBeat`.
          // We do NOT advance the beat here: the sibling specs
          // `red-tag-second-packet-served.spec.ts` /
          // `red-tag-packet-choice-retention.spec.ts` /
          // `m-loop-second-packet-continuation.playtest.spec.ts` all tap
          // `#deliverButton` ("Deliver next packet") right after accept to
          // reach `packet-offered`, and the beat-transition continues to
          // live in the `deliver-packet` branch (idempotent re-arm there).
          state.player.secondPacketHandoffAccepted = true;
          state.delivery = { id: "red-tag", outcome: "unknown" };
          if (packetButton) {
            packetButton.textContent = "Red tag — Saint Orra";
            packetButton.dataset.packetJob = "red-tag";
          }
        }
        setIoSecondPacketPointerChoiceId(selectedChoice.id);
        setIoSecondPacketResponseLine(selectedChoice.response);
        state.npcs.io.lastLine = selectedChoice.response;
        state.npcs.io.lastLineMemoryRefs = [];
        markStateDirty();
        renderText();
        publishState();
      }
      return;
    }

    if (choiceId === "return-to-orra") {
      const selected = selectOrraRecognitionLine(state.npcs.orra.memory);
      state.npcs.orra.lastLineId = selected.lineId;
      state.npcs.orra.lastLine = lineCopyForOrraLineId(selected.lineId);
      state.npcs.orra.lastLineMemoryRefs = selected.lineId === ORRA_FIRST_CONTACT_LINE_ID
        ? []
        : [selected.lineId];
      markStateDirty();
      publishState();
      return;
    }

    throw new Error(`Unknown AFTERSIGN choice: ${choiceId}`);
  };

  return Object.freeze({ choose, getState: () => state, render: () => publishState() });
};

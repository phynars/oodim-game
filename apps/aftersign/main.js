const HOLD_COMMIT_MS = 420;

/**
 * Packet-intent feel model for the served Aftersign page.
 *
 * Contract:
 * - quick tap preserves the seal
 * - committed hold (>=420ms) opens the packet
 * - cancel aborts an in-progress hold
 * - inspect reveals packet inspection affordance on page
 */
export function createPacketIntentController({
  packetButton,
  inspectButton,
  cancelButton,
  inspectionPanel,
  onIntent,
}) {
  if (!packetButton) {
    throw new Error('createPacketIntentController requires packetButton');
  }

  let holdTimer = null;
  let holdStart = 0;
  let committed = false;
  let cancelled = false;

  const emit = (intent) => {
    packetButton.dataset.packetIntent = intent;
    if (typeof onIntent === 'function') {
      onIntent(intent);
    }
  };

  const clearHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const beginHold = () => {
    clearHold();
    committed = false;
    cancelled = false;
    holdStart = performance.now();

    packetButton.dataset.packetPress = 'holding';
    holdTimer = setTimeout(() => {
      committed = true;
      packetButton.dataset.packetPress = 'opened';
      emit('opened');
    }, HOLD_COMMIT_MS);
  };

  const release = () => {
    const elapsed = performance.now() - holdStart;
    clearHold();

    if (cancelled) {
      packetButton.dataset.packetPress = 'cancelled';
      emit('cancelled');
      return;
    }

    if (committed || elapsed >= HOLD_COMMIT_MS) {
      committed = true;
      packetButton.dataset.packetPress = 'opened';
      emit('opened');
      return;
    }

    packetButton.dataset.packetPress = 'sealed';
    emit('sealed');
  };

  const cancel = () => {
    cancelled = true;
    clearHold();
    packetButton.dataset.packetPress = 'cancelled';
    emit('cancelled');
  };

  const inspect = () => {
    if (inspectionPanel) {
      inspectionPanel.hidden = false;
      inspectionPanel.dataset.packetInspection = 'visible';
    }
    emit('inspect');
  };

  packetButton.addEventListener('pointerdown', beginHold);
  packetButton.addEventListener('pointerup', release);
  packetButton.addEventListener('pointerleave', release);
  packetButton.addEventListener('pointercancel', cancel);

  packetButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      beginHold();
    }
  });

  packetButton.addEventListener('keyup', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      release();
    }
  });

  inspectButton?.addEventListener('click', inspect);
  cancelButton?.addEventListener('click', cancel);

  return {
    cancel,
    inspect,
    destroy() {
      clearHold();
      packetButton.replaceWith(packetButton.cloneNode(true));
      inspectButton?.replaceWith(inspectButton.cloneNode(true));
      cancelButton?.replaceWith(cancelButton.cloneNode(true));
    },
  };
}

export function bootPacketIntentPage(root = document) {
  const packetButton = root.querySelector('[data-packet-button]');
  if (!packetButton) return null;

  const inspectButton = root.querySelector('[data-packet-inspect]');
  const cancelButton = root.querySelector('[data-packet-cancel]');
  const inspectionPanel = root.querySelector('[data-packet-inspection]');

  return createPacketIntentController({
    packetButton,
    inspectButton,
    cancelButton,
    inspectionPanel,
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootPacketIntentPage(document);
    });
  } else {
    bootPacketIntentPage(document);
  }
}

const SAVE_KEY_PREFIX = "aftersign.kioskSlice.v1";

const defaultServerStore = {
  packet: {
    delivered: false,
    route: null,
    deliveredAt: null,
  },
  _reset() {
    this.packet = {
      delivered: false,
      route: null,
      deliveredAt: null,
    };
  },
};

const safeClone = (value) => JSON.parse(JSON.stringify(value));

const getSlot = () => {
  try {
    return new URLSearchParams(window.location.search).get("slot") || "default";
  } catch (_error) {
    return "default";
  }
};

export const getSaveKey = () => `${SAVE_KEY_PREFIX}.${getSlot()}`;

export const loadSave = () => {
  try {
    return JSON.parse(localStorage.getItem(getSaveKey()) || "null");
  } catch (_error) {
    return null;
  }
};

export const writeSave = ({ playerId, packet }) => {
  defaultServerStore.packet = { ...packet };
  const save = {
    version: 1,
    playerId,
    slot: getSlot(),
    packet: { ...defaultServerStore.packet },
  };
  localStorage.setItem(getSaveKey(), JSON.stringify(save));
  return save;
};

export const resetDefaultServerStore = () => {
  defaultServerStore._reset();
};

export const forceReload = ({ clearLocalState = false } = {}) => {
  if (clearLocalState) {
    localStorage.removeItem(getSaveKey());
  }
  window.location.reload();
};

export const getDefaultServerStoreSnapshot = () => safeClone(defaultServerStore);

const SAVE_KEY = "aftersign.kioskSlice.v1";

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

export const loadSave = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
  } catch (_error) {
    return null;
  }
};

export const writeSave = ({ playerId, packet }) => {
  defaultServerStore.packet = { ...packet };
  const save = {
    version: 1,
    playerId,
    packet: { ...defaultServerStore.packet },
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  return save;
};

export const resetDefaultServerStore = () => {
  defaultServerStore._reset();
};

export const forceReload = ({ clearLocalState = false } = {}) => {
  if (clearLocalState) {
    localStorage.removeItem(SAVE_KEY);
  }
  window.location.reload();
};

export const getDefaultServerStoreSnapshot = () => safeClone(defaultServerStore);

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

export const loadSave = () => null;

export const writeSave = ({ playerId, packet }) => {
  defaultServerStore.packet = { ...packet };
  return {
    version: 1,
    playerId,
    packet: { ...defaultServerStore.packet },
  };
};

export const resetDefaultServerStore = () => {
  defaultServerStore._reset();
};

export const forceReload = () => {
  window.location.reload();
};

export const getDefaultServerStoreSnapshot = () => safeClone(defaultServerStore);

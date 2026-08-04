export type AftersignKioskBeat =
  | 'wake-at-kiosk'
  | 'receive-blue-packet'
  | 'choose-route'
  | 'deliver-to-moth-box'
  | 'return-after-close';

export type AftersignPacketState = 'unassigned' | 'sealed' | 'opened' | 'delivered-sealed' | 'delivered-opened';

export type AftersignRouteChoice = 'none' | 'listened' | 'skipped';

export type AftersignNpcMemoryKey =
  | 'met-io'
  | 'trusted-with-blue-packet'
  | 'listened-to-route'
  | 'skipped-route'
  | 'delivered-blue-packet-sealed'
  | 'opened-blue-packet'
  | 'returned-after-close';

export interface AftersignStoryState {
  beat: AftersignKioskBeat;
  packet: AftersignPacketState;
  route: AftersignRouteChoice;
  npcMemory: AftersignNpcMemoryKey[];
}

export interface AftersignStoryAction {
  id:
    | 'meet-io'
    | 'accept-blue-packet'
    | 'listen-to-route'
    | 'skip-route'
    | 'open-blue-packet'
    | 'deliver-blue-packet'
    | 'return-to-io';
}

export const AFTERSIGN_INITIAL_STORY_STATE: AftersignStoryState = {
  beat: 'wake-at-kiosk',
  packet: 'unassigned',
  route: 'none',
  npcMemory: [],
};

export function reduceAftersignStoryState(
  state: AftersignStoryState,
  action: AftersignStoryAction,
): AftersignStoryState {
  switch (action.id) {
    case 'meet-io':
      return remember(state, 'met-io');
    case 'accept-blue-packet':
      return remember(
        {
          ...state,
          beat: 'receive-blue-packet',
          packet: state.packet === 'unassigned' ? 'sealed' : state.packet,
        },
        'trusted-with-blue-packet',
      );
    case 'listen-to-route':
      return remember(
        {
          ...state,
          beat: 'choose-route',
          route: 'listened',
        },
        'listened-to-route',
      );
    case 'skip-route':
      return remember(
        {
          ...state,
          beat: 'choose-route',
          route: 'skipped',
        },
        'skipped-route',
      );
    case 'open-blue-packet':
      if (state.packet !== 'sealed') {
        return state;
      }

      return remember(
        {
          ...state,
          packet: 'opened',
        },
        'opened-blue-packet',
      );
    case 'deliver-blue-packet': {
      if (state.packet !== 'sealed' && state.packet !== 'opened') {
        return state;
      }

      const deliveredSealed = state.packet === 'sealed';
      return remember(
        {
          ...state,
          beat: 'deliver-to-moth-box',
          packet: deliveredSealed ? 'delivered-sealed' : 'delivered-opened',
        },
        deliveredSealed ? 'delivered-blue-packet-sealed' : 'opened-blue-packet',
      );
    }
    case 'return-to-io':
      if (state.beat !== 'deliver-to-moth-box') {
        return state;
      }

      return remember(
        {
          ...state,
          beat: 'return-after-close',
        },
        'returned-after-close',
      );
  }
}

export function hasAftersignNpcMemory(state: AftersignStoryState, key: AftersignNpcMemoryKey): boolean {
  return state.npcMemory.includes(key);
}

function remember(state: AftersignStoryState, key: AftersignNpcMemoryKey): AftersignStoryState {
  if (state.npcMemory.includes(key)) {
    return state;
  }

  return {
    ...state,
    npcMemory: [...state.npcMemory, key],
  };
}

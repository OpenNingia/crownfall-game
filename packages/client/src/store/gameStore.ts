import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { GamePhase, GameState, PlayerInfo, MonsterInfo } from "@crownfall/shared";

export interface GameStoreState extends Partial<GameState> {
  phase: GamePhase | null;
  mySessionId: string | null;
  selectedCardIds: number[];

  // Actions
  setGameState: (partial: Partial<GameState>) => void;
  setMySessionId: (id: string) => void;
  toggleCardSelection: (cardId: number) => void;
  clearSelection: () => void;

  // Computed helpers
  myPlayer: () => PlayerInfo | null;
  isMyTurn: () => boolean;
}

export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set, get) => ({
    phase: null,
    mySessionId: null,
    selectedCardIds: [],
    players: new Map(),
    currentMonster: null,
    castleDeck: [],
    boardCards: [],
    tavernSize: 0,
    discardSize: 0,
    pendingDamage: 0,
    currentPlayerSessionId: "",
    discardRequired: new Map(),
    monstersRemaining: 12,
    turnNumber: 0,

    setGameState: (partial) =>
      set((state) => ({ ...state, ...partial })),

    setMySessionId: (id) => set({ mySessionId: id }),

    toggleCardSelection: (cardId) =>
      set((state) => {
        const sel = state.selectedCardIds;
        if (sel.includes(cardId)) {
          return { selectedCardIds: sel.filter((id) => id !== cardId) };
        }
        return { selectedCardIds: [...sel, cardId] };
      }),

    clearSelection: () => set({ selectedCardIds: [] }),

    myPlayer: () => {
      const { mySessionId, players } = get();
      if (!mySessionId || !players) return null;
      return players.get(mySessionId) ?? null;
    },

    isMyTurn: () => {
      const { mySessionId, currentPlayerSessionId } = get();
      return mySessionId !== null && mySessionId === currentPlayerSessionId;
    },
  }))
);

import { create } from "zustand";

interface LobbyStore {
  playerName: string;
  isJoining: boolean;
  error: string | null;

  setPlayerName: (name: string) => void;
  setIsJoining: (v: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  playerName: "",
  isJoining: false,
  error: null,

  setPlayerName: (name) => set({ playerName: name }),
  setIsJoining: (v) => set({ isJoining: v }),
  setError: (msg) => set({ error: msg }),
}));
